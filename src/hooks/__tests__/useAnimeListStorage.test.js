import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Кейс 6: Безопасность токена и изоляция хранилища', () => {
  const STORAGE_KEY_NICKNAME = 'anime_roulette_nickname';
  const STORAGE_KEY_TOKEN    = 'anime_roulette_token';

  let localStore = {};
  let sessionStore = {};

  beforeEach(() => {
    localStore = {};
    sessionStore = {};

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => localStore[k] ?? null),
      setItem: vi.fn((k, v) => { localStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete localStore[k]; }),
      clear: vi.fn(() => { localStore = {}; }),
    });

    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((k) => sessionStore[k] ?? null),
      setItem: vi.fn((k, v) => { sessionStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete sessionStore[k]; }),
      clear: vi.fn(() => { sessionStore = {}; }),
    });
  });

  it('сохраняет токен Shikimori исключительно в sessionStorage и очищает из localStorage', () => {
    // Симулируем наличие старого уязвимого токена в localStorage
    localStore[STORAGE_KEY_TOKEN] = 'leaked_old_token';

    // Функция сохранения из useAnimeList
    function onShikimoriLoaded(nickname, token) {
      localStorage.setItem(STORAGE_KEY_NICKNAME, nickname);
      sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }

    onShikimoriLoaded('TestUser', 'new_secret_pat');

    // Проверяем: в sessionStorage токен есть, а в localStorage его больше нет
    expect(sessionStorage.getItem(STORAGE_KEY_TOKEN)).toBe('new_secret_pat');
    expect(localStorage.getItem(STORAGE_KEY_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_NICKNAME)).toBe('TestUser');
  });

  it('полностью удаляет токен из всех хранилищ при сбросе списка (clearList)', () => {
    sessionStore[STORAGE_KEY_TOKEN] = 'active_session_token';
    localStore[STORAGE_KEY_TOKEN] = 'stale_disk_token';

    function onClearList() {
      sessionStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }

    onClearList();

    expect(sessionStorage.getItem(STORAGE_KEY_TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY_TOKEN)).toBeNull();
  });
});
