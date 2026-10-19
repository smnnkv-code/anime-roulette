import { describe, it, expect } from 'vitest';
import { setCorsHeaders } from '../_lib/cors.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(key, val) {
      res.headers[key] = val;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

describe('api/_lib/cors.js', () => {
  it('разрешает однодоменные запросы без заголовка Origin (включая req без headers)', () => {
    const req1 = { headers: {} };
    const res1 = createMockRes();
    expect(setCorsHeaders(req1, res1)).toBe(true);
    expect(res1.headers['Access-Control-Allow-Origin']).toBeUndefined();

    const req2 = {};
    const res2 = createMockRes();
    expect(setCorsHeaders(req2, res2)).toBe(true);
    expect(res2.headers['Access-Control-Allow-Origin']).toBeUndefined();
  });

  it('разрешает локальные источники разработки (localhost, 127.0.0.1) и выставляет все обязательные CORS заголовки', () => {
    const localhostReq = { headers: { origin: 'http://localhost:5173' } };
    const res1 = createMockRes();
    expect(setCorsHeaders(localhostReq, res1)).toBe(true);
    expect(res1.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
    expect(res1.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    expect(res1.headers['Access-Control-Allow-Headers']).toBe('Content-Type, X-Shikimori-Token');
    expect(res1.headers['Vary']).toBe('Origin');

    const loopbackReq = { headers: { origin: 'http://127.0.0.1:3000' } };
    const res2 = createMockRes();
    expect(setCorsHeaders(loopbackReq, res2)).toBe(true);
    expect(res2.headers['Access-Control-Allow-Origin']).toBe('http://127.0.0.1:3000');
    expect(res2.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
    expect(res2.headers['Access-Control-Allow-Headers']).toBe('Content-Type, X-Shikimori-Token');
    expect(res2.headers['Vary']).toBe('Origin');
  });

  it('разрешает Vercel домены приложения', () => {
    const vercelReq = { headers: { origin: 'https://anime-roulette.vercel.app' } };
    const res = createMockRes();
    expect(setCorsHeaders(vercelReq, res)).toBe(true);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://anime-roulette.vercel.app');
  });

  it('разрешает запросы, где Origin совпадает с Host (https и http)', () => {
    const httpsReq = { headers: { origin: 'https://custom-domain.com', host: 'custom-domain.com' } };
    const res1 = createMockRes();
    expect(setCorsHeaders(httpsReq, res1)).toBe(true);
    expect(res1.headers['Access-Control-Allow-Origin']).toBe('https://custom-domain.com');

    const httpReq = { headers: { origin: 'http://custom-domain.com', host: 'custom-domain.com' } };
    const res2 = createMockRes();
    expect(setCorsHeaders(httpReq, res2)).toBe(true);
    expect(res2.headers['Access-Control-Allow-Origin']).toBe('http://custom-domain.com');

    // Mismatch origin vs host
    const mismatchReq = { headers: { origin: 'https://attacker.com', host: 'custom-domain.com' } };
    const res3 = createMockRes();
    expect(setCorsHeaders(mismatchReq, res3)).toBe(false);
  });

  it('блокирует посторонние домены (evil.com)', () => {
    const evilReq = { headers: { origin: 'https://evil.com' } };
    const res = createMockRes();
    expect(setCorsHeaders(evilReq, res)).toBe(false);
    expect(res.headers['Access-Control-Allow-Origin']).toBeUndefined();
    expect(res.headers['Access-Control-Allow-Methods']).toBeUndefined();
  });
});
