import { useMemo } from 'react';
import styles from './LEDFrame.module.css';

const COLORS = [
  '#ff00aa', // neon-pink
  '#ffee00', // neon-yellow
  '#00aaff', // neon-blue
  '#00ff88', // neon-green
  '#cc00ff', // neon-purple
  '#ff6600', // neon-orange
];

const LED_COUNT = 60; // суммарное количество огоньков по периметру

/**
 * Генерирует позиции огоньков равномерно по периметру прямоугольника.
 * @param {number} w — ширина (в %)
 * @param {number} h — высота (в %)
 * @param {number} count
 */
function generateLEDPositions(count) {
  // Периметр нормализован: top / right / bottom / left
  const positions = [];
  const perSide = Math.floor(count / 4);
  const extra   = count - perSide * 4;

  // TOP — слева направо
  for (let i = 0; i < perSide + (extra > 0 ? 1 : 0); i++) {
    positions.push({ x: (i / (perSide)) * 100, y: 0 });
  }
  // RIGHT — сверху вниз
  for (let i = 0; i < perSide; i++) {
    positions.push({ x: 100, y: (i / perSide) * 100 });
  }
  // BOTTOM — справа налево
  for (let i = 0; i < perSide; i++) {
    positions.push({ x: 100 - (i / perSide) * 100, y: 100 });
  }
  // LEFT — снизу вверх
  for (let i = 0; i < perSide; i++) {
    positions.push({ x: 0, y: 100 - (i / perSide) * 100 });
  }

  return positions;
}

/**
 * LEDFrame — рамка из бегущих LED-огоньков вокруг слот-барабана.
 * @param {string} phase — 'idle' | 'spinning' | 'done'
 */
export default function LEDFrame({ phase, children }) {
  const leds = useMemo(() => generateLEDPositions(LED_COUNT), []);

  const frameClass = [
    styles.frame,
    phase === 'spinning' ? styles.spinning : '',
    phase === 'done'     ? styles.winner   : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={frameClass} role="presentation" aria-hidden="true">
      {leds.map((pos, i) => {
        const color = COLORS[i % COLORS.length];
        const delay = `${(i / LED_COUNT) * 2}s`;
        const spinDelay = `${(i / LED_COUNT) * 0.25}s`;

        return (
          <span
            key={i}
            className={styles.led}
            style={{
              left:          `${pos.x}%`,
              top:           `${pos.y}%`,
              color,
              '--led-delay':      delay,
              '--led-speed':      '2s',
              '--led-speed-spin': spinDelay,
            }}
          />
        );
      })}
      {children}
    </div>
  );
}
