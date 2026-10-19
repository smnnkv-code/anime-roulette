import { describe, it, expect } from 'vitest';
import { buildReelStrip } from '../buildReelStrip';
import { pickWeighted, getBucketName } from '../weightedRandom';

describe('Кейс 4: Инварианты ленты buildReelStrip', () => {
  it('соблюдает инвариант длины: stripLength + 1 для любых длин массивов', () => {
    const listSizes = [1, 2, 5, 10, 35, 50, 120];
    const testStripLengths = [10, 20, 35, 50];

    for (const size of listSizes) {
      const list = Array.from({ length: size }, (_, i) => ({
        id: i + 1,
        anime: {
          id: i + 1,
          russian: `Аниме ${i + 1}`,
          name: `Anime ${i + 1}`,
          image: { original: `/posters/${i + 1}.jpg` },
        },
      }));
      const winner = list[0];

      for (const stripLen of testStripLengths) {
        const strip = buildReelStrip(winner, list, stripLen);

        // Инвариант 1: Точная длина ленты
        expect(strip.length).toBe(stripLen + 1);

        // Инвариант 2: Победитель всегда строго последний
        const lastItem = strip[strip.length - 1];
        expect(lastItem.id).toBe(winner.id);
        expect(lastItem.titleRu).toBe(winner.anime.russian);

        // Инвариант 3: Полнота и целостность каждого элемента
        for (const item of strip) {
          expect(item.id).toBeDefined();
          expect(item.titleRu).toBeDefined();
          expect(item.titleEn).toBeDefined();
          expect(item.imageUrl).toMatch(/^https:\/\/shikimori\.io\/posters\/\d+\.jpg$/);
        }
      }
    }
  });

  it('корректно генерирует ленту при единственном элементе в списке', () => {
    const single = {
      id: 99,
      anime: {
        id: 99,
        russian: 'Соло тайтл',
        name: 'Solo Title',
        image: { malLarge: 'https://cdn.myanimelist.net/images/anime/99.jpg' },
      },
    };

    const strip = buildReelStrip(single, [single], 10);
    expect(strip.length).toBe(11);
    expect(strip[10].id).toBe(99);
    expect(strip[0].imageUrl).toBe('https://cdn.myanimelist.net/images/anime/99.jpg');
  });
});

describe('Кейс 5: Инварианты взвешенного выбора pickWeighted', () => {
  it('никогда не возвращает undefined/null для любого размера списка от 1 до 100', () => {
    for (let size = 1; size <= 80; size++) {
      const list = Array.from({ length: size }, (_, i) => ({ id: i + 1 }));
      for (let iter = 0; iter < 10; iter++) {
        const picked = pickWeighted(list);
        expect(picked).toBeDefined();
        expect(picked).not.toBeNull();
        expect(list).toContain(picked);
      }
    }
  });

  it('проверяет статистическое распределение корзин для больших списков (N >= 60)', () => {
    const N = 80;
    const list = Array.from({ length: N }, (_, i) => ({ id: i + 1 }));

    let oldschoolCount = 0; // первые 20 (ожидается ~40%)
    let freshCount = 0;    // последние 20 (ожидается ~40%)
    let middleCount = 0;   // середина 20..59 (ожидается ~20%)

    const ITERATIONS = 3000;
    for (let i = 0; i < ITERATIONS; i++) {
      const picked = pickWeighted(list);
      const bucket = getBucketName(list, picked);
      if (bucket === '🕹️ Олдскул') oldschoolCount++;
      else if (bucket === '✨ Свежак') freshCount++;
      else if (bucket === '📚 Бэклог') middleCount++;
    }

    const oldschoolRate = oldschoolCount / ITERATIONS;
    const freshRate = freshCount / ITERATIONS;
    const middleRate = middleCount / ITERATIONS;

    // Допустимая статистическая погрешность +- 4% при 3000 испытаниях
    expect(oldschoolRate).toBeGreaterThan(0.36);
    expect(oldschoolRate).toBeLessThan(0.44);

    expect(freshRate).toBeGreaterThan(0.36);
    expect(freshRate).toBeLessThan(0.44);

    expect(middleRate).toBeGreaterThan(0.16);
    expect(middleRate).toBeLessThan(0.24);
  });
});
