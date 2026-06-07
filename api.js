/* ============================================================
   api.js — TMDB live data client
   ============================================================ */
const GENRE_MAP = {}; 
let ALL_GENRES = [];   

async function tmdb(path, params={}){
  const url = new URL(TMDB.BASE + path);
  url.searchParams.set("api_key", TMDB.KEY);
  Object.entries(params).forEach(([k,v]) => v!=null && url.searchParams.set(k, v));
  const r = await fetch(url);
  if(!r.ok) throw new Error("TMDB "+r.status+" "+path);
  return r.json();
}

async function loadGenres(){
  const [m, t] = await Promise.all([
    tmdb("/genre/movie/list"),
    tmdb("/genre/tv/list"),
  ]);
  [...m.genres, ...t.genres].forEach(g => GENRE_MAP[g.id] = g.name);
  const seen = {};
  ALL_GENRES = [...m.genres, ...t.genres].filter(g => !seen[g.name] && (seen[g.name]=1)).sort((a,b)=>a.name.localeCompare(b.name));
}

function norm(x){
  const isTV = x.media_type === "tv" || (x.name && !x.title);
  const date = x.release_date || x.first_air_date || "";
  const genres = (x.genre_ids||[]).map(id=>GENRE_MAP[id]).filter(Boolean);
  return {
    id: (isTV?"tv-":"movie-") + x.id,
    tmdbId: x.id,
    type: isTV ? "series" : "movie",
    title: x.title || x.name || "Untitled",
    year: date ? +date.slice(0,4) : null,
    rating: x.vote_average ? +x.vote_average.toFixed(1) : 0,
    votes: x.vote_count || 0,
    overview: x.overview || "No description available.",
    poster: x.poster_path ? TMDB.IMG + x.poster_path : null,
    backdrop: x.backdrop_path ? TMDB.IMG_LG + x.backdrop_path : (x.poster_path ? TMDB.IMG_LG + x.poster_path : null),
    genres,
    genreIds: x.genre_ids || [],
  };
}
function normList(arr){ return (arr||[]).map(norm).filter(x=>x.poster); }

const api = {
  trendingMovies: () => tmdb("/trending/movie/week").then(d=>normList(d.results)),
  trendingTV:     () => tmdb("/trending/tv/week").then(d=>normList(d.results)),
  trendingAll:    () => tmdb("/trending/all/day").then(d=>normList(d.results)),
  popularMovies:  (p=1) => tmdb("/movie/popular",{page:p}).then(d=>normList(d.results)),
  topMovies:      (p=1) => tmdb("/movie/top_rated",{page:p}).then(d=>normList(d.results)),
  nowPlaying:     (p=1) => tmdb("/movie/now_playing",{page:p}).then(d=>normList(d.results)),
  popularTV:      (p=1) => tmdb("/tv/popular",{page:p}).then(d=>normList(d.results)),
  topTV:          (p=1) => tmdb("/tv/top_rated",{page:p}).then(d=>normList(d.results)),
  search:         (q,p=1) => tmdb("/search/multi",{query:q,page:p}).then(d=>normList(d.results.filter(r=>r.media_type!=="person"))),
  discover: (type, {genre, year, sort="popularity.desc", page=1}={}) => {
    const isTV = type==="series";
    const params = { sort_by: sort, page, "vote_count.gte": 30 };
    if(genre && genre!=="all") params.with_genres = genre;
    if(year && year!=="all") params[isTV?"first_air_date_year":"primary_release_year"] = year;
    return tmdb(isTV?"/discover/tv":"/discover/movie", params).then(d=>({items:normList(d.results), totalPages:d.total_pages}));
  },
  byGenreRow: (type, genreId) => {
    const isTV = type==="series";
    return tmdb(isTV?"/discover/tv":"/discover/movie",{with_genres:genreId,sort_by:"popularity.desc","vote_count.gte":50}).then(d=>normList(d.results).slice(0,16));
  },
  details: async (type, tmdbId) => {
    const isTV = type==="series";
    const d = await tmdb(`/${isTV?"tv":"movie"}/${tmdbId}`, {append_to_response:"credits,videos"});
    const base = norm({...d, media_type: isTV?"tv":"movie", genre_ids:(d.genres||[]).map(g=>g.id)});
    base.genres = (d.genres||[]).map(g=>g.name);
    base.runtime = isTV ? null : d.runtime;
    base.tagline = d.tagline || "";
    base.cast = (d.credits?.cast||[]).slice(0,6).map(c=>c.name);
    if(isTV){
      base.seasons = (d.seasons||[]).filter(s=>s.season_number>0);
      base.lastSeason = d.number_of_seasons || (base.seasons[base.seasons.length - 1]?.season_number) || 1;
      base.latest = `${d.number_of_seasons||1} season${(d.number_of_seasons||1)>1?'s':''}`;
    }
    return base;
  },
  season: (tmdbId, seasonNum) => tmdb(`/tv/${tmdbId}/season/${seasonNum}`).then(d=>d.episodes||[]),
};