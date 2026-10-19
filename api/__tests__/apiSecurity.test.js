import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import shikimoriHandler from '../shikimori';
import getEpisodesHandler from '../get-episodes';
import malPosterHandler from '../mal-poster';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, val) {
      res.headers[key] = val;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

describe('Кейс 1: Валидация входных параметров (api/shikimori.js)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('отклоняет запрос без nickname и mal_id с кодом 400', async () => {
    const req = { query: {}, headers: {}, method: 'GET' };
    const res = createMockRes();
    await shikimoriHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('nickname or mal_id is required');
  });

  it('отклоняет нечисловой mal_id (инъекция параметров) с кодом 400', async () => {
    const req = { query: { mal_id: '123&inject=true' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await shikimoriHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Valid numeric mal_id required');
  });

  it('отклоняет некорректный формат nickname с кодом 400', async () => {
    const req = { query: { nickname: 'user/../../admin' }, headers: { 'x-shikimori-token': 'token' }, method: 'GET' };
    const res = createMockRes();
    await shikimoriHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid nickname format');
  });

  it('требует API токен при запросе по никнейму (код 401)', async () => {
    const req = { query: { nickname: 'ValidUser' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await shikimoriHandler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('API token is required');
  });
});

describe('Кейс 2: Защита от SSRF (api/get-episodes.js)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('отклоняет запрос без параметра link с кодом 400', async () => {
    const req = { query: {}, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('link required');
  });

  it('отклоняет незащищенный протокол http: с кодом 400', async () => {
    const req = { query: { link: 'http://kodikplayer.com/serial/123/hash' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Forbidden host in link parameter');
  });

  it('отклоняет посторонние домены (попытка SSRF) с кодом 400', async () => {
    const maliciousUrls = [
      'https://evil-site.com/serial/123',
      'https://169.254.169.254/latest/meta-data',
      'https://localhost:8080/admin',
      'https://kodikplayer.com.attacker.com/serial',
    ];

    for (const url of maliciousUrls) {
      const req = { query: { link: url }, headers: {}, method: 'GET' };
      const res = createMockRes();
      await getEpisodesHandler(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Forbidden host in link parameter');
    }
  });
});

describe('Кейс 3: Сетевой таймаут в serverless-функциях', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shikimori.js возвращает 504 при таймауте внешнего запроса', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('The operation was aborted due to timeout', 'TimeoutError')));

    const req = { query: { mal_id: '123' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await shikimoriHandler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.error).toBe('Shikimori API request timed out');
  });

  it('get-episodes.js возвращает 504 при таймауте Kodik embed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Request timeout', 'TimeoutError')));

    const req = { query: { link: 'https://kodikplayer.com/serial/123/hash' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.error).toBe('Kodik embed request timed out');
  });

  it('mal-poster.js возвращает 504 при таймауте MAL API', async () => {
    process.env.MAL_CLIENT_ID = 'test-client-id';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError')));

    const req = { query: { mal_id: '123' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malPosterHandler(req, res);

    expect(res.statusCode).toBe(504);
    expect(res.body.error).toBe('MAL API request timed out');
  });
});
