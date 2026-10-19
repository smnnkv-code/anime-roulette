/**
 * FieldTestButton — аркадная кнопка «▶ FIELD TEST / СМОТРЕТЬ ОНЛАЙН».
 * Появляется под ShikiButton в состоянии winner.
 * Неактивна пока нет winner; для MAL-источника показывает tooltip.
 *
 * @param {boolean}  active     — winner уже выбран
 * @param {string}   source     — 'shikimori' | 'mal'
 * @param {Function} onClick    — открыть WatchModal
 */
import styles from './FieldTestButton.module.css';

export default function FieldTestButton({ active, source, onClick }) {
  const isMal    = source === 'mal';
  const disabled = !active;
  const tooltip  = isMal
    ? 'Shikimori ID не нужен — поиск автоматический через MAL'
    : !active
      ? 'Дождись результата рулетки'
      : null;

  return (
    <button
      id="field-test-button"
      className={`${styles.btn} ${active ? styles.active : ''}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={tooltip || undefined}
      aria-label="Смотреть аниме онлайн через Kodik"
    >
      {/* Физическая «подложка» кнопки — имитация аркадной кнопки */}
      <span className={styles.shadow} aria-hidden="true" />

      {/* Лицевая часть */}
      <span className={styles.face}>
        <span className={styles.label}>▶ FIELD TEST</span>
        <span className={styles.sublabel}>СМОТРЕТЬ ОНЛАЙН</span>
      </span>

      {/* Glow-кольцо (видно только в active) */}
      <span className={styles.glow} aria-hidden="true" />
    </button>
  );
}
