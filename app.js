/* ============================================================
   app.js — CINEMAX Premium UI + Player
   ============================================================ */

import { loadGenres, getGenres, api } from './api.js';
import { resolveSources } from './config.js';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ---------- Storage ---------- */
const store = {
  get(key, fallback = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  },
  set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (err) { console.error(`[store] write failed:`, err); }
  }
};

const KEYS = {
  history: 'cinemax_history',
  list: 'cinemax_list',
  progress: 'cinemax_progress'
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
  return item.poster ? `background-image:url('${item.poster}')` : 'background:linear-gradient(135deg,#0a0a12,#1a1a2e)';
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

function byId(id) { return state.index[id]; }
function defaultSeason(tmdbId) {
  return (typeof SEASON_DEFAULTS !== 'undefined' && SEASON_DEFAULTS[tmdbId]) ? SEASON_DEFAULTS[tmdbId] : 1;
}

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

/* ---------- Card Rendering (Premium) ---------- */
function cardHTML(item) {
  indexItems([item]);
  const saved = inList(item.id);
  const genre = item.genres?.[0] || '';
  const year = item.year || '';

  return `<div class="card-wrapper" data-id="${esc(item.id)}">
    <div class="card-poster" style="${posterStyle(item)}">
      <img src="${item.poster || ''}" alt="${esc(item.title)}" loading="lazy" onerror="this.style.display='none'">
      <div class="poster-overlay"></div>
      
      <span class="badge-4k">4K</span>
      <span class="badge-hdr">HDR</span>
      <span class="badge-rating">★ ${item.rating || '—'}</span>
      
      <div class="quick-actions">
        <button class="quick-action-btn play" data-play="${esc(item.id)}" aria-label="Play">▶</button>
        <button class="quick-action-btn" data-bookmark="${esc(item.id)}" aria-label="${saved ? 'Remove' : 'Add'}">${saved ? '✓' : '+'}</button>
        <button class="quick-action-btn" data-detail="${esc(item.id)}" aria-label="Details">ⓘ</button>
      </div>
      
      <div class="card-details">
        <div class="title">${esc(item.title)}</div>
        <div class="meta">
          <span>${year || '—'}</span>
          ${genre ? `<span class="genre-tag">${esc(genre)}</span>` : ''}
          <span>•</span>
          <span>${item.rating ? `★ ${item.rating}` : '—'}</span>
        </div>
      </div>
    </div>
  </div>`;
}

function continueCardHTML(item) {
  const base = cardHTML(item);
  return base.replace(
    '<div class="quick-actions">',
    `<div class="quick-actions">
      <button class="quick-action-btn" data-remove="${esc(item.id)}" aria-label="Remove from history" style="background:rgba(255,0,0,0.15);color:#ff4444;">×</button>`
  );
}

function rowHTML(title, items, routeLink) {
  if (!items?.length) return '';
  const rowId = `row-${title.replace(/\s/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
  return `<div class="row-container">
    <div class="flex items-baseline justify-between px-1 mb-3">
      <div>
        <h2 class="section-title">${esc(title)}</h2>
        <p class="section-subtitle">${items.length} titles</p>
      </div>
      ${routeLink ? `<span class="text-white/30 text-sm hover:text-white/60 cursor-pointer transition-colors" data-route="${esc(routeLink)}">View all →</span>` : ''}
    </div>
    <div class="row-scroll" id="${rowId}">
      ${items.map(cardHTML).join('')}
    </div>
    <button class="row-nav row-nav-left" data-scroll-left="${rowId}">
      <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <button class="row-nav row-nav-right" data-scroll-right="${rowId}">
      <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
    </button>
  </div>`;
}

function continueRowHTML(items) {
  if (!items?.length) return '';
  return `<div class="row-container" id="cwRow">
    <div class="flex items-baseline justify-between px-1 mb-3">
      <div>
        <h2 class="section-title">Continue Watching</h2>
        <p class="section-subtitle">${items.length} titles</p>
      </div>
      <span class="text-white/30 text-sm hover:text-white/60 cursor-pointer transition-colors" data-clear-history>Clear all</span>
    </div>
    <div class="row-scroll">
      ${items.map(continueCardHTML).join('')}
    </div>
  </div>`;
}

function watchlistRowHTML(items) {
  if (!items?.length) return '';
  return `<div class="row-container" id="watchlistRow">
    <div class="flex items-baseline justify-between px-1 mb-3">
      <div>
        <h2 class="section-title">My Watchlist</h2>
        <p class="section-subtitle">${items.length} titles</p>
      </div>
    </div>
    <div class="row-scroll">
      ${items.map(cardHTML).join('')}
    </div>
  </div>`;
}

/* ---------- Row Navigation ---------- */
function bindRowNav() {
  $$('[data-scroll-left]').forEach(btn => {
    btn.onclick = () => {
      const target = document.getElementById(btn.dataset.scrollLeft);
      if (target) target.scrollBy({ left: -300, behavior: 'smooth' });
    };
  });
  $$('[data-scroll-right]').forEach(btn => {
    btn.onclick = () => {
      const target = document.getElementById(btn.dataset.scrollRight);
      if (target) target.scrollBy({ left: 300, behavior: 'smooth' });
    };
  });
}

/* ---------- Hero ---------- */
function setHero(idx) {
  state.heroIdx = idx;
  const item = state.heroItems[idx];
  if (!item) return;

  indexItems([item]);

  const bg = $('#heroBg');
  if (bg) {
    bg.style.cssText = `background-image:url('${item.backdrop || item.poster || ''}');background-size:cover;background-position:center top;`;
  }

  const content = $('#heroContent');
  if (content) {
    content.innerHTML = `
      <span class="hero-badge">${item.type === 'series' ? 'Featured Series' : 'Featured Movie'}</span>
      <h1 class="hero-title">${esc(item.title)}</h1>
      <div class="hero-meta">
        ${item.rating ? `<span class="rating">★ ${item.rating}</span>` : ''}
        ${item.year ? `<span>${item.year}</span>` : ''}
        <span>${esc((item.genres || []).slice(0, 3).join(' · '))}</span>
      </div>
      <p class="hero-overview">${esc((item.overview || '').slice(0, 210))}${(item.overview || '').length > 210 ? '…' : ''}</p>
      <div class="hero-actions">
        <button class="hero-btn hero-btn-primary" data-play="${esc(item.id)}">▶ Play</button>
        <button class="hero-btn hero-btn-secondary" data-detail="${esc(item.id)}">ⓘ Details</button>
      </div>
    `;
  }

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

  const dots = $('#heroDots');
  if (dots) {
    dots.innerHTML = state.heroItems.map((_, i) => `<span data-i="${i}"></span>`).join('');
    $$('#heroDots span').forEach(dot => {
      dot.onclick = () => {
        setHero(+dot.dataset.i);
        restartHeroTimer();
      };
    });
  }

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
    return `<div class="trend-item flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors" data-id="${esc(item.id)}">
      <span class="text-2xl font-black w-8 text-center ${i === 0 ? 'text-[#FFD700]' : i === 1 ? 'text-white/30' : i === 2 ? 'text-[#cd7f32]' : 'text-white/10'}">${String(i + 1).padStart(2, '0')}</span>
      <div class="w-12 h-16 rounded-lg bg-cover bg-center flex-shrink-0" style="${posterStyle(item)}"></div>
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-sm truncate">${esc(item.title)}</div>
        <div class="text-white/30 text-xs">★ ${item.rating || '—'}</div>
      </div>
    </div>`;
  }).join('');
}

async function buildTrending() {
  const [movies, series] = await Promise.allSettled([
    PERIOD['24h'].movie(),
    PERIOD['24h'].series()
  ]);

  const m = movies.status === 'fulfilled' ? movies.value : [];
  const s = series.status === 'fulfilled' ? series.value : [];

  return `<div class="max-w-[1560px] mx-auto px-6 md:px-8 py-8">
    <h2 class="section-title">Trending Now</h2>
    <p class="section-subtitle mb-6">Popularity based on CINEMAX views</p>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 class="font-bold text-white/60 text-sm uppercase tracking-wider mb-3">Top Movies</h3>
        <div class="glass rounded-xl p-2">
          ${trendListHTML(m)}
        </div>
      </div>
      <div>
        <h3 class="font-bold text-white/60 text-sm uppercase tracking-wider mb-3">Top TV Shows</h3>
        <div class="glass rounded-xl p-2">
          ${trendListHTML(s)}
        </div>
      </div>
    </div>
  </div>`;
}

/* ---------- Home ---------- */
async function renderHome() {
  const hero = $('#hero');
  if (hero) hero.style.display = 'flex';
  
  const info = $('#infoBlocks');
  if (info) info.style.display = 'block';

  const view = $('#view');
  if (view) view.innerHTML = '<div class="text-white/30 text-center py-20">Loading CINEMAX…</div>';

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
    if (state.list.length) html += watchlistRowHTML(state.list);
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

    if (view) view.innerHTML = html;
    bindRowNav();
    restartHeroTimer();
  } catch (err) {
    console.error('[renderHome] fatal:', err);
    if (view) {
      view.innerHTML = `
        <div class="max-w-2xl mx-auto text-center py-20 px-6">
          <h2 class="text-[#8B5CF6] font-bold text-2xl mb-4">⚠️ Failed to load</h2>
          <p class="text-white/40 mb-6">${esc(err.message || 'Unknown error')}</p>
          <button onclick="location.reload()" class="hero-btn hero-btn-primary">Retry</button>
        </div>
      `;
    }
  }
}

/* ---------- Grid ---------- */
async function renderGrid(type) {
  const hero = $('#hero');
  if (hero) hero.style.display = 'none';
  
  const info = $('#infoBlocks');
  if (info) info.style.display = 'none';

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

  const view = $('#view');
  if (view) {
    view.innerHTML = `
      <div class="max-w-[1560px] mx-auto px-6 md:px-8 pt-24 pb-4">
        <h1 class="text-4xl font-black tracking-tight">${type === 'movie' ? 'Movies' : 'TV Shows'}</h1>
      </div>
      <div class="max-w-[1560px] mx-auto px-6 md:px-8 pb-6 flex flex-wrap gap-3">
        <select id="fGenre" class="filter-pill">
          <option value="all">All Genres</option>
          ${allGenres.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}
        </select>
        <select id="fYear" class="filter-pill">
          <option value="all">All Years</option>
          ${years.map(y => `<option>${y}</option>`).join('')}
        </select>
        <select id="fSort" class="filter-pill">
          <option value="popularity.desc">Popular</option>
          <option value="vote_average.desc">Top Rated</option>
          <option value="${newestSort}">Newest</option>
          <option value="${azSort}">A–Z</option>
        </select>
      </div>
      <div class="max-w-[1560px] mx-auto px-6 md:px-8">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" id="grid">
          <div class="text-white/30 text-center py-20 col-span-full">Loading…</div>
        </div>
        <button class="load-more hidden" id="loadMore">Load More</button>
      </div>
    `;

    $('#fGenre').onchange = () => { state.grid.genre = $('#fGenre').value; resetGrid(); };
    $('#fYear').onchange = () => { state.grid.year = $('#fYear').value; resetGrid(); };
    $('#fSort').onchange = () => { state.grid.sort = $('#fSort').value; resetGrid(); };
    $('#loadMore').onclick = () => loadGridPage();

    resetGrid();
  }
}

function resetGrid() {
  state.grid.page = 1;
  state.grid.items = [];
  state.grid.loading = false;
  const grid = $('#grid');
  if (grid) grid.innerHTML = '<div class="text-white/30 text-center py-20 col-span-full">Loading…</div>';
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
    if (grid) {
      grid.innerHTML = state.grid.items.length
        ? state.grid.items.map(cardHTML).join('')
        : '<div class="text-white/30 text-center py-20 col-span-full">No titles match your filters.</div>';
    }

    const more = $('#loadMore');
    if (more) {
      more.style.display = (state.grid.page <= totalPages && state.grid.items.length) ? 'block' : 'none';
    }
  } catch (err) {
    const grid = $('#grid');
    if (grid) {
      grid.innerHTML = `<div class="text-white/30 text-center py-20 col-span-full">Failed to load: ${esc(err.message)}</div>`;
    }
  } finally {
    state.grid.loading = false;
  }
}

/* ---------- Genres ---------- */
async function renderGenres() {
  const hero = $('#hero');
  if (hero) hero.style.display = 'none';
  
  const info = $('#infoBlocks');
  if (info) info.style.display = 'none';

  const view = $('#view');
  if (view) {
    view.innerHTML = `<div class="max-w-[1560px] mx-auto px-6 md:px-8 pt-24 pb-4"><h1 class="text-4xl font-black tracking-tight">Browse by Genre</h1></div><div id="gwrap" class="max-w-[1560px] mx-auto px-6 md:px-8"><div class="text-white/30 text-center py-20">Loading…</div></div>`;
  }

  const allGenres = getGenres();
  const rows = await Promise.all(allGenres.slice(0, 10).map(async (g) => {
    try {
      const items = await api.byGenreRow('movie', g.id);
      indexItems(items);
      return rowHTML(g.name, items);
    } catch { return ''; }
  }));

  const wrap = $('#gwrap');
  if (wrap) {
    wrap.innerHTML = rows.join('') || '<div class="text-white/30 text-center py-20">No genres available.</div>';
    bindRowNav();
  }
}

/* ---------- Years ---------- */
async function renderYears() {
  const hero = $('#hero');
  if (hero) hero.style.display = 'none';
  
  const info = $('#infoBlocks');
  if (info) info.style.display = 'none';

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

  const view = $('#view');
  if (view) {
    view.innerHTML = `<div class="max-w-[1560px] mx-auto px-6 md:px-8 pt-24 pb-4"><h1 class="text-4xl font-black tracking-tight">Browse by Year</h1></div><div id="ywrap" class="max-w-[1560px] mx-auto px-6 md:px-8"><div class="text-white/30 text-center py-20">Loading…</div></div>`;
  }

  const rows = await Promise.all(years.map(async (y) => {
    try {
      const { items } = await api.discover('movie', { year: y, sort: 'popularity.desc', page: 1 });
      indexItems(items);
      return rowHTML(`${y}`, items.slice(0, 16));
    } catch { return ''; }
  }));

  const wrap = $('#ywrap');
  if (wrap) {
    wrap.innerHTML = rows.join('');
    bindRowNav();
  }
}

/* ---------- Search ---------- */
async function renderSearch(q) {
  const hero = $('#hero');
  if (hero) hero.style.display = 'none';
  
  const info = $('#infoBlocks');
  if (info) info.style.display = 'none';

  const safeQ = esc(q);
  const view = $('#view');
  if (view) {
    view.innerHTML = `
      <div class="max-w-[1560px] mx-auto px-6 md:px-8 pt-24 pb-4">
        <h1 class="text-4xl font-black tracking-tight">Search: "${safeQ}"</h1>
      </div>
      <div class="max-w-[1560px] mx-auto px-6 md:px-8">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" id="sgrid">
          <div class="text-white/30 text-center py-20 col-span-full">Searching…</div>
        </div>
      </div>
    `;
  }

  try {
    const items = await api.search(q);
    indexItems(items);
    const grid = $('#sgrid');
    if (grid) {
      grid.innerHTML = items.length
        ? items.map(cardHTML).join('')
        : `<div class="text-white/30 text-center py-20 col-span-full">No results for "${safeQ}".</div>`;
    }
  } catch (err) {
    const grid = $('#sgrid');
    if (grid) {
      grid.innerHTML = `<div class="text-white/30 text-center py-20 col-span-full">Search failed: ${esc(err.message)}</div>`;
    }
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
  const card = $('#detailCard');
  if (card) {
    card.innerHTML = `<div class="p-8 text-center"><div class="text-white/30">Loading…</div></div>`;
  }
  
  const modal = $('#detailModal');
  if (modal) modal.classList.remove('hidden');
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

    episodesHTML = `
      <div class="mt-6">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-bold">Episodes</h4>
          <select id="seasonSel" class="filter-pill text-sm" data-tmdb="${esc(item.tmdbId)}">${seasonOpts}</select>
        </div>
        <div class="space-y-2" id="epList"><div class="text-white/30 text-sm">Loading episodes…</div></div>
      </div>
    `;
  }

  const playLabel = item.type === 'series' ? ` S${startSeason}·E1` : '';

  if (card) {
    card.innerHTML = `
      <button class="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/50 hover:bg-[#8B5CF6] text-white text-2xl transition-colors flex items-center justify-center" data-close>×</button>
      <div class="h-64 md:h-80 bg-cover bg-center relative" style="${item.backdrop ? `background-image:url('${item.backdrop}')` : posterStyle(item)}">
        <div class="absolute inset-0 bg-gradient-to-t from-[#0a0a12] to-transparent"></div>
      </div>
      <div class="p-6 md:p-8 -mt-16 relative z-10">
        <h2 class="text-3xl font-black tracking-tight">${esc(item.title)}</h2>
        ${item.tagline ? `<p class="text-white/40 italic mt-1">${esc(item.tagline)}</p>` : ''}
        <div class="flex flex-wrap gap-3 items-center text-sm text-white/50 mt-3">
          ${item.rating ? `<span class="text-[#FFD700] font-bold">★ ${item.rating}</span>` : ''}
          ${item.year ? `<span>${item.year}</span>` : ''}
          ${item.runtime ? `<span>${item.runtime} min</span>` : (item.latest ? `<span>${esc(item.latest)}</span>` : '')}
          <span class="glass px-3 py-0.5 rounded-full text-xs">${item.type === 'series' ? 'TV Series' : 'Movie'}</span>
          ${(item.genres || []).map(g => `<span class="glass px-3 py-0.5 rounded-full text-xs">${esc(g)}</span>`).join('')}
        </div>
        <p class="text-white/60 mt-4 max-w-2xl leading-relaxed">${esc(item.overview || '')}</p>
        ${item.cast?.length ? `<p class="text-white/40 text-sm mt-3"><strong class="text-white/60">Cast:</strong> ${esc(item.cast.join(', '))}</p>` : ''}
        <div class="flex flex-wrap gap-3 mt-6">
          <button class="hero-btn hero-btn-primary" data-play="${esc(item.id)}" data-s="${startSeason}" data-e="1">▶ Play${playLabel}</button>
          ${item.trailerKey ? `<button class="hero-btn hero-btn-secondary" data-trailer="${esc(item.trailerKey)}">▶ Trailer</button>` : ''}
          <button class="hero-btn hero-btn-secondary btn-list${inList(item.id) ? ' active' : ''}" data-bookmark="${esc(item.id)}">${inList(item.id) ? '✓ In Watchlist' : '+ Watchlist'}</button>
          <button class="hero-btn hero-btn-secondary" data-close>Close</button>
        </div>
        ${episodesHTML}
        <div id="moreLikeThis" class="mt-6"></div>
      </div>
    `;
  }

  if (item.type === 'series' && item.seasons?.length) {
    const sel = $('#seasonSel');
    const loadEpisodes = async () => {
      const listEl = $('#epList');
      if (listEl) listEl.innerHTML = '<div class="text-white/30 text-sm">Loading episodes…</div>';
      try {
        const list = await api.season(item.tmdbId, sel.value);
        const epList = $('#epList');
        if (epList) {
          epList.innerHTML = list.map(ep => `
            <div class="flex items-center gap-4 p-3 rounded-xl glass hover:border-[#8B5CF6]/30 cursor-pointer transition-all" data-play="${esc(item.id)}" data-s="${sel.value}" data-e="${ep.episode_number}">
              <span class="text-white/30 font-bold text-sm w-16">S${sel.value}·E${ep.episode_number}</span>
              <span class="flex-1 text-sm">${esc(ep.name || 'Episode ' + ep.episode_number)}</span>
              ${ep.vote_average ? `<span class="text-[#FFD700] text-sm font-bold">★ ${ep.vote_average.toFixed(1)}</span>` : ''}
              <span class="text-[#8B5CF6]">▶</span>
            </div>
          `).join('') || '<div class="text-white/30 text-sm">No episodes available.</div>';
        }
      } catch {
        const epList = $('#epList');
        if (epList) epList.innerHTML = '<div class="text-white/30 text-sm">Failed to load episodes.</div>';
      }
    };
    if (sel) sel.onchange = loadEpisodes;
    loadEpisodes();
  }

  const recs = await api.recommendations(item.type, item.tmdbId);
  if (recs?.length) {
    indexItems(recs);
    const box = $('#moreLikeThis');
    if (box) {
      box.innerHTML = `
        <h4 class="font-bold mb-3">More Like This</h4>
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${recs.map(cardHTML).join('')}
        </div>
      `;
    }
  }
}

function closeDetail() {
  const modal = $('#detailModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
  if ($('#hero').style.display !== 'none') restartHeroTimer();
}

/* ---------- Trailer ---------- */
function openTrailer(key) {
  const overlay = $('#trailerModal');
  if (overlay) {
    const iframe = $('#trailerIframe');
    if (iframe) iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeTrailer() {
  const overlay = $('#trailerModal');
  if (overlay) {
    const iframe = $('#trailerIframe');
    if (iframe) iframe.src = '';
    overlay.classList.add('hidden');
    if (!$('#detailModal').classList.contains('hidden') && !$('#playerModal').classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
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

  // Keep the label
  let label = bar.querySelector('.text-white\\/30');
  bar.innerHTML = '';
  if (label) bar.appendChild(label);
  else {
    const lbl = document.createElement('span');
    lbl.className = 'text-white/30 text-[10px] uppercase tracking-wider w-full mb-1';
    lbl.textContent = 'Sources';
    bar.appendChild(lbl);
  }

  sources.forEach((s, i) => {
    const cached = probeCache[s.url];
    const checked = cached && Date.now() - cached.ts < PROBE_CACHE_TTL;
    const reachable = !checked || cached.ok || s.type === 'embed';

    let dot = '';
    if (s.type !== 'embed') {
      if (checked) {
        dot = cached.ok 
          ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400 mr-1"></span>'
          : '<span class="inline-block w-1.5 h-1.5 rounded-full bg-red-400 mr-1"></span>';
      } else {
        dot = '<span class="inline-block w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse mr-1"></span>';
      }
    }

    let typeColor = 'text-white/30';
    if (s.type === 'embed') typeColor = 'text-purple-400/60';
    else if (s.type === 'hls') typeColor = 'text-blue-400/60';
    else if (s.type === 'mp4') typeColor = 'text-green-400/60';

    const isActive = i === activeIdx;
    const btn = document.createElement('button');
    btn.className = `text-xs px-3 py-1.5 rounded-full border transition-all duration-200 whitespace-nowrap ${
      isActive 
        ? 'bg-[#8B5CF6] border-[#8B5CF6] text-white shadow-lg shadow-purple-500/25' 
        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white hover:border-white/20'
    } ${!reachable && !isActive ? 'opacity-30 line-through' : ''}`;
    
    btn.dataset.srv = i;
    btn.title = s.url || s.label || '';
    btn.innerHTML = `${dot}<span>${esc(s.label || s.url || 'Unknown')}</span> <span class="${typeColor} text-[9px] ml-1">${s.type || 'unknown'}</span>`;

    btn.onclick = () => {
      if (!state.player) return;
      state.player.userChoseSource = true;
      const idx = +btn.dataset.srv;
      loadSource(state.player.sources[idx]);
      renderServerBar(state.player.sources, idx);
    };

    bar.appendChild(btn);
  });
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
    if (video) { video.pause(); video.removeAttribute('src'); video.load(); video.style.display = 'none'; }
    if (controls) controls.style.display = 'none';
    if (embed) { embed.style.display = 'block'; embed.src = src.url; }
    if (note) note.innerHTML = `Playing via <strong>${esc(src.label || 'embed')}</strong>. If it doesn't load, <a href="${src.url}" target="_blank" rel="noopener" class="text-[#8B5CF6] hover:underline">open in new tab ↗</a>`;
    return;
  }

  if (embed) { embed.style.display = 'none'; embed.removeAttribute('src'); }
  if (video) {
    video.style.display = 'block';
    video.playbackRate = parseFloat($('#speedSel')?.value || 1);
    video.onloadedmetadata = () => {
      const saved = state.progress[state.player?.trackId];
      if (saved && saved > 5 && saved < video.duration - 30) {
        video.currentTime = saved;
        if (note) note.innerHTML += ` <span class="text-[#8B5CF6] font-bold">↻ Resumed from ${formatTime(saved)}</span>`;
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
          if (data.fatal && note) note.textContent = 'HLS error — try another server.';
        });
      } else {
        video.src = src.url;
      }
    } else {
      video.src = src.url;
    }
    if (controls) controls.style.display = '';
    if (note) note.textContent = src.type === 'hls' ? 'Adaptive HLS stream.' : 'Direct MP4 source.';
    video.play().catch(() => {});
  }
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

  const title = $('#playerTitle');
  if (title) title.textContent = item.title + epTxt;

  const sources = resolveSources(item, state.player.season, state.player.episode);
  state.player.sources = sources;

  const modal = $('#playerModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  const isPlayable = (s) => s.type === 'embed' || !probeCache[s.url] || probeCache[s.url].ok;
  let defaultIdx = sources.findIndex(isPlayable);
  if (defaultIdx === -1) defaultIdx = 0;

  renderServerBar(sources, defaultIdx);
  loadSource(sources[defaultIdx]);

  sources.forEach((src, i) => {
    if (src.type === 'embed') return;
    probeSource(src, state.player.probeAbort.signal).then(ok => {
      if (!state.player || state.player.sources !== sources) return;
      const activeBtn = $('#serverBar')?.querySelector('[data-srv].bg-[#8B5CF6]');
      const activeIdx = activeBtn ? +activeBtn.dataset.srv : defaultIdx;
      if (!ok && activeIdx === i && !state.player.userChoseSource) {
        const nextBtn = $$('#serverBar [data-srv]').find(
          b => !b.classList.contains('opacity-30') && +b.dataset.srv !== i
        );
        if (nextBtn) {
          const nextIdx = +nextBtn.dataset.srv;
          loadSource(sources[nextIdx]);
          renderServerBar(sources, nextIdx);
        } else {
          const note = $('#playerNote');
          if (note) note.innerHTML = `⚠️ No reachable servers for <strong>${esc(item.title)}</strong>.`;
        }
      }
    });
  });
}

function closePlayer() {
  const video = $('#videoEl');
  const embed = $('#embedEl');

  if (state.player?.probeAbort) state.player.probeAbort.abort();

  if (state.player?.trackId && video && !isNaN(video.currentTime) && video.currentTime > 5) {
    saveProgress(state.player.trackId, video.currentTime);
  }

  destroyHls();
  if (video) { video.pause(); video.removeAttribute('src'); video.load(); }
  if (embed) embed.removeAttribute('src');

  const modal = $('#playerModal');
  if (modal) modal.classList.add('hidden');
  document.body.style.overflow = '';
  if ($('#hero').style.display !== 'none') restartHeroTimer();
}

function bindPlayer() {
  const video = $('#videoEl');
  if (!video) return;

  const btnPlay = $('#btnPlay');
  const btnBack = $('#btnBack');
  const btnFwd = $('#btnFwd');
  const btnMute = $('#btnMute');
  const volSlider = $('#volSlider');
  const speedSel = $('#speedSel');
  const btnFull = $('#btnFull');
  const progress = $('#progress');
  const timeLabel = $('#timeLabel');

  if (btnPlay) {
    btnPlay.onclick = () => {
      if (video.paused) { video.play(); btnPlay.textContent = '⏸'; }
      else { video.pause(); btnPlay.textContent = '▶'; }
    };
  }

  if (btnBack) btnBack.onclick = () => video.currentTime = Math.max(0, video.currentTime - 10);
  if (btnFwd) btnFwd.onclick = () => video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);

  if (btnMute) {
    btnMute.onclick = () => {
      video.muted = !video.muted;
      btnMute.textContent = video.muted ? '🔇' : '🔊';
    };
  }

  if (volSlider) {
    volSlider.oninput = (e) => {
      video.volume = +e.target.value;
      video.muted = false;
      if (btnMute) btnMute.textContent = video.volume === 0 ? '🔇' : '🔊';
    };
  }

  if (speedSel) {
    speedSel.onchange = (e) => video.playbackRate = parseFloat(e.target.value);
  }

  if (btnFull) {
    btnFull.onclick = () => {
      const wrap = $('#videoWrap');
      if (!document.fullscreenElement) wrap?.requestFullscreen?.();
      else document.exitFullscreen?.();
    };
  }

  let lastSave = 0;

  video.ontimeupdate = () => {
    const pct = (video.currentTime / (video.duration || 1)) * 100;
    const filled = $('#progressFilled');
    if (filled) filled.style.width = pct + '%';
    if (timeLabel) timeLabel.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

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
    if (btnPlay) btnPlay.textContent = '▶';
    if (state.player?.trackId) clearProgress(state.player.trackId);
  };

  if (progress) {
    progress.onclick = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      video.currentTime = ((e.clientX - rect.left) / rect.width) * (video.duration || 0);
    };
  }
}

/* ---------- Event Delegation ---------- */
document.addEventListener('click', (e) => {
  const remove = e.target.closest('[data-remove]');
  if (remove) {
    e.preventDefault();
    removeHistory(remove.dataset.remove);
    remove.closest('.card-wrapper')?.remove();
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
      (nowIn ? '✓ In Watchlist' : '+ Watchlist') :
      (nowIn ? '✓' : '+');
    if (!nowIn) {
      const row = bookmark.closest('#watchlistRow');
      if (row) {
        bookmark.closest('.card-wrapper')?.remove();
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

  const card = e.target.closest('.card-wrapper[data-id]');
  if (card) {
    openDetail(card.dataset.id);
    return;
  }

  const trend = e.target.closest('.trend-item[data-id]');
  if (trend) {
    openDetail(trend.dataset.id);
  }
});

/* ---------- Keyboard Shortcuts ---------- */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeTrailer();
    closePlayer();
    closeDetail();
    return;
  }

  const modal = $('#playerModal');
  if (!modal || modal.classList.contains('hidden')) return;

  const tag = (e.target.tagName || '').toLowerCase();
  if (['input', 'select', 'textarea'].includes(tag)) return;

  const video = $('#videoEl');
  if (!video) return;

  switch (e.key) {
    case ' ':
    case 'k':
      e.preventDefault();
      if (video.paused) { video.play(); $('#btnPlay').textContent = '⏸'; }
      else { video.pause(); $('#btnPlay').textContent = '▶'; }
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
      if (!document.fullscreenElement) wrap?.requestFullscreen?.();
      else document.exitFullscreen?.();
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
const searchInput = $('#searchInput');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    clearTimeout(state.searchTimer);
    const query = e.target.value.trim();
    state.searchTimer = setTimeout(() => {
      if (query.length >= 2) renderSearch(query);
      else if (!query.length) route('home');
    }, 300);
  });
}

/* ---------- Header Scroll ---------- */
window.addEventListener('scroll', () => {
  const header = $('#header');
  if (header) header.classList.toggle('scrolled', window.scrollY > 30);
});

/* ---------- Init ---------- */
async function init() {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
  
  bindPlayer();
  loadProgress();

  try {
    await loadGenres();
    await renderHome();
  } catch (err) {
    console.error('[init] fatal:', err);
    const view = $('#view');
    if (view) {
      view.innerHTML = `
        <div class="max-w-2xl mx-auto text-center py-20 px-6">
          <h2 class="text-[#8B5CF6] font-bold text-2xl mb-4">⚠️ Failed to load</h2>
          <p class="text-white/40 mb-6">${esc(err.message || 'Unknown error')}</p>
          <p class="text-white/20 text-sm mb-6">Check console. Make sure TMDB API key is valid.</p>
          <button onclick="location.reload()" class="hero-btn hero-btn-primary">Retry</button>
        </div>
      `;
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
