import { useState, useEffect, useRef } from 'react';
import styles from './CoinSlot.module.css';

const MESSAGES = {
  setup:    { text: 'INSERT COIN_',  cls: 'idle'    },
  loading:  { text: 'LOADING..._',   cls: 'spinning' },
  ready:    { text: 'READY!_',       cls: 'ready'   },
  spinning: { text: 'SPINNING..._',  cls: 'spinning' },
  winner:   { text: 'WINNER!!!_',    cls: 'winner'  },
  error:    { text: 'ERROR!_',       cls: 'idle'    },
};

/**
 * CoinSlot — декоративный монетоприёмник с typewriter-анимацией статуса.
 * Вариант B: посимвольный набор с мигающим курсором.
 */
export default function CoinSlot({ phase, onCoinDrop, isMuted, onToggleMute }) {
  const target = MESSAGES[phase] || MESSAGES.setup;
  const [displayed, setDisplayed] = useState('');
  const [coinDropping, setCoinDropping] = useState(false);
  const prevPhase = useRef(phase);
  const typeTimer = useRef(null);

  // Typewriter-эффект: когда фаза меняется — перепечатываем текст
  useEffect(() => {
    // Бросаем монетку при переходе к spinning
    if (phase === 'spinning' && prevPhase.current !== 'spinning') {
      setCoinDropping(true);
      onCoinDrop?.();
      setTimeout(() => setCoinDropping(false), 600);
    }
    prevPhase.current = phase;

    const fullText = target.text;
    let idx = 0;
    setDisplayed('');

    clearInterval(typeTimer.current);
    typeTimer.current = setInterval(() => {
      idx++;
      setDisplayed(fullText.slice(0, idx));
      if (idx >= fullText.length) clearInterval(typeTimer.current);
    }, 60);

    return () => clearInterval(typeTimer.current);
  }, [phase, target.text, onCoinDrop]);

  return (
    <div className={styles.coinSlot} aria-label="Coin slot status">
      {/* Корпус монетоприёмника */}
      <div className={styles.slotBody}>
        <div className={styles.slotOuter}>
          <div className={styles.slotGap} />
          <div className={styles.slotLabel}>COIN</div>
        </div>

        {/* Монетка */}
        <div className={`${styles.coin} ${coinDropping ? styles.dropping : ''}`} />
      </div>

      {/* Typewriter-текст */}
      <div className={styles.textArea}>
        <span
          className={`${styles.statusText} ${styles[target.cls]}`}
          role="status"
          aria-live="polite"
        >
          {displayed}
        </span>
      </div>

      {/* Кнопка Mute/Sound */}
      {onToggleMute && (
        <button
          type="button"
          className={styles.muteBtn}
          onClick={onToggleMute}
          title={isMuted ? 'Включить звук' : 'Выключить звук'}
          aria-label={isMuted ? 'Включить звук' : 'Выключить звук'}
        >
          {isMuted ? '🔇 MUTE' : '🔊 SOUND'}
        </button>
      )}
    </div>
  );
}
