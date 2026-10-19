/**
 * scripts/run-load-test.js
 *
 * Раннер нагрузочного тестирования для Контура 1 (PERF-TEST-PLAN.md).
 * Запускает локальный сервер с мок-эндпоинтами и прогоняет autocannon по каждому сценарию.
 */

import autocannon from 'autocannon';
import { createPerfServer } from './perf-mock-server.js';

const SLO = {
  static: { p95Max: 50, errorRateMax: 0.0, minThroughput: 50 },
  malList: { p95Max: 250, errorRateMax: 0.0, minThroughput: 10 },
  getInfo: { p95Max: 100, errorRateMax: 0.0, minThroughput: 20 },
  getEpisodes: { p95Max: 150, errorRateMax: 0.0, minThroughput: 20 },
};

async function runScenario({ name, url, connections = 5, duration = 8, sloKey }) {
  console.info(`\n🚀 [LoadTest] Запуск сценария: "${name}" (${connections} VUs, ${duration}с)...`);

  const result = await autocannon({
    url,
    connections,
    duration,
    pipelining: 1,
    timeout: 3,
    bailout: 2, // kill switch: прерывание при росте ошибок
  });

  const totalRequests = result.requests.total;
  const errorCount = result.errors + result.timeouts + result.non2xx;
  const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  const p50 = result.latency.p50;
  const p95 = result.latency.p97_5 ?? result.latency.p90 ?? result.latency.average;
  const p99 = result.latency.p99;
  const throughput = result.requests.average;

  const slo = SLO[sloKey];
  const sloPassed = p95 <= slo.p95Max && errorRate <= slo.errorRateMax;

  console.info(`   p50: ${p50}ms | p95: ${p95}ms | p99: ${p99}ms | Error rate: ${errorRate.toFixed(2)}% | Throughput: ${throughput.toFixed(1)} req/s`);
  console.info(`   SLO (${slo.p95Max}ms p95, ≤${slo.errorRateMax}% err): ${sloPassed ? '✅ ВЫПОЛНЕН' : '❌ НЕ ВЫПОЛНЕН'}`);

  return {
    name,
    p50,
    p95,
    p99,
    errorRate: `${errorRate.toFixed(2)}%`,
    throughput: `${throughput.toFixed(1)} req/s`,
    sloPassed: sloPassed ? '✅ Да' : '❌ Нет',
  };
}

async function main() {
  const { url, close } = await createPerfServer(3001);
  console.info(`[PerfRunner] Локальный сервер поднят на ${url}`);

  const results = [];

  try {
    // 1. Пробный мини-прогон (Smoke test)
    console.info('\n[PerfRunner] Выполняю пробный мини-прогон (Smoke test)...');
    const smokeRes = await fetch(`${url}/`);
    if (!smokeRes.ok) throw new Error(`Smoke test failed: ${smokeRes.status}`);
    const smokeApiRes = await fetch(`${url}/api/mal-list?username=SmokeUser`);
    if (!smokeApiRes.ok) throw new Error(`Smoke API test failed: ${smokeApiRes.status}`);
    console.info('[PerfRunner] Smoke test пройден успешно!');

    // 2. Сценарий 1: Раздача статического бандла (SPA)
    results.push(await runScenario({
      name: 'Сценарий 1: Раздача статического SPA (/)',
      url: `${url}/`,
      connections: 10,
      duration: 5,
      sloKey: 'static',
    }));

    // 3. Сценарий 2: Загрузка и нормализация списка MAL (1000 записей)
    results.push(await runScenario({
      name: 'Сценарий 2: GET /api/mal-list (1000 тайтлов)',
      url: `${url}/api/mal-list?username=LoadTestUser`,
      connections: 5,
      duration: 5,
      sloKey: 'malList',
    }));

    // 4. Сценарий 3A: Получение переводов Kodik
    results.push(await runScenario({
      name: 'Сценарий 3A: GET /api/get-info (Kodik translations)',
      url: `${url}/api/get-info?shikimori_id=123`,
      connections: 5,
      duration: 5,
      sloKey: 'getInfo',
    }));

    // 5. Сценарий 3B: Парсинг серий плеера
    results.push(await runScenario({
      name: 'Сценарий 3B: GET /api/get-episodes (Embed parser)',
      url: `${url}/api/get-episodes?link=${encodeURIComponent('https://kodikplayer.com/serial/123/abc/720p')}`,
      connections: 5,
      duration: 5,
      sloKey: 'getEpisodes',
    }));

    // Итоговая таблица
    console.info('\n================== ИТОГИ НАГРУЗОЧНОГО ТЕСТИРОВАНИЯ ==================');
    console.table(results);

  } finally {
    await close();
    console.info('\n[PerfRunner] Локальный сервер остановлен.');
  }
}

main().catch((err) => {
  console.error('[PerfRunner] Критическая ошибка:', err);
  process.exit(1);
});
