import styles from './ArcadeCabinet.module.css';

/**
 * ArcadeCabinet — корпус аркадного автомата.
 *
 * @param {ReactNode} marquee      — верхнее табло
 * @param {ReactNode} screenArea   — область барабана
 * @param {ReactNode} shikiSlot    — слот под экраном (ShikiButton в winner-состоянии)
 * @param {ReactNode} playerInput  — форма игрока
 * @param {ReactNode} controlPanel — панель управления
 * @param {string}    phase        — текущая фаза ('spinning' | 'winner' | ...)
 */
export default function ArcadeCabinet({
  marquee,
  screenArea,
  shikiSlot,
  playerInput,
  controlPanel,
  phase,
}) {
  const isSpinning = phase === 'spinning';

  return (
    <div className={styles.scene}>
      <div className={styles.cabinet} role="main" aria-label="Аркадный автомат Аниме-рулетка">

        {/* Болты по углам */}
        <div className={`${styles.bolt} ${styles.boltTL}`} aria-hidden="true" />
        <div className={`${styles.bolt} ${styles.boltTR}`} aria-hidden="true" />
        <div className={`${styles.bolt} ${styles.boltBL}`} aria-hidden="true" />
        <div className={`${styles.bolt} ${styles.boltBR}`} aria-hidden="true" />

        {/* Верхнее табло */}
        {marquee}

        {/* Основная секция */}
        <div className={styles.body}>

          {/* Область экрана */}
          <div className={styles.screenArea}>
            {screenArea}
          </div>

          {/* C1 — ShikiButton слот под экраном (visible only in winner) */}
          {shikiSlot && (
            <div className={styles.shikiArea}>
              {shikiSlot}
            </div>
          )}

          <div className={styles.dividerStrip} aria-hidden="true" />

          {/* Форма игрока */}
          {playerInput}

          <div className={styles.dividerStrip} aria-hidden="true" />

          {/* Нижняя панель управления */}
          <div className={styles.controlPanel}>

            {/* D2 — Clockwork джойстик: вращается во время спина */}
            <div
              className={`${styles.joystick} ${isSpinning ? styles.joystickSpinning : ''}`}
              aria-hidden="true"
            >
              <div className={styles.joystickStick}>
                <div className={styles.joystickTop} />
              </div>
              <div className={styles.joystickBase} />
            </div>

            {/* Основные элементы управления */}
            {controlPanel}

            {/* Декоративные кнопки — волновая анимация во время спина */}
            <div className={`${styles.smallButtons} ${isSpinning ? styles.controlPanelSpinning : ''}`} aria-hidden="true">
              {[
                { color: '#ff0066' },
                { color: '#00aaff' },
                { color: '#00ff88' },
                { color: '#ffee00' },
              ].map((btn, i) => (
                <div
                  key={i}
                  className={styles.smallBtn}
                  style={{
                    background: btn.color,
                    '--btn-color': btn.color,
                    '--glow-delay': `${i * 0.6}s`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Нижняя декоративная полоска */}
        <div className={styles.cabinetBottom} aria-hidden="true">
          {['#ff00aa', '#ffee00', '#00ff88', '#00aaff', '#cc00ff'].map((c, i) => (
            <div
              key={i}
              className={styles.bottomLight}
              style={{ background: c, animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
