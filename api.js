const GENRE_MAP = {};
let ALL_GENRES = [];
async function tmdb(path, params = {}, _retry = 0) {
  const url = new URL(TMDB.BASE + path);
  url.searchParams.set("api_key", TMDB.KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v == null) return;
    if (typeof v === "string" && v === "") return;
    url.searchParams.set(k, v);
  });
  const r = await fetch(url);
  if (r.status === 429 && _retry < 2) {
    const wait = (+r.headers.get("retry-after") || 1) * 1000;
    await new Promise(res => setTimeout(res, wait));
    return tmdb(path, params, _retry + 1);
  }
  if (!r.ok) throw new Error("TMDB " + r.status + " " + path);
  return r.json();
}
async function loadGenres() {
  let m, t;
  try {
    [m, t] = await Promise.all([
      tmdb("/genre/movie/list"),
      tmdb("/genre/tv/list"),
    ]);
  } catch (err) {
    console.error("[api] loadGenres failed:", err);
    throw err;
  }
  [...m.genres, ...t.genres].forEach(g => (GENRE_MAP[g.id] = g.name));
  const seen = {};
  ALL_GENRES = [...m.genres, ...t.genres]
    .filter(g => !seen[g.name] && (seen[g.name] = 1))
    .sort((a, b) => a.name.localeCompare(b.name));
}
function norm(x) {
  if (!x?.id) return null;
  if (x.media_type === "person") return null;
  const isTV =
    x.media_type === "tv" ||
    (x.media_type == null && x.name != null && x.title == null);
  const date = x.release_date || x.first_air_date || "";
  const genres = (x.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean);
  const yearStr = date.slice(0, 4);
  const year = /^\d{4}$/.test(yearStr) ? +yearStr : null;
  return {
    id: (isTV ? "tv-" : "movie-") + x.id,
    tmdbId: x.id,
    type: isTV ? "series" : "movie",
    title: x.title || x.name || "Untitled",
    year,
    rating: x.vote_average != null ? +Number(x.vote_average).toFixed(1) : 0,
    votes: x.vote_count || 0,
    overview: x.overview || "No description available.",
    poster: x.poster_path ? TMDB.IMG + x.poster_path : null,
    backdrop: x.backdrop_path
      ? TMDB.IMG_LG + x.backdrop_path
      : x.poster_path
      ? TMDB.IMG_LG + x.poster_path
      : null,
    genres,
    genreIds: x.genre_ids || [],
  };
}
function normList(arr) {
  return (arr || []).map(norm).filter(Boolean);
}
const api = {
  trendingMovies: () =>
    tmdb("/trending/movie/week")
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] trendingMovies:", err); throw err; }),
  trendingMoviesDay: () =>
    tmdb("/trending/movie/day")
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] trendingMoviesDay:", err); throw err; }),
  trendingTV: () =>
    tmdb("/trending/tv/week")
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] trendingTV:", err); throw err; }),
  trendingTVDay: () =>
    tmdb("/trending/tv/day")
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] trendingTVDay:", err); throw err; }),
  trendingAll: () =>
    tmdb("/trending/all/day")
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] trendingAll:", err); throw err; }),
  popularMovies: (p = 1) =>
    tmdb("/movie/popular", { page: p })
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] popularMovies:", err); throw err; }),
  topMovies: (p = 1) =>
    tmdb("/movie/top_rated", { page: p })
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] topMovies:", err); throw err; }),
  nowPlaying: (p = 1) =>
    tmdb("/movie/now_playing", { page: p })
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] nowPlaying:", err); throw err; }),
  popularTV: (p = 1) =>
    tmdb("/tv/popular", { page: p })
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] popularTV:", err); throw err; }),
  topTV: (p = 1) =>
    tmdb("/tv/top_rated", { page: p })
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] topTV:", err); throw err; }),
  search: (q, p = 1) =>
    tmdb("/search/multi", { query: q, page: p })
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] search:", err); throw err; }),
  discover: (type, { genre, year, sort = "popularity.desc", page = 1 } = {}) => {
    const isTV = type === "series";
    const safeSort = sort || "popularity.desc";
    const params = { sort_by: safeSort, page, "vote_count.gte": 30 };
    if (genre && genre !== "all") params.with_genres = genre;
    if (year && year !== "all")
      params[isTV ? "first_air_date_year" : "primary_release_year"] = year;
    return tmdb(isTV ? "/discover/tv" : "/discover/movie", params)
      .then(d => ({ items: normList(d.results), totalPages: d.total_pages ?? 1 }))
      .catch(err => { console.error("[api] discover:", err); throw err; });
  },
  byGenreRow: (type, genreId) => {
    const isTV = type === "series";
    return tmdb(isTV ? "/discover/tv" : "/discover/movie", {
      with_genres: genreId,
      sort_by: "popularity.desc",
      "vote_count.gte": 50,
    })
      .then(d => normList(d.results).slice(0, 16))
      .catch(err => { console.error("[api] byGenreRow:", err); throw err; });
  },
  details: async (type, tmdbId) => {
    const isTV = type === "series";
    const d = await tmdb(`/${isTV ? "tv" : "movie"}/${tmdbId}`, {
      append_to_response: "credits,videos",
    });
    const base = norm({
      ...d,
      media_type: isTV ? "tv" : "movie",
      genre_ids: (d.genres || []).map(g => g.id),
    });
    if (!base) throw new Error("norm() returned null for tmdbId " + tmdbId);
    base.genres  = (d.genres || []).map(g => g.name);
    base.runtime = isTV ? null : d.runtime;
    base.tagline = d.tagline || "";
    base.cast    = (d.credits?.cast || []).slice(0, 6).map(c => c.name);
    const trailer = (d.videos?.results || []).find(
      v => v.site === "YouTube" && v.type === "Trailer"
    );
    base.trailerKey = trailer?.key || null;
    if (isTV) {
      base.seasons = (d.seasons || []).filter(s => s.season_number > 0);
      const numSeasons =
        d.number_of_seasons ??
        base.seasons[base.seasons.length - 1]?.season_number ??
        1;
      base.lastSeason = numSeasons;
      base.latest = `${numSeasons} season${numSeasons !== 1 ? "s" : ""}`;
    }
    return base;
  },
  season: (tmdbId, seasonNum) =>
    tmdb(`/tv/${tmdbId}/season/${seasonNum}`)
      .then(d => d.episodes || [])
      .catch(err => { console.error("[api] season:", err); throw err; }),
  recommendations: (type, tmdbId) =>
    tmdb(`/${type === "series" ? "tv" : "movie"}/${tmdbId}/recommendations`)
      .then(d => normList(d.results).slice(0, 16))
      .catch(err => { console.error("[api] recommendations:", err); return []; }),
};
