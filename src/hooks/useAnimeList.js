import { useState, useCallback, useRef } from 'react';
import { normalizeMalList } from '../utils/normalizeMAL';
import { usePostersEnrich } from './usePostersEnrich';

const STORAGE_KEY_NICKNAME = 'anime_roulette_nickname';
const STORAGE_KEY_TOKEN    = 'anime_roulette_token';
const STORAGE_KEY_MAL_USER = 'anime_roulette_mal_username';
const STORAGE_KEY_SOURCE   = 'anime_roulette_source';   // 'shikimori' | 'mal'
const CACHE_TTL_MS         = 5 * 60 * 1000;             // 5 минут TTL для кэша списка

/**
 * useAnimeList — универсальный хук загрузки списка аниме.
 * Поддерживает два источника: Shikimori и MyAnimeList.
 *
 * @returns {Object} {
 *   animeList, isLoading, error,
 *   source, setSource,
 *   fetchList, clearList,
 *   savedNickname, savedToken, savedMalUsername,
 * }
 */
export function useAnimeList() {
  const [animeList,    setAnimeList]    = useState([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [isEnriching,  setIsEnriching]  = useState(false);
  const [error,        setError]        = useState(null);
  const [source,       setSourceState]  = useState(
    () => localStorage.getItem(STORAGE_KEY_SOURCE) || null  // null = показать пикер
  );

  const { enrichList, abort: abortEnrich } = usePostersEnrich();

  // Сохранённые данные (токен хранится только в рамках сессии в sessionStorage)
  const [savedNickname]    = useState(() => localStorage.getItem(STORAGE_KEY_NICKNAME)   || '');
  const [savedToken]       = useState(() => sessionStorage.getItem(STORAGE_KEY_TOKEN) || localStorage.getItem(STORAGE_KEY_TOKEN) || '');
  const [savedMalUsername] = useState(() => localStorage.getItem(STORAGE_KEY_MAL_USER)  || '');

  const cacheRef = useRef({ key: null, data: null });

  // Меняем источник и сохраняем выбор
  const setSource = useCallback((src) => {
    setSourceState(src);
    if (src === null) {
      localStorage.removeItem(STORAGE_KEY_SOURCE);
    } else {
      localStorage.setItem(STORAGE_KEY_SOURCE, src);
    }
  }, []);

  // ── Загрузка из Shikimori ────────────────────────────────────────────
  const fetchShikimori = useCallback(async (nickname, token) => {
    if (!nickname) {
      setError('Введи никнейм Shikimori');
      return false;
    }

    const cacheKey = `shiki:${nickname}`;
    const now = Date.now();
    const isCacheFresh = cacheRef.current.key === cacheKey &&
      cacheRef.current.data &&
      (now - (cacheRef.current.timestamp || 0) < CACHE_TTL_MS);

    if (isCacheFresh) {
      setAnimeList(cacheRef.current.data);
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/shikimori?nickname=${encodeURIComponent(nickname)}&limit=5000`,
        { headers: token ? { 'X-Shikimori-Token': token } : {} }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Неожиданный формат ответа от API');
      if (data.length === 0) throw new Error('Список запланированного пуст или профиль приватный');

      localStorage.setItem(STORAGE_KEY_NICKNAME, nickname);
      if (token) {
        sessionStorage.setItem(STORAGE_KEY_TOKEN, token);
      } else {
        sessionStorage.removeItem(STORAGE_KEY_TOKEN);
      }
      localStorage.removeItem(STORAGE_KEY_TOKEN); // удаляем из постоянного хранилища на диске

      cacheRef.current = { key: cacheKey, data, timestamp: now };
      setAnimeList(data);

      // ── Фоновое обогащение MAL-постерами ────────────────────────────
      // Запускаем без await — не блокируем UI
      setIsEnriching(true);
      enrichList(data, (enriched) => {
        setAnimeList(enriched);
        cacheRef.current = { key: cacheKey, data: enriched, timestamp: now };
      }).finally(() => setIsEnriching(false));

      return true;

    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [enrichList]);

  // ── Загрузка из MAL ──────────────────────────────────────────────────
  const fetchMAL = useCallback(async (username) => {
    if (!username) {
      setError('Введи никнейм MyAnimeList');
      return false;
    }

    const cacheKey = `mal:${username}`;
    const now = Date.now();
    const isCacheFresh = cacheRef.current.key === cacheKey &&
      cacheRef.current.data &&
      (now - (cacheRef.current.timestamp || 0) < CACHE_TTL_MS);

    if (isCacheFresh) {
      setAnimeList(cacheRef.current.data);
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/mal-list?username=${encodeURIComponent(username)}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const rawData = await res.json();
      if (!Array.isArray(rawData)) throw new Error('Неожиданный формат ответа MAL API');
      if (rawData.length === 0) throw new Error('Список "планирую посмотреть" пуст или профиль приватный');

      const normalized = normalizeMalList(rawData);

      localStorage.setItem(STORAGE_KEY_MAL_USER, username);

      cacheRef.current = { key: cacheKey, data: normalized, timestamp: now };
      setAnimeList(normalized);
      return true;

    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Универсальный fetchList ──────────────────────────────────────────
  const fetchList = useCallback(async (primary, secondary) => {
    if (source === 'mal') {
      return fetchMAL(primary);         // primary = MAL username
    } else {
      return fetchShikimori(primary, secondary);  // primary = nickname, secondary = token
    }
  }, [source, fetchMAL, fetchShikimori]);

  const clearList = useCallback(() => {
    abortEnrich();          // прерываем фоновую подгрузку если идёт
    setAnimeList([]);
    setIsEnriching(false);
    setError(null);
    sessionStorage.removeItem(STORAGE_KEY_TOKEN);
    localStorage.removeItem(STORAGE_KEY_TOKEN);
    cacheRef.current = { key: null, data: null, timestamp: 0 };
  }, [abortEnrich]);

  return {
    animeList,
    isLoading,
    isEnriching,
    error,
    source,
    setSource,
    fetchList,
    clearList,
    savedNickname,
    savedToken,
    savedMalUsername,
  };
}
