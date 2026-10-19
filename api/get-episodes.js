/**
 * api/get-episodes.js — Serverless Node.js (Vercel, ESM)
 *
 * Получает список серий с id/hash для конкретного перевода.
 * Парсит embed-страницу kodikplayer.com на сервере (это работает с Vercel IP).
 * Полученные пары {id, hash} используются для прямых iframe-ссылок вида:
 *   https://kodikplayer.com/seria/{id}/{hash}/720p
 *
 * GET /api/get-episodes?link=https://kodikplayer.com/serial/...
 * → { episodes: [{num: 1, id: "176463", hash: "f91684a..."}], isMovie: false }
 */

import { captureServerError } from './_lib/monitoring.js';
import { setCorsHeaders } from './_lib/cors.js';

export default async function handler(req, res) {
  const isCorsAllowed = setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(isCorsAllowed ? 204 : 403).end();

  const { link } = req.query;
  if (!link) return res.status(400).json({ error: 'link required' });

  // Валидация link против SSRF — разрешены только доверенные домены Kodik
  let embedUrl;
  try {
    const raw = link.startsWith('//') ? `https:${link}` : link;
    const parsed = new URL(raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`);
    const allowedHosts = ['kodikplayer.com', 'kodik.info'];
    const isAllowed = parsed.protocol === 'https:' &&
      allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`));

    if (!isAllowed) {
      return res.status(400).json({ error: 'Forbidden host in link parameter' });
    }
    embedUrl = parsed.toString();
  } catch {
    return res.status(400).json({ error: 'Invalid link parameter' });
  }

  try {

    // Fetching embed HTML из kodikplayer.com — работает с Vercel IP
    const pageRes = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':     'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    });

    if (!pageRes.ok) throw new Error(`Embed HTTP ${pageRes.status}`);
    const html = await pageRes.text();

    const isMovie = embedUrl.includes('/video/');

    if (isMovie) {
      // Фильм — одна "серия" (сам фильм)
      const idMatch   = html.match(/var serialId = Number\((\d+)\)/);
      const hashMatch = html.match(/var serialHash = "([a-f0-9]+)"/);
      if (!idMatch || !hashMatch) throw new Error('Movie data not found');
      return res.status(200).json({
        isMovie: true,
        episodes: [{ num: 1, id: idMatch[1], hash: hashMatch[1] }],
      });
    }

    // Сериал — парсим все <option> из списка серий
    const episodes = [];
    // Ищем все опции в serial-series-box
    const seriesBoxMatch = html.match(/<div class="serial-series-box">([\s\S]*?)<\/div>/);
    const selectHtml     = seriesBoxMatch ? seriesBoxMatch[1] : '';

    const optionRe = /value="(\d+)"[\s\S]*?data-id="(\d+)"[\s\S]*?data-hash="([a-f0-9]+)"/g;
    let m;
    while ((m = optionRe.exec(selectHtml)) !== null) {
      const num = parseInt(m[1], 10);
      if (!episodes.find(e => e.num === num)) {
        episodes.push({ num, id: m[2], hash: m[3] });
      }
    }

    if (episodes.length === 0) {
      // Fallback: ищем по всему документу
      const globalRe = /value="(\d+)"[\s\S]{0,200}?data-id="(\d+)"[\s\S]{0,50}?data-hash="([a-f0-9]+)"/g;
      while ((m = globalRe.exec(html)) !== null) {
        const num = parseInt(m[1], 10);
        if (!episodes.find(e => e.num === num)) {
          episodes.push({ num, id: m[2], hash: m[3] });
        }
      }
    }

    if (episodes.length === 0) {
      return res.status(404).json({ error: 'Серии не найдены в плеере Kodik' });
    }

    episodes.sort((a, b) => a.num - b.num);

    return res.status(200).json({ isMovie: false, episodes });

  } catch (err) {
    console.error('[get-episodes]', err.message);
    await captureServerError(err, req, { endpoint: 'api/get-episodes' });
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Kodik embed request timed out' : 'Failed to parse Kodik episodes',
    });
  }
}
