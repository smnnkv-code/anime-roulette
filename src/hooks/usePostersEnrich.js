/**
 * usePostersEnrich.js
 *
 * Фоновое обогащение списка аниме MAL-постерами.
 * Запускается после загрузки Shikimori-списка.
 *
 * Алгоритм:
 *  1. Мгновенно применяем кеш из localStorage (poster_mal_{id})
 *  2. Находим тайтлы с битыми/отсутствующими Shikimori-постерами
 *  3. Запрашиваем /api/mal-poster пакетами по BATCH_SIZE штук
 *  4. Между пакетами — пауза BATCH_DELAY_MS (укладываемся в MAL 60/min)
 *  5. После каждого пакета вызываем onUpdate → список обновляется на лету
 *
 * Vercel Edge Cache на /api/mal-poster (24ч) гарантирует что MAL API
 * дёргается только при первом запросе уникального mal_id.
 * Все последующие пользователи получают ответ из кеша Vercel мгновенно.
 */

import { useCallback, useRef } from 'react';

const CACHE_PREFIX  = 'poster_mal_';
const BATCH_SIZE    = 25;
const BATCH_DELAY   = 1100;  // > 1s → ≤ 60 батч-запросов в минуту к MAL

// ── Хелперы localStorage ──────────────────────────────────────────────────

function readCache(malId) {
  try {
    return localStorage.getItem(`${CACHE_PREFIX}${malId}`) || null;
  } catch {
    return null;
  }
}

function writeCache(malId, url) {
  try {
    if (url) localStorage.setItem(`${CACHE_PREFIX}${malId}`, url);
  } catch {
    /* localStorage недоступен — молча пропускаем */
  }
}

// ── Определяем нужна ли замена постера ───────────────────────────────────

function isPlaceholder(path) {
  if (!path || typeof path !== 'string') return true;
  return /missing/i.test(path);
}

function needsEnrichment(item) {
  const img   = item.anime?.image;
  const malId = item.anime?.mal_id;

  if (!img || !malId) return false;

  // Уже есть MAL-постер — не трогаем
  if (img.malLarge || img.malMedium) return false;

  // Shikimori-постер нормальный — не трогаем
  const hasGoodShiki = [img.original, img.preview, img.x96]
    .some(p => p && !isPlaceholder(p));

  return !hasGoodShiki;
}

// ── Применяем URL к элементу списка (иммутабельно) ───────────────────────

function applyPoster(item, url) {
  return {
    ...item,
    anime: {
      ...item.anime,
      image: {
        ...item.anime.image,
        malLarge:  url,
        malMedium: url,
      },
    },
  };
}

// ── Основной хук ──────────────────────────────────────────────────────────

export function usePostersEnrich() {
  const abortRef = useRef(false);

  /**
   * enrichList — запускает фоновое обогащение.
   *
   * @param {Array}    animeList  — исходный список (от Shikimori)
   * @param {Function} onUpdate   — (newList) => void, вызывается после каждого батча
   */
  const enrichList = useCallback(async (animeList, onUpdate) => {
    abortRef.current = false;

    // ── Шаг 1: мгновенно применяем кеш localStorage ──────────────────
    let workingList = animeList.map(item => {
      const malId = item.anime?.mal_id;
      if (!malId) return item;
      const cached = readCache(malId);
      return cached ? applyPoster(item, cached) : item;
    });

    // Если кеш что-то дал — обновляем список сразу
    const cachedCount = workingList.filter(
      (item, i) => item !== animeList[i]
    ).length;

    if (cachedCount > 0) {
      onUpdate(workingList);
    }

    // ── Шаг 2: собираем тайтлы без постеров ──────────────────────────
    const queue = workingList.filter(needsEnrichment);

    if (queue.length === 0) return;

    console.info(`[PostersEnrich] Нужно подгрузить ${queue.length} постеров из MAL`);

    // ── Шаг 3: пакетные запросы ──────────────────────────────────────
    for (let batchStart = 0; batchStart < queue.length; batchStart += BATCH_SIZE) {
      if (abortRef.current) {
        console.info('[PostersEnrich] Прерван');
        break;
      }

      const batch = queue.slice(batchStart, batchStart + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async item => {
          const malId = item.anime.mal_id;
          const res   = await fetch(`/api/mal-poster?mal_id=${malId}`);
          if (!res.ok) return null;
          const data  = await res.json();
          return { malId, url: data.poster || null };
        })
      );

      // Применяем результаты к рабочему списку
      let batchChanged = false;
      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value?.url) continue;
        const { malId, url } = result.value;
        writeCache(malId, url);

        const idx = workingList.findIndex(x => x.anime?.mal_id === malId);
        if (idx !== -1) {
          workingList = [
            ...workingList.slice(0, idx),
            applyPoster(workingList[idx], url),
            ...workingList.slice(idx + 1),
          ];
          batchChanged = true;
        }
      }

      if (batchChanged) {
        onUpdate(workingList);
      }

      const loaded = Math.min(batchStart + BATCH_SIZE, queue.length);
      console.info(`[PostersEnrich] ${loaded}/${queue.length} постеров загружено`);

      // Пауза между пакетами — чтобы не превысить rate limit MAL
      const hasMore = batchStart + BATCH_SIZE < queue.length;
      if (hasMore && !abortRef.current) {
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    }

    console.info('[PostersEnrich] Завершено');
  }, []);

  /** abort — прерывает текущее обогащение (например при смене аккаунта) */
  const abort = useCallback(() => {
    abortRef.current = true;
  }, []);

  return { enrichList, abort };
}
