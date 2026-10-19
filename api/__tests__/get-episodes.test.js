import { describe, it, expect, vi, afterEach } from 'vitest';
import getEpisodesHandler from '../get-episodes';

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

describe('Кейс 7 и 8: Парсинг Kodik embed HTML (api/get-episodes.js)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Кейс 7: корректно парсит HTML многосерийного тайтла с сортировкой серий', async () => {
    const mockHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="serial-series-box">
            <select name="series">
              <option value="2" data-id="202" data-hash="a1b2c3d4e502">Серия 2</option>
              <option value="1" data-id="101" data-hash="a1b2c3d4e501">Серия 1</option>
              <option value="3" data-id="303" data-hash="a1b2c3d4e503">Серия 3</option>
            </select>
          </div>
        </body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockHtml),
    }));

    const req = {
      query: { link: 'https://kodikplayer.com/serial/123/hash' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isMovie).toBe(false);
    expect(res.body.episodes).toHaveLength(3);
    // Проверяем сортировку по номеру серии
    expect(res.body.episodes[0]).toEqual({ num: 1, id: '101', hash: 'a1b2c3d4e501' });
    expect(res.body.episodes[1]).toEqual({ num: 2, id: '202', hash: 'a1b2c3d4e502' });
    expect(res.body.episodes[2]).toEqual({ num: 3, id: '303', hash: 'a1b2c3d4e503' });
  });

  it('Кейс 8: корректно парсит HTML полнометражного фильма (/video/)', async () => {
    const mockMovieHtml = `
      <!DOCTYPE html>
      <html>
        <script>
          var serialId = Number(88812);
          var serialHash = "a1b2c3d4e5f67890";
        </script>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockMovieHtml),
    }));

    const req = {
      query: { link: 'https://kodikplayer.com/video/555/test' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isMovie).toBe(true);
    expect(res.body.episodes).toEqual([
      { num: 1, id: '88812', hash: 'a1b2c3d4e5f67890' },
    ]);
  });

  it('возвращает 404, если в HTML сериала не найдено ни одной серии', async () => {
    const emptyHtml = `<html><body><div>Нет серий</div></body></html>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(emptyHtml),
    }));

    const req = {
      query: { link: 'https://kodikplayer.com/serial/999/empty' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Серии не найдены в плеере Kodik');
  });

  it('вызывает fetch с флагом redirect: error для защиты от SSRF через перенаправление', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('<div class="serial-series-box"><option value="1" data-id="1" data-hash="abc">1</option></div>'),
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = {
      query: { link: 'https://kodikplayer.com/serial/101/redirect-test' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://kodikplayer.com/serial/101/redirect-test',
      expect.objectContaining({ redirect: 'error' })
    );
  });

  it('обрабатывает OPTIONS preflight запрос (204 при разрешенном origin, 403 при запрещенном)', async () => {
    const allowedReq = { method: 'OPTIONS', query: {}, headers: { origin: 'http://localhost:5173' } };
    const res1 = createMockRes();
    await getEpisodesHandler(allowedReq, res1);
    expect(res1.statusCode).toBe(204);

    const forbiddenReq = { method: 'OPTIONS', query: {}, headers: { origin: 'https://evil.com' } };
    const res2 = createMockRes();
    await getEpisodesHandler(forbiddenReq, res2);
    expect(res2.statusCode).toBe(403);
  });

  it('поддерживает fallback парсинг серий без опций в serial-series-box и фильтрует дубликаты', async () => {
    // В блоке serial-series-box нет опций, но они есть в документе вне блока, плюс дубликат серии 1
    const rawHtml = `
      <html>
        <body>
          <div class="serial-series-box">
            <!-- Пустой селектор серий в контейнере -->
          </div>
          <select class="custom-select">
            <option value="1" data-id="101" data-hash="a1b2c3d4e501">1 серия</option>
            <option value="1" data-id="101" data-hash="a1b2c3d4e501">1 серия дубль</option>
            <option value="2" data-id="202" data-hash="a1b2c3d4e502">2 серия</option>
          </select>
        </body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(rawHtml),
    }));

    const req = {
      query: { link: '//kodik.info/serial/999/fallback-test' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isMovie).toBe(false);
    expect(res.body.episodes).toHaveLength(2);
    expect(res.body.episodes[0]).toEqual({ num: 1, id: '101', hash: 'a1b2c3d4e501' });
    expect(res.body.episodes[1]).toEqual({ num: 2, id: '202', hash: 'a1b2c3d4e502' });
  });

  it('дедуплицирует серии при наличии дублирующихся опций внутри serial-series-box', async () => {
    const mockHtmlWithDuplicates = `
      <div class="serial-series-box">
        <select>
          <option value="1" data-id="101" data-hash="a1b2c3d4e501">1 серия</option>
          <option value="1" data-id="101" data-hash="a1b2c3d4e501">1 серия (дубликат)</option>
          <option value="2" data-id="202" data-hash="a1b2c3d4e502">2 серия</option>
        </select>
      </div>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockHtmlWithDuplicates),
    }));

    const req = {
      query: { link: 'https://kodikplayer.com/serial/101/duplicate-test' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isMovie).toBe(false);
    expect(res.body.episodes).toHaveLength(2);
    expect(res.body.episodes[0]).toEqual({ num: 1, id: '101', hash: 'a1b2c3d4e501' });
    expect(res.body.episodes[1]).toEqual({ num: 2, id: '202', hash: 'a1b2c3d4e502' });
  });

  it('вызывает fallback-парсер с дедупликацией при полном отсутствии блока serial-series-box в HTML', async () => {
    const mockHtmlWithoutBox = `
      <html>
        <body>
          <div class="custom-player-wrapper">
            <option value="1" data-id="501" data-hash="a1b2c3d4e501">1</option>
            <option value="1" data-id="501" data-hash="a1b2c3d4e501">1 (дубль)</option>
            <option value="2" data-id="502" data-hash="a1b2c3d4e502">2</option>
          </div>
        </body>
      </html>
    `;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(mockHtmlWithoutBox),
    }));

    const req = {
      query: { link: 'https://kodikplayer.com/serial/500/no-box-test' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.isMovie).toBe(false);
    expect(res.body.episodes).toHaveLength(2);
    expect(res.body.episodes[0]).toEqual({ num: 1, id: '501', hash: 'a1b2c3d4e501' });
    expect(res.body.episodes[1]).toEqual({ num: 2, id: '502', hash: 'a1b2c3d4e502' });
  });

  it('возвращает 500, если в HTML фильма (/video/) отсутствуют serialId или serialHash', async () => {
    const brokenMovieHtml = `<html><script>var nothing = 1;</script></html>`;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(brokenMovieHtml),
    }));

    const req = {
      query: { link: 'https://sub.kodikplayer.com/video/123/broken' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to parse Kodik episodes');
  });

  it('возвращает 500, если внешний embed запрос вернул HTTP ошибку (!pageRes.ok)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    }));

    const req = {
      query: { link: 'https://kodikplayer.com/serial/503/error' },
      headers: {},
      method: 'GET',
    };
    const res = createMockRes();
    await getEpisodesHandler(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to parse Kodik episodes');
  });
});
