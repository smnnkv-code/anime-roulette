import { useState, useCallback, useRef } from 'react';

import ArcadeCabinet    from './components/ArcadeCabinet/ArcadeCabinet';
import ArcadeBackground from './components/ArcadeBackground/ArcadeBackground';
import Marquee          from './components/Marquee/Marquee';
import SlotReel         from './components/SlotReel/SlotReel';
import PlayerInput      from './components/PlayerInput/PlayerInput';
import CoinSlot         from './components/CoinSlot/CoinSlot';
import SpinButton       from './components/SpinButton/SpinButton';
import WinnerCard       from './components/WinnerCard/WinnerCard';
import ShikiButton      from './components/ShikiButton/ShikiButton';
import StandalonePlayer from './components/StandalonePlayer/StandalonePlayer';

import { useAnimeList }    from './hooks/useAnimeList';
import { useSlotAnimation } from './hooks/useSlotAnimation';
import { useArcadeSound }  from './hooks/useArcadeSound';
import { pickWeighted, getBucketName } from './utils/weightedRandom';

/**
 * App — State Machine верхнего уровня.
 * Фазы: 'setup' | 'loading' | 'ready' | 'spinning' | 'winner' | 'error'
 */
function ArcadeRouletteApp() {
  const [phase,        setPhase]      = useState('setup');
  const [winner,       setWinner]     = useState(null);
  const [bucketName,   setBucketName] = useState('');
  const [spinCount,    setSpinCount]  = useState(0);
  const [nickname,     setNickname]   = useState('');

  const { animeList, isLoading, isEnriching, error, source, setSource, fetchList, clearList, savedNickname, savedToken, savedMalUsername } = useAnimeList();
  const { reelItems, startSpin, onAnimationEnd, reset: resetAnim } = useSlotAnimation();
  const { playCoin, playSpin, playTick, playWin, playError, isMuted, toggleMute } = useArcadeSound();

  const currentNickname = useRef(savedNickname);

  // ── Выбор источника ─────────────────────────────────────────────────
  const handleSourceSelect = useCallback((src) => {
    setSource(src);
  }, [setSource]);

  // ── Загрузка списка ───────────────────────────────────────────────────
  const handleLoad = useCallback(async (primary, secondary) => {
    setPhase('loading');
    currentNickname.current = primary;
    setNickname(primary);

    const ok = await fetchList(primary, secondary);
    if (ok) {
      setPhase('ready');
      resetAnim();
      setWinner(null);
    } else {
      setPhase('error');
      playError();
    }
  }, [fetchList, resetAnim, playError]);

  // ── Сброс игрока ─────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    clearList();
    setPhase('setup');
    setWinner(null);
    resetAnim();
    setSpinCount(0);
  }, [clearList, resetAnim]);

  // ── Запуск вращения ──────────────────────────────────────────────────
  const handleSpin = useCallback(() => {
    if (animeList.length === 0) return;

    const picked = pickWeighted(animeList);
    const bucket = getBucketName(animeList, picked);

    setWinner(picked);
    setBucketName(bucket);
    setPhase('spinning');
    setSpinCount(c => c + 1);

    setTimeout(() => playSpin(), 200);
    startSpin(picked, animeList, playTick);
  }, [animeList, playSpin, playTick, startSpin]);

  // ── Нажатие SpinButton ───────────────────────────────────────────────
  const handleButtonClick = useCallback(() => {
    if (phase === 'ready' || phase === 'winner') {
      handleSpin();
    }
  }, [phase, handleSpin]);

  // ── Окончание анимации барабана ──────────────────────────────────────
  const handleSpinEnd = useCallback(() => {
    onAnimationEnd();
    setPhase('winner');
    playWin();
  }, [onAnimationEnd, playWin]);

  // ── Эффективная фаза (учитываем isLoading из хука) ───────────────────
  const effectivePhase = isLoading ? 'loading' : phase;

  const isLoaded = effectivePhase === 'ready'
    || effectivePhase === 'spinning'
    || effectivePhase === 'winner';

  return (
    <>
      {/* E5 — Неоновый фон зала аркады (колонны + частицы) */}
      <ArcadeBackground />

      <ArcadeCabinet
        phase={effectivePhase}

        marquee={
          <Marquee
            nickname={isLoaded ? (nickname || (source === 'mal' ? savedMalUsername : savedNickname)) : ''}
            animeCount={animeList.length}
            isEnriching={isEnriching}
          />
        }

        screenArea={
          <div style={{ position: 'relative' }}>
            <SlotReel
              appPhase={effectivePhase}
              reelItems={reelItems}
              onSpinEnd={handleSpinEnd}
            />
            {effectivePhase === 'winner' && winner && (
              <WinnerCard
                winner={winner}
                source={source}
                bucketName={bucketName}
              />
            )}
          </div>
        }

        /* C1 — ShikiButton появляется под экраном в winner-состоянии */
        shikiSlot={
          effectivePhase === 'winner' && winner ? (
            <ShikiButton
              animeId={winner.anime?.id}
              malId={winner.anime?.mal_id}
              source={source}
              titleRu={winner.anime?.russian || winner.anime?.name}
            />
          ) : null
        }

        playerInput={
          <PlayerInput
            source={source}
            onSourceSelect={handleSourceSelect}
            initialNickname={savedNickname}
            initialToken={savedToken}
            initialMalUser={savedMalUsername}
            isLoading={effectivePhase === 'loading'}
            isLoaded={isLoaded}
            error={error}
            animeCount={animeList.length}
            onLoad={handleLoad}
            onClear={handleClear}
          />
        }

        controlPanel={
          <>
            <CoinSlot
              phase={effectivePhase}
              onCoinDrop={playCoin}
              isMuted={isMuted}
              onToggleMute={toggleMute}
            />
            <SpinButton
              phase={isLoaded ? effectivePhase : 'setup'}
              onClick={isLoaded ? handleButtonClick : undefined}
              spinCount={spinCount}
            />
          </>
        }
      />
    </>
  );
}

export default function App() {
  const isWatchMode = typeof window !== 'undefined' && (
    window.location.search.includes('watch=') ||
    window.location.search.includes('shikimori_id=')
  );

  if (isWatchMode) {
    return <StandalonePlayer />;
  }

  return <ArcadeRouletteApp />;
}
