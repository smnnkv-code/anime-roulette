import { SHIKIMORI_DOMAIN } from '../../config/shikimori';
import styles from './ShikiButton.module.css';

/**
 * ShikiButton — C1: аркадная ссылка под экраном рулетки.
 * Меняет текст, цвет и URL в зависимости от источника аниме-листа.
 *
 * @param {number|string} animeId  — ID аниме на Shikimori
 * @param {number|string} malId    — MAL ID аниме
 * @param {string}        source   — 'shikimori' | 'mal'
 * @param {string}        titleRu  — название аниме (для aria-label)
 */
export default function ShikiButton({ animeId, malId, source = 'shikimori', titleRu }) {
  const isMal = source === 'mal';

  const url = isMal && malId
    ? `https://myanimelist.net/anime/${malId}`
    : `${SHIKIMORI_DOMAIN}/animes/${animeId}`;

  const label   = isMal ? '▶ ОТКРЫТЬ НА MY ANIME LIST' : '▶ ОТКРЫТЬ НА SHIKIMORI';
  const icon    = isMal ? '🔵' : '🔗';
  const btnCls  = `${styles.btn} ${isMal ? styles.malBtn : ''}`.trim();

  if (!animeId && !malId) return null;

  return (
    <div className={styles.wrap}>
      <a
        id="shikimori-open-link"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={btnCls}
        aria-label={`Открыть ${titleRu || ''} ${isMal ? 'на MyAnimeList' : 'на Shikimori'}`}
      >
        <span className={styles.icon}>{icon}</span>
        {label}
      </a>
    </div>
  );
}
