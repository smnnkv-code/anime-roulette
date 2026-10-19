import styles from './Marquee.module.css';

/**
 * Marquee — верхнее мигающее табло аркадного кабинета.
 */
export default function Marquee({ nickname, animeCount, isEnriching }) {
  const enrichText = isEnriching ? '  🖼 ЗАГРУЗКА ПОСТЕРОВ...  ' : '';
  const tickerText = nickname
    ? `>>> PLAYER: @${nickname.toUpperCase()} <<<  ЗАГРУЖЕНО ТАЙТЛОВ: ${animeCount}${enrichText}  >>> УДАЧИ В РУЛЕТКЕ! <<<  `
    : `>>> ДОБРО ПОЖАЛОВАТЬ В АНИМЕ-РУЛЕТКУ <<<  ВВЕДИ НИКНЕЙМ И ТОКЕН ДЛЯ НАЧАЛА ИГРЫ  >>>  `;

  return (
    <header className={styles.marquee} role="banner" aria-label="Arcade marquee">
      <div className={styles.strip} />

      <h1 className={styles.titleJp} aria-label="Аниме Рулетка">
        アニメ・ルーレット
      </h1>

      {/* Звёздочки между японским и английским — перенесены из ::before/::after */}
      <div className={styles.starsRow} aria-hidden="true">
        ★ ★ ★ ★ ★
      </div>

      <p className={styles.titleEn}>
        ANIME&nbsp;ROULETTE&nbsp;★&nbsp;GACHA&nbsp;MODE
      </p>

      <div className={styles.ticker} aria-hidden="true">
        <span className={styles.tickerInner}>
          {tickerText.repeat(3)}
        </span>
      </div>

      <div className={styles.strip} />
    </header>
  );
}
