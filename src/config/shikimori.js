/**
 * shikimori.js — Централизованная конфигурация домена Shikimori.
 *
 * Позволяет управлять базовым доменом и зеркалами сервиса в одном месте,
 * а также переопределять его через переменную окружения VITE_SHIKIMORI_DOMAIN.
 */

export const SHIKIMORI_DOMAIN =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SHIKIMORI_DOMAIN) ||
  'https://shikimori.io';

export const SHIKIMORI_OAUTH_URL = `${SHIKIMORI_DOMAIN}/oauth/applications`;

/**
 * Преобразует относительный путь постера или ресурса в абсолютный URL.
 * Если передан уже абсолютный URL, возвращает его без изменений.
 *
 * @param {string|null|undefined} path
 * @returns {string|null}
 */
export function getShikimoriUrl(path) {
  if (!path || typeof path !== 'string') return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${SHIKIMORI_DOMAIN}${cleanPath}`;
}
