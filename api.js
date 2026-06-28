/* ============================================================
   api.js — TMDB client with genre cache, normalization, retry
   ============================================================ */

const genreMap = new Map();
let allGenres = [];

/* ---------- Core: fetch with exponential backoff ---------- */
async function tmdb(path, params = {}, retries = 2) {
  const url = new URL(TMDB.BASE + path);
  url.searchParams.set("api_key", TMDB.KEY);
  
  for (const [key, val] of Object.entries(params)) {
    if (val != null && val !== "") url.searchParams.set(key, val);
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url);
    
    if (res.status === 429 && attempt < retries) {
      const ms = (+res.headers.get("retry-after") || 1) * 1000;
      await new Promise(r => setTimeout(r, ms));
      continue;
    }
    
    if (!res.ok) throw new Error(`TMDB ${res.status} ${path}`);
    return res.json();
  }
  
  throw new Error(`TMDB rate limit exceeded for ${path}`);
}

/* ---------- Genre cache ---------- */
async function loadGenres() {
  try {
    const [movies, tv] = await Promise.all([
      tmdb("/genre/movie/list"),
      tmdb("/genre/tv/list"),
    ]);

    const all = [...movies.genres, ...tv.genres];
    for (const g of all) genreMap.set(g.id, g.name);

    const seen = new Set();
    allGenres = all
      .filter(g => !seen.has(g.name) && seen.add(g.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("[api] loadGenres failed:", err);
    throw err;
  }
}

/* ---------- Normalize ---------- */
function normalize(item) {
  if (!item?.id || item.media_type === "person") return null;

  const isTV = item.media_type === "tv" || (!item.media_type && item.name && !item.title);
  const date = item.release_date || item.first_air_date || "";
  const year = /^\d{4}/.test(date) ? +date.slice(0, 4) : null;

  return {
    id: `${isTV ? "tv" : "movie"}-${item.id}`,
    tmdbId: item.id,
    type: isTV ? "series" : "movie",
    title: item.title || item.name || "Untitled",
    year,
    rating: item.vote_average ? +item.vote_average.toFixed(1) : 0,
    votes: item.vote_count || 0,
    overview: item.overview || "No description available.",
    poster: item.poster_path ? TMDB.IMG + item.poster_path : null,
    backdrop: item.backdrop_path ? TMDB.IMG_LG + item.backdrop_path : 
              item.poster_path ? TMDB.IMG_LG + item.poster_path : null,
    genres: (item.genre_ids || []).map(id => genreMap.get(id)).filter(Boolean),
    genreIds: item.genre_ids || [],
  };
}

function normalizeList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normalize).filter(Boolean);
}

/* ---------- Endpoint factory ---------- */
function createEndpoint(path, transform) {
  return (params = {}) =>
    tmdb(path, params)
      .then(data => transform ? transform(data) : normalizeList(data.results))
      .catch(err => {
        console.error(`[api] ${path}:`, err);
        throw err;
      });
}

/* ---------- Endpoints ---------- */
const endpointConfig = {
  trendingMovies: "/trending/movie/week",
  trendingMoviesDay: "/trending/movie/day",
  trendingTV: "/trending/tv/week",
  trendingTVDay: "/trending/tv/day",
  trendingAll: "/trending/all/day",
  popularMovies: "/movie/popular",
  topMovies: "/movie/top_rated",
  nowPlaying: "/movie/now_playing",
  popularTV: "/tv/popular",
  topTV: "/tv/top_rated",
};

const api = Object.fromEntries(
  Object.entries(endpointConfig).map(([name, path]) => [
    name,
    (page = 1) => createEndpoint(path)({ page }),
  ])
);

/* ---------- Search ---------- */
api.search = (query, page = 1) =>
  createEndpoint("/search/multi")({ query, page });

/* ---------- Discover ---------- */
api.discover = (type, { genre, year, sort = "popularity.desc", page = 1 } = {}) => {
  const isTV = type === "series";
  const params = {
    sort_by: sort,
    page,
    "vote_count.gte": 30,
  };
  if (genre && genre !== "all") params.with_genres = genre;
  if (year && year !== "all") {
    const key = isTV ? "first_air_date_year" : "primary_release_year";
    params[key] = year;
  }

  const path = isTV ? "/discover/tv" : "/discover/movie";
  return tmdb(path, params)
    .then(data => ({
      items: normalizeList(data.results),
      totalPages: data.total_pages ?? 1,
    }))
    .catch(err => {
      console.error("[api] discover:", err);
      throw err;
    });
};

/* ---------- Genre row ---------- */
api.byGenreRow = (type, genreId) => {
  const isTV = type === "series";
  return tmdb(isTV ? "/discover/tv" : "/discover/movie", {
    with_genres: genreId,
    sort_by: "popularity.desc",
    "vote_count.gte": 50,
  })
    .then(data => normalizeList(data.results).slice(0, 16))
    .catch(err => {
      console.error("[api] byGenreRow:", err);
      throw err;
    });
};

/* ---------- Details ---------- */
api.details = async (type, tmdbId) => {
  const isTV = type === "series";
  const data = await tmdb(`/${isTV ? "tv" : "movie"}/${tmdbId}`, {
    append_to_response: "credits,videos",
  });

  const base = normalize({
    ...data,
    media_type: isTV ? "tv" : "movie",
    genre_ids: (data.genres || []).map(g => g.id),
  });

  if (!base) throw new Error(`normalize() returned null for ID ${tmdbId}`);

  base.genres = (data.genres || []).map(g => g.name);
  base.runtime = isTV ? null : data.runtime;
  base.tagline = data.tagline || "";
  base.cast = (data.credits?.cast || []).slice(0, 6).map(c => c.name);

  const trailer = (data.videos?.results || []).find(
    v => v.site === "YouTube" && v.type === "Trailer"
  );
  base.trailerKey = trailer?.key || null;

  if (isTV) {
    const seasons = (data.seasons || []).filter(s => s.season_number > 0);
    const numSeasons = data.number_of_seasons ??
                      seasons[seasons.length - 1]?.season_number ??
                      1;
    base.seasons = seasons;
    base.lastSeason = numSeasons;
    base.latest = `${numSeasons} season${numSeasons !== 1 ? "s" : ""}`;
  }

  return base;
};

/* ---------- Season episodes ---------- */
api.season = (tmdbId, seasonNum) =>
  tmdb(`/tv/${tmdbId}/season/${seasonNum}`)
    .then(data => data.episodes || [])
    .catch(err => {
      console.error("[api] season:", err);
      throw err;
    });

/* ---------- Recommendations ---------- */
api.recommendations = (type, tmdbId) => {
  const path = `/${type === "series" ? "tv" : "movie"}/${tmdbId}/recommendations`;
  return tmdb(path)
    .then(data => normalizeList(data.results).slice(0, 16))
    .catch(err => {
      console.error("[api] recommendations:", err);
      return [];
    });
};
