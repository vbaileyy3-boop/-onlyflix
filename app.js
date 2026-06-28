/* ============================================================
   app.js — OnlyFlix UI + Player
   ============================================================ */

import { loadGenres, getGenres, api } from './api.js';
import { resolveSources } from './config.js';

/* ---------- DOM shortcuts ---------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ---------- Storage ---------- */
const store = {
  get(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) {
      console.error(`[store] write failed for ${key}:`, err);
    }
  }
};

const KEYS = {
  history: 'onlyflix_history',
  list: 'onlyflix_mylist',
  progress: 'onlyflix_progress'
};

/* ---------- State ---------- */
const state = {
  history: [],
  list: [],
  progress: {},
  index: {},
  heroItems: [],
  heroIdx: 0,
  heroTimer: null,
  grid: { type: 'movie', genre: 'all', year: 'all', sort: 'popularity.desc', page: 1, items: [], totalPages: 1, loading: false },
  player: null,
  hls: null,
  searchTimer: null
};

/* ---------- Helpers ---------- */
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function posterStyle(item) {
  return item.poster ? `background-image:url('${item.poster}')` : 'background:#1a1a24';
}

function formatTime(t) {
  if (isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function indexItems(arr) {
  for (const item of (arr || [])) {
    if (item?.id) state.index[item.id] = item;
  }
  return arr;
}

function byId(id) {
  return state.index[id];
}

function defaultSeason(tmdbId) {
  return (typeof SEASON_DEFAULTS !== 'undefined' && SEASON_DEFAULTS[tmdbId]) ? SEASON_DEFAULTS[tmdbId] : 1;
}

/* ---------- Storage operations ---------- */
function loadHistory() {
  state.history = store.get(KEYS.history);
  return state.history;
}

function loadList() {
  state.list = store.get(KEYS.list);
  return state.list;
}

function loadProgress() {
  state.progress = store.get(KEYS.progress, {});
  return state.progress;
}

function pushHistory(item) {
  let h = state.history.filter(x => x.id !== item.id);
  h.unshift({
    id: item.id,
    type: item.type,
    tmdbId: item.tmdbId,
    title: item.title,
    poster: item.poster,
    backdrop: item.backdrop,
    year: item.year,
    rating: item.rating,
    genres: item.genres || [],
    overview: item.overview
  });
  state.history = h.slice(0, 18);
  store.set(KEYS.history, state.history);
}

function removeHistory(id) {
  state.history = state.history.filter(x => x.id !== id);
  store.set(KEYS.history, state.history);
  return state.history;
}

function inList(id) {
  return state.list.some(x => x.id === id);
}

function toggleList(item) {
  if (!item) return false;
  const exists = state.list.some(x => x.id === item.id);
  if (exists) {
    state.list = state.list.filter(x => x.id !== item.id);
  } else {
    state.list = [{
      id: item.id,
      type: item.type,
      tmdbId: item.tmdbId,
      title: item.title,
      poster: item.poster,
      backdrop: item.backdrop,
      year: item.year,
      rating: item.rating,
      genres: item.genres || [],
      overview: item.overview
    }, ...state.list].slice(0, 60);
  }
  store.set(KEYS.list, state.list);
  return !exists;
}

function saveProgress(id, time) {
  state.progress[id] = time;
  store.set(KEYS.progress, state.progress);
}

function clearProgress(id) {
  delete state.progress[id];
  store.set(KEYS.progress, state.progress);
}

/* ---------- Rendering ---------- */
function cardHTML(item) {
  indexItems([item]);
  const genre = item.genres?.[0] ? ` · ${esc(item.genres[0])}` : '';
  const saved = inList(item.id);

  return `<div class="card" data-id="${esc(item.id)}">
    <div class="poster" style="${posterStyle(item)}">
      <span class="badge-type">${item.type === 'series' ? 'TV' : 'Movie'}</span>
      ${item.rating ? `<span class="badge-rating">★ ${item.rating}</span>` : ''}
      <button class="bm-btn${saved ? ' active' : ''}" data-bookmark="${esc(item.id)}" title="${saved ? 'Remove from My List' : 'Add to My List'}">${saved ? '✓' : '+'}</button>
      <div class="play-ico"><div>▶</div></div>
    </div>
    <div class="card-sub">${esc(item.title)}</div>
    <div class="card-sub2">${item.year || ''}${genre}</div>
  </div>`;
}

function continueCardHTML(item) {
  indexItems([item]);
  const genre = item.genres?.[0] ? ` · ${esc(item.genres[0])}` : '';

  return `<div class="card cw-card" data-id="${esc(item.id)}">
    <div class="poster" style="${posterStyle(item)}">
      <span class="badge-type">${item.type === 'series' ? 'TV' : 'Movie'}</span>
      ${item.rating ? `<span class="badge-rating">★ ${item.rating}</span>` : ''}
      <button class="cw-remove" data-remove="${esc(item.id)}">×</button>
      <div class="play-ico"><div>▶</div></div>
    </div>
    <div class="card-sub">${esc(item.title)}</div>
    <div class="card-sub2">${item.year || ''}${genre}</div>
  </div>`;
}

function rowHTML(title, items, route) {
  if (!items?.length) return '';
  return `<div class="row">
    <div class="row-head">
      <h2>${esc(title)}</h2>
      ${route ? `<span class="more" data-route="${esc(route)}">View all →</span>` : ''}
    </div>
    <div class="row-scroll">${items.map(cardHTML).join('')}</div>
  </div>`;
}

function continueRowHTML(items) {
  if (!items?.length) return '';
  return `<div class="row" id="cwRow">
    <div class="row-head">
      <h2>Continue Watching</h2>
      <span class="more cw-clear" data-clear-history>Clear all</span>
    </div>
    <div class="row-scroll">${items.map(continueCardHTML).join('')}</div>
  </div>`;
}

function myListRowHTML(items) {
  if (!items?.length) return '';
  return `<div class="row" id="myListRow">
    <div class="row-head"><h2>My List</h2></div>
    <div class="row-scroll">${items.map(cardHTML).join('')}</div>
  </div>`;
}

/* ---------- Hero ---------- */
function setHero(idx) {
  state.heroIdx = idx;
  const item = state.heroItems[idx];
  if (!item) return;

  indexItems([item]);

  $('#heroBg').style.cssText =
    (item.backdrop ? `background-image:url('${item.backdrop}')` : posterStyle(item)) +
    ';background-size:cover;background-position:center top;';

  $('#heroContent').innerHTML = `
    <span class="hero-badge">${item.type === 'series' ? 'Featured Series' : 'Featured Movie'}</span>
    <h1 class="hero-title">${esc(item.title)}</h1>
    <div class="hero-meta">
      ${item.rating ? `<span class="rating">★ ${item.rating}</span>` : ''}
      ${item.year ? `<span>${item.year}</span>` : ''}
      <span class="genres">${esc((item.genres || []).slice(0, 3).join(', '))}</span>
    </div>
    <p class="hero-overview">${esc((item.overview || '').slice(0, 210))}${(item.overview || '').length > 210 ? '…' : ''}</p>
    <div class="hero-actions">
      <button class="btn btn-play" data-play="${esc(item.id)}">▶ Play</button>
      <button class="btn btn-info" data-detail="${esc(item.id)}">ⓘ More Info</button>
    </div>
  `;

  $$('#heroDots span').forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
  });
}

function restartHeroTimer() {
  clearInterval(state.heroTimer);
  if (!state.heroItems.length) return;
  state.heroTimer = setInterval(() => {
    setHero((state.heroIdx + 1) % state.heroItems.length);
  }, 6500);
}

function initHero(trendData) {
  state.heroItems = (trendData || [])
    .filter(x => x.backdrop && x.overview)
    .slice(0, 6);

  $('#heroDots').innerHTML = state.heroItems.map((_, i) => `<span data-i="${i}"></span>`).join('');

  $$('#heroDots span').forEach(dot => {
    dot.onclick = () => {
      setHero(+dot.dataset.i);
      restartHeroTimer();
    };
  });

  if (state.heroItems.length) setHero(0);
  restartHeroTimer();
}

/* ---------- Trending ---------- */
const PERIOD = {
  '24h': { movie: () => api.trendingMoviesDay(), series: () => api.trendingTVDay() },
  '7d': { movie: () => api.trendingMovies(), series: () => api.trendingTV() },
  '30d': { movie: () => api.popularMovies(), series: () => api.popularTV() }
};

function trendListHTML(items) {
  return (items || []).slice(0, 8).map((item, i) => {
    indexItems([item]);
    return `<li class="trend-item" data-id="${esc(item.id)}">
      <span class="trend-rank">${String(i + 1).padStart(2, '0')}</span>
      <div class="trend-thumb" style="${posterStyle(item)}"></div>
      <div class="trend-info">
        <div class="t">${esc(item.title)}</div>
        <div class="v">★ ${item.rating}</div>
      </div>
    </li>`;
  }).join('');
}

async function buildTrending() {
  const [movies, series] = await Promise.allSettled([
    PERIOD['24h'].movie(),
    PERIOD['24h'].series()
  ]);

  const m = movies.status === 'fulfilled' ? movies.value : [];
  const s = series.status === 'fulfilled' ? series.value : [];

  return `<div class="trending">
    <h2>Trending on OnlyFlix</h2>
    <p class="sub">Popularity based on OnlyFlix views during the selected period.</p>
    <div class="trend-cols">
      <div class="trend-col" data-type="movie">
        <h3>Top Movies</h3>
        <div class="period-tabs">
          <button data-p="24h" class="active">24h</button>
          <button data-p="7d">7d</button>
          <button data-p="30d">30d</button>
        </div>
        <ul class="trend-list">${trendListHTML(m)}</ul>
      </div>
      <div class="trend-col" data-type="series">
        <h3>Top TV Shows</h3>
        <div class="period-tabs">
          <button data-p="24h" class="active">24h</button>
          <button data-p="7d">7d</button>
          <button data-p="30d">30d</button>
        </div>
        <ul class="trend-list">${trendListHTML(s)}</ul>
      </div>
    </div>
  </div>`;
}

function bindTrending() {
  $$('.trend-col').forEach(col => {
    const type = col.dataset.type;
    $$('.period-tabs button', col).forEach(btn => {
      btn.onclick = async () => {
        $$('.period-tabs button', col).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const list = $('.trend-list', col);
        list.innerHTML = '<li class="trend-skel">Loading…</li>';

        try {
          const items = await PERIOD[btn.dataset.p][type]();
          list.innerHTML = trendListHTML(indexItems(items));
        } catch {
          list.innerHTML = '<li class="empty">Failed to load.</li>';
        }
      };
    });
  });
}

/* ---------- Home ---------- */
async function renderHome() {
  $('#hero').style.display = 'flex';
  $('#infoBlocks').classList.add('show');
  $('#view').innerHTML = '<div class="boot">Loading…</div>';

  try {
    const [trend, nowPlaying, topMovies, popularTV, topTV] = await Promise.all([
      api.trendingAll(),
      api.nowPlaying(),
      api.topMovies(),
      api.popularTV(),
      api.topTV()
    ]);

    [trend, nowPlaying, topMovies, popularTV, topTV].forEach(indexItems);
    initHero(trend);

    loadHistory();
    loadList();
    [...state.history, ...state.list].forEach(h => state.index[h.id] = h);

    let html = '';
    if (state.history.length) html += continueRowHTML(state.history);
    if (state.list.length) html += myListRowHTML(state.list);
    html += rowHTML('Trending Now', trend, 'movie');
    html += rowHTML('Now Playing', nowPlaying, 'movie');
    html += rowHTML('Top Rated Movies', topMovies, 'movie');
    html += rowHTML('Popular TV Shows', popularTV, 'series');
    html += rowHTML('Top Rated TV Shows', topTV, 'series');

    try {
      html += await buildTrending();
    } catch (err) {
      console.error('[renderHome] trending failed:', err);
    }

    $('#view').innerHTML = html;
    bindTrending();
    restartHeroTimer();
  } catch (err) {
    console.error('[renderHome] fatal:', err);
    throw err;
  }
}

/* ---------- Grid ---------- */
async function renderGrid(type) {
  $('#hero').style.display = 'none';
  $('#infoBlocks').classList.remove('show');

  state.grid = {
    type,
    genre: 'all',
    year: 'all',
    sort: 'popularity.desc',
    page: 1,
    items: [],
    totalPages: 1,
    loading: false
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);
  const azSort = type === 'movie' ? 'original_title.asc' : 'original_name.asc';
  const newestSort = type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';

  const allGenres = getGenres();

  $('#view').innerHTML = `
    <div class="page-head"><h1>${type === 'movie' ? 'Movies' : 'TV Shows'}</h1></div>
    <div class="filters">
      <select id="fGenre">
        <option value="all">All Genres</option>
        ${allGenres.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}
      </select>
      <select id="fYear">
        <option value="all">All Years</option>
        ${years.map(y => `<option>${y}</option>`).join('')}
      </select>
      <select id="fSort">
        <option value="popularity.desc">Popular</option>
        <option value="vote_average.desc">Top Rated</option>
        <option value="${newestSort}">Newest</option>
        <option value="${azSort}">A–Z</option>
      </select>
    </div>
    <div class="grid" id="grid"><div class="boot">Loading…</div></div>
    <button class="load-more" id="loadMore" style="display:none">Load More</button>
  `;

  $('#fGenre').onchange = () => { state.grid.genre = $('#fGenre').value; resetGrid(); };
  $('#fYear').onchange = () => { state.grid.year = $('#fYear').value; resetGrid(); };
  $('#fSort').onchange = () => { state.grid.sort = $('#fSort').value; resetGrid(); };
  $('#loadMore').onclick = () => loadGridPage();

  resetGrid();
}

function resetGrid() {
  state.grid.page = 1;
  state.grid.items = [];
  state.grid.loading = false;
  $('#grid').innerHTML = '<div class="boot">Loading…</div>';
  loadGridPage(true);
}

async function loadGridPage(fresh = false) {
  if (state.grid.loading) return;
  state.grid.loading = true;

  try {
    const { type, genre, year, sort, page } = state.grid;
    const { items, totalPages } = await api.discover(type, { genre, year, sort, page });

    indexItems(items);
    state.grid.items = fresh ? items : state.grid.items.concat(items);
    state.grid.totalPages = totalPages;
    state.grid.page = page + 1;

    const grid = $('#grid');
    grid.innerHTML = state.grid.items.length
      ? state.grid.items.map(cardHTML).join('')
      : '<div class="empty">No titles match your filters.</div>';

    $('#loadMore').style.display =
      (state.grid.page <= totalPages && state.grid.items.length) ? 'block' : 'none';
  } catch (err) {
    $('#grid').innerHTML = `<div class="empty">Failed to load: ${esc(err.message)}</div>`;
  } finally {
    state.grid.loading = false;
  }
}

/* ---------- Genres ---------- */
async function renderGenres() {
  $('#hero').style.display = 'none';
  $('#infoBlocks').classList.remove('show');
  $('#view').innerHTML = `<div class="page-head"><h1>Browse by Genre</h1></div><div id="gwrap"><div class="boot">Loading…</div></div>`;

  const allGenres = getGenres();
  const rows = await Promise.all(allGenres.slice(0, 10).map(async (g) => {
    try {
      const items = await api.byGenreRow('movie', g.id);
      indexItems(items);
      return rowHTML(g.name, items);
    } catch {
      return '';
    }
  }));

  $('#gwrap').innerHTML = rows.join('') || '<div class="empty">No genres.</div>';
}

/* ---------- Years ---------- */
async function renderYears() {
  $('#hero').style.display = 'none';
  $('#infoBlocks').classList.remove('show');

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  $('#view').innerHTML = `<div class="page-head"><h1>Browse by Year</h1></div><div id="ywrap"><div class="boot">Loading…</div></div>`;

  const rows = await Promise.all(years.map(async (y) => {
    try {
      const { items } = await api.discover('movie', { year: y, sort: 'popularity.desc', page: 1 });
      indexItems(items);
      return rowHTML(`${y}`, items.slice(0, 16));
    } catch {
      return '';
    }
  }));

  $('#ywrap').innerHTML = rows.join('');
}

/* ---------- Search ---------- */
async function renderSearch(q) {
  $('#hero').style.display = 'none';
  $('#infoBlocks').classList.remove('show');

  const safeQ = esc(q);
  $('#view').innerHTML = `<div class="page-head"><h1>Search: "${safeQ}"</h1></div><div class="grid" id="sgrid"><div class="boot">Searching…</div></div>`;

  try {
    const items = await api.search(q);
    indexItems(items);
    $('#sgrid').innerHTML = items.length
      ? items.map(cardHTML).join('')
      : `<div class="empty">No results for "${safeQ}".</div>`;
  } catch (err) {
    $('#sgrid').innerHTML = `<div class="empty">Search failed: ${esc(err.message)}</div>`;
  }
}

/* ---------- Router ---------- */
function route(name) {
  clearInterval(state.heroTimer);
  $$('.main-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === name));
  window.scrollTo({ top: 0 });

  const routes = {
    home: renderHome,
    movie: () => renderGrid('movie'),
    series: () => renderGrid('series'),
    genres: renderGenres,
    years: renderYears
  };

  if (routes[name]) routes[name]();
}

/* ---------- Detail ---------- */
async function openDetail(id) {
  const stub = byId(id);
  if (!stub) return;

  clearInterval(state.heroTimer);
  $('#detailCard').innerHTML = `<button class="detail-close" data-close>&times;</button><div class="boot" style="padding:80px">Loading…</div>`;
  $('#detailModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  let item;
  try {
    item = await api.details(stub.type, stub.tmdbId);
  } catch {
    item = stub;
  }
  indexItems([item]);

  const startSeason = defaultSeason(item.tmdbId);
  let episodesHTML = '';

  if (item.type === 'series' && item.seasons?.length) {
    const seasonOpts = item.seasons.map(s =>
      `<option value="${s.season_number}"${s.season_number === startSeason ? ' selected' : ''}>Season ${s.season_number}</option>`
    ).join('');

    episodesHTML = `<div class="eps">
      <div class="eps-head">
        <h4>Episodes</h4>
        <select id="seasonSel" data-tmdb="${esc(item.tmdbId)}">${seasonOpts}</select>
      </div>
      <div class="ep-list" id="epList"><div class="boot">Loading episodes…</div></div>
    </div>`;
  }

  const playLabel = item.type === 'series' ? ` S${startSeason}·E1` : '';

  $('#detailCard').innerHTML = `
    <button class="detail-close" data-close>&times;</button>
    <div class="detail-hero" style="${item.backdrop ? `background-image:url('${item.backdrop}')` : posterStyle(item)};background-size:cover;background-position:center">
      <div class="dfade"></div>
    </div>
    <div class="detail-body">
      <h2>${esc(item.title)}</h2>
      ${item.tagline ? `<p class="tagline">${esc(item.tagline)}</p>` : ''}
      <div class="detail-meta">
        ${item.rating ? `<span class="rating">★ ${item.rating}</span>` : ''}
        ${item.year ? `<span>${item.year}</span>` : ''}
        ${item.runtime ? `<span>${item.runtime} min</span>` : (item.latest ? `<span>${esc(item.latest)}</span>` : '')}
        <span class="tag">${item.type === 'series' ? 'TV Series' : 'Movie'}</span>
        ${(item.genres || []).map(g => `<span class="tag">${esc(g)}</span>`).join('')}
      </div>
      <p class="ov">${esc(item.overview || '')}</p>
      ${item.cast?.length ? `<p class="cast"><strong>Cast:</strong> ${esc(item.cast.join(', '))}</p>` : ''}
      <div class="detail-actions">
        <button class="btn btn-play" data-play="${esc(item.id)}" data-s="${startSeason}" data-e="1">▶ Play${playLabel}</button>
        ${item.trailerKey ? `<button class="btn btn-trailer" data-trailer="${esc(item.trailerKey)}">▶ Trailer</button>` : ''}
        <button class="btn btn-list${inList(item.id) ? ' active' : ''}" data-bookmark="${esc(item.id)}">${inList(item.id) ? '✓ In My List' : '+ My List'}</button>
        <button class="btn btn-info" data-close>Close</button>
      </div>
      ${episodesHTML}
      <div id="moreLikeThis" class="mlt"></div>
    </div>
  `;

  if (item.type === 'series' && item.seasons?.length) {
    const sel = $('#seasonSel');
    const loadEpisodes = async () => {
      $('#epList').innerHTML = '<div class="boot">Loading episodes…</div>';
      try {
        const list = await api.season(item.tmdbId, sel.value);
        $('#epList').innerHTML = list.map(ep => `
          <div class="ep" data-play="${esc(item.id)}" data-s="${sel.value}" data-e="${ep.episode_number}">
            <span class="epn">S${sel.value}·E${ep.episode_number}</span>
            <span class="ept">${esc(ep.name || 'Episode ' + ep.episode_number)}</span>
            ${ep.vote_average ? `<span class="epr">★ ${ep.vote_average.toFixed(1)}</span>` : ''}
            <span class="epp">▶</span>
          </div>
        `).join('') || '<div class="empty">No episodes.</div>';
      } catch {
        $('#epList').innerHTML = '<div class="empty">Failed to load episodes.</div>';
      }
    };
    sel.onchange = loadEpisodes;
    loadEpisodes();
  }

  const recs = await api.recommendations(item.type, item.tmdbId);
  if (recs?.length) {
    indexItems(recs);
    const box = $('#moreLikeThis');
    if (box) {
      box.innerHTML = `<h4 class="mlt-head">More Like This</h4><div class="row-scroll">${recs.map(cardHTML).join('')}</div>`;
    }
  }
}

function closeDetail() {
  $('#detailModal').classList.remove('open');
  if (!$('#playerModal').classList.contains('open')) document.body.style.overflow = '';
  if ($('#hero').style.display !== 'none') restartHeroTimer();
}

/* ---------- Trailer ---------- */
function openTrailer(key) {
  let overlay = $('#trailerModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'trailerModal';
    overlay.className = 'trailer-modal';
    overlay.innerHTML = `
      <div class="trailer-box">
        <button class="trailer-close" data-close-trailer>×</button>
        <div class="trailer-frame">
          <iframe id="trailerIframe" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeTrailer();
    });
    document.body.appendChild(overlay);
  }

  $('#trailerIframe').src = `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTrailer() {
  const overlay = $('#trailerModal');
  if (!overlay) return;
  const iframe = $('#trailerIframe');
  if (iframe) iframe.src = '';
  overlay.classList.remove('open');
  if (!$('#detailModal').classList.contains('open') && !$('#playerModal').classList.contains('open')) {
    document.body.style.overflow = '';
  }
}

/* ---------- Player ---------- */
const PROBE_TIMEOUT = 4500;
const PROBE_CACHE_TTL = 10 * 60 * 1000;
const probeCache = {};

function probeSource(src, signal) {
  if (src.type === 'embed') return Promise.resolve(true);

  const cached = probeCache[src.url];
  if (cached && Date.now() - cached.ts < PROBE_CACHE_TTL) {
    return Promise.resolve(cached.ok);
  }

  return new Promise(resolve => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
    if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true });

    fetch(src.url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal })
      .then(() => {
        clearTimeout(timer);
        probeCache[src.url] = { ok: true, ts: Date.now() };
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        if (!signal?.aborted) {
          probeCache[src.url] = { ok: false, ts: Date.now() };
        }
        resolve(false);
      });
  });
}

function renderServerBar(sources, activeIdx) {
  const bar = $('#serverBar');
  if (!bar) return;

  bar.innerHTML = sources.map((s, i) => {
    const cached = probeCache[s.url];
    const checked = cached && Date.now() - cached.ts < PROBE_CACHE_TTL;
    const reachable = !checked || cached.ok || s.type === 'embed';

    const dot = s.type === 'embed' ? '' :
      checked ? (cached.ok ? '<span class="srv-dot srv-ok"></span>' : '<span class="srv-dot srv-bad"></span>') :
      '<span class="srv-dot srv-pending"></span>';

    return `<button class="srv-btn${i === activeIdx ? ' active' : ''}${!reachable ? ' srv-unreachable' : ''}" data-srv="${i}" title="${esc(s.url)}">
      ${dot}<span class="srv-name">${esc(s.label || s.url)}</span><span class="srv-tag">${s.type}</span>
    </button>`;
  }).join('');

  $$('.srv-btn', bar).forEach(btn => {
    btn.onclick = () => {
      if (!state.player) return;
      const idx = +btn.dataset.srv;
      state.player.userChoseSource = true;
      const sel = $('#sourceSel');
      if (sel) sel.value = String(idx);
      setActiveServer(idx);
      loadSource(state.player.sources[idx]);
    };
  });
}

function setActiveServer(idx) {
  $$('.srv-btn', $('#serverBar')).forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });
}

function updateServerDot(idx, ok) {
  const btn = $('#serverBar')?.querySelector(`[data-srv="${idx}"]`);
  if (!btn) return;
  const dot = btn.querySelector('.srv-dot');
  if (!dot) return;
  dot.className = ok ? 'srv-dot srv-ok' : 'srv-dot srv-bad';
  btn.classList.toggle('srv-unreachable', !ok);
}

function destroyHls() {
  if (state.hls) {
    try { state.hls.destroy(); } catch {}
    state.hls = null;
  }
}

function loadSource(src) {
  const video = $('#videoEl');
  const embed = $('#embedEl');
  const controls = $('#videoControls');
  const note = $('#playerNote');

  destroyHls();

  if (src.type === 'embed') {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.style.display = 'none';
    controls.style.display = 'none';
    embed.style.display = 'block';
    embed.src = src.url;
    note.innerHTML = `Playing via <strong>${esc(src.label)}</strong>. If it doesn't load, <a href="${src.url}" target="_blank" rel="noopener">open in new tab ↗</a>`;
    return;
  }

  embed.style.display = 'none';
  embed.removeAttribute('src');
  video.style.display = 'block';
  controls.style.display = '';
  note.textContent = src.type === 'hls' ? 'Adaptive HLS stream.' : 'Direct MP4 source.';

  video.playbackRate = parseFloat($('#speedSel').value) || 1;

  video.onloadedmetadata = () => {
    const saved = state.progress[state.player.trackId];
    if (saved && saved > 5 && saved < video.duration - 30) {
      video.currentTime = saved;
      note.innerHTML += ` <span style="color:var(--gold);font-weight:bold;">↻ Resumed from ${formatTime(saved)}</span>`;
    }
  };

  if (src.type === 'hls') {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src.url;
    } else if (window.Hls && Hls.isSupported()) {
      state.hls = new Hls({ enableWorker: true });
      state.hls.loadSource(src.url);
      state.hls.attachMedia(video);
      state.hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) note.textContent = 'HLS error — try another server.';
      });
    } else {
      video.src = src.url;
    }
  } else {
    video.src = src.url;
  }

  video.play().catch(() => {});
}

function openPlayer(id, season, episode) {
  const item = byId(id);
  if (!item) return;

  pushHistory(item);
  clearInterval(state.heroTimer);

  if (state.player?.probeAbort) state.player.probeAbort.abort();

  const trackId = (season && episode) ? `${id}-S${season}E${episode}` : id;
  state.player = {
    item,
    season: season ? +season : null,
    episode: episode ? +episode : null,
    trackId,
    userChoseSource: false,
    probeAbort: new AbortController(),
    sources: []
  };

  const epTxt = (season && episode) ? ` · S${season}·E${episode}` :
    (item.type === 'series' ? ` · S${defaultSeason(item.tmdbId)}·E1` : '');

  $('#playerTitle').textContent = item.title + epTxt;

  const sources = resolveSources(item, state.player.season, state.player.episode);
  state.player.sources = sources;

  const sel = $('#sourceSel');
  if (sel) {
    sel.innerHTML = sources.map((s, i) => `<option value="${i}">${esc(s.label || s.url)}</option>`).join('');
    sel.onchange = () => {
      state.player.userChoseSource = true;
      const idx = +sel.value;
      setActiveServer(idx);
      loadSource(sources[idx]);
    };
  }

  $('#playerModal').classList.add('open');
  document.body.style.overflow = 'hidden';

  const bar = $('#serverBar');
  if (bar && !bar.querySelector('.srv-bar-label')) {
    bar.insertAdjacentHTML('afterbegin', '<span class="srv-bar-label">Servers</span>');
  }

  const isPlayable = (s) => s.type === 'embed' || !probeCache[s.url] || probeCache[s.url].ok;
  let defaultIdx = sources.findIndex(isPlayable);
  if (defaultIdx === -1) defaultIdx = 0;

  renderServerBar(sources, defaultIdx);
  if (sel) sel.value = String(defaultIdx);
  loadSource(sources[defaultIdx]);

  sources.forEach((src, i) => {
    if (src.type === 'embed') return;
    probeSource(src, state.player.probeAbort.signal).then(ok => {
      if (!state.player || state.player.sources !== sources) return;
      updateServerDot(i, ok);

      const activeBtn = $('#serverBar')?.querySelector('.srv-btn.active');
      const activeIdx = activeBtn ? +activeBtn.dataset.srv : defaultIdx;

      if (!ok && activeIdx === i && !state.player.userChoseSource) {
        const nextBtn = $$('#serverBar .srv-btn').find(
          b => !b.classList.contains('srv-unreachable') && +b.dataset.srv !== i
        );
        if (nextBtn) {
          const nextIdx = +nextBtn.dataset.srv;
          if (sel) sel.value = String(nextIdx);
          setActiveServer(nextIdx);
          loadSource(sources[nextIdx]);
        } else {
          $('#playerNote').innerHTML = `⚠️ No reachable servers for <strong>${esc(item.title)}</strong>.`;
        }
      }
    });
  });
}

function closePlayer() {
  const video = $('#videoEl');
  const embed = $('#embedEl');

  if (state.player?.probeAbort) state.player.probeAbort.abort();

  if (state.player?.trackId && !isNaN(video.currentTime) && video.currentTime > 5) {
    saveProgress(state.player.trackId, video.currentTime);
  }

  destroyHls();
  video.pause();
  video.removeAttribute('src');
  video.load();
  embed.removeAttribute('src');

  $('#playerModal').classList.remove('open');
  if (!$('#detailModal').classList.contains('open')) document.body.style.overflow = '';
  if ($('#hero').style.display !== 'none' && !$('#detailModal').classList.contains('open')) {
    restartHeroTimer();
  }
}

function bindPlayer() {
  const video = $('#videoEl');

  $('#btnPlay').onclick = () => {
    if (video.paused) {
      video.play();
      $('#btnPlay').textContent = '❚❚';
    } else {
      video.pause();
      $('#btnPlay').textContent = '▶';
    }
  };

  $('#btnBack').onclick = () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
  };

  $('#btnFwd').onclick = () => {
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
  };

  $('#btnMute').onclick = () => {
    video.muted = !video.muted;
    $('#btnMute').textContent = video.muted ? '🔇' : '🔊';
  };

  $('#volSlider').oninput = (e) => {
    video.volume = +e.target.value;
    video.muted = false;
    $('#btnMute').textContent = video.volume === 0 ? '🔇' : '🔊';
  };

  $('#speedSel').onchange = (e) => {
    video.playbackRate = parseFloat(e.target.value);
  };

  $('#btnFull').onclick = () => {
    const wrap = $('#videoWrap');
    if (!document.fullscreenElement) {
      wrap.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  let lastSave = 0;

  video.ontimeupdate = () => {
    const pct = (video.currentTime / (video.duration || 1)) * 100;
    $('#progressFilled').style.width = pct + '%';
    $('#timeLabel').textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

    if (state.player?.trackId && video.currentTime > 5) {
      const now = Date.now();
      if (now - lastSave > 5000) {
        saveProgress(state.player.trackId, video.currentTime);
        lastSave = now;
      }
    }
  };

  video.onpause = () => {
    if (state.player?.trackId && video.currentTime > 5) {
      saveProgress(state.player.trackId, video.currentTime);
    }
  };

  video.onended = () => {
    $('#btnPlay').textContent = '▶';
    if (state.player?.trackId) clearProgress(state.player.trackId);
  };

  $('#progress').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    video.currentTime = ((e.clientX - rect.left) / rect.width) * (video.duration || 0);
  };
}

/* ---------- Event delegation ---------- */
document.addEventListener('click', (e) => {
  const remove = e.target.closest('[data-remove]');
  if (remove) {
    e.preventDefault();
    removeHistory(remove.dataset.remove);
    remove.closest('.card')?.remove();
    if (!state.history.length) $('#cwRow')?.remove();
    return;
  }

  const bookmark = e.target.closest('[data-bookmark]');
  if (bookmark) {
    e.preventDefault();
    const item = byId(bookmark.dataset.bookmark);
    const nowIn = toggleList(item);
    bookmark.classList.toggle('active', nowIn);
    bookmark.textContent = bookmark.classList.contains('btn-list') ?
      (nowIn ? '✓ In My List' : '+ My List') :
      (nowIn ? '✓' : '+');
    bookmark.title = nowIn ? 'Remove from My List' : 'Add to My List';

    if (!nowIn) {
      const row = bookmark.closest('#myListRow');
      if (row) {
        bookmark.closest('.card')?.remove();
        if (!state.list.length) row.remove();
      }
    }
    return;
  }

  if (e.target.closest('[data-clear-history]')) {
    e.preventDefault();
    store.set(KEYS.history, []);
    state.history = [];
    $('#cwRow')?.remove();
    return;
  }

  if (e.target.closest('[data-trailer]')) {
    e.preventDefault();
    openTrailer(e.target.closest('[data-trailer]').dataset.trailer);
    return;
  }

  if (e.target.closest('[data-close-trailer]')) {
    closeTrailer();
    return;
  }

  if (e.target.closest('[data-route]')) {
    e.preventDefault();
    route(e.target.closest('[data-route]').dataset.route);
    return;
  }

  if (e.target.closest('[data-play]')) {
    const btn = e.target.closest('[data-play]');
    e.preventDefault();
    openPlayer(btn.dataset.play, btn.dataset.s, btn.dataset.e);
    return;
  }

  if (e.target.closest('[data-detail]')) {
    e.preventDefault();
    openDetail(e.target.closest('[data-detail]').dataset.detail);
    return;
  }

  if (e.target.closest('[data-close]')) {
    closeDetail();
    return;
  }

  if (e.target.closest('[data-close-player]')) {
    closePlayer();
    return;
  }

  const card = e.target.closest('.card[data-id]');
  if (card) {
    openDetail(card.dataset.id);
    return;
  }

  const trend = e.target.closest('.trend-item[data-id]');
  if (trend) {
    openDetail(trend.dataset.id);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTrailer();
    closePlayer();
    closeDetail();
    return;
  }

  if (!$('#playerModal').classList.contains('open')) return;

  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'select', 'textarea'].includes(tag)) return;

  const video = $('#videoEl');

  switch (e.key) {
    case ' ':
    case 'k':
      e.preventDefault();
      if (video.paused) {
        video.play();
        $('#btnPlay').textContent = '❚❚';
      } else {
        video.pause();
        $('#btnPlay').textContent = '▶';
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      video.currentTime = Math.max(0, video.currentTime - 10);
      break;
    case 'ArrowRight':
      e.preventDefault();
      video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
      break;
    case 'f':
    case 'F':
      e.preventDefault();
      const wrap = $('#videoWrap');
      if (!document.fullscreenElement) {
        wrap.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
      break;
    case 'm':
    case 'M':
      e.preventDefault();
      video.muted = !video.muted;
      $('#btnMute').textContent = video.muted ? '🔇' : '🔊';
      break;
  }
});

/* ---------- Search ---------- */
$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(state.searchTimer);
  const query = e.target.value.trim();
  state.searchTimer = setTimeout(() => {
    if (query.length >= 2) {
      renderSearch(query);
    } else if (!query.length) {
      route('home');
    }
  }, 300);
});

/* ---------- Header scroll ---------- */
window.addEventListener('scroll', () => {
  $('#header').classList.toggle('scrolled', window.scrollY > 30);
});

/* ---------- Init ---------- */
async function init() {
  $('#year').textContent = new Date().getFullYear();
  bindPlayer();
  loadProgress();

  try {
    await loadGenres();
    await renderHome();
  } catch (err) {
    console.error('[init] fatal:', err);
    $('#view').innerHTML = `
      <div class="empty" style="padding:80px 28px;max-width:800px;margin:0 auto;text-align:left;">
        <h2 style="color:var(--accent);margin-bottom:20px;">⚠️ Failed to load</h2>
        <p style="color:var(--text);margin-bottom:10px;"><strong>Error:</strong> ${esc(err.message || 'Unknown error')}</p>
        <p style="color:var(--muted);font-size:14px;margin-top:20px;border-top:1px solid var(--line);padding-top:20px;">
          Check console. Make sure:<br>
          • TMDB API key is valid in config.js<br>
          • Internet connection is working<br>
          • CORS isn't blocking requests
        </p>
        <button onclick="location.reload()" style="margin-top:20px;background:var(--accent);color:#fff;border:none;padding:12px 30px;border-radius:8px;cursor:pointer;font-weight:700;">Retry</button>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', init);
