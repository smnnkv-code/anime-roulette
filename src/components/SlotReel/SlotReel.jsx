import { useEffect, useRef, useState } from 'react';
import LEDFrame from '../LEDFrame/LEDFrame';
import styles from './SlotReel.module.css';

const ITEM_HEIGHT = 300; // Должен совпадать с useSlotAnimation и CSS

function ReelItem({ item }) {
  const [src, setSrc] = useState(item.imageUrl);
  const [failed, setFailed] = useState(!item.imageUrl);

  const handleError = () => {
    if (src !== item.imageFallback && item.imageFallback) {
      setSrc(item.imageFallback);
    } else {
      setFailed(true);
    }
  };

  return (
    <div className={styles.reelItem}>
      {!failed && src ? (
        <img
          src={src}
          alt={item.titleRu}
          loading="lazy"
          onError={handleError}
        />
      ) : (
        <div className={styles.noImage}>🎌</div>
      )}
    </div>
  );
}

/**
 * SlotReel — центральный барабан с лентой обложек аниме.
 *
 * @param {string}   appPhase    — текущая фаза приложения: 'setup'|'loading'|'ready'|'spinning'|'winner'|'error'
 * @param {Array}    reelItems   — лента объектов { id, imageUrl, titleRu }
 * @param {Function} onSpinEnd   — callback по окончании анимации
 */
export default function SlotReel({ appPhase, reelItems, onSpinEnd }) {
  const stripRef  = useRef(null);
  const [blurClass, setBlurClass] = useState('');

  // Управление анимацией через DOM
  useEffect(() => {
    if (appPhase !== 'spinning' || !stripRef.current || reelItems.length === 0) return;

    const strip = stripRef.current;

    // 1. Мгновенно ставим в начало (без transition)
    strip.style.transition = 'none';
    strip.style.transform  = 'translateY(0)';

    // 2. Принудительный reflow для сброса transition
    void strip.offsetHeight;

    // 3. Добавляем плавный transition
    strip.style.transition = `transform 4.5s cubic-bezier(0.15, 0.85, 0.35, 1)`;

    // 4. Рассчитываем финальную позицию (победитель — последний элемент)
    const finalY = -((reelItems.length - 1) * ITEM_HEIGHT);
    strip.style.transform = `translateY(${finalY}px)`;

    // 5. Blur по таймингу: нарастает в первые 30% и убывает в последние 30%
    const totalMs = 4500;
    const blurStartMs  = totalMs * 0.10; // 450ms
    const blurPeakMs   = totalMs * 0.30; // 1350ms
    const blurFadeMs   = totalMs * 0.65; // 2925ms
    const blurEndMs    = totalMs * 0.85; // 3825ms

    const t1 = setTimeout(() => setBlurClass(styles.blurMedium), blurStartMs);
    const t2 = setTimeout(() => setBlurClass(styles.blurPeak),   blurPeakMs);
    const t3 = setTimeout(() => setBlurClass(styles.blurMedium), blurFadeMs);
    const t4 = setTimeout(() => setBlurClass(''),                blurEndMs);

    // 6. По окончании transition — сообщаем о конце (с защитой от зависания при неактивной вкладке)
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      strip.removeEventListener('transitionend', onTransitionEnd);
      onSpinEnd?.();
    };

    const onTransitionEnd = (e) => {
      if (e.propertyName === 'transform') {
        finish();
      }
    };
    strip.addEventListener('transitionend', onTransitionEnd, { once: true });

    // Страховочный таймер: если вкладка была скрыта и transitionend не сработал
    const safetyTimer = setTimeout(finish, totalMs + 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(safetyTimer);
      strip.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [appPhase, reelItems, onSpinEnd]);

  // ── Экран ожидания (idle / setup) ──────────────────────────────────────
  if (appPhase === 'setup') {
    return (
      <div className={styles.reelWrapper}>
        <div className={styles.ledContainer}>
          <LEDFrame phase="idle">
            <div className={styles.idleScreen}>
              <div className={styles.idleIcon}>🎰</div>
              <div className={styles.idleText}>
                {'> ENTER NICKNAME\n& API TOKEN'}
              </div>
            </div>
          </LEDFrame>
        </div>
      </div>
    );
  }

  // ── Экран загрузки ────────────────────────────────────────────────────
  if (appPhase === 'loading') {
    return (
      <div className={styles.reelWrapper}>
        <div className={styles.ledContainer}>
          <LEDFrame phase="spinning">
            <div className={styles.idleScreen}>
              <div className={styles.spinner} />
              <div className={styles.loadingText}>LOADING DATA...</div>
            </div>
          </LEDFrame>
        </div>
      </div>
    );
  }

  // ── Барабан: ready / spinning / winner ────────────────────────────────
  const ledPhase = appPhase === 'spinning' ? 'spinning' : appPhase === 'winner' ? 'done' : 'idle';

  return (
    <div className={styles.reelWrapper}>
      <div className={styles.ledContainer}>
        <LEDFrame phase={ledPhase}>
          <div className={styles.viewport}>
            {/* Победная рамка — показывается после остановки */}
            {appPhase === 'winner' && (
              <div className={styles.winnerHighlight} aria-hidden="true" />
            )}

            {reelItems.length === 0 ? (
              /* READY: пустой экран с надписью */
              <div className={styles.idleScreen}>
                <div className={styles.idleIcon}>🎯</div>
                <div className={styles.idleText}>PRESS START!</div>
              </div>
            ) : (
              /* Лента обложек */
              <div
                ref={stripRef}
                className={`${styles.strip} ${blurClass}`}
                aria-live="polite"
                aria-atomic="true"
              >
                {reelItems.map((item, idx) => (
                  <ReelItem key={`${item.id}-${idx}`} item={item} />
                ))}
              </div>
            )}
          </div>
        </LEDFrame>
      </div>
    </div>
  );
}
