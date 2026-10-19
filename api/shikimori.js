/**
 * Vercel Serverless Function — Shikimori API Proxy
 * Проксирует запросы к Shikimori, добавляя нужные заголовки (User-Agent, Authorization).
 * Браузеры не могут устанавливать User-Agent напрямую — это делаем мы здесь.
 */
import { captureServerError } from './_lib/monitoring.js';
import { setCorsHeaders } from './_lib/cors.js';

export default async function handler(req, res) {
  const isCorsAllowed = setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(isCorsAllowed ? 200 : 403).end();
  }

  const SHIKIMORI_DOMAIN = process.env.SHIKIMORI_DOMAIN || 'https://shikimori.io';
  const { nickname, mal_id, page = 1, limit = 5000 } = req.query;
  const token = req.headers['x-shikimori-token'];

  // 1. Поиск тайтла по mal_id для резолва в Shikimori ID
  if (mal_id) {
    if (!/^\d+$/.test(String(mal_id))) {
      return res.status(400).json({ error: 'Valid numeric mal_id required' });
    }

    const url = `${SHIKIMORI_DOMAIN}/api/animes?mal_id=${encodeURIComponent(mal_id)}&limit=1`;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AnimeRoulette/1.0 (personal project)',
          'Accept':     'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `Shikimori API error: ${response.status}`,
          detail: errorText,
        });
      }

      const data = await response.json();
      return res.status(200).json(data);
    } catch (err) {
      console.error('Proxy error (mal_id):', err);
      await captureServerError(err, req, { endpoint: 'api/shikimori', query_type: 'mal_id' });
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
      return res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'Shikimori API request timed out' : 'Proxy request failed',
      });
    }
  }

  // 2. Запрос списка запланированного по никнейму
  if (!nickname) {
    return res.status(400).json({ error: 'nickname or mal_id is required' });
  }

  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(String(nickname))) {
    return res.status(400).json({ error: 'Invalid nickname format' });
  }

  if (!token) {
    return res.status(401).json({ error: 'API token is required' });
  }

  const safeLimit = Math.min(5000, Math.max(1, parseInt(limit, 10) || 5000));
  const safePage  = Math.max(1, parseInt(page, 10) || 1);

  const url = `${SHIKIMORI_DOMAIN}/api/users/${encodeURIComponent(nickname)}/anime_rates?status=planned&limit=${safeLimit}&page=${safePage}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':    'AnimeRoulette/1.0 (personal project)',
        'Authorization': `Bearer ${token}`,
        'Accept':        'application/json',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        error: `Shikimori API error: ${response.status}`,
        detail: errorText,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    await captureServerError(err, req, { endpoint: 'api/shikimori', query_type: 'nickname' });
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'Shikimori API request timed out' : 'Proxy request failed',
    });
  }
}
