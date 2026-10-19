import { describe, it, expect } from 'vitest';
import { pickWeighted, getBucketName } from '../weightedRandom';

describe('weightedRandom utility', () => {
  it('throws an error if animeList is empty', () => {
    expect(() => pickWeighted([])).toThrow('Список пуст');
  });

  it('selects an element uniformly from a small list (< 40 items)', () => {
    const list = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Anime ${i + 1}` }));
    
    // Проверяем, что выбираются разные индексы, а не только первый (убивает Math.random() / N)
    const pickedIds = new Set();
    for (let i = 0; i < 50; i++) {
      const picked = pickWeighted(list);
      expect(list).toContain(picked);
      expect(getBucketName(list, picked)).toBe('Рандом');
      pickedIds.add(picked.id);
    }
    // За 50 итераций из 10 элементов должно быть выбрано более 1 уникального элемента
    expect(pickedIds.size).toBeGreaterThan(1);
    // Должны выбираться элементы с id > 1 (не только нулевой индекс)
    expect([...pickedIds].some(id => id > 1)).toBe(true);
  });

  it('categorizes buckets correctly for large lists (>= 40 items)', () => {
    const N = 60;
    const list = Array.from({ length: N }, (_, i) => ({ id: i + 1, name: `Anime ${i + 1}` }));

    // Первые 20 — Олдскул
    expect(getBucketName(list, list[0])).toBe('🕹️ Олдскул');
    expect(getBucketName(list, list[19])).toBe('🕹️ Олдскул');

    // Середина — Бэклог
    expect(getBucketName(list, list[20])).toBe('📚 Бэклог');
    expect(getBucketName(list, list[39])).toBe('📚 Бэклог');

    // Последние 20 — Свежак (от N-20 до N-1)
    expect(getBucketName(list, list[40])).toBe('✨ Свежак');
    expect(getBucketName(list, list[59])).toBe('✨ Свежак');
  });

  it('safely handles boundary list size (N = 40) without returning undefined', () => {
    const list = Array.from({ length: 40 }, (_, i) => ({ id: i + 1 }));
    const pickedIds = new Set();

    for (let i = 0; i < 100; i++) {
      const picked = pickWeighted(list);
      expect(picked).toBeDefined();
      expect(picked.id).toBeGreaterThanOrEqual(1);
      expect(picked.id).toBeLessThanOrEqual(40);
      pickedIds.add(picked.id);

      // Граничное условие: при N = 40 корзина строго 'Рандом'
      expect(getBucketName(list, picked)).toBe('Рандом');
    }

    // Для N = 40 выборка равномерная: должны попадаться и первая, и вторая половина
    expect([...pickedIds].some(id => id <= 20)).toBe(true);
    expect([...pickedIds].some(id => id > 20)).toBe(true);
  });

  it('safely handles unknown or missing picked element in getBucketName', () => {
    const list = Array.from({ length: 50 }, (_, i) => ({ id: i + 1 }));
    // Отсутствующий id
    expect(getBucketName(list, { id: 999 })).toBe('Рандом');
    // null и undefined
    expect(getBucketName(list, null)).toBe('Рандом');
    expect(getBucketName(list, undefined)).toBe('Рандом');

    // Граничные размеры: при ровно 40 элементах — всегда 'Рандом'
    const list40 = Array.from({ length: 40 }, (_, i) => ({ id: i + 1 }));
    expect(getBucketName(list40, list40[0])).toBe('Рандом');
    expect(getBucketName(list40, list40[39])).toBe('Рандом');
    expect(getBucketName(list40, { id: 999 })).toBe('Рандом');
  });

  it('samples different elements within large list buckets (killing Math.random() / bucket.length)', () => {
    const list = Array.from({ length: 60 }, (_, i) => ({ id: i + 1 }));
    const pickedIds = new Set();

    for (let i = 0; i < 100; i++) {
      const picked = pickWeighted(list);
      pickedIds.add(picked.id);
    }

    // Должно быть выбрано множество различных ID по всем корзинам
    expect(pickedIds.size).toBeGreaterThan(10);
  });
});
