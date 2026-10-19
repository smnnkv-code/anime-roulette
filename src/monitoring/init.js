/**
 * src/monitoring/init.js — Инициализация Sentry для клиентского приложения.
 */

import * as Sentry from '@sentry/react';
import { sanitizeEvent, sanitizeBreadcrumb } from '../utils/sanitizer.js';

let _initialized = false;

export function initClientMonitoring() {
  if (_initialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const isTest = import.meta.env.MODE === 'test';
  const isProd = import.meta.env.PROD;
  const env = import.meta.env.VITE_VERCEL_ENV || (isProd ? 'production' : 'development');
  const release = import.meta.env.VITE_APP_RELEASE || '0.0.0';

  if (!dsn || isTest) {
    _initialized = true;
    return;
  }

  Sentry.init({
    dsn,
    environment: env,
    release,
    sampleRate: 1.0,
    tracesSampleRate: isProd ? 0.05 : 0.0,
    replaysOnErrorSampleRate: isProd ? 0.1 : 0.0,
    replaysSessionSampleRate: 0.0,
    sendDefaultPii: false,
    beforeSend: sanitizeEvent,
    beforeBreadcrumb: sanitizeBreadcrumb,
  });

  _initialized = true;
}
