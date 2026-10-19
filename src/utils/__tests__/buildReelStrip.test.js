import { describe, it, expect } from 'vitest';
import { buildReelStrip } from '../buildReelStrip';

describe('buildReelStrip utility', () => {
  const animeList = [
    {
      id: 1,
      anime: {
        id: 1,
        name: 'Cowboy Bebop',
        russian: 'Ковбой Бибоп',
        image: { original: '/system/animes/original/1.jpg', preview: '/system/animes/preview/1.jpg' },
      },
    },
    {
      id: 2,
      anime: {
        id: 2,
        name: 'Steins;Gate',
        russian: 'Врата Штейна',
        image: { malLarge: 'https://cdn.myanimelist.net/2.jpg' },
      },
    },
  ];

  const winner = {
    id: 99,
    anime: {
      id: 99,
      name: 'Winner Anime',
      russian: 'Победитель',
      image: { original: '/system/animes/original/99.jpg' },
    },
  };

  it('generates a strip of length stripLength + 1 with winner at the very end', () => {
    const strip = buildReelStrip(winner, animeList, 10);
    expect(strip.length).toBe(11);
    expect(strip[10].id).toBe(99);
    expect(strip[10].titleRu).toBe('Победитель');
    expect(strip[10].imageUrl).toContain('shikimori.io/system/animes/original/99.jpg');
  });

  it('uses absolute URLs for MAL images without adding Shikimori domain', () => {
    const winnerMal = {
      id: 88,
      anime: {
        id: 88,
        name: 'MAL Winner',
        image: { malLarge: 'https://cdn.myanimelist.net/88.jpg' },
      },
    };

    const strip = buildReelStrip(winnerMal, animeList, 5);
    expect(strip[5].imageUrl).toBe('https://cdn.myanimelist.net/88.jpg');
  });

  it('correctly handles imageFallback resolution with Shikimori and MAL sources', () => {
    const list = [
      {
        id: 10,
        anime: {
          id: 10,
          name: 'Shiki Preview',
          image: { original: '/system/animes/original/10.jpg', preview: '/system/animes/preview/10.jpg' },
        },
      },
      {
        id: 20,
        anime: {
          id: 20,
          name: 'Shiki Missing Original',
          image: { original: '/missing/original.jpg', x96: '/system/animes/x96/20.jpg', malMedium: 'https://cdn.myanimelist.net/m20.jpg' },
        },
      },
      {
        id: 30,
        anime: {
          id: 30,
          name: 'MAL Fallback',
          image: { original: '/missing/original.jpg', preview: '/missing/preview.jpg', malMedium: 'https://cdn.myanimelist.net/m30.jpg' },
        },
      },
      {
        id: 40,
        anime: {
          id: 40,
          name: 'No Image',
          image: null,
        },
      },
    ];

    const strip = buildReelStrip(list[0], list, 4);

    // 10: имеет валидный preview
    const item10 = strip.find(x => x.id === 10);
    expect(item10.imageFallback).toContain('shikimori.io/system/animes/preview/10.jpg');

    // 20: original битый, но x96 валидный
    const item20 = strip.find(x => x.id === 20);
    expect(item20.imageFallback).toContain('shikimori.io/system/animes/x96/20.jpg');
    // Primary URL для 20 упал на malMedium/malLarge
    expect(item20.imageUrl).toBe('https://cdn.myanimelist.net/m20.jpg');

    // 30: Shikimori полностью битый -> fallback на malMedium
    const item30 = strip.find(x => x.id === 30);
    expect(item30.imageFallback).toBe('https://cdn.myanimelist.net/m30.jpg');

    // 40: image отсутствует -> оба URL null
    const item40 = strip.find(x => x.id === 40);
    expect(item40.imageUrl).toBeNull();
    expect(item40.imageFallback).toBeNull();
  });

  it('correctly falls back for titles when russian or name is missing', () => {
    const list = [
      {
        id: 1,
        anime: { id: 1, name: 'English Only', russian: null },
      },
      {
        id: 2,
        anime: { id: 2, name: '', russian: '' },
      },
      {
        id: 3,
        anime: null,
      },
    ];

    const strip = buildReelStrip(list[0], list, 3);

    // Russian отсутствует -> titleRu берет name
    const item1 = strip.find(x => x.id === 1);
    expect(item1.titleRu).toBe('English Only');
    expect(item1.titleEn).toBe('English Only');

    // Обоих названий нет -> fallback на '???'
    const item2 = strip.find(x => x.id === 2);
    expect(item2.titleRu).toBe('???');
    expect(item2.titleEn).toBe('???');

    const item3 = strip.find(x => x.id === 3);
    expect(item3.titleRu).toBe('???');
    expect(item3.titleEn).toBe('???');
  });

  it('performs non-deterministic Fisher-Yates shuffling across strip elements', () => {
    const list = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, anime: { id: i + 1, name: `Anime ${i + 1}` } }));
    const winnerItem = { id: 999, anime: { id: 999, name: 'Winner' } };

    // Проверяем, что в последовательности 15 элементов в ленте порядок меняется
    const sequences = new Set();
    for (let run = 0; run < 10; run++) {
      const strip = buildReelStrip(winnerItem, list, 15);
      const order = strip.slice(0, 15).map(x => x.id).join(',');
      sequences.add(order);
    }
    // За 10 запусков тасование Фишера-Йетса должно дать более 1 уникальной перестановки
    expect(sequences.size).toBeGreaterThan(1);
  });
});
