/**
 * sanitizer.js — Модуль очистки (scrubbing) чувствительных данных и fingerprinting для Sentry.
 * Используется как на клиенте (@sentry/react), так и на сервере (@sentry/node).
 *
 * Приоритет №1: предотвращение утечки PII, токенов авторизации и API-ключей.
 */

export const SECRET_QUERY_REGEX = /([?&](token|x-shikimori-token)=)[^&]+/gi;
export const BEARER_REGEX = /Bearer\s+[a-zA-Z0-9._-]+/gi;
export const BLOCKED_HEADERS = [
  'authorization',
  'x-shikimori-token',
  'x-mal-client-id',
  'cookie',
  'set-cookie',
];

/**
 * Очищает URL от токенов и секретных query-параметров
 */
export function scrubUrl(url) {
  if (!url || typeof url !== 'string') return url;
  return url.replace(SECRET_QUERY_REGEX, '$1[REDACTED]');
}

/**
 * Очищает заголовки запроса от секретных ключей и cookies
 */
export function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const sanitized = { ...headers };
  for (const key of Object.keys(sanitized)) {
    if (BLOCKED_HEADERS.includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    }
  }
  return sanitized;
}

/**
 * Очищает текстовую строку от токенов, Bearer-заголовков и секретов
 */
export function scrubText(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(BEARER_REGEX, 'Bearer [REDACTED]')
    .replace(SECRET_QUERY_REGEX, '$1[REDACTED]');
}

/**
 * Вычисляет кастомный fingerprint для группировки ошибок согласно MONITORING-PLAN.md
 */
export function computeFingerprint(event, hint) {
  const error = hint?.originalException;
  const errorMsg = String(error?.message || event.message || '');
  const errorName = String(error?.name || '');

  // 1. Сетевые таймауты
  if (errorName === 'TimeoutError' || errorName === 'AbortError' || /timed out/i.test(errorMsg)) {
    const transaction = event.transaction || 'unknown-op';
    return ['timeout', transaction];
  }

  // 2. Ошибки парсинга Kodik Embed
  if (errorMsg.includes('Movie data not found') || errorMsg.includes('Серии не найдены в плеере Kodik')) {
    return ['kodik-parser-failure'];
  }

  // 3. Отказ авторизации Kodik API
  if (errorMsg.includes('Kodik API auth error')) {
    return ['kodik-auth-invalid-token'];
  }

  // 4. Сбои лимитов или доступности MAL API
  if (/MAL API error: HTTP (429|5\d\d)/.test(errorMsg)) {
    const match = errorMsg.match(/HTTP (429|5\d\d)/);
    return ['mal-api-upstream', match ? match[1] : '5xx'];
  }

  // 5. Ошибки ErrorBoundary в React
  if (event.tags?.errorBoundary === 'true' || event.tags?.component === 'RootErrorBoundary') {
    return ['react-error-boundary', errorName || 'Error'];
  }

  return undefined; // Дефолтная группировка Sentry
}

/**
 * Основной хук beforeSend: санитизация события перед отправкой в Sentry
 */
export function sanitizeEvent(event, hint) {
  if (!event) return null;

  // 1. Очистка HTTP-запроса (headers, url)
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = scrubHeaders(event.request.headers);
    }
    if (event.request.url) {
      event.request.url = scrubUrl(event.request.url);
    }
  }

  // 2. Очистка breadcrumbs
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (b.data?.url) {
        b.data.url = scrubUrl(b.data.url);
      }
      if (b.message) {
        b.message = scrubText(b.message);
      }
    }
  }

  // 3. Защита PII: удаление IP-адреса и очистка user
  if (event.user) {
    delete event.user.ip_address;
    // Никнеймы пользователей не должны передаваться в открытом виде
    if (event.user.username) {
      delete event.user.username;
    }
  }

  // 4. Очистка сообщений об ошибках и стектрейсов
  if (event.message) {
    event.message = scrubText(event.message);
  }

  if (Array.isArray(event.exception?.values)) {
    for (const val of event.exception.values) {
      if (val.value) {
        val.value = scrubText(val.value);
      }
    }
  }

  // 5. Кастомный fingerprinting
  const customFingerprint = computeFingerprint(event, hint);
  if (customFingerprint) {
    event.fingerprint = customFingerprint;
  }

  return event;
}

/**
 * Хук beforeBreadcrumb: фильтрация и очистка breadcrumbs на лету
 */
export function sanitizeBreadcrumb(breadcrumb) {
  if (!breadcrumb) return null;

  // Очистка HTTP breadcrumbs
  if (breadcrumb.data?.url) {
    breadcrumb.data.url = scrubUrl(breadcrumb.data.url);
  }

  // Очистка сообщений breadcrumbs
  if (breadcrumb.message) {
    breadcrumb.message = scrubText(breadcrumb.message);
  }

  // Защита от утечки паролей/токенов через клики и ввод
  if (breadcrumb.category === 'ui.input' || breadcrumb.category === 'ui.click') {
    if (breadcrumb.data) {
      delete breadcrumb.data.value;
    }
  }

  return breadcrumb;
}
