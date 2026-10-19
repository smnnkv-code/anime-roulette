/**
 * normalizeMAL.js — адаптер MAL API → внутренний формат приложения.
 *
 * MAL возвращает структуру вида:
 *   [{ node: { id, title, main_picture, ... }, list_status: { status } }]
 *
 * Приложение ожидает:
 *   [{ id, anime: { id, name, russian, score, kind, status, episodes, aired_on, genres, image, mal_id } }]
 */

const MAL_STATUS_MAP = {
  finished_airing:  'released',
  currently_airing: 'ongoing',
  not_yet_aired:    'anons',
};

const MAL_KIND_MAP = {
  tv:      'tv',
  movie:   'movie',
  ova:     'ova',
  ona:     'ona',
  special: 'special',
  music:   'music',
  // MAL может возвращать: 'tv_short', 'pv', 'cm' — нормализуем их
  tv_short: 'special',
  pv:       'special',
  cm:       'special',
};

/**
 * Нормализует массив записей из MAL /users/{username}/animelist
 * во внутренний формат приложения (совместимый с Shikimori).
 *
 * @param {Array} malData — массив от MAL API
 * @returns {Array} — нормализованный список
 */
export function normalizeMalList(malData) {
  // MAL возвращает newest-first при sort=list_updated_at.
  // Разворачиваем, чтобы порядок был от старых к новым (совместимо с Shikimori и weightedRandom).
  const sorted = [...malData].reverse();

  return sorted.map((item) => {
    const node = item.node || {};

    return {
      id:    node.id,
      anime: {
        id:         node.id,
        mal_id:     node.id,             // для совместимости с Shikimori-путями
        name:       node.title || '',
        russian:    node.title || '',    // MAL не отдаёт русские названия
        score:      String(node.mean || 0),
        kind:       MAL_KIND_MAP[node.media_type] || node.media_type || 'tv',
        status:     MAL_STATUS_MAP[node.status] || node.status || 'released',
        episodes:   node.num_episodes || 0,
        episodes_aired: node.num_episodes || 0,
        aired_on:   node.start_date || null,
        genres:     (node.genres || []).map((g) => ({
          id:      g.id,
          name:    g.name,
          russian: g.name,   // MAL жанры на английском
        })),
        image: {
          original:  null,            // Shikimori-пути не используются
          preview:   null,
          x96:       null,
          x48:       null,
          malLarge:  node.main_picture?.large  || null,
          malMedium: node.main_picture?.medium || null,
        },
      },
    };
  });
}
