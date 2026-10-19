import { describe, it, expect } from 'vitest';
import { SHIKIMORI_DOMAIN, SHIKIMORI_OAUTH_URL, getShikimoriUrl } from '../shikimori';

describe('shikimori config', () => {
  it('defaults to https://shikimori.io', () => {
    expect(SHIKIMORI_DOMAIN).toBe('https://shikimori.io');
    expect(SHIKIMORI_OAUTH_URL).toBe('https://shikimori.io/oauth/applications');
  });

  it('correctly builds absolute URLs from relative paths', () => {
    expect(getShikimoriUrl('/system/animes/preview/1.jpg')).toBe('https://shikimori.io/system/animes/preview/1.jpg');
    expect(getShikimoriUrl('system/animes/preview/1.jpg')).toBe('https://shikimori.io/system/animes/preview/1.jpg');
  });

  it('preserves already absolute URLs without modifying them', () => {
    const url = 'https://cdn.myanimelist.net/images/anime/1.jpg';
    expect(getShikimoriUrl(url)).toBe(url);
  });

  it('returns null for empty or non-string paths', () => {
    expect(getShikimoriUrl(null)).toBeNull();
    expect(getShikimoriUrl('')).toBeNull();
    expect(getShikimoriUrl(undefined)).toBeNull();
  });
});
