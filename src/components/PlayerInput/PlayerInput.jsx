import { useState } from 'react';
import styles from './PlayerInput.module.css';

/**
 * PlayerInput — форма ввода данных для Shikimori или MAL.
 *
 * Фазы:
 *   1. «Выбор источника» — две большие анимированные кнопки
 *   2. «Форма ввода» — поля в цвете выбранного сервиса
 *   3. «Загружено» — badge с никнеймом и кнопкой смены
 *
 * Props:
 *   source            — 'shikimori' | 'mal'
 *   onSourceSelect    — (src) => void
 *   initialNickname   — из localStorage (Shikimori)
 *   initialToken      — из localStorage (Shikimori)
 *   initialMalUser    — из localStorage (MAL)
 *   isLoading / isLoaded / error / animeCount — от хука
 *   onLoad            — (primary, secondary?) => void
 *   onClear           — () => void
 */
export default function PlayerInput({
  source,
  onSourceSelect,
  initialNickname,
  initialToken,
  initialMalUser,
  isLoading,
  isLoaded,
  error,
  animeCount,
  onLoad,
  onClear,
}) {
  const [nickname,    setNickname]   = useState(initialNickname || '');
  const [token,       setToken]      = useState(initialToken    || '');
  const [malUsername, setMalUsername] = useState(initialMalUser || '');
  const [showToken,   setShowToken]  = useState(false);

  // Показывать ли выбор источника — только если source ещё не выбран (null)
  const showSourcePicker = source === null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (source === 'mal') {
      onLoad(malUsername.trim());
    } else {
      onLoad(nickname.trim(), token.trim());
    }
  };

  const isMal  = source === 'mal';
  const themeClass = isMal ? styles.themeMal : styles.themeShiki;

  // ── Состояние «загружено» ──────────────────────────────────────────────
  if (isLoaded) {
    const displayName = isMal
      ? (malUsername || initialMalUser || '').toUpperCase()
      : (nickname    || initialNickname || '').toUpperCase();

    const serviceLabel = isMal ? '🔵 MAL' : '🟣 SHIKIMORI';

    return (
      <div className={`${styles.panel} ${themeClass}`}>
        <div className={styles.panelTitle}>◀ PLAYER SELECT ▶</div>
        <div className={styles.successBadge}>
          <div className={styles.successText}>
            {serviceLabel} / @{displayName}<br />
            ТАЙТЛОВ В ОЧЕРЕДИ: {animeCount}
          </div>
          <button
            className={styles.changeBtn}
            onClick={onClear}
            aria-label="Сменить игрока"
          >
            СМЕНА
          </button>
        </div>
      </div>
    );
  }

  // ── Выбор источника ─────────────────────────────────────────────────
  if (showSourcePicker) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelTitle}>◀ PLAYER SELECT ▶</div>
        <p className={styles.pickerLabel}>Выбери источник списка аниме:</p>
        <div className={styles.pickerRow}>
          <button
            id="source-shikimori"
            className={`${styles.sourceBtn} ${styles.sourceBtnShiki}`}
            onClick={() => onSourceSelect('shikimori')}
            aria-label="Shikimori"
          >
            <span className={styles.sourceBtnIcon}>🟣</span>
            <span className={styles.sourceBtnName}>SHIKIMORI</span>
          </button>
          <button
            id="source-mal"
            className={`${styles.sourceBtn} ${styles.sourceBtnMal}`}
            onClick={() => onSourceSelect('mal')}
            aria-label="MyAnimeList"
          >
            <span className={styles.sourceBtnIcon}>🔵</span>
            <span className={styles.sourceBtnName}>MAL</span>
          </button>
        </div>
      </div>
    );
  }

  // ── Форма ввода ─────────────────────────────────────────────────────
  return (
    <div className={`${styles.panel} ${themeClass}`}>
      <div className={styles.panelTitle}>◀ PLAYER SELECT ▶</div>

      {/* Индикатор выбранного сервиса + смена */}
      <div className={styles.sourceIndicator}>
        <span className={styles.sourceTag}>
          {isMal ? '🔵 MY ANIME LIST' : '🟣 SHIKIMORI'}
        </span>
        <button
          className={styles.switchBtn}
          onClick={() => onSourceSelect(null)}
          disabled={isLoading}
          type="button"
        >
          ↩ сменить
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        {isMal ? (
          /* MAL — только никнейм */
          <div className={styles.fieldGroup}>
            <label htmlFor="mal-username-input" className={styles.label}>
              Никнейм MyAnimeList
            </label>
            <div className={styles.inputWrapper}>
              <input
                id="mal-username-input"
                className={styles.input}
                type="text"
                value={malUsername}
                onChange={(e) => setMalUsername(e.target.value)}
                placeholder="Твой_ник_на_MAL"
                autoComplete="username"
                disabled={isLoading}
                required
              />
            </div>
          </div>
        ) : (
          /* Shikimori — никнейм + токен */
          <>
            <div className={styles.fieldGroup}>
              <label htmlFor="nickname-input" className={styles.label}>
                Никнейм Shikimori
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="nickname-input"
                  className={styles.input}
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Твой_ник"
                  autoComplete="username"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className={styles.fieldGroup} style={{ marginTop: '10px' }}>
              <label htmlFor="token-input" className={styles.label}>
                API Токен (опционально)
              </label>
              <div className={styles.inputWrapper}>
                <input
                  id="token-input"
                  className={styles.input}
                  type={showToken ? 'text' : 'password'}
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Только для приватных списков"
                  autoComplete="current-password"
                  disabled={isLoading}
                  style={{ paddingRight: '36px' }}
                />
                <button
                  type="button"
                  className={styles.toggleBtn}
                  onClick={() => setShowToken((v) => !v)}
                  aria-label={showToken ? 'Скрыть токен' : 'Показать токен'}
                >
                  {showToken ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className={styles.error} role="alert" style={{ marginTop: '10px' }}>
            ⚠ {error}
          </div>
        )}

        <button
          id="load-list-button"
          type="submit"
          className={styles.loadBtn}
          disabled={isLoading || (isMal ? !malUsername : !nickname)}
          style={{ marginTop: '12px' }}
        >
          {isLoading ? '▌▌ LOADING...' : '► ЗАГРУЗИТЬ СПИСОК'}
        </button>
      </form>

      <p className={styles.hint}>
        {isMal
          ? <>Профиль должен быть публичным на <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer">myanimelist.net</a></>
          : <>Профиль должен быть публичным на <a href="https://shikimori.one" target="_blank" rel="noopener noreferrer">shikimori.one</a></>
        }
      </p>
    </div>
  );
}
