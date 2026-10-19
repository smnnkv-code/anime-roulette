// api/mal-poster.js — Vercel Serverless Function
// Возвращает URL постера из MAL по mal_id.
// Используется как запасной источник если Shikimori не отдал нормальный постер.

import { captureServerError } from './_lib/monitoring.js';
import { setCorsHeaders } from './_lib/cors.js';

export default async function handler(req, res) {
  const isCorsAllowed = setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(isCorsAllowed ? 200 : 403).end();
  }

  const { mal_id } = req.query;

  if (!mal_id || !/^\d+$/.test(String(mal_id))) {
    return res.status(400).json({ error: 'Valid numeric mal_id required' });
  }

  if (!process.env.MAL_CLIENT_ID) {
    await captureServerError(new Error('MAL_CLIENT_ID not configured on server'), req, { endpoint: 'api/mal-poster' });
    return res.status(500).json({ error: 'MAL_CLIENT_ID not configured on server' });
  }

  try {
    const resp = await fetch(
      `https://api.myanimelist.net/v2/anime/${encodeURIComponent(mal_id)}?fields=main_picture`,
      {
        headers: { 'X-MAL-CLIENT-ID': process.env.MAL_CLIENT_ID },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!resp.ok) {
      return res.status(resp.status).json({ error: `MAL API error: HTTP ${resp.status}` });
    }

    const data = await resp.json();
    const poster = data.main_picture?.large || data.main_picture?.medium || null;

    // Постеры MAL кешируем на 24 часа — они меняются редко
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.json({ poster });
  } catch (err) {
    console.error('[mal-poster]', err.message);
    await captureServerError(err, req, { endpoint: 'api/mal-poster' });
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'MAL API request timed out' : 'Failed to fetch poster',
    });
  }
}
