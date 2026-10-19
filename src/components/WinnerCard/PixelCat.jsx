/**
 * PixelCat — маскот WinnerCard.
 * Пиксельный кот 32×36 px (ViewBox), 3 кадра анимации глаз (CSS step-opacity).
 *
 * Схема пикселей (8 кол × 9 строк, каждый пиксель 4×4 px):
 *   col: 0  1  2  3  4  5  6  7
 *  row0: .  B  .  .  .  .  B  .   ← кончики ушей
 *  row1: B  B  .  .  .  .  B  B   ← уши
 *  row2: B  B  B  B  B  B  B  B   ← верх головы
 *  row3: B  .  .  .  .  .  .  B   ← стороны
 *  row4: B  .  E  E  .  E  E  B   ← глаза (верх)
 *  row5: B  .  E  E  .  E  E  B   ← глаза (низ)
 *  row6: B  .  .  N  N  .  .  B   ← нос (col3-4)
 *  row7: B  ω  .  ω  .  ω  .  B   ← рот ω (col1,3,5)
 *  row8: B  B  B  B  B  B  B  B   ← подбородок
 */

import styles from './PixelCat.module.css';

const BC = '#ff66cc';  // тело (нeon pink)
const EC = '#00ffcc';  // глаза (cyan)

/* ── Пиксели тела (неизменны для всех кадров) ── */
const BODY = [
  // Кончики ушей (row0)
  { x: 4,  y: 0,  w: 4,  h: 4  },   // col 1 (левый)
  { x: 24, y: 0,  w: 4,  h: 4  },   // col 6 (правый)
  // Тела ушей (row1)
  { x: 0,  y: 4,  w: 8,  h: 4  },   // col 0-1
  { x: 24, y: 4,  w: 8,  h: 4  },   // col 6-7
  // Верх головы (row2, полная строка)
  { x: 0,  y: 8,  w: 32, h: 4  },
  // Боковые полосы (row3-7 = y12..y31, h=20)
  { x: 0,  y: 12, w: 4,  h: 20 },   // левая стена
  { x: 28, y: 12, w: 4,  h: 20 },   // правая стена
  // Нос (row6, col3-4 = x12, w8)
  { x: 12, y: 24, w: 8,  h: 4  },
  // Рот ω (row7 — col1, col3, col5)
  { x: 4,  y: 28, w: 4,  h: 4  },
  { x: 12, y: 28, w: 4,  h: 4  },
  { x: 20, y: 28, w: 4,  h: 4  },
  // Подбородок (row8, полная строка)
  { x: 0,  y: 32, w: 32, h: 4  },
];

/* ── 3 варианта глаз ── */
// Кадр 1: открытые (2×2 блок)
const EYES_OPEN = [
  { x: 8,  y: 16, w: 8, h: 8 },   // левый глаз col2-3
  { x: 20, y: 16, w: 8, h: 8 },   // правый глаз col5-6
];
// Кадр 2: моргает (только нижняя половина)
const EYES_BLINK = [
  { x: 8,  y: 20, w: 8, h: 4 },
  { x: 20, y: 20, w: 8, h: 4 },
];
// Кадр 3: счастливые ^ ^ (диагональ)
const EYES_HAPPY = [
  { x: 8,  y: 16, w: 4, h: 4 },   // левый ^: верх-лево  (col2, row4)
  { x: 12, y: 20, w: 4, h: 4 },   // левый ^: низ-право  (col3, row5)
  { x: 24, y: 16, w: 4, h: 4 },   // правый ^: верх-право (col6, row4)
  { x: 20, y: 20, w: 4, h: 4 },   // правый ^: низ-лево   (col5, row5)
];

export default function PixelCat() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 32 36"
        width="52"
        height="58"
        className={styles.catSvg}
        shapeRendering="crispEdges"
      >
        {/* Тело — всегда видимо */}
        <g fill={BC}>
          {BODY.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </g>

        {/* Глаза — три анимированные группы (Variant A) */}
        <g className={styles.eyesOpen} fill={EC}>
          {EYES_OPEN.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </g>
        <g className={styles.eyesBlink} fill={EC}>
          {EYES_BLINK.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </g>
        <g className={styles.eyesHappy} fill={EC}>
          {EYES_HAPPY.map((r, i) => (
            <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </g>
      </svg>
    </div>
  );
}
