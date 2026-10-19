import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Sentry from '@sentry/react';
import styles from './StandalonePlayer.module.css';

/**
 * StandalonePlayer — автономный полноэкранный плеер для открытия в отдельной вкладке.
 *
 * Принимает параметры из query-строки URL:
 * - watch / shikimori_id / id — ID аниме на Shikimori
 * - mal_id — ID аниме на MyAnimeList (если запуск был из MAL)
 * - title — название аниме
 */
export default function StandalonePlayer() {
  const [translations, setTranslations] = useState([]);
  const [selectedId,   setSelectedId]   = useState('');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(null);

  // Извлекаем query-параметры
  const queryParams = useMemo(() => {
    if (typeof window === 'undefined') return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);

  const rawWatchId = queryParams.get('watch') || queryParams.get('id') || queryParams.get('shikimori_id');
  const rawMalId   = queryParams.get('mal_id');
  const titleParam = queryParams.get('title') || 'Аниме';

  const validInitialId = rawWatchId && /^\d+$/.test(rawWatchId) ? rawWatchId : null;
  const [activeShikiId, setActiveShikiId] = useState(validInitialId);

  // 1. Резолвинг MAL ID -> Shikimori ID и валидация входных данных
  useEffect(() => {
    if (activeShikiId) return;

    // Проверка на некорректный ID в watch
    if (rawWatchId && !/^\d+$/.test(rawWatchId)) {
      setError('Некорректный формат идентификатора тайтла (ожидается числовой ID)');
      setLoading(false);
      return;
    }

    if (!rawMalId) {
      if (!rawWatchId) {
        setError('Не указан идентификатор тайтла (shikimori_id или mal_id)');
        setLoading(false);
      }
      return;
    }

    if (!/^\d+$/.test(rawMalId)) {
      setError('Некорректный формат идентификатора MyAnimeList (ожидается числовой ID)');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutSignal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : null;
    const fetchSignal = typeof AbortSignal.any === 'function' && timeoutSignal
      ? AbortSignal.any([controller.signal, timeoutSignal])
      : controller.signal;

    setLoading(true);
    setError(null);

    fetch(`/api/shikimori?mal_id=${encodeURIComponent(rawMalId)}`, { signal: fetchSignal })
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          const err = new Error(errData.error || `HTTP ${r.status}`);
          err.status = r.status;
          throw err;
        }
        return r.json();
      })
      .then((data) => {
        const foundId = data?.[0]?.id;
        if (!foundId) throw new Error('Тайтл не найден на Shikimori');
        setActiveShikiId(String(foundId));
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        setLoading(false);
        Sentry.captureException(err, { tags: { component: 'StandalonePlayer', step: 'resolveMal' } });
      });

    return () => controller.abort();
  }, [activeShikiId, rawMalId, rawWatchId]);

  // 2. Запрос списка озвучек из /api/get-info с таймаутом и AbortController
  useEffect(() => {
    if (!activeShikiId || !/^\d+$/.test(String(activeShikiId))) return;

    const controller = new AbortController();
    const timeoutSignal = typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : null;
    const fetchSignal = typeof AbortSignal.any === 'function' && timeoutSignal
      ? AbortSignal.any([controller.signal, timeoutSignal])
      : controller.signal;

    setLoading(true);
    setError(null);

    fetch(`/api/get-info?shikimori_id=${encodeURIComponent(activeShikiId)}`, { signal: fetchSignal })
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          const err = new Error(errData.error || `Ошибка загрузки плеера: HTTP ${r.status}`);
          err.status = r.status;
          throw err;
        }
        return r.json();
      })
      .then((data) => {
        const list = data?.translations || [];
        if (list.length === 0) {
          const notFoundErr = new Error('Тайтл не найден в базе Kodik');
          notFoundErr.status = 404;
          throw notFoundErr;
        }
        setTranslations(list);
        setSelectedId(String(list[0].id));
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message);
        if (err.status !== 404 && !err.message?.includes('не найден')) {
          Sentry.captureException(err, { tags: { component: 'StandalonePlayer', step: 'getInfo' } });
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [activeShikiId]);

  // Закрытие по Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        window.close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleClose = useCallback(() => {
    window.close();
  }, []);

  // Текущая выбранная озвучка и ссылка с валидацией схемы и доверенного хоста
  const currentTranslation = useMemo(() => {
    return translations.find((t) => String(t.id) === String(selectedId)) || translations[0];
  }, [translations, selectedId]);

  const playerUrl = useMemo(() => {
    const rawLink = currentTranslation?.link;
    if (!rawLink || typeof rawLink !== 'string') return null;
    try {
      const parsed = new URL(rawLink);
      const allowedHosts = ['kodikplayer.com', 'kodik.info'];
      const isAllowed = parsed.protocol === 'https:' &&
        allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
      return isAllowed ? parsed.toString() : null;
    } catch {
      return null;
    }
  }, [currentTranslation?.link]);

  return (
    <div className={styles.container}>
      {/* ── Шапка плеера ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.brandTag}>▶ KODIK THEATER</span>
          <h1 className={styles.title} title={titleParam}>
            {titleParam}
          </h1>
        </div>

        {translations.length > 0 && (
          <div className={styles.headerCenter}>
            <label htmlFor="voiceover-select" className={styles.selectLabel}>
              ОЗВУЧКА:
            </label>
            <select
              id="voiceover-select"
              className={styles.select}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              aria-label="Выбор озвучки"
            >
              {translations.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} {t.episodes_count ? `(${t.episodes_count} эп.)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.headerRight}>
          <a href="/" className={styles.navBtn} title="Вернуться к автомату рулетки">
            🎰 К РУЛЕТКЕ
          </a>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={handleClose}
            title="Закрыть вкладку (Esc)"
            aria-label="Закрыть вкладку"
          >
            ✕ ЗАКРЫТЬ
          </button>
        </div>
      </header>

      {/* ── Основная зона плеера ── */}
      <main className={styles.main}>
        {loading && (
          <div className={styles.statusBox}>
            <div className={styles.spinner}>⟳</div>
            <div className={styles.statusText}>
              ПОИСК ВИДЕОПОТОКА В БАЗЕ KODIK...
            </div>
          </div>
        )}

        {error && !loading && (
          <div className={`${styles.statusBox} ${styles.statusError}`}>
            <div className={styles.errorTitle}>⚠ ОШИБКА ЗАГРУЗКИ</div>
            <div className={styles.errorHint}>
              {error}
              <br />
              Возможно, тайтл отсутствует в базе Kodik или сервис временно недоступен.
            </div>
            <a href="/" className={styles.returnBtn}>
              ВЕРНУТЬСЯ В РУЛЕТКУ
            </a>
          </div>
        )}

        {!loading && !error && playerUrl && (
          <div className={styles.videoCard}>
            <iframe
              className={styles.iframe}
              src={playerUrl}
              title={`Плеер Kodik: ${titleParam}`}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            />
          </div>
        )}

        {!loading && !error && !playerUrl && translations.length > 0 && (
          <div className={`${styles.statusBox} ${styles.statusError}`}>
            <div className={styles.errorTitle}>⚠ НЕБЕЗОПАСНАЯ ССЫЛКА НА ПЛЕЕР</div>
            <div className={styles.errorHint}>
              Ссылка на видеопоток не прошла проверку доверенного домена Kodik.
            </div>
            <a href="/" className={styles.returnBtn}>
              ВЕРНУТЬСЯ В РУЛЕТКУ
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
