/**
 * buildReelStrip.js
 * Генерирует ленту из 35 случайных обложек + победитель в конце.
 * Поддерживает оба источника постеров: Shikimori и MAL.
 */

import { getShikimoriUrl } from '../config/shikimori';

/**
 * @param {Object} winner      — элемент user_rate (победитель)
 * @param {Array}  animeList   — полный список user_rates
 * @param {number} stripLength — длина ленты перед победителем (default: 35)
 * @returns {Array}            — массив объектов длиной stripLength + 1
 */
export function buildReelStrip(winner, animeList, stripLength = 35) {
  // Несмещённое тасование Фишера — Йетса
  const shuffled = [...animeList];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const strip = [];
  for (let i = 0; i < stripLength; i++) {
    strip.push(shuffled[i % shuffled.length]);
  }

  // Победитель последним
  strip.push(winner);

  return strip.map(item => ({
    id:            item.id,
    imageUrl:      getPrimaryUrl(item),
    imageFallback: getFallbackUrl(item),
    titleRu:       item.anime?.russian || item.anime?.name || '???',
    titleEn:       item.anime?.name    || '???',
  }));
}

/**
 * Основной URL постера:
 *   Shikimori original → MAL large (для MAL-источника)
 */
function getPrimaryUrl(item) {
  const img = item.anime?.image;
  if (!img) return null;

  // Shikimori пути (относительные)
  const shikiPath = img.original || img.preview || img.x96 || '';
  if (shikiPath && !/missing/i.test(shikiPath)) {
    return getShikimoriUrl(shikiPath);
  }

  // MAL пути (уже абсолютные)
  return img.malLarge || img.malMedium || null;
}

/**
 * Запасной URL постера:
 *   Shikimori preview → MAL medium
 */
function getFallbackUrl(item) {
  const img = item.anime?.image;
  if (!img) return null;

  const shikiPath = img.preview || img.x96 || img.x48 || '';
  if (shikiPath && !/missing/i.test(shikiPath)) {
    return getShikimoriUrl(shikiPath);
  }

  return img.malMedium || img.malLarge || null;
}
