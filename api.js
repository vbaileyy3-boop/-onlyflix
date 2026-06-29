/* ============================================================
   api.js — TMDB client with caching & normalization
   ============================================================ */

import { TMDB } from './config.js';

const genreMap = new Map();
let allGenres = [];
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_ITEMS = 150;

async function tmdb(path, params = {}, retries = 2) {
  const url = new URL(TMDB.BASE + path);
  url.searchParams.set('api_key', TMDB.KEY);

  for (const [key, val] of Object.entries(params)) {
    if (val != null && val !== '') url.searchParams.set(key, val);
  }

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        const ms = (+res.headers.get('retry-after') || 1) * 1000;
        await new Promise(r => setTimeout(r, ms));
        continue;
      }
      if (!res.ok) throw new Error(`TMDB ${res.status} ${path}`);
      const data = await res.json();
      
      if (cache.size >= MAX_CACHE_ITEMS) {
        const now = Date.now();
        for (const [k, v] of cache.entries()) {
          if (now - v.ts > CACHE_TTL) cache.delete(k);
        }
      }
      
      cache.set(cacheKey, { data, ts: Date.now() });
      return data;
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
  throw new Error(`Failed after ${retries} retries`);
}

export async function loadGenres() {
  try {
    const [movies, tv] = await Promise.all([
      tmdb('/genre/movie/list'),
      tmdb('/genre/tv/list')
    ]);

    const all = [...movies.genres, ...tv.genres];
    for (const g of all) genreMap.set(g.id, g.name);

    const seen = new Set();
    allGenres = all
      .filter(g => !seen.has(g.name) && seen.add(g.name))
      .sort((a, b) => a.name.localeCompare(b.name));

    return allGenres;
  } catch (err) {
    console.error('[api] loadGenres failed:', err);
    throw err;
  }
}

export function getGenres() {
  return allGenres;
}

function normalize(item) {
  if (!item?.id || item.media_type === 'person') return null;

  const isTV = item.media_type === 'tv' || (!item.media_type && item.name && !item.title);
  const date = item.release_date || item.first_air_date || '';
  const year = /^\d{4}/.test(date) ? +date.slice(0, 4) : null;

  return {
    id: `${isTV ? 'tv' : 'movie'}-${item.id}`,
    tmdbId: item.id,
    type: isTV ? 'series' : 'movie',
    title: item.title || item.name || 'Untitled',
    year,
    rating: item.vote_average ? +item.vote_average.toFixed(1) : 0,
    votes: item.vote_count || 0,
    overview: item.overview || 'No description available.',
    poster: item.poster_path ? TMDB.IMG + item.poster_path : null,
    backdrop: item.backdrop_path ? TMDB.IMG_LG + item.backdrop_path : item.poster_path ? TMDB.IMG_LG + item.poster_path : null,
    genres: (item.genre_ids || []).map(id => genreMap.get(id)).filter(Boolean),
    genreIds: item.genre_ids || []
  };
}

function normalizeList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalize).filter(Boolean);
}

function createEndpoint(path) {
  return (params = {}) =>
    tmdb(path, params)
      .then(data => normalizeList(data.results))
      .catch(err => {
        console.error(`[api] ${path}:`, err);
        throw err;
      });
}

const endpoints = {
  trendingMovies: '/trending/movie/week',
  trendingMoviesDay: '/trending/movie/day',
  trendingTV: '/trending/tv/week',
  trendingTVDay: '/trending/tv/day',
  trendingAll: '/trending/all/day',
  popularMovies: '/movie/popular',
  topMovies: '/movie/top_rated',
  nowPlaying: '/movie/now_playing',
  popularTV: '/tv/popular',
  topTV: '/tv/top_rated'
};

export const api = Object.fromEntries(
  Object.entries(endpoints).map(([name, path]) => {
    const fetcher = createEndpoint(path);
    return [name, (page = 1) => fetcher({ page })];
  })
);

api.search = (query, page = 1) =>
  createEndpoint('/search/multi')({ query, page });

api.discover = async (type, { genre, year, sort = 'popularity.desc', page = 1 } = {}) => {
  const isTV = type === 'series';
  const params = {
    sort_by: sort,
    page,
    'vote_count.gte': 30
  };

  if (genre && genre !== 'all') params.with_genres = genre;
  if (year && year !== 'all') {
    params[isTV ? 'first_air_date_year' : 'primary_release_year'] = year;
  }

  const path = isTV ? '/discover/tv' : '/discover/movie';
  const data = await tmdb(path, params);
  return {
    items: normalizeList(data.results),
    totalPages: data.total_pages ?? 1
  };
};

api.byGenreRow = (type, genreId) => {
  const isTV = type === 'series';
  return tmdb(isTV ? '/discover/tv' : '/discover/movie', {
    with_genres: genreId,
    sort_by: 'popularity.desc',
    'vote_count.gte': 50
  })
    .then(data => normalizeList(data.results).slice(0, 16))
    .catch(err => {
      console.error('[api] byGenreRow:', err);
      return [];
    });
};

api.details = async (type, tmdbId) => {
  const isTV = type === 'series';
  const data = await tmdb(`/${isTV ? 'tv' : 'movie'}/${tmdbId}`, {
    append_to_response: 'credits,videos'
  });

  const base = normalize({
    ...data,
    media_type: isTV ? 'tv' : 'movie',
    genre_ids: (data.genres || []).map(g => g.id)
  });

  if (!base) throw new Error(`normalize failed for ID ${tmdbId}`);

  base.genres = (data.genres || []).map(g => g.name);
  base.runtime = isTV ? null : data.runtime;
  base.tagline = data.tagline || '';
  base.cast = (data.credits?.cast || []).slice(0, 6).map(c => c.name);

  const trailer = (data.videos?.results || []).find(
    v => v.site === 'YouTube' && v.type === 'Trailer'
  );
  base.trailerKey = trailer?.key || null;

  if (isTV) {
    const seasons = (data.seasons || []).filter(s => s.season_number > 0);
    const numSeasons = data.number_of_seasons ??
      seasons[seasons.length - 1]?.season_number ??
      1;
    base.seasons = seasons;
    base.lastSeason = numSeasons;
    base.latest = `${numSeasons} season${numSeasons !== 1 ? 's' : ''}`;
  }

  return base;
};

api.season = (tmdbId, seasonNum) =>
  tmdb(`/tv/${tmdbId}/season/${seasonNum}`)
    .then(data => data.episodes || [])
    .catch(err => {
      console.error('[api] season:', err);
      return [];
    });

api.recommendations = (type, tmdbId) => {
  const path = `/${type === 'series' ? 'tv' : 'movie'}/${tmdbId}/recommendations`;
  return tmdb(path)
    .then(data => normalizeList(data.results).slice(0, 16))
    .catch(err => {
      console.error('[api] recommendations:', err);
      return [];
    });
};
