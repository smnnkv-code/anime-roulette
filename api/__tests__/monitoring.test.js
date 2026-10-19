import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/node';
import { initServerMonitoring, captureServerError } from '../_lib/monitoring.js';

vi.mock('@sentry/node', () => ({
  init: vi.fn(),
  withScope: vi.fn((fn) => {
    const mockScope = {
      setTag: vi.fn(),
      setContext: vi.fn(),
    };
    fn(mockScope);
  }),
  captureException: vi.fn(),
  flush: vi.fn().mockResolvedValue(true),
}));

describe('Server Monitoring (api/_lib/monitoring.js)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it('не инициализирует Sentry если DSN отсутствует', () => {
    delete process.env.SENTRY_DSN;
    process.env.NODE_ENV = 'production';
    initServerMonitoring();
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('захватывает исключение и вызывает flush(2000) при наличии SENTRY_DSN', async () => {
    process.env.SENTRY_DSN = 'https://key@sentry.io/12345';
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';

    const testError = new Error('Test Serverless Error');
    const req = { method: 'GET', url: '/api/get-info?shikimori_id=123', query: { shikimori_id: '123' } };

    await captureServerError(testError, req, { endpoint: 'api/get-info' });

    expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    expect(Sentry.flush).toHaveBeenCalledWith(2000);
  });
});
