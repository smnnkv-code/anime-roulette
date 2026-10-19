/**
 * RetroPlayer — Аркадный плеер с выбором озвучки и серии
 *
 * Архитектура (после DDoS-guard исследования):
 *  - get-info  : server-side → kodik-api.com → список переводов          ✅
 *  - get-episodes: server-side → парсит embed HTML → {id, hash} серий    ✅
 *  - Плеер     : <iframe> с прямым URL /seria/{id}/{hash}/720p            ✅
 *                (работает в браузере пользователя — не блокируется)
 *
 * Фазы:
 *  'loading'          — запрашиваем get-info
 *  'selection'        — пользователь выбирает озвучку и серию
 *  'loading-episodes' — запрашиваем get-episodes для выбранного перевода
 *  'playing'          — показываем iframe с конкретной серией
 *
 * @param {string}   shikimoriId  — Shikimori ID тайтла
 * @param {string}   titleRu      — Название для отображения
 * @param {Function} onFallback   — callback при fallback на общий Kodik iframe
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './RetroPlayer.module.css';

/* ── Хелперы ──────────────────────────────────────────────────────────────── */

/** Строит iframe URL для конкретной серии/фильма */
function buildEpisodeUrl(link, episode) {
  const isMovie = link.includes('/video/');
  const type    = isMovie ? 'video' : 'seria';
  return `https://kodikplayer.com/${type}/${episode.id}/${episode.hash}/720p`;
}

/** Ключ кеша для списка серий */
function epsCacheKey(link) {
  return `retro_eps_${link.replace(/[^a-z0-9]/gi, '_').slice(-60)}`;
}

/* ── Компонент ──────────────────────────────────────────────────────────────── */
export default function RetroPlayer({ shikimoriId, titleRu, onFallback }) {
  const [phase,         setPhase]         = useState('loading');
  const [info,          setInfo]          = useState(null);    // { translations }
  const [selectedTrans, setSelectedTrans] = useState(null);   // translation object
  const [selectedEp,    setSelectedEp]    = useState(1);
  const [iframeSrc,     setIframeSrc]     = useState(null);   // URL текущей серии

  const iframeRef = useRef(null);

  /* ── Шаг 1: get-info — переводы ──────────────────────────────────────── */
  useEffect(() => {
    if (!shikimoriId) return;

    const cacheKey = `retro_info_${shikimoriId}`;
    const cached   = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setInfo(parsed);
        setSelectedTrans(parsed.translations[0] || null);
        setPhase('selection');
        return;
      } catch { /* битый кеш */ }
    }

    setPhase('loading');

    fetch(`/api/get-info?shikimori_id=${shikimoriId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const text = await res.text();
        if (!text.trim()) throw new Error(`Пустой ответ (${res.status})`);
        let data;
        try { data = JSON.parse(text); } catch { throw new Error('Некорректный JSON'); }
        if (data.error) throw new Error(data.error);
        return data;
      })
      .then(data => {
        if (!data.translations?.length) throw new Error('Переводы не найдены');
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        setInfo(data);
        setSelectedTrans(data.translations[0]);
        setPhase('selection');
      })
      .catch(err => {
        console.warn('[RetroPlayer] get-info failed:', err.message);
        onFallback?.();  // → общий Kodik iframe
      });
  }, [shikimoriId, onFallback]);

  /* ── Шаг 2: Запуск — get-episodes → iframe ───────────────────────────── */
  const handlePlay = useCallback(async () => {
    if (!selectedTrans?.link) return;

    setPhase('loading-episodes');

    try {
      const cacheKey = epsCacheKey(selectedTrans.link);
      let episodes;

      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try { episodes = JSON.parse(cached); } catch { /* пересчитаем */ }
      }

      if (!episodes) {
        const params = new URLSearchParams({ link: selectedTrans.link });
        const res    = await fetch(`/api/get-episodes?${params}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${res.status}`);
        }
        let data;
        try {
          data = await res.json();
        } catch {
          throw new Error(`Некорректный ответ сервера (${res.status})`);
        }
        if (data.error) throw new Error(data.error);
        if (!Array.isArray(data.episodes) || data.episodes.length === 0) {
          throw new Error('Серии не найдены в ответе API');
        }
        episodes = data.episodes;
        sessionStorage.setItem(cacheKey, JSON.stringify(episodes));
      }

      // Находим нужную серию
      const ep = episodes.find(e => e.num === selectedEp) || episodes[0];
      if (!ep) throw new Error(`Серия ${selectedEp} не найдена`);

      const url = buildEpisodeUrl(selectedTrans.link, ep);
      setIframeSrc(url);
      setPhase('playing');

    } catch (err) {
      console.warn('[RetroPlayer] get-episodes failed:', err.message);
      onFallback?.();
    }
  }, [selectedTrans, selectedEp, onFallback]);

  /* ── Возврат к выбору ──────────────────────────────────────────────── */
  const handleBack = useCallback(() => {
    setIframeSrc(null);
    setPhase('selection');
  }, []);

  /* ── Рендер ─────────────────────────────────────────────────────────── */
  const episodesCount = selectedTrans?.episodes_count ?? 1;
  const epNumbers     = Array.from({ length: episodesCount }, (_, i) => i + 1);

  return (
    <div className={styles.root}>

      {/* ── LOADING (get-info) ── */}
      {phase === 'loading' && (
        <div className={styles.status}>
          <span className={styles.spinner}>⟳</span>
          <span>ЗАГРУЗКА ДАННЫХ...</span>
          <span className={styles.subStatus}>ОБРАЩЕНИЕ К KODIK PARSERS</span>
        </div>
      )}

      {/* ── LOADING EPISODES ── */}
      {phase === 'loading-episodes' && (
        <div className={styles.status}>
          <span className={styles.spinner}>⟳</span>
          <span>ЗАГРУЗКА СЕРИИ...</span>
          <span className={styles.subStatus}>ВЫБОР ЭПИЗОДА</span>
        </div>
      )}

      {/* ── SELECTION ── */}
      {phase === 'selection' && info && (
        <div className={styles.selection}>

          {/* Озвучка */}
          <div className={styles.row}>
            <label className={styles.fieldLabel} htmlFor="rp-translation">
              ОЗВУЧКА
            </label>
            <select
              id="rp-translation"
              className={styles.select}
              value={selectedTrans?.id ?? ''}
              onChange={(e) => {
                const t = info.translations.find(x => x.id === e.target.value);
                if (t) { setSelectedTrans(t); setSelectedEp(1); }
              }}
            >
              {info.translations.map(t => (
                <option key={t.id} value={t.id}>
                  {t.type === 'subtitles' ? `[SUB] ${t.title}` : t.title}
                </option>
              ))}
            </select>
          </div>

          {/* Выбор серии */}
          {episodesCount > 1 && (
            <div className={styles.episodeSection}>
              <div className={styles.fieldLabel}>
                СЕРИЯ — <span className={styles.epCurrent}>{selectedEp}</span>
                <span className={styles.epTotal}> / {episodesCount}</span>
              </div>
              {episodesCount <= 50 ? (
                <div className={styles.episodeGrid}>
                  {epNumbers.map(ep => (
                    <button
                      key={ep}
                      className={`${styles.epBtn} ${ep === selectedEp ? styles.epActive : ''}`}
                      onClick={() => setSelectedEp(ep)}
                      aria-label={`Серия ${ep}`}
                    >
                      {ep}
                    </button>
                  ))}
                </div>
              ) : (
                <select
                  id="rp-episode-select"
                  className={styles.select}
                  value={selectedEp}
                  onChange={(e) => setSelectedEp(Number(e.target.value))}
                  aria-label="Выбор серии"
                >
                  {epNumbers.map(ep => (
                    <option key={ep} value={ep}>
                      Серия {ep} из {episodesCount}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Кнопки */}
          <div className={styles.actions}>
            <button
              className={styles.playBtn}
              onClick={handlePlay}
              disabled={!selectedTrans}
            >
              ▶ СМОТРЕТЬ{episodesCount > 1 ? ` СЕР. ${selectedEp}` : ''}
            </button>
            <button className={styles.iframeBtn} onClick={onFallback}>
              ⊞ KODIK IFRAME
            </button>
          </div>
        </div>
      )}

      {/* ── PLAYING — iframe с конкретным эпизодом ── */}
      {phase === 'playing' && iframeSrc && (
        <div className={styles.iframeWrap}>
          <div className={styles.playingMeta}>
            <span className={styles.playingInfo}>
              {selectedTrans?.title}
              {episodesCount > 1 && <> ◆ СЕР.&nbsp;{selectedEp}&nbsp;/&nbsp;{episodesCount}</>}
            </span>
            <div className={styles.playingActions}>
              <button className={styles.changeBtn} onClick={handleBack}>
                ← НАЗАД
              </button>
              <button className={styles.iframeBtn} onClick={onFallback}>
                ⊞ IFRAME
              </button>
            </div>
          </div>
          <iframe
            ref={iframeRef}
            src={iframeSrc}
            className={styles.iframe}
            allowFullScreen
            allow="autoplay; fullscreen"
            scrolling="no"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
            title={`${titleRu} — Серия ${selectedEp}`}
          />
        </div>
      )}

    </div>
  );
}
