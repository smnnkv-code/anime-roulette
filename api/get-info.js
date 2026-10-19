/**
 * api/get-info.js — Serverless Node.js (Vercel, ESM)
 *
 * GET /api/get-info?shikimori_id=XXX
 * → { translations: [{ id, title, type, episodes_count, link }] }
 */

import { captureServerError } from './_lib/monitoring.js';
import { setCorsHeaders } from './_lib/cors.js';

// Локальный резервный токен из репозитория (не зависит от доступности внешнего GitHub в рантайме)
const FALLBACK_TOKENS = [
  '==QO0ADM3kTZmRTNiRDNjFDM==QOxkDMzQjZ4ADZ4YzNhZTN',
  '==QNyE2NzIjM4ETM3MmNklDM==gY5EzNxIzY0gjZ1kDZkFDN',
];

/* ── Расшифровка токенов (алгоритм из AnimeParsers/TOKENS.md) ──────── */
function decryptToken(tkn) {
  if (typeof tkn === 'string' && /^[a-f0-9]{32}$/i.test(tkn.trim())) {
    return tkn.trim();
  }
  const half = Math.floor(tkn.length / 2);
  const p1   = tkn.slice(0, half).split('').reverse().join('');
  const p2   = tkn.slice(half).split('').reverse().join('');
  const dec1 = Buffer.from(p1, 'base64').toString('utf8');
  const dec2 = Buffer.from(p2, 'base64').toString('utf8');
  return dec2 + dec1;
}

/* ── Кэш токена (warm invocations) ─────────────────────────────────── */
let _cachedToken = null;

async function getKodikToken() {
  if (process.env.KODIK_TOKEN) return process.env.KODIK_TOKEN;
  if (_cachedToken) return _cachedToken;

  // Используем локальные токены
  for (const tkn of FALLBACK_TOKENS) {
    try {
      const token = decryptToken(tkn);
      if (token && token.length >= 20) {
        _cachedToken = token;
        return token;
      }
    } catch { /* skip */ }
  }

  throw new Error('Kodik: рабочий токен не настроен на сервере');
}

/* ── Handler ────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  const isCorsAllowed = setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(isCorsAllowed ? 204 : 403).end();

  const { shikimori_id } = req.query;
  if (!shikimori_id || !/^\d+$/.test(String(shikimori_id))) {
    return res.status(400).json({ error: 'Valid numeric shikimori_id required' });
  }

  try {
    const token = await getKodikToken();

    const apiUrl = `https://kodik-api.com/search?token=${token}&shikimori_id=${encodeURIComponent(shikimori_id)}&limit=100`;
    const apiRes = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(8000),
    });

    if (apiRes.status === 401 || apiRes.status === 403) {
      _cachedToken = null; // сбрасываем кэш только при реальной ошибке авторизации
      throw new Error(`Kodik API auth error: ${apiRes.status}`);
    }

    if (!apiRes.ok) {
      throw new Error(`Kodik API: ${apiRes.status}`);
    }

    const data = await apiRes.json();

    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ error: 'Тайтл не найден в Kodik' });
    }

    /* Группируем по translation_id, берём макс. episodes_count */
    const map = {};
    for (const item of data.results) {
      if (!item.translation?.id) continue;

      const tid = String(item.translation.id);
      const ec  = item.episodes_count || 1;

      if (!map[tid] || map[tid].episodes_count < ec) {
        const rawLink = item.link || '';
        // API уже возвращает //kodikplayer.com/... — просто добавляем https:
        // Если вдруг kodik.info — меняем домен. Если уже https — оставляем.
        let link;
        if (rawLink.startsWith('//kodik.info')) {
          link = 'https://kodikplayer.com' + rawLink.slice('//kodik.info'.length);
        } else if (rawLink.startsWith('//')) {
          link = 'https:' + rawLink;
        } else if (rawLink.startsWith('https://kodik.info')) {
          link = rawLink.replace('https://kodik.info', 'https://kodikplayer.com');
        } else {
          link = rawLink; // уже полная ссылка
        }

        map[tid] = {
          id: tid,
          title: item.translation.title || 'Озвучка',
          type: item.translation.type || 'voice',
          episodes_count: ec,
          link,
        };
      }
    }

    const translations = Object.values(map).sort((a, b) =>
      (a.type === 'voice' ? 0 : 1) - (b.type === 'voice' ? 0 : 1)
    );

    return res.status(200).json({ translations });

  } catch (err) {
    console.error('[get-info]', err.message);
    await captureServerError(err, req, { endpoint: 'api/get-info' });
    return res.status(500).json({ error: 'Failed to fetch anime info from Kodik' });
  }
}
