import { describe, it, expect } from 'vitest';
import { pickWeighted } from '../weightedRandom.js';
import { buildReelStrip } from '../buildReelStrip.js';

function generateAnimeList(count) {
  const genres = [
    { name: 'Action' },
    { name: 'Comedy' },
    { name: 'Drama' },
    { name: 'Sci-Fi' },
    { name: 'Fantasy' },
  ];

  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Anime Title ${i + 1}`,
    russian: `Аниме Название ${i + 1}`,
    score: (Math.random() * 5 + 5).toFixed(2), // 5.0 - 10.0
    genres: [genres[i % genres.length]],
    anime: {
      id: i + 1,
      mal_id: i + 1,
      name: `Anime Title ${i + 1}`,
      russian: `Аниме Название ${i + 1}`,
      score: (Math.random() * 5 + 5).toFixed(2),
      genres: [genres[i % genres.length]],
      image: {
        original: `https://shikimori.io/system/animes/original/${i + 1}.jpg`,
        preview: `https://shikimori.io/system/animes/preview/${i + 1}.jpg`,
      },
    },
  }));
}

describe('Сценарий 4 (PERF-TEST-PLAN.md): Клиентские алгоритмические бенчмарки', () => {
  const largeList = generateAnimeList(5000);
  const winner = largeList[42];

  it('алгоритм pickWeighted на 5 000 элементах выполняется быстрее SLO (< 5ms)', () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const picked = pickWeighted(largeList);
      expect(picked).toBeDefined();
    }

    const duration = performance.now() - start;
    const avgLatencyMs = duration / iterations;

    console.info(`[PerfBenchmark] pickWeighted(5000): avg ${avgLatencyMs.toFixed(4)}ms / pick (total ${duration.toFixed(2)}ms for ${iterations} runs)`);

    // SLO: < 5ms на одну выборку
    expect(avgLatencyMs).toBeLessThan(5);
  });

  it('алгоритм buildReelStrip (35 обложек из 5 000 элементов) выполняется быстрее SLO (< 5ms)', () => {
    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const strip = buildReelStrip(winner, largeList, 35);
      expect(strip).toHaveLength(36); // 35 случайных + 1 победитель
    }

    const duration = performance.now() - start;
    const avgLatencyMs = duration / iterations;

    console.info(`[PerfBenchmark] buildReelStrip(35, 5000): avg ${avgLatencyMs.toFixed(4)}ms / build (total ${duration.toFixed(2)}ms for ${iterations} runs)`);

    // SLO: < 5ms на одну генерацию ленты
    expect(avgLatencyMs).toBeLessThan(5);
  });
});
