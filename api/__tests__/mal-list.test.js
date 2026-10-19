import { describe, it, expect, vi, afterEach } from 'vitest';
import malListHandler from '../mal-list';

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

describe('Кейс 11: Пагинация и валидация списка MAL (api/mal-list.js)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('отклоняет запрос без username с кодом 400', async () => {
    const req = { query: {}, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('username required');
  });

  it('отклоняет некорректный формат username с кодом 400', async () => {
    const req = { query: { username: 'bad user/traversal' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Invalid username format');
  });

  it('возвращает 500, если MAL_CLIENT_ID не настроен на сервере', async () => {
    const oldId = process.env.MAL_CLIENT_ID;
    delete process.env.MAL_CLIENT_ID;

    const req = { query: { username: 'ValidUser' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('MAL_CLIENT_ID not configured on server');

    process.env.MAL_CLIENT_ID = oldId || 'test-client-id';
  });

  it('Кейс 11: ограничивает пагинацию ровно 5 страницами (MAX_PAGES = 5)', async () => {
    process.env.MAL_CLIENT_ID = 'test-client-id';

    let fetchCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      fetchCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [{ node: { id: fetchCount, title: `Title ${fetchCount}` } }],
          paging: { next: `https://api.myanimelist.net/v2/users/test/animelist?offset=${fetchCount * 1000}` },
        }),
      });
    }));

    const req = { query: { username: 'HeavyUser' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(200);
    // Проверяем, что запрос оборвался строго после 5 страниц
    expect(fetchCount).toBe(5);
    expect(res.body).toHaveLength(5);
  });

  it('возвращает уже накопленный частичный список (200 OK), если таймаут произошел на последующей странице', async () => {
    process.env.MAL_CLIENT_ID = 'test-client-id';

    let fetchCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            data: [{ node: { id: 101, title: 'Anime 1' } }],
            paging: { next: 'https://api.myanimelist.net/v2/users/test/animelist?offset=1000' },
          }),
        });
      }
      // Вторая страница падает по таймауту
      const timeoutErr = new Error('The operation was aborted due to timeout');
      timeoutErr.name = 'TimeoutError';
      return Promise.reject(timeoutErr);
    }));

    const req = { query: { username: 'TimeoutUser' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].node.title).toBe('Anime 1');
  });

  it('игнорирует недоверенный paging.next URL и не совершает переход на сторонний хост', async () => {
    process.env.MAL_CLIENT_ID = 'secret-mal-id';

    let fetchCount = 0;
    const requestedUrls = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      fetchCount++;
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [{ node: { id: 101, title: 'Anime 1' } }],
          paging: { next: 'https://attacker.com/malicious/callback' },
        }),
      });
    }));

    const req = { query: { username: 'TestUser' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fetchCount).toBe(1);
    expect(requestedUrls[0]).toContain('https://api.myanimelist.net/');
    expect(requestedUrls).not.toContain('https://attacker.com/malicious/callback');
    expect(res.body).toHaveLength(1);
    expect(res.headers['Cache-Control']).toBe('no-store');
  });

  it('обрабатывает OPTIONS preflight запрос (200 при разрешенном origin, 403 при запрещенном)', async () => {
    const allowedReq = { method: 'OPTIONS', query: {}, headers: { origin: 'http://localhost:5173' } };
    const res1 = createMockRes();
    await malListHandler(allowedReq, res1);
    expect(res1.statusCode).toBe(200);

    const forbiddenReq = { method: 'OPTIONS', query: {}, headers: { origin: 'https://evil.com' } };
    const res2 = createMockRes();
    await malListHandler(forbiddenReq, res2);
    expect(res2.statusCode).toBe(403);
  });

  it('пробрасывает статус и сообщение об ошибке от MAL API при !resp.ok на первой странице', async () => {
    process.env.MAL_CLIENT_ID = 'test-client-id';

    // 404 с JSON телом
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ message: 'User not found' }),
    }));

    const req1 = { query: { username: 'NotFoundUser' }, headers: {}, method: 'GET' };
    const res1 = createMockRes();
    await malListHandler(req1, res1);

    expect(res1.statusCode).toBe(404);
    expect(res1.body.error).toBe('User not found');

    // 500 с нечитаемым телом (fallback на HTTP статус)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('SyntaxError')),
    }));

    const req2 = { query: { username: 'BrokenMALUser' }, headers: {}, method: 'GET' };
    const res2 = createMockRes();
    await malListHandler(req2, res2);

    expect(res2.statusCode).toBe(500);
    expect(res2.body.error).toBe('MAL API error: HTTP 500');
  });

  it('возвращает 400, если в теле ответа MAL API содержится data.error', async () => {
    process.env.MAL_CLIENT_ID = 'test-client-id';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ error: 'invalid_param', message: 'Param is invalid' }),
    }));

    const req = { query: { username: 'ErrorUser' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Param is invalid');
  });

  it('возвращает 504 при таймауте и 500 при сетевом сбое на первой странице', async () => {
    process.env.MAL_CLIENT_ID = 'test-client-id';

    // Timeout на первой странице
    const timeoutErr = new Error('aborted');
    timeoutErr.name = 'TimeoutError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeoutErr));

    const req1 = { query: { username: 'FirstPageTimeout' }, headers: {}, method: 'GET' };
    const res1 = createMockRes();
    await malListHandler(req1, res1);

    expect(res1.statusCode).toBe(504);
    expect(res1.body.error).toBe('MAL API request timed out');

    // Сетевой сбой на первой странице
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));

    const req2 = { query: { username: 'FirstPageNetError' }, headers: {}, method: 'GET' };
    const res2 = createMockRes();
    await malListHandler(req2, res2);

    expect(res2.statusCode).toBe(500);
    expect(res2.body.error).toBe('Failed to fetch MAL list');
  });

  it('прерывает цикл пагинации, если приближается дедлайн (remainingTime < 1500)', async () => {
    process.env.MAL_CLIENT_ID = 'test-client-id';

    let fetchCount = 0;
    const realDateNow = Date.now;
    let simulatedTime = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => simulatedTime);

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      fetchCount++;
      // После первой страницы симулируем скачок времени близко к дедлайну
      simulatedTime += 7500;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: [{ node: { id: fetchCount, title: `Title ${fetchCount}` } }],
          paging: { next: 'https://api.myanimelist.net/v2/users/test/animelist?offset=1000' },
        }),
      });
    }));

    const req = { query: { username: 'DeadlineUser' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await malListHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(fetchCount).toBe(1);
    expect(res.body).toHaveLength(1);
    expect(res.headers['Cache-Control']).toBe('no-store');

    Date.now = realDateNow;
  });
});

