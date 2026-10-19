import { describe, it, expect, vi, afterEach } from 'vitest';
import getInfoHandler from '../get-info';

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

describe('Кейс 9 и 10: Логика получения озвучек Kodik (api/get-info.js)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('отклоняет нечисловой shikimori_id с кодом 400', async () => {
    const req = { query: { shikimori_id: 'bad_id' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getInfoHandler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Valid numeric shikimori_id required');
  });

  it('Кейс 9: пропускает элементы без translation и корректно группирует озвучки', async () => {
    const mockKodikData = {
      results: [
        // Запись без translation (поврежденные данные или анонс)
        { translation: null, link: '//kodik.info/seria/1/hash' },
        // Запись с озвучкой
        {
          translation: { id: 609, title: 'AniLibria', type: 'voice' },
          episodes_count: 12,
          link: '//kodikplayer.com/seria/100/hash1',
        },
        // Запись с субтитрами
        {
          translation: { id: 10, title: 'Субтитры', type: 'subtitles' },
          episodes_count: 12,
          link: '//kodikplayer.com/seria/200/hash2',
        },
        // Дубль той же озвучки с меньшим числом серий (должен быть отфильтрован)
        {
          translation: { id: 609, title: 'AniLibria', type: 'voice' },
          episodes_count: 6,
          link: '//kodikplayer.com/seria/100/hash_old',
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockKodikData),
    }));

    const req = { query: { shikimori_id: '5114' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getInfoHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.translations).toHaveLength(2);

    // Сортировка: voice (AniLibria) идет перед subtitles
    expect(res.body.translations[0].title).toBe('AniLibria');
    expect(res.body.translations[0].type).toBe('voice');
    expect(res.body.translations[0].episodes_count).toBe(12);
    expect(res.body.translations[0].link).toBe('https://kodikplayer.com/seria/100/hash1');

    expect(res.body.translations[1].title).toBe('Субтитры');
    expect(res.body.translations[1].type).toBe('subtitles');
  });

  it('Кейс 10: успешно использует локальные резервные токены при сбое внешней сети', async () => {
    delete process.env.KODIK_TOKEN;

    const mockKodikData = {
      results: [
        {
          translation: { id: 1, title: 'Original', type: 'voice' },
          episodes_count: 1,
          link: '//kodikplayer.com/video/1/hash',
        },
      ],
    };

    // Мокаем fetch: Kodik API отвечает успешно
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      if (url.includes('tokens.json')) {
        return Promise.reject(new Error('GitHub network offline'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockKodikData),
      });
    }));

    const req = { query: { shikimori_id: '123' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getInfoHandler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.translations[0].title).toBe('Original');
  });

  it('возвращает 404, если тайтл не найден в Kodik', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ results: [] }),
    }));

    const req = { query: { shikimori_id: '999999' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getInfoHandler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error).toBe('Тайтл не найден в Kodik');
  });

  it('не выполняет сетевых запросов к сторонним GitHub-репозиториям за токенами', async () => {
    delete process.env.KODIK_TOKEN;
    const requestedUrls = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ results: [] }),
      });
    }));

    const req = { query: { shikimori_id: '777' }, headers: {}, method: 'GET' };
    const res = createMockRes();
    await getInfoHandler(req, res);

    expect(requestedUrls.some((u) => u.includes('raw.githubusercontent.com'))).toBe(false);
  });
});
