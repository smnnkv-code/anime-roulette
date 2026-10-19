import { describe, it, expect } from 'vitest';
import { normalizeMalList } from '../normalizeMAL';

describe('normalizeMAL utility', () => {
  it('normalizes MAL items and reverses them to match oldest-first order', () => {
    const rawMal = [
      {
        node: {
          id: 101,
          title: 'Newest Anime',
          mean: 8.5,
          media_type: 'tv',
          status: 'currently_airing',
          num_episodes: 12,
          start_date: '2024-01-01',
          genres: [{ id: 1, name: 'Action' }],
          main_picture: {
            large: 'https://cdn.myanimelist.net/large.jpg',
            medium: 'https://cdn.myanimelist.net/medium.jpg',
          },
        },
      },
      {
        node: {
          id: 102,
          title: 'Oldest Anime',
          mean: 7.2,
          media_type: 'movie',
          status: 'finished_airing',
          num_episodes: 1,
          start_date: '2010-05-12',
        },
      },
    ];

    const result = normalizeMalList(rawMal);

    // Должен развернуть порядок (102 сначала, 101 потом)
    expect(result.length).toBe(2);
    expect(result[0].id).toBe(102);
    expect(result[0].anime.id).toBe(102);
    expect(result[0].anime.mal_id).toBe(102);
    expect(result[0].anime.name).toBe('Oldest Anime');
    expect(result[0].anime.russian).toBe('Oldest Anime');
    expect(result[0].anime.kind).toBe('movie');
    expect(result[0].anime.status).toBe('released');
    expect(result[0].anime.episodes).toBe(1);
    expect(result[0].anime.episodes_aired).toBe(1);
    expect(result[0].anime.aired_on).toBe('2010-05-12');
    expect(result[0].anime.genres).toEqual([]);
    expect(result[0].anime.image.malLarge).toBeNull();
    expect(result[0].anime.image.malMedium).toBeNull();
    expect(result[0].anime.image.original).toBeNull();

    expect(result[1].id).toBe(101);
    expect(result[1].anime.status).toBe('ongoing');
    expect(result[1].anime.score).toBe('8.5');
    expect(result[1].anime.episodes).toBe(12);
    expect(result[1].anime.episodes_aired).toBe(12);
    expect(result[1].anime.aired_on).toBe('2024-01-01');
    expect(result[1].anime.image.malLarge).toBe('https://cdn.myanimelist.net/large.jpg');
    expect(result[1].anime.image.malMedium).toBe('https://cdn.myanimelist.net/medium.jpg');
    expect(result[1].anime.genres).toHaveLength(1);
    expect(result[1].anime.genres[0]).toEqual({ id: 1, name: 'Action', russian: 'Action' });
  });

  it('handles empty or sparse objects without crashing and applies defaults', () => {
    const rawMal = [{ node: {} }];
    const result = normalizeMalList(rawMal);

    expect(result.length).toBe(1);
    expect(result[0].anime.name).toBe('');
    expect(result[0].anime.russian).toBe('');
    expect(result[0].anime.score).toBe('0');
    expect(result[0].anime.kind).toBe('tv');
    expect(result[0].anime.status).toBe('released');
    expect(result[0].anime.episodes).toBe(0);
    expect(result[0].anime.episodes_aired).toBe(0);
    expect(result[0].anime.aired_on).toBeNull();
    expect(result[0].anime.genres).toEqual([]);
    expect(result[0].anime.image.malLarge).toBeNull();
    expect(result[0].anime.image.malMedium).toBeNull();
  });

  it('Кейс 12: корректно нормализует необычные типы media_type (tv_short, pv, cm, ova, ona, special, music)', () => {
    const rawMal = [
      { node: { id: 1, title: 'Short Anime', media_type: 'tv_short' } },
      { node: { id: 2, title: 'Promo Video', media_type: 'pv' } },
      { node: { id: 3, title: 'Commercial', media_type: 'cm' } },
      { node: { id: 4, title: 'Custom Unknown', media_type: 'custom_type' } },
      { node: { id: 5, title: 'OVA Title', media_type: 'ova' } },
      { node: { id: 6, title: 'ONA Title', media_type: 'ona' } },
      { node: { id: 7, title: 'Special Title', media_type: 'special' } },
      { node: { id: 8, title: 'Music Title', media_type: 'music' } },
    ];

    const result = normalizeMalList(rawMal);
    expect(result).toHaveLength(8);

    // В обратном порядке (последний в raw становится первым в result)
    expect(result[0].anime.kind).toBe('music');
    expect(result[1].anime.kind).toBe('special');
    expect(result[2].anime.kind).toBe('ona');
    expect(result[3].anime.kind).toBe('ova');
    expect(result[4].anime.kind).toBe('custom_type');
    expect(result[5].anime.kind).toBe('special'); // cm
    expect(result[6].anime.kind).toBe('special'); // pv
    expect(result[7].anime.kind).toBe('special'); // tv_short
  });

  it('нормализует все варианты статуса MAL (finished_airing, currently_airing, not_yet_aired, custom)', () => {
    const rawMal = [
      { node: { id: 1, status: 'finished_airing' } },
      { node: { id: 2, status: 'currently_airing' } },
      { node: { id: 3, status: 'not_yet_aired' } },
      { node: { id: 4, status: 'unknown_status' } },
    ];

    const result = normalizeMalList(rawMal);
    expect(result).toHaveLength(4);

    expect(result[0].anime.status).toBe('unknown_status');
    expect(result[1].anime.status).toBe('anons');
    expect(result[2].anime.status).toBe('ongoing');
    expect(result[3].anime.status).toBe('released');
  });

  it('возвращает пустой массив при пустом входном списке', () => {
    expect(normalizeMalList([])).toEqual([]);
  });
});
