/**
 * api/_lib/cors.js — Модуль безопасной валидации CORS для Serverless Functions.
 *
 * Блокирует использование функций приложения в качестве открытого анонимного прокси
 * со сторонних вредоносных сайтов, сохраняя поддержку локальной разработки и деплоев на Vercel.
 */

export function setCorsHeaders(req, res) {
  const origin = req.headers?.origin;
  const host = req.headers?.host;

  // Однодоменные запросы без Origin (прямые GET с собственного фронтенда)
  if (!origin) {
    return true;
  }

  // Разрешенные источники: локальная разработка (localhost / 127.0.0.1) и Vercel-домены
  const isAllowed =
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.endsWith('.vercel.app') ||
    (host && (origin === `https://${host}` || origin === `http://${host}`));

  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shikimori-Token');
    res.setHeader('Vary', 'Origin');
    return true;
  }

  return false;
}
