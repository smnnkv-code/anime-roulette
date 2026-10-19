import { useCallback, useRef, useState } from 'react';

const STORAGE_KEY_MUTED = 'anime_roulette_muted';

/**
 * useArcadeSound — генерирует 8-bit аркадные звуки через Web Audio API.
 * Никаких внешних файлов — всё синтезируется прямо в браузере.
 */
export function useArcadeSound() {
  const ctxRef = useRef(null);
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_MUTED) === 'true';
    } catch {
      return false;
    }
  });

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_MUTED, String(next));
      } catch { /* skip */ }
      return next;
    });
  }, []);

  function getCtx() {
    if (typeof window === 'undefined') return null;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed') {
        ctxRef.current = new AudioCtx();
      }
      if (ctxRef.current.state === 'suspended') {
        ctxRef.current.resume();
      }
      return ctxRef.current;
    } catch {
      return null;
    }
  }

  /** Вспомогательная: создаём осциллятор и запускаем */
  function playTone({ type = 'square', freq, duration, gain = 0.3, startTime, ctx }) {
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gainNode.gain.setValueAtTime(gain, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /** 🪙 Звук монеты — короткий «дзинь» */
  const playCoin = useCallback(() => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    playTone({ ctx, type: 'sine',   freq: 1200, duration: 0.05, gain: 0.4, startTime: now });
    playTone({ ctx, type: 'sine',   freq: 800,  duration: 0.08, gain: 0.3, startTime: now + 0.04 });
    playTone({ ctx, type: 'square', freq: 400,  duration: 0.06, gain: 0.2, startTime: now + 0.09 });
  }, [isMuted]);

  /** 🎰 Звук раскрутки — нарастающий шум + тон */
  const playSpin = useCallback(() => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Нарастающий buzz
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, now);
    osc.frequency.linearRampToValueAtTime(200, now + 0.5);
    gainNode.gain.setValueAtTime(0.1, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  }, [isMuted]);

  /** 🎵 Тик при пролёте обложки */
  const playTick = useCallback(() => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone({ ctx, type: 'square', freq: 220, duration: 0.025, gain: 0.08, startTime: now });
  }, [isMuted]);

  /** 🎊 Фанфара победы — 8-bit мелодия C-E-G-C */
  const playWin = useCallback(() => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Ноты победной мелодии
    const notes = [
      { freq: 523.25, start: 0.00, dur: 0.12 },   // C5
      { freq: 659.25, start: 0.13, dur: 0.12 },   // E5
      { freq: 783.99, start: 0.26, dur: 0.12 },   // G5
      { freq: 1046.5, start: 0.39, dur: 0.25 },   // C6
      { freq: 783.99, start: 0.65, dur: 0.10 },   // G5
      { freq: 1046.5, start: 0.76, dur: 0.40 },   // C6 (долгая)
    ];

    notes.forEach(({ freq, start, dur }) => {
      playTone({ ctx, type: 'square', freq, duration: dur, gain: 0.3, startTime: now + start });
      // Гармоника для объёма
      playTone({ ctx, type: 'sine',   freq: freq * 0.5, duration: dur, gain: 0.15, startTime: now + start });
    });

    // Барабан — короткие noise bursts
    [0.00, 0.13, 0.26, 0.39].forEach(offset => {
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      source.buffer = buffer;
      gainNode.gain.setValueAtTime(0.2, now + offset);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(now + offset);
    });
  }, [isMuted]);

  /** ⚠️ Звук ошибки */
  const playError = useCallback(() => {
    if (isMuted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    playTone({ ctx, type: 'square', freq: 180, duration: 0.15, gain: 0.3, startTime: now });
    playTone({ ctx, type: 'square', freq: 120, duration: 0.20, gain: 0.3, startTime: now + 0.16 });
  }, [isMuted]);

  return { playCoin, playSpin, playTick, playWin, playError, isMuted, toggleMute };
}
