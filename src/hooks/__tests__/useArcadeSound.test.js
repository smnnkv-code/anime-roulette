import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useArcadeSound } from '../useArcadeSound';

function renderHook(hookFn) {
  let hookResult;
  function Harness() {
    hookResult = hookFn();
    return null;
  }
  renderToString(React.createElement(Harness));
  return hookResult;
}

describe('Кейс 18: Синтезатор звука useArcadeSound и режим без звука (isMuted)', () => {
  let localStore = {};
  let createOscillatorSpy;
  let createGainSpy;

  beforeEach(() => {
    localStore = {};
    createOscillatorSpy = vi.fn(() => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    }));
    createGainSpy = vi.fn(() => ({
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    }));

    vi.stubGlobal('window', globalThis);

    vi.stubGlobal('localStorage', {
      getItem: vi.fn((k) => localStore[k] ?? null),
      setItem: vi.fn((k, v) => { localStore[k] = String(v); }),
      removeItem: vi.fn((k) => { delete localStore[k]; }),
      clear: vi.fn(() => { localStore = {}; }),
    });

    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(() => ({
      state: 'running',
      currentTime: 0,
      destination: {},
      createOscillator: createOscillatorSpy,
      createGain: createGainSpy,
      resume: vi.fn(),
    })));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('не создает осцилляторы и не воспроизводит звук, если isMuted === true', () => {
    localStore['anime_roulette_muted'] = 'true';

    const { playCoin, playSpin, playTick, isMuted } = renderHook(() => useArcadeSound());
    expect(isMuted).toBe(true);

    playCoin();
    playSpin();
    playTick();

    // Осцилляторы не должны создаваться
    expect(createOscillatorSpy).not.toHaveBeenCalled();
    expect(createGainSpy).not.toHaveBeenCalled();
  });

  it('безопасно работает и не падает, если AudioContext не поддерживается браузером', () => {
    // Симулируем окружение без Web Audio API
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);

    const { playCoin, playError } = renderHook(() => useArcadeSound());

    expect(() => {
      playCoin();
      playError();
    }).not.toThrow();
  });
});
