import { useRef, useState, useCallback, useEffect } from 'react';
import { buildReelStrip } from '../utils/buildReelStrip';

const ITEM_HEIGHT = 300; // px — высота одного слота в барабане
const STRIP_LENGTH = 35; // количество обложек перед победителем

/**
 * useSlotAnimation — управляет фазами анимации барабана.
 *
 * Фазы: idle → spinning → done
 *
 * Механика:
 *  1. Строим ленту (35 случайных + победитель)
 *  2. Устанавливаем translateY(0) мгновенно
 *  3. Запрашиваем reflow, затем добавляем CSS transition
 *  4. Устанавливаем финальный translateY(-STRIP_LENGTH * ITEM_HEIGHT)
 *  5. По окончании transition → фаза 'done'
 */
export function useSlotAnimation() {
  const [phase,     setPhase]     = useState('idle'); // 'idle' | 'spinning' | 'done'
  const [reelItems, setReelItems] = useState([]);
  const stripRef   = useRef(null); // ref на .reel-strip div
  const tickCbRef  = useRef(null); // callback для звуков тиков
  const tickTimer  = useRef(null);

  // Гарантированная очистка таймера тиков при размонтировании
  useEffect(() => {
    return () => {
      clearTimeout(tickTimer.current);
    };
  }, []);

  const startSpin = useCallback((winner, animeList, onTick) => {
    const strip = buildReelStrip(winner, animeList, STRIP_LENGTH);
    tickCbRef.current = onTick;

    setReelItems(strip);
    setPhase('spinning');

    // Звуковые тики — замедляются к концу (имитация торможения)
    let tickInterval = 80;
    let tickCount = 0;
    const maxTicks = STRIP_LENGTH;

    const scheduleTick = () => {
      if (tickCount >= maxTicks) return;
      tickTimer.current = setTimeout(() => {
        tickCbRef.current?.();
        tickCount++;
        // Постепенно замедляем тики
        tickInterval = Math.min(80 + tickCount * 8, 400);
        scheduleTick();
      }, tickInterval);
    };
    scheduleTick();

    return () => clearTimeout(tickTimer.current);
  }, []);

  const onAnimationEnd = useCallback(() => {
    clearTimeout(tickTimer.current);
    setPhase('done');
  }, []);

  const reset = useCallback(() => {
    setPhase('idle');
    setReelItems([]);
    clearTimeout(tickTimer.current);
  }, []);

  return {
    phase,
    reelItems,
    stripRef,
    itemHeight: ITEM_HEIGHT,
    startSpin,
    onAnimationEnd,
    reset,
  };
}
