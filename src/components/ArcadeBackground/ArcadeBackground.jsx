import { useMemo } from 'react';
import styles from './ArcadeBackground.module.css';

/* ── Конфигурация колонн ── */
const LEFT_TUBES = [
  { color: '#ff00aa', dur: '3s',   delay: '0s' },
  { color: '#cc00ff', dur: '4.5s', delay: '0.8s' },
  { color: '#0088ff', dur: '2.8s', delay: '1.6s' },
];

const RIGHT_TUBES = [
  { color: '#00ff88', dur: '3.5s', delay: '0.4s' },
  { color: '#ffee00', dur: '2.5s', delay: '1.1s' },
  { color: '#ff6600', dur: '4s',   delay: '0s'   },
];

/* ── Символы и цвета частиц ── */
const CHARS  = [
  '⚔️',  // мечи
  '🌸',  // сакура
  '🌙',  // луна
  '🦊',  // лиса (кицуне)
  '★',   // звезда
  '🐉',  // дракон
  '⚡',  // молния
  '🌀',  // вихрь (джутсу)
  '💮',  // цветок
  '💥',  // взрыв
  '🎴',  // карта
  '🎌',  // японский флаг
];
const COLORS = ['#ff00aa', '#00ff88', '#ffee00', '#00aaff', '#cc00ff', '#ff6600'];

/**
 * ArcadeBackground — E5: Неоновые колонны + плавающие пиксельные частицы.
 * Рендерится как position:fixed позади автомата.
 */
export default function ArcadeBackground() {
  // Частицы генерируются один раз (useMemo)
  const particles = useMemo(() =>
    Array.from({ length: 36 }, (_, i) => ({   // 24 → 36
      id: i,
      char:      CHARS[i % CHARS.length],
      color:     COLORS[i % COLORS.length],
      left:      `${2 + (i * 2.7) % 96}%`,
      top:       `${(i * 5.3) % 100}%`,
      size:      `${14 + (i % 5) * 4}px`,      // 9-21 → 14-30px
      opacity:   0.25 + (i % 5) * 0.07,       // 0.12-0.28 → 0.25-0.53
      dur:       `${5 + (i % 6)}s`,
      delay:     `-${(i * 1.7) % 10}s`,
      glowDur:   `${2 + (i % 4)}s`,           // независимая длительность свечения
      glowDelay: `-${(i * 0.9) % 4}s`,
    }))
  , []);

  return (
    <div className={styles.bg} aria-hidden="true">

      {/* ── Левая неоновая колонна ── */}
      <div className={`${styles.col} ${styles.leftCol}`}>
        {LEFT_TUBES.map((t, i) => (
          <div
            key={i}
            className={styles.tube}
            style={{ '--color': t.color, '--dur': t.dur, '--delay': t.delay }}
          />
        ))}
        <span className={styles.colSign}>AKIHABARA</span>
      </div>

      {/* ── Правая неоновая колонна ── */}
      <div className={`${styles.col} ${styles.rightCol}`}>
        {RIGHT_TUBES.map((t, i) => (
          <div
            key={i}
            className={styles.tube}
            style={{ '--color': t.color, '--dur': t.dur, '--delay': t.delay }}
          />
        ))}
        <span className={styles.colSign}>ゲームセンター</span>
      </div>

      {/* ── Плавающие частицы ── */}
      {particles.map(p => (
        <span
          key={p.id}
          className={styles.particle}
          style={{
            '--color':      p.color,
            '--size':       p.size,
            '--opacity':    p.opacity,
            '--dur':        p.dur,
            '--delay':      p.delay,
            '--glow-dur':   p.glowDur,
            '--glow-delay': p.glowDelay,
            '--left':       p.left,
            '--top':        p.top,
          }}
        >
          {p.char}
        </span>
      ))}
    </div>
  );
}
