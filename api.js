/* ============================================================
   api.js — TMDB API wrapper with genre cache & normalization
   ============================================================ */

const GENRE_MAP = {};
let ALL_GENRES = [];

/* ---------- Core fetch with retry ---------- */
async function tmdb(path, params = {}, _retry = 0) {
  const url = new URL(TMDB.BASE + path);
  url.searchParams.set("api_key", TMDB.KEY);
  
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  
  const r = await fetch(url);
  if (r.status === 429 && _retry < 2) {
    const wait = (+r.headers.get("retry-after") || 1) * 1000;
    await new Promise(res => setTimeout(res, wait));
    return tmdb(path, params, _retry + 1);
  }
  if (!r.ok) throw new Error(`TMDB ${r.status} ${path}`);
  return r.json();
}

/* ---------- Load genres ---------- */
async function loadGenres() {
  try {
    const [m, t] = await Promise.all([
      tmdb("/genre/movie/list"),
      tmdb("/genre/tv/list"),
    ]);
    
    const all = [...m.genres, ...t.genres];
    all.forEach(g => GENRE_MAP[g.id] = g.name);
    
    const seen = new Set();
    ALL_GENRES = all
      .filter(g => !seen.has(g.name) && seen.add(g.name))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("[api] loadGenres failed:", err);
    throw err;
  }
}

/* ---------- Normalize ---------- */
function norm(x) {
  if (!x?.id || x.media_type === "person") return null;
  
  const isTV = x.media_type === "tv" || 
               (!x.media_type && x.name && !x.title);
  
  const date = x.release_date || x.first_air_date || "";
  const year = /^\d{4}$/.test(date.slice(0, 4)) ? +date.slice(0, 4) : null;
  
  return {
    id: `${isTV ? "tv" : "movie"}-${x.id}`,
    tmdbId: x.id,
    type: isTV ? "series" : "movie",
    title: x.title || x.name || "Untitled",
    year,
    rating: x.vote_average ? +x.vote_average.toFixed(1) : 0,
    votes: x.vote_count || 0,
    overview: x.overview || "No description available.",
    poster: x.poster_path ? TMDB.IMG + x.poster_path : null,
    backdrop: x.backdrop_path ? TMDB.IMG_LG + x.backdrop_path : 
              x.poster_path ? TMDB.IMG_LG + x.poster_path : null,
    genres: (x.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean),
    genreIds: x.genre_ids || [],
  };
}

function normList(arr) { return (arr || []).map(norm).filter(Boolean); }

/* ---------- Generic endpoint factory ---------- */
function endpoint(path, transform = normList) {
  return (params = {}) => 
    tmdb(path, params)
      .then(d => transform(d))
      .catch(err => { 
        console.error(`[api] ${path}:`, err); 
        throw err; 
      });
}

/* ---------- Endpoint config ---------- */
const endpoints = {
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
  Object.entries(endpoints).map(([name, path]) => [
    name,
    (p = 1) => endpoint(path)({ page: p })
  ])
);

/* ---------- Search ---------- */
api.search = (q, p = 1) => 
  endpoint("/search/multi")({ query: q, page: p });

/* ---------- Discover ---------- */
api.discover = (type, { genre, year, sort = "popularity.desc", page = 1 } = {}) => {
  const isTV = type === "series";
  const params = { 
    sort_by: sort || "popularity.desc", 
    page, 
    "vote_count.gte": 30 
  };
  if (genre && genre !== "all") params.with_genres = genre;
  if (year && year !== "all") {
    params[isTV ? "first_air_date_year" : "primary_release_year"] = year;
  }
  
  return endpoint(
    isTV ? "/discover/tv" : "/discover/movie",
    d => ({ items: normList(d.results), totalPages: d.total_pages ?? 1 })
  )(params);
};

/* ---------- Genre row ---------- */
api.byGenreRow = (type, genreId) => {
  const isTV = type === "series";
  return endpoint(
    isTV ? "/discover/tv" : "/discover/movie",
    d => normList(d.results).slice(0, 16)
  )({
    with_genres: genreId,
    sort_by: "popularity.desc",
    "vote_count.gte": 50,
  });
};

/* ---------- Details ---------- */
api.details = async (type, tmdbId) => {
  const isTV = type === "series";
  const d = await tmdb(`/${isTV ? "tv" : "movie"}/${tmdbId}`, {
    append_to_response: "credits,videos",
  });
  
  const base = norm({
    ...d,
    media_type: isTV ? "tv" : "movie",
    genre_ids: (d.genres || []).map(g => g.id),
  });
  
  if (!base) throw new Error(`norm() returned null for tmdbId ${tmdbId}`);
  
  base.genres = (d.genres || []).map(g => g.name);
  base.runtime = isTV ? null : d.runtime;
  base.tagline = d.tagline || "";
  base.cast = (d.credits?.cast || []).slice(0, 6).map(c => c.name);
  
  const trailer = (d.videos?.results || []).find(
    v => v.site === "YouTube" && v.type === "Trailer"
  );
  base.trailerKey = trailer?.key || null;
  
  if (isTV) {
    const seasons = (d.seasons || []).filter(s => s.season_number > 0);
    const numSeasons = d.number_of_seasons ?? 
                      seasons[seasons.length - 1]?.season_number ?? 1;
    base.seasons = seasons;
    base.lastSeason = numSeasons;
    base.latest = `${numSeasons} season${numSeasons !== 1 ? "s" : ""}`;
  }
  
  return base;
};

/* ---------- Season episodes ---------- */
api.season = (tmdbId, seasonNum) =>
  tmdb(`/tv/${tmdbId}/season/${seasonNum}`)
    .then(d => d.episodes || [])
    .catch(err => { 
      console.error("[api] season:", err); 
      throw err; 
    });

/* ---------- Recommendations ---------- */
api.recommendations = (type, tmdbId) =>
  tmdb(`/${type === "series" ? "tv" : "movie"}/${tmdbId}/recommendations`)
    .then(d => normList(d.results).slice(0, 16))
    .catch(err => { 
      console.error("[api] recommendations:", err); 
      return []; 
    });
