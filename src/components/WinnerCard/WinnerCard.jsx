/**
 * WinnerCard — CRT-экран игрового автомата.
 * Структура правой колонки (space-between):
 *   TOP    → Название (RU + EN) + Рейтинг
 *   MIDDLE → TARGET INFO (прицел)
 *   BOTTOM → Пиксельный кот + японские фразы
 *
 * Без жанров, без интерактивных кнопок — только CRT-контент.
 */

import { useState, useEffect } from 'react';
import { getShikimoriUrl } from '../../config/shikimori';
import styles from './WinnerCard.module.css';
import PixelCat from './PixelCat';

/* ── Маппинг типов ── */
const KIND_MAP = {
  tv:      { label: 'TV',    icon: '📺' },
  movie:   { label: 'Фильм', icon: '🎬' },
  ova:     { label: 'OVA',   icon: '📀' },
  ona:     { label: 'ONA',   icon: '🌐' },
  special: { label: 'Спэшл', icon: '⭐' },
  music:   { label: 'Клип',  icon: '🎵' },
};

/* ── Маппинг статусов ── */
const STATUS_MAP = {
  released: { label: 'Завершён', icon: '✅' },
  ongoing:  { label: 'Выходит',  icon: '🔴' },
  anons:    { label: 'Анонс',    icon: '🔔' },
};

/* ── Все 9 японских фраз — выбирается детерминированно для каждого выигрыша ── */
const ALL_JP = [
  { text: '《おめでとう！》', color: '#ff00aa' },   // Поздравляем!
  { text: 'アタリ！',          color: '#00ffcc' },   // Попадание!
  { text: 'やったー！',        color: '#00ff88' },   // Ура!
  { text: '★ 大勝利 ★',       color: '#ffee00' },   // Большая победа
  { text: 'ラッキー！',        color: '#ff6600' },   // Везунчик!
  { text: 'チャンス！',        color: '#cc00ff' },   // Шанс!
  { text: 'すごい！',          color: '#00aaff' },   // Невероятно!
  { text: '完璧！',            color: '#ff0066' },   // Идеально!
  { text: '神引き！',          color: '#ffd700' },   // Бог-ролл (гача-слэнг)
];

/* ── Компонент звёздочек ── */
function Stars({ score }) {
  const filled = Math.round((score / 10) * 5);
  return (
    <span className={styles.stars} aria-label={`Рейтинг: ${score} из 10`}>
      {'★'.repeat(filled)}{'☆'.repeat(Math.max(0, 5 - filled))}
    </span>
  );
}

/* ── Главный компонент ── */
export default function WinnerCard({ winner, source }) {
  const [posterIdx, setPosterIdx] = useState(0);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setPosterIdx(0);
    setImgFailed(false);
  }, [winner?.anime?.id]);

  if (!winner) return null;

  const anime    = winner.anime || {};
  const titleRu  = anime.russian || anime.name || 'Без названия';
  const titleEn  = anime.name    || '';
  const score    = parseFloat(anime.score) || 0;

  const kindInfo   = KIND_MAP[anime.kind]     || { label: anime.kind   || '—', icon: '🎭' };
  const statusInfo = STATUS_MAP[anime.status] || { label: anime.status || '—', icon: '❓' };
  const episodes   = anime.episodes || anime.episodes_aired || null;
  const year       = anime.aired_on ? anime.aired_on.slice(0, 4) : null;

  const jpIdx = anime.id ? Math.abs(Number(anime.id)) % ALL_JP.length : 0;
  const jpPhrase = ALL_JP[jpIdx];

  /* Постер — цепочка приоритетов:
     Shikimori original → Shikimori preview → MAL large → MAL medium → 🎌 */
  const img = anime.image || {};

  const makeShikiSrc = (p) => {
    if (!p || /missing/i.test(p)) return null;
    return getShikimoriUrl(p);
  };

  const posterChain = [
    makeShikiSrc(img.original),
    makeShikiSrc(img.preview || img.x96),
    img.malLarge  || null,
    img.malMedium || null,
  ].filter(Boolean);

  const currentPoster = !imgFailed && posterIdx < posterChain.length ? posterChain[posterIdx] : null;

  const handleError = () => {
    if (posterIdx + 1 < posterChain.length) {
      setPosterIdx((idx) => idx + 1);
    } else {
      setImgFailed(true);
    }
  };

  const handleLoad = (e) => {
    if (e.target.naturalWidth < 10 || e.target.naturalHeight < 10) {
      handleError();
    }
  };

  const handleWatch = (e) => {
    e.stopPropagation();
    const params = new URLSearchParams();
    if (anime.id) params.set('watch', String(anime.id));
    if (anime.mal_id) params.set('mal_id', String(anime.mal_id));
    params.set('title', titleRu);
    if (source) params.set('source', source);
    window.open(`/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Победитель рулетки: ${titleRu}`}
    >
      <div className={styles.card}>

        {/* ── Шапка ── */}
        <div className={styles.cardHeader}>
          <span className={styles.headerLabel}>🎉 WINNER!</span>
          <span className={styles.headerStars}>★★★</span>
          <span className={styles.headerLabel}>🎉 WINNER!</span>
        </div>

        {/* ── Тело ── */}
        <div className={styles.body}>

          {/* ─── Постер (левая колонка) ─── */}
          <div className={styles.posterCol}>
            {currentPoster ? (
              <img
                className={styles.poster}
                src={currentPoster}
                alt={`Постер: ${titleRu}`}
                onLoad={handleLoad}
                onError={handleError}
              />
            ) : (
              <div className={styles.posterFallback}>🎌</div>
            )}
          </div>

          {/* ─── Правая колонка: space-between → TOP / MIDDLE / BOTTOM ─── */}
          <div className={styles.infoCol}>

            {/* ── ТОП: Название + Рейтинг ── */}
            <div className={styles.topBlock}>
              <h2 className={styles.titleRu}>{titleRu}</h2>
              {titleEn && titleEn !== titleRu && (
                <p className={styles.titleEn}>{titleEn}</p>
              )}
              {score > 0 && (
                <div className={styles.rating}>
                  <Stars score={score} />
                  <span className={styles.ratingNum}>{score.toFixed(1)}</span>
                  <span className={styles.ratingLabel}>/ 10</span>
                </div>
              )}
            </div>

            {/* ── СЕРЕДИНА: TARGET INFO — прицел бортового компьютера ── */}
            <div className={styles.targetBox} role="group" aria-label="Данные тайтла">
              {/* Угловые скобки */}
              <div className={styles.cTL} aria-hidden="true" />
              <div className={styles.cTR} aria-hidden="true" />
              <div className={styles.cBL} aria-hidden="true" />
              <div className={styles.cBR} aria-hidden="true" />

              {/* Заголовок прицела */}
              <div className={styles.targetHeader} aria-hidden="true">
                <span className={styles.targetLine} />
                <span className={styles.targetTitle}>TARGET INFO</span>
                <span className={styles.targetLine} />
              </div>

              {/* Сетка 2×2 */}
              <div className={styles.metaGrid}>
                <div className={styles.metaCell}>
                  <span className={styles.metaIcon}>{kindInfo.icon}</span>
                  <span className={styles.metaVal}>{kindInfo.label}</span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaIcon}>🎬</span>
                  <span className={styles.metaVal}>{episodes ? `${episodes} эп.` : '—'}</span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaIcon}>📅</span>
                  <span className={styles.metaVal}>{year || '—'}</span>
                </div>
                <div className={styles.metaCell}>
                  <span className={styles.metaIcon}>{statusInfo.icon}</span>
                  <span className={styles.metaVal}>{statusInfo.label}</span>
                </div>
              </div>

              {/* Подвал прицела */}
              <div className={styles.targetFooter} aria-hidden="true">
                <span className={styles.targetLine} />
                <span className={styles.targetFootText}>TARGET ACQUIRED</span>
                <span className={styles.targetLine} />
              </div>
            </div>

            {/* ── Кнопка «Смотреть онлайн» ── */}
            <div className={styles.watchActionWrap}>
              <button
                type="button"
                className={styles.watchBtn}
                onClick={handleWatch}
                aria-label={`Смотреть аниме онлайн: ${titleRu}`}
              >
                <span className={styles.watchIcon} aria-hidden="true">▶</span>
                <span className={styles.watchText}>СМОТРЕТЬ ОНЛАЙН</span>
              </button>
            </div>

            {/* ── НИЗ: Кот + одна рандомная японская фраза ── */}
            <div className={styles.bottomBlock} aria-label="Маскот и поздравления">
              <PixelCat />
              <div className={styles.jpWrap} aria-hidden="true">
                <span
                  className={styles.jpPhrase}
                  style={{ color: jpPhrase.color, '--glow': jpPhrase.color }}
                >
                  {jpPhrase.text}
                </span>
              </div>
            </div>

          </div>{/* /infoCol */}
        </div>{/* /body */}
      </div>{/* /card */}
    </div>
  );
}
