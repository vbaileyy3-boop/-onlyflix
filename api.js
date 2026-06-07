/* ============================================================
   api.js — TMDB live data client (FIXED)
   ============================================================ */
const GENRE_MAP = {};
let ALL_GENRES = [];

async function tmdb(path, params = {}) {
  const url = new URL(TMDB.BASE + path);
  url.searchParams.set("api_key", TMDB.KEY);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const r = await fetch(url);
  if (!r.ok) throw new Error("TMDB " + r.status + " " + path);
  return r.json();
}

// FIX #5: loadGenres now catches and re-throws so callers know when genres
// failed to load, rather than silently leaving GENRE_MAP empty forever.
async function loadGenres() {
  const [m, t] = await Promise.all([
    tmdb("/genre/movie/list"),
    tmdb("/genre/tv/list"),
  ]).catch(err => {
    console.error("[api] loadGenres failed:", err);
    throw err; // re-throw so the caller can show an error state
  });
  [...m.genres, ...t.genres].forEach(g => (GENRE_MAP[g.id] = g.name));
  const seen = {};
  ALL_GENRES = [...m.genres, ...t.genres]
    .filter(g => !seen[g.name] && (seen[g.name] = 1))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function norm(x) {
  // FIX #1: prefer explicit media_type from TMDB over the name/title heuristic.
  // The heuristic (has name but no title → TV) is unreliable for /search/multi
  // results where both fields can co-exist. media_type is authoritative when present.
  const isTV =
    x.media_type === "tv" ||
    (x.media_type == null && x.name != null && x.title == null);

  const date = x.release_date || x.first_air_date || "";
  const genres = (x.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean);

  // FIX #2: guard against malformed date strings shorter than 4 chars
  // (e.g. "20" would parse as year 20). Require exactly 4 leading digits.
  const yearStr = date.slice(0, 4);
  const year = /^\d{4}$/.test(yearStr) ? +yearStr : null;

  return {
    id: (isTV ? "tv-" : "movie-") + x.id,
    tmdbId: x.id,
    type: isTV ? "series" : "movie",
    title: x.title || x.name || "Untitled",
    year,
    rating: x.vote_average ? +x.vote_average.toFixed(1) : 0,
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

// FIX #3: normList no longer silently drops posterless items.
// Items without a poster are kept in the list with poster:null so the UI
// can render a placeholder instead of mysteriously short result sets.
// If you still want to filter them, swap the body back to:
//   return (arr || []).map(norm).filter(x => x.poster);
function normList(arr) {
  return (arr || []).map(norm);
}

const api = {
  // FIX #6: all public methods now have a .catch() so rejections surface
  // as a rejected promise that callers can handle, rather than as silent
  // unhandled rejections. Each catch logs and re-throws.

  trendingMovies: () =>
    tmdb("/trending/movie/week")
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] trendingMovies:", err); throw err; }),

  trendingTV: () =>
    tmdb("/trending/tv/week")
      .then(d => normList(d.results))
      .catch(err => { console.error("[api] trendingTV:", err); throw err; }),

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
      .then(d => normList(d.results.filter(r => r.media_type !== "person")))
      .catch(err => { console.error("[api] search:", err); throw err; }),

  // FIX #4: sanitise `sort` before sending to the API.
  // Destructuring defaults only fire for `undefined`, not for empty string "".
  // A caller passing sort:"" would send sort_by:"" to TMDB, likely causing
  // a 422 or unexpected ordering. Normalise falsy values to the default here.
  discover: (type, { genre, year, sort = "popularity.desc", page = 1 } = {}) => {
    const isTV = type === "series";
    const safeSort = sort || "popularity.desc"; // guard against sort:""
    const params = { sort_by: safeSort, page, "vote_count.gte": 30 };
    if (genre && genre !== "all") params.with_genres = genre;
    if (year && year !== "all")
      params[isTV ? "first_air_date_year" : "primary_release_year"] = year;
    return tmdb(isTV ? "/discover/tv" : "/discover/movie", params)
      .then(d => ({ items: normList(d.results), totalPages: d.total_pages }))
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

    // FIX #7: pass genre_ids directly instead of relying on norm() to do a
    // GENRE_MAP lookup that we immediately overwrite anyway. This makes the
    // intent clear and avoids a wasted lookup if GENRE_MAP failed to load.
    const base = norm({
      ...d,
      media_type: isTV ? "tv" : "movie",
      genre_ids: (d.genres || []).map(g => g.id),
    });

    // Overwrite with full genre names from the detail response (authoritative).
    base.genres = (d.genres || []).map(g => g.name);
    base.runtime = isTV ? null : d.runtime;
    base.tagline = d.tagline || "";
    base.cast = (d.credits?.cast || []).slice(0, 6).map(c => c.name);

    if (isTV) {
      base.seasons = (d.seasons || []).filter(s => s.season_number > 0);

      // FIX #8: use ?? instead of || so that a legitimate value of 0
      // (a cancelled show with no numbered seasons) is not incorrectly
      // replaced by the fallback. || treats 0 as falsy.
      const numSeasons =
        d.number_of_seasons ?? base.seasons[base.seasons.length - 1]?.season_number ?? 1;
      base.lastSeason = numSeasons;
      base.latest = `${numSeasons} season${numSeasons !== 1 ? "s" : ""}`;
    }

    return base;
  },

  season: (tmdbId, seasonNum) =>
    tmdb(`/tv/${tmdbId}/season/${seasonNum}`)
      .then(d => d.episodes || [])
      .catch(err => { console.error("[api] season:", err); throw err; }),
};
