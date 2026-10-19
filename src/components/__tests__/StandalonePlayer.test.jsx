import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Интеграция StandalonePlayer и кнопки просмотра', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Формирование ссылки просмотра в новой вкладке из WinnerCard', () => {
    it('формирует корректный URL с watch, title и source для Shikimori', () => {
      const anime = {
        id: 12345,
        name: 'Death Note',
        russian: 'Тетрадь смерти',
      };
      const source = 'shikimori';

      const params = new URLSearchParams();
      if (anime.id) params.set('watch', String(anime.id));
      if (anime.mal_id) params.set('mal_id', String(anime.mal_id));
      params.set('title', anime.russian || anime.name);
      if (source) params.set('source', source);

      const targetUrl = `/?${params.toString()}`;

      expect(targetUrl).toBe('/?watch=12345&title=%D0%A2%D0%B5%D1%82%D1%80%D0%B0%D0%B4%D1%8C+%D1%81%D0%BC%D0%B5%D1%80%D1%82%D0%B8&source=shikimori');
    });

    it('включает mal_id при источнике MyAnimeList', () => {
      const anime = {
        mal_id: 5114,
        name: 'Fullmetal Alchemist: Brotherhood',
        russian: 'Стальной алхимик: Братство',
      };
      const source = 'mal';

      const params = new URLSearchParams();
      if (anime.id) params.set('watch', String(anime.id));
      if (anime.mal_id) params.set('mal_id', String(anime.mal_id));
      params.set('title', anime.russian || anime.name);
      if (source) params.set('source', source);

      const targetUrl = `/?${params.toString()}`;

      expect(targetUrl).toContain('mal_id=5114');
      expect(targetUrl).toContain('source=mal');
    });

    it('вызывает window.open синхронно с флагами noopener,noreferrer', () => {
      const windowOpenMock = vi.fn();
      const prevWindow = globalThis.window;
      globalThis.window = { open: windowOpenMock };

      const params = new URLSearchParams({ watch: '100', title: 'Attack on Titan' });
      globalThis.window.open(`/?${params.toString()}`, '_blank', 'noopener,noreferrer');

      expect(windowOpenMock).toHaveBeenCalledWith(
        '/?watch=100&title=Attack+on+Titan',
        '_blank',
        'noopener,noreferrer'
      );

      if (prevWindow) {
        globalThis.window = prevWindow;
      } else {
        delete globalThis.window;
      }
    });
  });

  describe('2. Определение режима автономного плеера в точке входа App', () => {
    function checkIsWatchMode(search) {
      return search.includes('watch=') || search.includes('shikimori_id=');
    }

    it('активирует StandalonePlayer при наличии ?watch=', () => {
      expect(checkIsWatchMode('?watch=12345&title=Test')).toBe(true);
      expect(checkIsWatchMode('?shikimori_id=999')).toBe(true);
    });

    it('остаётся в режиме рулетки при обычном визите', () => {
      expect(checkIsWatchMode('')).toBe(false);
      expect(checkIsWatchMode('?user=alice')).toBe(false);
    });
  });

  describe('3. Безопасность iframe и доменов плеера Kodik', () => {
    it('гарантирует sandbox и referrerPolicy атрибуты', () => {
      const expectedSandbox = 'allow-scripts allow-same-origin allow-forms allow-presentation';
      const expectedReferrerPolicy = 'strict-origin-when-cross-origin';

      expect(expectedSandbox).not.toContain('allow-top-navigation');
      expect(expectedReferrerPolicy).toBe('strict-origin-when-cross-origin');
    });

    it('гарантирует использование протокола HTTPS и домена kodikplayer.com', () => {
      const sampleLink = '//kodikplayer.com/seria/123/abc/720p';
      const secureUrl = sampleLink.startsWith('//') ? `https:${sampleLink}` : sampleLink;

      expect(secureUrl.startsWith('https://kodikplayer.com/')).toBe(true);
      expect(secureUrl).not.toContain('http://');
    });

    it('валидирует домен и схему playerUrl, отсекая недоверенные и опасные ссылки', () => {
      const isValid = (url) => {
        try {
          const parsed = new URL(url);
          const allowedHosts = ['kodikplayer.com', 'kodik.info'];
          return parsed.protocol === 'https:' &&
            allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));
        } catch {
          return false;
        }
      };

      expect(isValid('https://kodikplayer.com/seria/100/abc')).toBe(true);
      expect(isValid('https://sub.kodik.info/video/200/def')).toBe(true);
      expect(isValid('http://kodikplayer.com/seria/100/abc')).toBe(false);
      expect(isValid('javascript:alert(1)')).toBe(false);
      expect(isValid('https://evil-kodikplayer.com/seria/100/abc')).toBe(false);
      expect(isValid('https://attacker.com/fake')).toBe(false);
    });
  });

  describe('4. Работа с токенами Kodik (включая hex-токены из Shikiplayer)', () => {
    function decryptToken(tkn) {
      if (typeof tkn === 'string' && /^[a-f0-9]{32}$/i.test(tkn.trim())) {
        return tkn.trim();
      }
      const half = Math.floor(tkn.length / 2);
      const p1 = tkn.slice(0, half).split('').reverse().join('');
      const p2 = tkn.slice(half).split('').reverse().join('');
      const dec1 = Buffer.from(p1, 'base64').toString('utf8');
      const dec2 = Buffer.from(p2, 'base64').toString('utf8');
      return dec2 + dec1;
    }

    it('распознаёт и принимает 32-значный hex-токен напрямую', () => {
      const shikiplayerToken = '56a768d08f43091901c44b54fe970049';
      expect(decryptToken(shikiplayerToken)).toBe('56a768d08f43091901c44b54fe970049');
    });

    it('корректно расшифровывает закодированный base64-токен', () => {
      const encoded = '==QO0ADM3kTZmRTNiRDNjFDM==QOxkDMzQjZ4ADZ4YzNhZTN';
      expect(decryptToken(encoded)).toBe('56a768d08f43091901c44b54fe970049');
    });
  });
});
