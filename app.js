/* ============================================================
   app.js — CINEMAX Premium UI + Player (Full Script)
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

/* ---------- Modal helpers ---------- */
function showModal(modal) {
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('visible');
}

function hideModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('visible');
}

/* ---------- Helpers ---------- */
function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function posterStyle(item) {
  return item.poster ? `background-image:url('${item.poster}')` : 'background:linear-gradient(160deg,#1a1712,#0c0c0a)';
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
  if (!Array.isArray(state.history)) state.history = [];
  return state.history;
}

function loadList() {
  state.list = store.get(KEYS.list);
  if (!Array.isArray(state.list)) state.list = [];
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

/* ---------- Card Rendering (Ticket Stub) ---------- */
function cardHTML(item) {
  indexItems([item]);
  const saved = inList(item.id);
  const genre = item.genres?.[0] || '';
  const year = item.year || '';

  return `<div class="card-wrapper" data-id="${esc(item.id)}">
    <div class="card-poster" style="${posterStyle(item)}">
      <img src="${item.poster || ''}" alt="${esc(item.title)}" loading="lazy" onerror="this.style.display='none'">
      <div class="poster-overlay"></div>

      <span class="stub-fmt">35MM</span>
      <span class="stub-rating">★ ${item.rating || '—'}</span>

      <div class="quick-actions">
        <button class="quick-action-btn play" data-play="${esc(item.id)}" aria-label="Play">▶</button>
        <button class="quick-action-btn" data-bookmark="${esc(item.id)}" aria-label="${saved ? 'Remove' : 'Add'}">${saved ? '✓' : '+'}</button>
        <button class="quick-action-btn" data-detail="${esc(item.id)}" aria-label="Details">ⓘ</button>
      </div>

      <div class="card-details">
        <div class="perf"></div>
        <div class="title">${esc(item.title)}</div>
        <div class="meta">
          <span>${year || '—'}</span>
          ${genre ? `<span class="genre-tag">${esc(genre)}</span>` : ''}
          <span>·</span>
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
      <button class="quick-action-btn" data-remove="${esc(item.id)}" aria-label="Remove from history" style="background:rgba(201,72,31,0.25);color:#e8a688;">×</button>`
  );
}

function rowHTML(title, items, routeLink, index) {
  if (!items?.length) return '';
  const rowId = `row-${title.replace(/\s/g, '-').replace(/[^a-zA-Z0-9-]/g, '')}`;
  const num = typeof index === 'number' ? String(index + 1).padStart(2, '0') : null;
  return `<div class="row-container">
    <div class="reel-divider" aria-hidden="true"></div>
    <div class="flex items-baseline justify-between px-1 mb-3">
      <div class="row-heading">
        ${num ? `<span class="row-number">${num}</span>` : ''}
        <div>
          <h2 class="section-title">${esc(title)}</h2>
          <p class="section-subtitle">${items.length} titles</p>
        </div>
      </div>
      ${routeLink ? `<span class="view-all" data-route="${esc(routeLink)}">Full programme →</span>` : ''}
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
    <div class="reel-divider" aria-hidden="true"></div>
    <div class="flex items-baseline justify-between px-1 mb-3">
      <div class="row-heading">
        <div>
          <h2 class="section-title">Resume</h2>
          <p class="section-subtitle">${items.length} titles</p>
        </div>
      </div>
      <span class="view-all" data-clear-history>Clear stub</span>
    </div>
    <div class="row-scroll">
      ${items.map(continueCardHTML).join('')}
    </div>
  </div>`;
}

function watchlistRowHTML(items) {
  if (!items?.length) return '';
  return `<div class="row-container" id="watchlistRow">
    <div class="reel-divider" aria-hidden="true"></div>
    <div class="flex items-baseline justify-between px-1 mb-3">
      <div class="row-heading">
        <div>
          <h2 class="section-title">Reserved</h2>
          <p class="section-subtitle">${items.length} titles</p>
        </div>
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

/* ---------- Hero (Marquee) ---------- */
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
      <span class="hero-badge">${item.type === 'series' ? 'Now Screening · Series' : 'Now Screening'}</span>
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

/* ---------- Trending (Board) ---------- */
const PERIOD = {
  '24h': { movie: () => api.trendingMoviesDay(), series: () => api.trendingTVDay() },
  '7d': { movie: () => api.trendingMovies(), series: () => api.trendingTV() },
  '30d': { movie: () => api.popularMovies(), series: () => api.popularTV() }
};

function trendListHTML(items) {
  return (items || []).slice(0, 8).map((item, i) => {
    indexItems([item]);
    return `<div class="trend-item" data-id="${esc(item.id)}">
      <span class="trend-rank ${i === 0 ? 'is-first' : i === 1 ? 'is-second' : i === 2 ? 'is-third' : ''}">${String(i + 1).padStart(2, '0')}</span>
      <div class="trend-thumb" style="${posterStyle(item)}"></div>
      <div class="flex-1 min-w-0">
        <div class="trend-title">${esc(item.title)}</div>
        <div class="trend-sub">★ ${item.rating || '—'}</div>
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

  return `<div class="max-w-[1560px] mx-auto px-6 md:px-8 py-8 board-section">
    <div class="board-heading">
      <h2 class="section-title">Box Office Board</h2>
      <p class="section-subtitle mb-6">Ranked by CINEMAX audience activity</p>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h3 class="board-col-label">Feature Film</h3>
        <div class="board-panel">
          ${trendListHTML(m)}
        </div>
      </div>
      <div>
        <h3 class="board-col-label">Serial Programme</h3>
        <div class="board-panel">
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
  if (view) view.innerHTML = '<div class="loading-state">Rolling the reel…</div>';

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
    let rowIndex = 0;
    if (state.history.length) html += continueRowHTML(state.history);
    if (state.list.length) html += watchlistRowHTML(state.list);
    html += rowHTML('Now Showing', trend, 'movie', rowIndex++);
    html += rowHTML('In Theatres', nowPlaying, 'movie', rowIndex++);
    html += rowHTML('Critics\u2019 Picks — Film', topMovies, 'movie', rowIndex++);
    html += rowHTML('Serial Programme', popularTV, 'series', rowIndex++);
    html += rowHTML('Critics\u2019 Picks — Series', topTV, 'series', rowIndex++);

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
      view.innerHTml = '';
      view.innerHTML = `
        <div class="max-w-2xl mx-auto text-center py-20 px-6">
          <h2 class="error-title">Projector jammed</h2>
          <p class="error-msg">${esc(err.message || 'Unknown error')}</p>
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
        <span class="listing-eyebrow">${type === 'movie' ? 'Feature Catalogue' : 'Series Catalogue'}</span>
        <h1 class="listing-title">${type === 'movie' ? 'Film' : 'Television'}</h1>
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
          <div class="loading-state col-span-full">Loading…</div>
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
  if (grid) grid.innerHTML = '<div class="loading-state col-span-full">Loading…</div>';
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
        : '<div class="loading-state col-span-full">No titles match your filters.</div>';
    }

    const more = $('#loadMore');
    if (more) {
      more.style.display = (state.grid.page <= totalPages && state.grid.items.length) ? 'block' : 'none';
    }
  } catch (err) {
    const grid = $('#grid');
    if (grid) {
      grid.innerHTML = `<div class="loading-state col-span-full">Failed to load: ${esc(err.message)}</div>`;
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
    view.innerHTML = `<div class="max-w-[1560px] mx-auto px-6 md:px-8 pt-24 pb-4"><span class="listing-eyebrow">By Category</span><h1 class="listing-title">Genres</h1></div><div id="gwrap" class="max-w-[1560px] mx-auto px-6 md:px-8"><div class="loading-state">Loading…</div></div>`;
  }

  const allGenres = getGenres();
  const rows = await Promise.all(allGenres.slice(0, 10).map(async (g, i) => {
    try {
      const items = await api.byGenreRow('movie', g.id);
      indexItems(items);
      return rowHTML(g.name, items, null, i);
    } catch { return ''; }
  }));

  const wrap = $('#gwrap');
  if (wrap) {
    wrap.innerHTML = rows.join('') || '<div class="loading-state">No genres available.</div>';
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
    view.innerHTML = `<div class="max-w-[1560px] mx-auto px-6 md:px-8 pt-24 pb-4"><span class="listing-eyebrow">By Release</span><h1 class="listing-title">Years</h1></div><div id="ywrap" class="max-w-[1560px] mx-auto px-6 md:px-8"><div class="loading-state">Loading…</div></div>`;
  }

  const rows = await Promise.all(years.map(async (y, i) => {
    try {
      const { items } = await api.discover('movie', { year: y, sort: 'popularity.desc', page: 1 });
      indexItems(items);
      return rowHTML(`${y}`, items.slice(0, 16), null, i);
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
        <span class="listing-eyebrow">Search Results</span>
        <h1 class="listing-title">"${safeQ}"</h1>
      </div>
      <div class="max-w-[1560px] mx-auto px-6 md:px-8">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4" id="sgrid">
          <div class="loading-state col-span-full">Searching…</div>
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
        : `<div class="loading-state col-span-full">No results for "${safeQ}".</div>`;
    }
  } catch (err) {
    const grid = $('#sgrid');
    if (grid) {
      grid.innerHTML = `<div class="loading-state col-span-full">Search failed: ${esc(err.message)}</div>`;
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

/* ---------- Detail (Ticket Stub Modal) ---------- */
async function openDetail(id) {
  const stub = byId(id);
  if (!stub) return;

  clearInterval(state.heroTimer);
  const card = $('#detailCard');
  if (card) {
    card.innerHTML = `<div class="p-8 text-center"><div class="loading-state">Printing ticket…</div></div>`;
  }

  showModal($('#detailModal'));
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
          <h4 class="detail-subhead">Episodes</h4>
          <select id="seasonSel" class="filter-pill text-sm" data-tmdb="${esc(item.tmdbId)}">${seasonOpts}</select>
        </div>
        <div class="space-y-2" id="epList"><div class="loading-state">Loading episodes…</div></div>
      </div>
    `;
  }

  const playLabel = item.type === 'series' ? ` S${startSeason}·E1` : '';

  if (card) {
    card.innerHTML = `
      <button class="modal-close" data-close>×</button>
      <div class="detail-backdrop" style="${item.backdrop ? `background-image:url('${item.backdrop}')` : posterStyle(item)}">
        <div class="detail-backdrop-fade"></div>
      </div>
      <div class="detail-body">
        <div class="stub-perf" aria-hidden="true"></div>
        <h2 class="detail-title">${esc(item.title)}</h2>
        ${item.tagline ? `<p class="detail-tagline">${esc(item.tagline)}</p>` : ''}
        <div class="detail-meta">
          ${item.rating ? `<span class="detail-rating">★ ${item.rating}</span>` : ''}
          ${item.year ? `<span>${item.year}</span>` : ''}
          ${item.runtime ? `<span>${item.runtime} min</span>` : (item.latest ? `<span>${esc(item.latest)}</span>` : '')}
          <span class="tag-pill">${item.type === 'series' ? 'TV Series' : 'Feature Film'}</span>
          ${(item.genres || []).map(g => `<span class="tag-pill">${esc(g)}</span>`).join('')}
        </div>
        <p class="detail-overview">${esc(item.overview || '')}</p>
        ${item.cast?.length ? `<p class="detail-cast"><strong>Cast</strong> ${esc(item.cast.join(', '))}</p>` : ''}
        <div class="flex flex-wrap gap-3 mt-6">
          <button class="hero-btn hero-btn-primary" data-play="${esc(item.id)}" data-s="${startSeason}" data-e="1">▶ Play${playLabel}</button>
          ${item.trailerKey ? `<button class="hero-btn hero-btn-secondary" data-trailer="${esc(item.trailerKey)}">▶ Trailer</button>` : ''}
          <button class="hero-btn hero-btn-secondary btn-list${inList(item.id) ? ' active' : ''}" data-bookmark="${esc(item.id)}">${inList(item.id) ? '✓ Reserved' : '+ Reserve'}</button>
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
      if (listEl) listEl.innerHTML = '<div class="loading-state">Loading episodes…</div>';
      try {
        const list = await api.season(item.tmdbId, sel.value);
        const epList = $('#epList');
        if (epList) {
          epList.innerHTML = list.map(ep => `
            <div class="ep-row" data-play="${esc(item.id)}" data-s="${sel.value}" data-e="${ep.episode_number}">
              <span class="ep-code">S${sel.value}·E${ep.episode_number}</span>
              <span class="ep-name">${esc(ep.name || 'Episode ' + ep.episode_number)}</span>
              ${ep.vote_average ? `<span class="ep-rating">★ ${ep.vote_average.toFixed(1)}</span>` : ''}
              <span class="ep-play">▶</span>
            </div>
          `).join('') || '<div class="loading-state">No episodes available.</div>';
        }
      } catch {
        const epList = $('#epList');
        if (epList) epList.innerHTML = '<div class="loading-state">Failed to load episodes.</div>';
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
        <h4 class="detail-subhead mb-3">Paired Screenings</h4>
        <div class="flex gap-3 overflow-x-auto pb-2">
          ${recs.map(cardHTML).join('')}
        </div>
      `;
    }
  }
}

function closeDetail() {
  hideModal($('#detailModal'));
  document.body.style.overflow = '';
  if ($('#hero').style.display !== 'none') restartHeroTimer();
}

/* ---------- Trailer ---------- */
function openTrailer(key) {
  const overlay = $('#trailerModal');
  if (overlay) {
    const iframe = $('#trailerIframe');
    if (iframe) iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;
    showModal(overlay);
    document.body.style.overflow = 'hidden';
  }
}

function closeTrailer() {
  const overlay = $('#trailerModal');
  if (overlay) {
    const iframe = $('#trailerIframe');
    if (iframe) iframe.src = '';
    hideModal(overlay);
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

  let label = bar.querySelector('.server-bar-label');
  bar.innerHTML = '';
  if (label) bar.appendChild(label);
  else {
    const lbl = document.createElement('span');
    lbl.className = 'server-bar-label';
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
          ? '<span class="status-dot online"></span>'
          : '<span class="status-dot offline"></span>';
      } else {
        dot = '<span class="status-dot checking"></span>';
      }
    }

    let typeColor = 'src-type-embed';
    if (s.type === 'hls') typeColor = 'src-type-hls';
    else if (s.type === 'mp4') typeColor = 'src-type-mp4';

    const isActive = i === activeIdx;
    const btn = document.createElement('button');
    btn.className = `server-btn ${isActive ? 'active' : ''} ${!reachable && !isActive ? 'unreachable' : ''}`;

    btn.dataset.srv = i;
    btn.title = s.url || s.label || '';
    btn.innerHTML = `${dot}<span>${esc(s.label || s.url || 'Unknown')}</span> <span class="${typeColor}">${s.type || 'unknown'}</span>`;

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
    if (controls) { controls.style.display = 'none'; controls.style.visibility = 'hidden'; controls.style.pointerEvents = 'none'; }
    if (embed) { embed.style.display = 'block'; embed.src = src.url; }
    if (note) note.innerHTML = `Playing via <strong>${esc(src.label || 'embed')}</strong>. If the player above shows an error or won't load, try another source above, or <a href="${src.url}" target="_blank" rel="noopener">open in new tab ↗</a>`;
    return;
  }

  if (embed) { embed.src = ''; embed.style.display = 'none'; }
  if (video) video.style.display = 'block';
  if (controls) { controls.style.display = 'flex'; controls.style.visibility = 'visible'; controls.style.pointerEvents = 'auto'; }
  if (note) note.innerHTML = `Playing direct stream: <strong>${esc(src.label || 'Direct Source')}</strong>`;

  const savedProgress = state.progress[state.player?.id] || 0;

  if (src.type === 'hls') {
    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      state.hls = new Hls({ maxLoadingDelay: 4, crashRecoveryRetry: 2 });
      state.hls.loadSource(src.url);
      state.hls.attachMedia(video);

      state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (savedProgress) video.currentTime = savedProgress;
        video.play().catch(err => console.warn('[Player] Autoplay blocked:', err));
      });

      state.hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal && (!state.player || !state.player.userChoseSource)) {
          handlePlayerError();
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src.url;
      video.addEventListener('loadedmetadata', () => {
        if (savedProgress) video.currentTime = savedProgress;
        video.play().catch(err => console.warn('[Player] Native autoplay blocked:', err));
      }, { once: true });
    } else {
      if (note) note.innerHTML = `<span class="error-inline">HLS streams are not natively supported in this browser.</span>`;
    }
  } else {
    video.src = src.url;
    video.load();
    video.addEventListener('loadedmetadata', () => {
      if (savedProgress) video.currentTime = savedProgress;
      video.play().catch(err => console.warn('[Player] MP4 Autoplay blocked:', err));
    }, { once: true });

    video.onerror = () => {
      if (!state.player || !state.player.userChoseSource) handlePlayerError();
    };
  }
}

function handlePlayerError() {
  if (!state.player) return;
  const nextIdx = state.player.activeIdx + 1;
  if (nextIdx < state.player.sources.length) {
    console.warn(`[Player] Stream error. Shifting to index path: ${nextIdx}`);
    state.player.activeIdx = nextIdx;
    loadSource(state.player.sources[nextIdx]);
    renderServerBar(state.player.sources, nextIdx);
  } else {
    const note = $('#playerNote');
    if (note) note.innerHTML = `<span class="error-inline">All direct streams failed. Please switch nodes manually.</span>`;
  }
}

export async function openPlayer(id, season, episode) {
  const item = byId(id);
  if (!item) return;

  clearInterval(state.heroTimer);
  document.body.style.overflow = 'hidden';

  showModal($('#playerModal'));

  const titleEl = $('#playerTitle');
  if (titleEl) {
    const epLabel = (item.type === 'series' || item.type === 'tv') ? ` — Season ${season}, Episode ${episode}` : '';
    titleEl.textContent = `${item.title}${epLabel}`;
  }

  loadProgress();
  const sources = resolveSources(item, season, episode);

  state.player = {
    id: item.id,
    item,
    season,
    episode,
    sources,
    activeIdx: 0,
    userChoseSource: false
  };

  renderServerBar(sources, 0);
  loadSource(sources[0]);

  sources.forEach(async (src) => {
    await probeSource(src);
    if (state.player && state.player.id === item.id) {
      renderServerBar(state.player.sources, state.player.activeIdx);
    }
  });
}

function closePlayer() {
  hideModal($('#playerModal'));

  const video = $('#videoEl');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }

  const embed = $('#embedEl');
  if (embed) embed.src = '';

  destroyHls();
  state.player = null;
  document.body.style.overflow = '';

  if ($('#hero') && $('#hero').style.display !== 'none') restartHeroTimer();
  if (window.currentRoute === 'home') renderHome();
}

function initPlayerControls() {
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
  const progressFilled = $('#progressFilled');
  const timeLabel = $('#timeLabel');

  const setPlayIcon = () => {
    if (btnPlay) btnPlay.textContent = video.paused ? '▶' : '❚❚';
  };

  if (btnPlay) {
    btnPlay.onclick = () => {
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    };
  }

  video.addEventListener('play', setPlayIcon);
  video.addEventListener('pause', setPlayIcon);

  if (btnBack) {
    btnBack.onclick = () => {
      video.currentTime = Math.max(0, video.currentTime - 10);
    };
  }

  if (btnFwd) {
    btnFwd.onclick = () => {
      if (video.duration) video.currentTime = Math.min(video.duration, video.currentTime + 10);
    };
  }

  if (btnMute) {
    btnMute.onclick = () => {
      video.muted = !video.muted;
      btnMute.textContent = video.muted ? '🔇' : '🔊';
      if (volSlider) volSlider.value = video.muted ? 0 : video.volume;
    };
  }

  if (volSlider) {
    volSlider.oninput = () => {
      video.volume = +volSlider.value;
      video.muted = +volSlider.value === 0;
      if (btnMute) btnMute.textContent = video.muted ? '🔇' : '🔊';
    };
  }

  if (speedSel) {
    speedSel.onchange = () => {
      video.playbackRate = +speedSel.value;
    };
  }

  if (btnFull) {
    btnFull.onclick = () => {
      const wrap = $('#videoWrap');
      if (!wrap) return;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else wrap.requestFullscreen?.().catch(() => {});
    };
  }

  if (progress) {
    progress.onclick = (e) => {
      if (!video.duration) return;
      const rect = progress.getBoundingClientRect();
      const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      video.currentTime = pct * video.duration;
    };
  }

  video.ontimeupdate = () => {
    if (!state.player) return;
    const cur = video.currentTime;
    const dur = video.duration;

    if (progressFilled && dur > 0) progressFilled.style.width = `${(cur / dur) * 100}%`;
    if (timeLabel) timeLabel.textContent = `${formatTime(cur)} / ${formatTime(dur || 0)}`;

    if (cur > 5 && dur > 0) {
      saveProgress(state.player.id, cur);
    }
  };

  video.onended = () => {
    if (!state.player) return;
    clearProgress(state.player.id);
    setPlayIcon();
  };

  setPlayIcon();
}


/* ---------- Global Event Listeners ---------- */
function initGlobalListeners() {
  document.body.addEventListener('click', async (e) => {
    const playBtn = e.target.closest('[data-play]');
    const detailBtn = e.target.closest('[data-detail]');
    const bookmarkBtn = e.target.closest('[data-bookmark]');
    const removeBtn = e.target.closest('[data-remove]');
    const clearHistoryBtn = e.target.closest('[data-clear-history]');
    const closeBtn = e.target.closest('[data-close]');
    const routeBtn = e.target.closest('[data-route]');
    const trailerBtn = e.target.closest('[data-trailer]');

    if (playBtn) {
      const id = playBtn.dataset.play;
      const targetItem = byId(id);
      const s = playBtn.dataset.s || defaultSeason(targetItem?.tmdbId || 0);
      const ep = playBtn.dataset.e || 1;

      if (targetItem) pushHistory(targetItem);
      closeDetail();
      openPlayer(id, s, ep);
    }
    else if (detailBtn) {
      openDetail(detailBtn.dataset.detail);
    }
    else if (bookmarkBtn) {
      const id = bookmarkBtn.dataset.bookmark;
      const targetItem = byId(id);
      const added = toggleList(targetItem);

      bookmarkBtn.textContent = added ? '✓ Reserved' : '+ Reserve';
      bookmarkBtn.classList.toggle('active', added);
      if (window.currentRoute === 'home') renderHome();
    }
    else if (removeBtn) {
      const id = removeBtn.dataset.remove;
      removeHistory(id);
      const cwRow = document.getElementById('cwRow');
      if (cwRow) {
        const freshHistory = loadHistory();
        if (freshHistory.length) cwRow.outerHTML = continueRowHTML(freshHistory);
        else cwRow.remove();
      }
    }
    else if (clearHistoryBtn) {
      state.history = [];
      store.set(KEYS.history, []);
      const cwRow = document.getElementById('cwRow');
      if (cwRow) cwRow.remove();
    }
    else if (closeBtn) {
      closeDetail();
      closeTrailer();
      closePlayer();
    }
    else if (routeBtn) {
      const targetRoute = routeBtn.dataset.route;
      window.currentRoute = targetRoute;
      route(targetRoute);
    }
    else if (trailerBtn) {
      openTrailer(trailerBtn.dataset.trailer);
    }
  });

  const searchBar = $('#searchInput');
  if (searchBar) {
    searchBar.addEventListener('input', () => {
      clearTimeout(state.searchTimer);
      const query = searchBar.value.trim();
      if (query.length > 2) {
        state.searchTimer = setTimeout(() => renderSearch(query), 400);
      } else if (query.length === 0) {
        window.currentRoute = 'home';
        route('home');
      }
    });
  }

  $$('.main-nav a').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const targetRoute = link.dataset.route;
      window.currentRoute = targetRoute;
      route(targetRoute);
    };
  });

  window.addEventListener('scroll', () => {
    const header = $('#header');
    if (header) header.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

/* ---------- Module Orchestration Initialization ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  window.currentRoute = 'home';
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  try {
    await loadGenres();
  } catch (err) {
    console.error('[CINEMAX] Initialization genre initialization map error:', err);
  }
  initGlobalListeners();
  initPlayerControls();
  route('home');
});
