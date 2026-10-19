/**
 * scripts/perf-mock-server.js
 *
 * Локальный HTTP-сервер для Контура 1 нагрузочного тестирования (PERF-TEST-PLAN.md).
 * Мокирует внешние вызовы к MAL, Kodik и Shikimori и отдает статические ассеты из dist/.
 *
 * Запускается на порту 3001.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import malListHandler from '../api/mal-list.js';
import getInfoHandler from '../api/get-info.js';
import getEpisodesHandler from '../api/get-episodes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist');

process.env.MAL_CLIENT_ID = 'perf-mock-mal-client-id';
process.env.NODE_ENV = 'test'; // отключить отправку в Sentry во время бенчмарка

// ── Мок внешних вызовов fetch ──────────────────────────────────────────────
const mockEpisodesHtml = `
<!DOCTYPE html>
<html>
<body>
  <div class="serial-series-box">
    ${Array.from({ length: 24 }, (_, i) => `
      <option value="${i + 1}" data-id="100${i + 1}" data-hash="a${i + 1}b2c3d4e5f6a7b8c9d0">Серия ${i + 1}</option>
    `).join('\n')}
  </div>
</body>
</html>
`;

const mockMalData = {
  data: Array.from({ length: 1000 }, (_, i) => ({
    node: {
      id: i + 1,
      title: `Anime Title ${i + 1}`,
      main_picture: {
        medium: `https://cdn.myanimelist.net/images/anime/${i + 1}/med.jpg`,
        large: `https://cdn.myanimelist.net/images/anime/${i + 1}/lrg.jpg`,
      },
      num_episodes: 12,
      start_date: '2023-01-01',
      media_type: 'tv',
      status: 'finished_airing',
      genres: [{ id: 1, name: 'Action' }],
      mean: 8.25,
    },
  })),
  paging: {},
};

const mockKodikApiData = {
  results: [
    {
      translation: { id: 609, title: 'AniLibria', type: 'voice' },
      episodes_count: 24,
      link: '//kodikplayer.com/serial/12345/f91684a/720p',
    },
    {
      translation: { id: 701, title: 'SHIZA Project', type: 'voice' },
      episodes_count: 24,
      link: '//kodikplayer.com/serial/12345/abc789/720p',
    },
    {
      translation: { id: 802, title: 'Субтитры', type: 'subtitles' },
      episodes_count: 24,
      link: '//kodikplayer.com/serial/12345/def456/720p',
    },
  ],
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const urlStr = String(url);

  // Мок MAL API
  if (urlStr.includes('api.myanimelist.net')) {
    return {
      ok: true,
      status: 200,
      json: async () => mockMalData,
      text: async () => JSON.stringify(mockMalData),
    };
  }

  // Мок Kodik API
  if (urlStr.includes('kodik-api.com')) {
    return {
      ok: true,
      status: 200,
      json: async () => mockKodikApiData,
      text: async () => JSON.stringify(mockKodikApiData),
    };
  }

  // Мок Kodik embed page
  if (urlStr.includes('kodikplayer.com') || urlStr.includes('kodik.info')) {
    return {
      ok: true,
      status: 200,
      text: async () => mockEpisodesHtml,
    };
  }

  return originalFetch(url, options);
};

// ── Хелпер адаптации serverless handler к Node.js req/res ──────────────────
function adaptHandler(handler) {
  return async (req, res, query) => {
    req.query = query;
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
      return res;
    };
    try {
      await handler(req, res);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  };
}

const malWrapper = adaptHandler(malListHandler);
const infoWrapper = adaptHandler(getInfoHandler);
const episodesWrapper = adaptHandler(getEpisodesHandler);

export function createPerfServer(port = 3001) {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(req.url, `http://localhost:${port}`);
    const pathname = parsedUrl.pathname;
    const query = Object.fromEntries(parsedUrl.searchParams.entries());

    // 1. Статические ресурсы из dist
    if (pathname === '/' || pathname === '/index.html') {
      const htmlPath = path.join(DIST_DIR, 'index.html');
      if (fs.existsSync(htmlPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(fs.readFileSync(htmlPath));
        return;
      }
    }

    if (pathname.startsWith('/assets/')) {
      const filePath = path.join(DIST_DIR, pathname);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath);
        if (ext === '.js') res.setHeader('Content-Type', 'application/javascript');
        if (ext === '.css') res.setHeader('Content-Type', 'text/css');
        res.end(fs.readFileSync(filePath));
        return;
      }
    }

    // 2. API эндпоинты
    if (pathname === '/api/mal-list') {
      return malWrapper(req, res, query);
    }
    if (pathname === '/api/get-info') {
      return infoWrapper(req, res, query);
    }
    if (pathname === '/api/get-episodes') {
      return episodesWrapper(req, res, query);
    }

    res.statusCode = 404;
    res.end('Not Found');
  });

  return new Promise((resolve) => {
    server.listen(port, () => {
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

// Прямой запуск из CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createPerfServer(3001).then(({ url }) => {
    console.info(`[PerfMockServer] Listening on ${url}`);
  });
}
