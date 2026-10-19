// api/mal-list.js — Vercel Serverless Function
// Возвращает список "plan_to_watch" из MAL для заданного username.
// Использует X-MAL-CLIENT-ID (не требует OAuth).

import { captureServerError } from './_lib/monitoring.js';
import { setCorsHeaders } from './_lib/cors.js';

export default async function handler(req, res) {
  const isCorsAllowed = setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(isCorsAllowed ? 200 : 403).end();
  }

  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'username required' });
  }

  if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(String(username))) {
    return res.status(400).json({ error: 'Invalid username format' });
  }

  if (!process.env.MAL_CLIENT_ID) {
    await captureServerError(new Error('MAL_CLIENT_ID not configured on server'), req, { endpoint: 'api/mal-list' });
    return res.status(500).json({ error: 'MAL_CLIENT_ID not configured on server' });
  }

  const fields = [
    'id', 'title', 'main_picture',
    'num_episodes', 'start_date',
    'media_type', 'status', 'genres', 'mean',
  ].join(',');

  let all = [];
  let url = `https://api.myanimelist.net/v2/users/${encodeURIComponent(username)}/animelist`
          + `?status=plan_to_watch&fields=${fields}&limit=1000&nsfw=true&sort=list_updated_at`;

  const MAX_PAGES = 5; // максимум 5000 тайтлов для предотвращения превышения лимита Vercel
  let pageCount = 0;
  const deadline = Date.now() + 8500; // 8.5с суммарный лимит времени на выполнение функции

  try {
    // MAL пагинирует по 1000 записей — обходим до MAX_PAGES страниц с таймаутом
    while (url && pageCount < MAX_PAGES) {
      const remainingTime = Math.max(1000, deadline - Date.now());
      if (pageCount > 0 && remainingTime < 1500) {
        console.warn(`[mal-list] Приближение к таймауту после ${pageCount} стр., возвращаем ${all.length} тайтлов`);
        break;
      }

      pageCount++;
      const resp = await fetch(url, {
        headers: { 'X-MAL-CLIENT-ID': process.env.MAL_CLIENT_ID },
        signal: AbortSignal.timeout(Math.min(8000, remainingTime)),
      });

      if (!resp.ok) {
        if (all.length > 0) {
          console.warn(`[mal-list] Ошибка на странице ${pageCount} (${resp.status}), возвращаем полученные ${all.length} тайтлов`);
          break;
        }
        const errData = await resp.json().catch(() => ({}));
        return res.status(resp.status).json({
          error: errData.message || `MAL API error: HTTP ${resp.status}`,
        });
      }

      const data = await resp.json();
      if (data.error) {
        if (all.length > 0) break;
        return res.status(400).json({ error: data.message || data.error });
      }

      all = all.concat(data.data || []);

      const nextUrl = data.paging?.next;
      if (nextUrl) {
        try {
          const parsedNext = new URL(nextUrl);
          if (parsedNext.protocol === 'https:' && parsedNext.hostname === 'api.myanimelist.net') {
            url = parsedNext.toString();
          } else {
            console.warn('[mal-list] Игнорируем недоверенный paging.next URL:', nextUrl);
            url = null;
          }
        } catch {
          url = null;
        }
      } else {
        url = null;
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.json(all);
  } catch (err) {
    console.error('[mal-list]', err.message);
    await captureServerError(err, req, { endpoint: 'api/mal-list' });

    // Если ошибка/таймаут произошли на последующих страницах, но часть данных уже получена
    if (all.length > 0) {
      console.warn(`[mal-list] Возвращаем накопленный список из ${all.length} тайтлов после ошибки на странице ${pageCount}`);
      res.setHeader('Cache-Control', 'no-store');
      return res.json(all);
    }

    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    return res.status(isTimeout ? 504 : 500).json({
      error: isTimeout ? 'MAL API request timed out' : 'Failed to fetch MAL list',
    });
  }
}
