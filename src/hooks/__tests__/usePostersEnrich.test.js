import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { usePostersEnrich } from '../usePostersEnrich';

function renderHook(hookFn) {
  let hookResult;
  function Harness() {
    hookResult = hookFn();
    return null;
  }
  renderToString(React.createElement(Harness));
  return hookResult;
}

describe('Кейс 13: Логика фонового обогащения постеров usePostersEnrich', () => {
  let localStore = {};

  beforeEach(() => {
    localStore = {};
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => localStore[k] ?? null),
      setItem: vi.fn((k, v) => { localStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete localStore[k]; }),
      clear: vi.fn(() => { localStore = {}; }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('мгновенно применяет сохраненные постеры из localStorage к списку', async () => {
    localStore['poster_mal_501'] = 'https://cdn.myanimelist.net/cached_501.jpg';

    const inputList = [
      {
        id: 1,
        anime: {
          id: 1,
          mal_id: 501,
          image: { original: '/missing/original.jpg', malLarge: null },
        },
      },
      {
        id: 2,
        anime: {
          id: 2,
          mal_id: 502,
          image: { original: 'https://shikimori.io/good_poster.jpg' }, // Уже валидный постер
        },
      },
    ];

    const updates = [];
    const { enrichList } = renderHook(() => usePostersEnrich());

    // Запускаем обогащение (fetch не должен вызываться для 501, так как он в кэше)
    vi.stubGlobal('fetch', vi.fn());

    await enrichList(inputList, (updated) => updates.push(updated));

    // Проверяем мгновенное применение кэша
    expect(updates.length).toBeGreaterThanOrEqual(1);
    const enriched = updates[0];
    expect(enriched[0].anime.image.malLarge).toBe('https://cdn.myanimelist.net/cached_501.jpg');
    // Элемент 2 с хорошим постером остался нетронутым
    expect(enriched[1].anime.image.original).toBe('https://shikimori.io/good_poster.jpg');
  });

  it('прерывает цикл запросов при вызове abort()', async () => {
    // 30 элементов без постеров (2 батча: 25 + 5)
    const list = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      anime: {
        id: i + 1,
        mal_id: 1000 + i,
        image: { original: null, preview: null, x96: null },
      },
    }));

    const { enrichList, abort } = renderHook(() => usePostersEnrich());

    let fetchCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      fetchCount++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ poster: 'https://cdn.myanimelist.net/poster.jpg' }),
      });
    }));

    // Запускаем и сразу прерываем
    const enrichPromise = enrichList(list, () => {});
    abort();
    await enrichPromise;

    // После abort() запросы второго батча не должны выполняться
    expect(fetchCount).toBeLessThanOrEqual(25);
  });
});
