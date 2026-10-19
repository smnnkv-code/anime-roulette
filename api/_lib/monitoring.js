/**
 * api/_lib/monitoring.js — Интеграция Sentry для Vercel Serverless Functions (@sentry/node).
 *
 * Обеспечивает:
 * 1. Инициализацию Sentry с разделением dev/preview/prod.
 * 2. Обязательную санитизацию перед отправкой (beforeSend/beforeBreadcrumb).
 * 3. Асинхронный Sentry.flush(2000) для гарантии доставки событий до заморозки контейнера Vercel.
 */

import * as Sentry from '@sentry/node';
import { sanitizeEvent, sanitizeBreadcrumb } from '../../src/utils/sanitizer.js';

let _initialized = false;

export function initServerMonitoring() {
  if (_initialized) return;

  const dsn = process.env.SENTRY_DSN;
  const isTest = process.env.NODE_ENV === 'test';
  const env = process.env.VERCEL_ENV || process.env.NODE_ENV || 'development';
  const release = process.env.VERCEL_GIT_COMMIT_SHA || '0.0.0';

  if (!dsn || isTest) {
    // В тестовом окружении или при отсутствии DSN SDK отключен
    _initialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment: env,
    release,
    sampleRate: 1.0,
    tracesSampleRate: env === 'production' ? 0.05 : 0.0,
    sendDefaultPii: false,
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
  });

  _initialized = true;
}

/**
 * Захватывает серверную ошибку и сбрасывает буфер перед ответом клиенту
 */
export async function captureServerError(error, req = null, extraContext = {}) {
  // Гарантируем инициализацию при первом вызове
  initServerMonitoring();

  if (!process.env.SENTRY_DSN || process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    Sentry.withScope((scope) => {
      if (req) {
        scope.setTag('http.method', req.method || 'GET');
        scope.setContext('runtime_request', {
          url: req.url,
          query: req.query,
        });
      }

      for (const [key, val] of Object.entries(extraContext)) {
        if (typeof val === 'string') {
          scope.setTag(key, val);
        } else {
          scope.setContext(key, val);
        }
      }

      Sentry.captureException(error);
    });

    // Serverless-функции Vercel замораживаются сразу после res.end()
    // flush() необходим для завершения HTTP-запроса к Sentry
    await Sentry.flush(2000);
  } catch (err) {
    console.error('[monitoring] Failed to report error to Sentry:', err.message);
  }
}
