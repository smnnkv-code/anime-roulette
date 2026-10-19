import { describe, it, expect } from 'vitest';
import {
  scrubUrl,
  scrubHeaders,
  scrubText,
  sanitizeEvent,
  sanitizeBreadcrumb,
  computeFingerprint,
} from '../sanitizer.js';

describe('Sanitizer: очистка чувствительных данных (PII & Secrets)', () => {
  it('маскирует токен в query-параметрах URL', () => {
    const rawUrl = 'https://kodik-api.com/search?token=secret1234567890&shikimori_id=123&limit=100';
    const cleaned = scrubUrl(rawUrl);
    expect(cleaned).toBe('https://kodik-api.com/search?token=[REDACTED]&shikimori_id=123&limit=100');
    expect(cleaned).not.toContain('secret1234567890');
  });

  it('маскирует x-shikimori-token в URL', () => {
    const rawUrl = 'https://example.com/api?x-shikimori-token=my-shiki-token-999&user=john';
    const cleaned = scrubUrl(rawUrl);
    expect(cleaned).toBe('https://example.com/api?x-shikimori-token=[REDACTED]&user=john');
  });

  it('вычищает заголовки авторизации и cookie', () => {
    const headers = {
      'content-type': 'application/json',
      'authorization': 'Bearer user-secret-jwt-token-12345',
      'X-Shikimori-Token': 'shiki-secret-token-abcde',
      'x-mal-client-id': 'mal-client-id-xyz987',
      'Cookie': 'session=abc; secret=123',
      'user-agent': 'Mozilla/5.0',
    };

    const sanitized = scrubHeaders(headers);
    expect(sanitized['content-type']).toBe('application/json');
    expect(sanitized['user-agent']).toBe('Mozilla/5.0');
    expect(sanitized['authorization']).toBe('[REDACTED]');
    expect(sanitized['X-Shikimori-Token']).toBe('[REDACTED]');
    expect(sanitized['x-mal-client-id']).toBe('[REDACTED]');
    expect(sanitized['Cookie']).toBe('[REDACTED]');
  });

  it('маскирует Bearer токены и query-токены в тексте сообщений', () => {
    const msg = 'Failed request with Bearer abcdef123456 to https://api.com?token=supersecretkey';
    const cleaned = scrubText(msg);
    expect(cleaned).toBe('Failed request with Bearer [REDACTED] to https://api.com?token=[REDACTED]');
    expect(cleaned).not.toContain('abcdef123456');
    expect(cleaned).not.toContain('supersecretkey');
  });

  it('полная санитизация события Sentry в beforeSend', () => {
    const mockEvent = {
      message: 'Crash while calling https://kodik-api.com/search?token=secretKodikToken999',
      request: {
        url: 'https://kodik-api.com/search?token=secretKodikToken999&limit=10',
        headers: {
          'authorization': 'Bearer secret-bearer-123',
          'x-shikimori-token': 'token-shiki-456',
          'cookie': 'tracker=bad',
        },
      },
      user: {
        id: '12345',
        ip_address: '192.168.1.1',
        username: 'real_username_ivan',
      },
      breadcrumbs: [
        {
          category: 'fetch',
          data: { url: 'https://kodik-api.com/search?token=breadcrumbSecret' },
        },
        {
          category: 'log',
          message: 'User logged in with Bearer secret-in-log',
        },
      ],
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Failed with Bearer crash-secret-token',
          },
        ],
      },
    };

    const result = sanitizeEvent(mockEvent);

    // 1. Headers & URLs
    expect(result.request.headers.authorization).toBe('[REDACTED]');
    expect(result.request.headers['x-shikimori-token']).toBe('[REDACTED]');
    expect(result.request.headers.cookie).toBe('[REDACTED]');
    expect(result.request.url).not.toContain('secretKodikToken999');
    expect(result.request.url).toContain('token=[REDACTED]');

    // 2. User & PII
    expect(result.user.ip_address).toBeUndefined();
    expect(result.user.username).toBeUndefined();
    expect(result.user.id).toBe('12345');

    // 3. Breadcrumbs
    expect(result.breadcrumbs[0].data.url).not.toContain('breadcrumbSecret');
    expect(result.breadcrumbs[0].data.url).toContain('token=[REDACTED]');
    expect(result.breadcrumbs[1].message).toBe('User logged in with Bearer [REDACTED]');

    // 4. Exception values & message
    expect(result.message).not.toContain('secretKodikToken999');
    expect(result.exception.values[0].value).toBe('Failed with Bearer [REDACTED]');
  });

  it('санитизирует breadcrumbs на лету и очищает значения полей ввода и кликов', () => {
    expect(sanitizeBreadcrumb(null)).toBeNull();

    const inputBreadcrumb = {
      category: 'ui.input',
      message: 'User entered token',
      data: {
        value: 'very-secret-password-input-123',
      },
    };

    const sanitizedInput = sanitizeBreadcrumb(inputBreadcrumb);
    expect(sanitizedInput.data.value).toBeUndefined();

    const clickBreadcrumb = {
      category: 'ui.click',
      message: 'User clicked button with token in secret log',
      data: {
        value: 'credit-card-number',
      },
    };
    const sanitizedClick = sanitizeBreadcrumb(clickBreadcrumb);
    expect(sanitizedClick.data.value).toBeUndefined();

    const fetchBreadcrumb = {
      category: 'fetch',
      data: {
        url: 'https://kodik-api.com/search?token=secret123',
      },
    };

    const sanitizedFetch = sanitizeBreadcrumb(fetchBreadcrumb);
    expect(sanitizedFetch.data.url).toBe('https://kodik-api.com/search?token=[REDACTED]');
  });

  it('обрабатывает пустые и невалидные входные данные в утилитах санитизации', () => {
    expect(sanitizeEvent(null)).toBeNull();

    // Пустой объект события не падает при отсутствии request, breadcrumbs, user, exception
    const emptyEvent = {};
    const sanitizedEmpty = sanitizeEvent(emptyEvent);
    expect(sanitizedEmpty).toEqual({});

    expect(scrubUrl(null)).toBeNull();
    expect(scrubUrl(123)).toBe(123);
    expect(scrubHeaders(null)).toBeNull();
    expect(scrubHeaders('not-an-object')).toBe('not-an-object');
    expect(scrubText(null)).toBeNull();
    expect(scrubText(123)).toBe(123);
  });

  it('устанавливает customFingerprint в событие через sanitizeEvent', () => {
    const event = { transaction: 'api/mal-list' };
    const hint = { originalException: { name: 'AbortError', message: 'aborted' } };
    const sanitized = sanitizeEvent(event, hint);
    expect(sanitized.fingerprint).toEqual(['timeout', 'api/mal-list']);
  });
});

describe('Sanitizer: Fingerprinting и группировка ошибок', () => {
  it('группирует сетевые таймауты (TimeoutError, AbortError, regex timed out, fallback transaction)', () => {
    const event1 = { transaction: 'api/get-episodes' };
    const hint1 = { originalException: { name: 'TimeoutError', message: 'The operation was aborted due to timeout' } };
    expect(computeFingerprint(event1, hint1)).toEqual(['timeout', 'api/get-episodes']);

    const event2 = {};
    const hint2 = { originalException: { name: 'AbortError', message: 'Operation aborted' } };
    expect(computeFingerprint(event2, hint2)).toEqual(['timeout', 'unknown-op']);

    const event3 = { transaction: 'api/kodik' };
    const hint3 = { originalException: { name: 'Error', message: 'Gateway timed out' } };
    expect(computeFingerprint(event3, hint3)).toEqual(['timeout', 'api/kodik']);
  });

  it('группирует ошибки парсинга Kodik', () => {
    const event = {};
    const hint = { originalException: { message: 'Серии не найдены в плеере Kodik' } };
    expect(computeFingerprint(event, hint)).toEqual(['kodik-parser-failure']);
  });

  it('группирует ошибки авторизации Kodik', () => {
    const event = {};
    const hint = { originalException: { message: 'Kodik API auth error: 401' } };
    expect(computeFingerprint(event, hint)).toEqual(['kodik-auth-invalid-token']);
  });

  it('группирует апстрим-ошибки MAL API по коду статуса (429, 500, 503)', () => {
    const event = {};
    expect(computeFingerprint(event, { originalException: { message: 'MAL API error: HTTP 429' } }))
      .toEqual(['mal-api-upstream', '429']);

    expect(computeFingerprint(event, { originalException: { message: 'MAL API error: HTTP 500' } }))
      .toEqual(['mal-api-upstream', '500']);

    expect(computeFingerprint(event, { originalException: { message: 'MAL API error: HTTP 503' } }))
      .toEqual(['mal-api-upstream', '503']);
  });

  it('группирует сбои React ErrorBoundary (tags.errorBoundary и tags.component с дефолтным именем)', () => {
    const event1 = { tags: { errorBoundary: 'true' } };
    const hint1 = { originalException: { name: 'ChunkLoadError' } };
    expect(computeFingerprint(event1, hint1)).toEqual(['react-error-boundary', 'ChunkLoadError']);

    const event2 = { tags: { component: 'RootErrorBoundary' } };
    const hint2 = { originalException: {} };
    expect(computeFingerprint(event2, hint2)).toEqual(['react-error-boundary', 'Error']);
  });
});
