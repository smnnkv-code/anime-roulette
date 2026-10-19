import styles from './SpinButton.module.css';

const LABELS = {
  setup:    { line1: 'LOAD',  line2: 'LIST'  },
  loading:  { line1: '...',   line2: ''      },
  ready:    { line1: 'START', line2: 'SPIN'  },
  spinning: { line1: 'WAIT',  line2: '...'   },
  winner:   { line1: 'SPIN',  line2: 'AGAIN' },
  error:    { line1: 'RETRY', line2: ''      },
};

/**
 * SpinButton — огромная глянцевая аркадная кнопка.
 * @param {string}   phase     — текущая фаза приложения
 * @param {Function} onClick   — обработчик нажатия
 * @param {number}   spinCount — счётчик прокруток
 */
export default function SpinButton({ phase, onClick, spinCount = 0 }) {
  const label   = LABELS[phase] || LABELS.ready;
  const disabled = phase === 'loading' || phase === 'spinning';

  const btnClass = [
    styles.button,
    phase === 'spinning' ? styles.spinning : '',
    phase === 'winner'   ? styles.winner   : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.wrapper}>
      <button
        id="spin-button"
        className={btnClass}
        onClick={onClick}
        disabled={disabled}
        aria-label={`${label.line1} ${label.line2}`.trim()}
        aria-busy={phase === 'spinning'}
      >
        <span className={styles.label}>
          {label.line1}
          {label.line2 && <><br />{label.line2}</>}
        </span>
      </button>

      {spinCount > 0 && (
        <span className={styles.counter}>ROLLS: {spinCount}</span>
      )}
    </div>
  );
}
