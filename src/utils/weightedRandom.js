/**
 * weightedRandom.js
 * Взвешенный рандом — Вариант A: явный выбор корзины.
 *
 * Корзины:
 *  - «Олдскул»  (первые 20): 40%
 *  - «Свежак»   (последние 20): 40%
 *  - «Середина» (всё остальное): 20%
 *
 * Если список < 40 элементов — равномерный рандом по всему списку.
 */

/**
 * @param {Array} animeList — отсортированный массив user_rates (старые → новые)
 * @returns {Object} — один случайный элемент
 */
export function pickWeighted(animeList) {
  const N = animeList.length;

  if (N === 0) throw new Error('Список пуст');

  // Равномерный рандом для малых списков (при N <= 40 средняя корзина пуста)
  if (N <= 40) {
    return animeList[Math.floor(Math.random() * N)];
  }

  // Явный выбор корзины
  const roll = Math.random(); // [0, 1)

  let bucket;
  if (roll < 0.4) {
    // «Олдскул» — первые 20 (индексы 0..19)
    bucket = animeList.slice(0, 20);
  } else if (roll < 0.8) {
    // «Свежак» — последние 20
    bucket = animeList.slice(N - 20);
  } else {
    // «Середина бэклога»
    bucket = animeList.slice(20, N - 20);
  }

  if (!bucket || bucket.length === 0) {
    bucket = animeList;
  }

  return bucket[Math.floor(Math.random() * bucket.length)];
}

/**
 * Возвращает название корзины для отладки/отображения.
 * @param {Array} animeList
 * @param {Object} picked — элемент, выбранный pickWeighted
 * @returns {string}
 */
export function getBucketName(animeList, picked) {
  const N = animeList.length;
  if (N <= 40 || !picked) return 'Рандом';
  const idx = animeList.findIndex(a => a.id === picked.id);
  if (idx === -1) return 'Рандом';
  if (idx < 20) return '🕹️ Олдскул';
  if (idx >= N - 20) return '✨ Свежак';
  return '📚 Бэклог';
}
