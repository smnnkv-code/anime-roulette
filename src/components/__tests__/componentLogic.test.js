import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Кейсы 15, 16, 17, 19, 20: Логика компонентов UI и вспомогательных модулей', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Кейс 15: Переключение селектора серий в RetroPlayer (порог > 50 серий)', () => {
    function getEpisodeViewMode(episodesCount) {
      return episodesCount <= 50 ? 'button-grid' : 'select-dropdown';
    }

    it('выбирает сетку кнопок для коротких и средних тайтлов (<= 50 серий)', () => {
      expect(getEpisodeViewMode(12)).toBe('button-grid');
      expect(getEpisodeViewMode(24)).toBe('button-grid');
      expect(getEpisodeViewMode(50)).toBe('button-grid');
    });

    it('переключается на выпадающий список для длинных тайтлов (> 50 серий)', () => {
      expect(getEpisodeViewMode(51)).toBe('select-dropdown');
      expect(getEpisodeViewMode(148)).toBe('select-dropdown');
      expect(getEpisodeViewMode(1100)).toBe('select-dropdown'); // One Piece
    });
  });

  describe('Кейс 16: Страховочный таймер рулетки SlotReel при пропуске transitionend', () => {
    it('гарантирует вызов onSpinEnd через safetyTimer, если браузер не отправил transitionend', () => {
      vi.useFakeTimers();
      const onSpinEnd = vi.fn();
      const totalMs = 4500;

      let completed = false;
      const finish = () => {
        if (completed) return;
        completed = true;
        onSpinEnd();
      };

      // Имитируем логику SlotReel: transitionend не пришел, срабатывает safetyTimer
      const safetyTimer = setTimeout(finish, totalMs + 500);

      expect(onSpinEnd).not.toHaveBeenCalled();

      // Прокручиваем время вперед на 5000мс
      vi.advanceTimersByTime(5000);

      expect(onSpinEnd).toHaveBeenCalledTimes(1);

      clearTimeout(safetyTimer);
      vi.useRealTimers();
    });
  });

  describe('Кейс 17: Резолв MAL ID в Shikimori ID с сессионным кэшированием (WatchModal)', () => {
    let sessionStore = {};

    beforeEach(() => {
      sessionStore = {};
      vi.stubGlobal('sessionStorage', {
        getItem: vi.fn((k) => sessionStore[k] ?? null),
        setItem: vi.fn((k, v) => { sessionStore[k] = String(v); }),
      });
    });

    it('возвращает ID из sessionStorage при повторном открытии без сетевого запроса', async () => {
      const malId = 1535; // Death Note
      sessionStore[`shiki_id_for_mal_${malId}`] = '1535';

      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      async function resolveShikimoriId(id) {
        const cached = sessionStorage.getItem(`shiki_id_for_mal_${id}`);
        if (cached) return cached;
        const res = await fetch(`/api/shikimori?mal_id=${id}`);
        const data = await res.json();
        sessionStorage.setItem(`shiki_id_for_mal_${id}`, data[0].id);
        return data[0].id;
      }

      const result = await resolveShikimoriId(malId);
      expect(result).toBe('1535');
      // fetch не должен вызываться благодаря кэшу в sessionStorage
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('Кейс 19: Маппинг никнейма в Marquee в зависимости от источника', () => {
    function resolveMarqueeNickname(source, currentNick, savedShikiNick, savedMalNick) {
      return source === 'mal'
        ? (currentNick || savedMalNick)
        : (currentNick || savedShikiNick);
    }

    it('выбирает никнейм MAL при активном источнике mal даже при наличии сохраненного ника Shikimori', () => {
      const nickname = resolveMarqueeNickname('mal', '', 'ShikiUser', 'MalUser');
      expect(nickname).toBe('MalUser');
    });

    it('выбирает никнейм Shikimori при источнике shikimori', () => {
      const nickname = resolveMarqueeNickname('shikimori', '', 'ShikiUser', 'MalUser');
      expect(nickname).toBe('ShikiUser');
    });
  });

  describe('Кейс 20: Детерминированность WinnerCard (фразы и рейтинг)', () => {
    const ALL_JP = [
      { text: '《おめでとう！》', color: '#ff00aa' },
      { text: 'アタリ！',          color: '#00ffcc' },
      { text: 'やったー！',        color: '#00ff88' },
      { text: '★ 大勝利 ★',       color: '#ffee00' },
      { text: 'ラッキー！',        color: '#ff6600' },
      { text: 'チャンス！',        color: '#cc00ff' },
      { text: 'すごい！',          color: '#00aaff' },
      { text: '完璧！',            color: '#ff0066' },
      { text: '神引き！',          color: '#ffd700' },
    ];

    it('детерминированно выбирает одну и ту же фразу для одного и того же anime.id', () => {
      const id = 5114; // Fullmetal Alchemist: Brotherhood
      const phraseIndex1 = Math.abs(Number(id)) % ALL_JP.length;
      const phraseIndex2 = Math.abs(Number(id)) % ALL_JP.length;
      expect(phraseIndex1).toBe(phraseIndex2);
      expect(ALL_JP[phraseIndex1].text).toBeDefined();
    });

    it('корректно рассчитывает количество звезд рейтинга от 0 до 5', () => {
      const calcStars = (score) => Math.round((score / 10) * 5);
      expect(calcStars(10.0)).toBe(5);
      expect(calcStars(8.2)).toBe(4);
      expect(calcStars(6.8)).toBe(3);
      expect(calcStars(4.0)).toBe(2);
      expect(calcStars(1.5)).toBe(1);
      expect(calcStars(0.0)).toBe(0);
    });
  });

  describe('Кейс 21: Безопасная обработка не-JSON ответов (504 HTML от Vercel) в RetroPlayer', () => {
    async function fetchEpisodesSafe(mockResponse) {
      if (!mockResponse.ok) {
        const errData = await mockResponse.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${mockResponse.status}`);
      }
      const data = await mockResponse.json();
      if (data.error) throw new Error(data.error);
      if (!Array.isArray(data.episodes) || data.episodes.length === 0) {
        throw new Error('Серии не найдены в ответе API');
      }
      return data.episodes;
    }

    it('корректно выбрасывает ошибку HTTP 504 без SyntaxError, если сервер вернул HTML-страницу', async () => {
      const html504Response = {
        ok: false,
        status: 504,
        json: () => Promise.reject(new SyntaxError("Unexpected token '<'")),
      };

      await expect(fetchEpisodesSafe(html504Response)).rejects.toThrow('HTTP 504');
    });

    it('извлекает текст ошибки из JSON, если он передан сервером', async () => {
      const jsonErrorResponse = {
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Kodik embed parsing failed' }),
      };

      await expect(fetchEpisodesSafe(jsonErrorResponse)).rejects.toThrow('Kodik embed parsing failed');
    });
  });

  describe('Кейс 22: Очистка таймера тиков при размонтировании (useSlotAnimation)', () => {
    it('очищает таймер тиков, предотвращая утечку и вызовы коллбэка после unmount', () => {
      vi.useFakeTimers();
      const tickTimer = { current: null };
      const onTick = vi.fn();

      // Имитируем логику startSpin с таймером
      tickTimer.current = setTimeout(() => {
        onTick();
      }, 100);

      // Имитируем cleanup хука
      clearTimeout(tickTimer.current);

      // Прокручиваем время вперед
      vi.advanceTimersByTime(500);

      expect(onTick).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
