/**
 * WatchModal — аркадное модальное окно для просмотра аниме.
 *
 * Рендерится через ReactDOM.createPortal в document.body.
 *
 * Режимы плеера:
 *   'retro'    — кастомный RetroPlayer (HLS.js + AnimeParsers)
 *   'kodik'    — Kodik iframe (fallback, без токена)
 *
 * Закрытие: backdrop, [✕ CLOSE], Escape
 *
 * Shikimori ID:
 *   Shikimori source → anime.id напрямую
 *   MAL source       → резолвим по mal_id через /api/shikimori
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import RetroPlayer from '../RetroPlayer/RetroPlayer';
import styles from './WatchModal.module.css';

function makeKodikUrl(shikimoriId, titleRu = '') {
  const params = new URLSearchParams();
  params.set('watch', String(shikimoriId));
  if (titleRu) params.set('title', titleRu);
  return `/?${params.toString()}`;
}

export default function WatchModal({ winner, source, onClose }) {
  const [shikimoriId, setShikimoriId] = useState(null);
  const [resolving,   setResolving]   = useState(false);
  const [resolveErr,  setResolveErr]  = useState(null);
  const [isFallback,  setIsFallback]  = useState(false);

  const overlayRef = useRef(null);

  const anime   = winner?.anime || {};
  const titleRu = anime.russian || anime.name || '';

  /* ── Определяем Shikimori ID ──────────────────────────────────── */
  useEffect(() => {
    if (!winner) return;

    if (source !== 'mal') {
      setShikimoriId(anime.id);
      return;
    }

    const malId = anime.mal_id;
    if (!malId) {
      setResolveErr('MAL ID недоступен');
      return;
    }

    const cached = sessionStorage.getItem(`shiki_id_for_mal_${malId}`);
    if (cached) {
      setShikimoriId(cached);
      return;
    }

    setResolving(true);
    setResolveErr(null);

    fetch(`/api/shikimori?mal_id=${encodeURIComponent(malId)}`)
      .then(async (r) => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then(data => {
        const id = data?.[0]?.id;
        if (!id) throw new Error('Тайтл не найден на Shikimori');
        sessionStorage.setItem(`shiki_id_for_mal_${malId}`, String(id));
        setShikimoriId(id);
      })
      .catch(err => setResolveErr(err.message))
      .finally(() => setResolving(false));
  }, [winner, source, anime.id, anime.mal_id]);

  /* ── Escape ───────────────────────────────────────────────────── */
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  /* ── Блокируем скролл body ────────────────────────────────────── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  /* ── Backdrop click ───────────────────────────────────────────── */
  const handleBackdropClick = useCallback((e) => {
    if (e.target === overlayRef.current) onClose();
  }, [onClose]);

  /* ── Pop-out ─────────────────────────────────────────────────── */
  const handlePopOut = useCallback(() => {
    if (!shikimoriId) return;
    window.open(makeKodikUrl(shikimoriId, titleRu), '_blank', 'noopener,noreferrer');
  }, [shikimoriId, titleRu]);

  /* ── Fallback RetroPlayer → предложение открыть в новой вкладке ── */
  const handleFallback = useCallback(() => {
    setIsFallback(true);
  }, []);

  const footerLabel = 'HLS PLAYER  ◆  НАЖМИ Esc ДЛЯ ВЫХОДА';

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Просмотр: ${titleRu}`}
    >
      <div className={styles.modal}>

        {/* ── Шапка ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.headerTag}>▶ FIELD TEST</span>
            <span className={styles.headerTitle}>{titleRu}</span>
          </div>
          <div className={styles.headerRight}>
            {/* Pop-out */}
            {shikimoriId && (
              <button
                className={styles.popOutBtn}
                onClick={handlePopOut}
                title="Открыть в новой вкладке"
                aria-label="Открыть в новой вкладке"
              >
                ⧉ POP&nbsp;OUT
              </button>
            )}
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Закрыть"
            >
              ✕&nbsp;CLOSE
            </button>
          </div>
        </div>

        {/* ── Разделитель ── */}
        <div className={styles.divider} aria-hidden="true" />

        {/* ── Область плеера ── */}
        <div className={styles.playerWrap}>

          {/* Резолвинг MAL → Shikimori ID */}
          {resolving && (
            <div className={styles.status}>
              <span className={styles.statusIcon}>⟳</span>
              <span>ПОИСК НА SHIKIMORI...</span>
            </div>
          )}

          {/* Ошибка резолвинга */}
          {resolveErr && (
            <div className={styles.statusError}>
              <span>⚠ {resolveErr}</span>
              <p className={styles.statusHint}>
                Попробуй найти тайтл вручную на{' '}
                <a
                  href={`https://kodik.info/search?q=${encodeURIComponent(titleRu)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.statusLink}
                >
                  kodik.info
                </a>
              </p>
            </div>
          )}

          {/* Плеер — только когда shikimoriId известен */}
          {shikimoriId && !resolving && !resolveErr && (
            isFallback ? (
              <div className={styles.status}>
                <span>⚠ Не удалось загрузить встроенный плеер.</span>
                <button
                  type="button"
                  className={styles.popOutBtn}
                  onClick={handlePopOut}
                  style={{ marginTop: '12px' }}
                >
                  ⧉ ОТКРЫТЬ В НОВОЙ ВКЛАДКЕ
                </button>
              </div>
            ) : (
              <RetroPlayer
                shikimoriId={String(shikimoriId)}
                titleRu={titleRu}
                onFallback={handleFallback}
              />
            )
          )}
        </div>

        {/* ── Подвал ── */}
        <div className={styles.footer} aria-hidden="true">
          <span className={styles.footerText}>{footerLabel}</span>
        </div>

      </div>
    </div>,
    document.body,
  );
}
