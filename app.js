/* ============================================================
   app.js — OnlyFlix UI (TMDB) + multi-format player (FIXED v7)
   ============================================================ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ---------- Storage ---------- */
const storage = {
  get: (key, fallback = []) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (err) {
      console.error(`[storage] write failed for ${key}:`, err);
    }
  }
};

const STORE = {
  history: { key: 'onlyflix_history', max: 18 },
  list: { key: 'onlyflix_mylist', max: 60 },
  progress: { key: 'onlyflix_progress', default: {} }
};

const getHistory = () => storage.get(STORE.history.key);
const getList = () => storage.get(STORE.list.key);
const getProgress = () => storage.get(STORE.progress.key, STORE.progress.default);

const pushHistory = (item) => {
  let h = getHistory().filter(x => x.id !== item.id);
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
  storage.set(STORE.history.key, h.slice(0, STORE.history.max));
};

const removeHistory = (id) => {
  const h = getHistory().filter(x => x.id !== id);
  storage.set(STORE.history.key, h);
  return h;
};

const inList = (id) => getList().some(x => x.id === id);

const toggleList = (item) => {
  if (!item) return false;
  let list = getList();
  const exists = list.some(x => x.id === item.id);
  
  if (exists) {
    list = list.filter(x => x.id !== item.id);
  } else {
    list = [{
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
    }, ...list].slice(0, STORE.list.max);
  }
  
  storage.set(STORE.list.key, list);
  return !exists;
};

const saveProgress = (id, time) => {
  const p = getProgress();
  p[id] = time;
  storage.set(STORE.progress.key, p);
};

const clearProgress = (id) => {
  const p = getProgress();
  delete p[id];
  storage.set(STORE.progress.key, p);
};

/* ---------- Helpers ---------- */
const INDEX = {};
const indexItems = (arr) => {
  (arr || []).forEach(item => {
    if (item?.id) INDEX[item.id] = item;
  });
  return arr;
};

const byId = (id) => INDEX[id];
const esc = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const posterStyle = (item) => item.poster ? `background-image:url('${item.poster}')` : 'background:#1a1a24';
const defaultSeason = (tmdbId) => (typeof SEASON_DEFAULTS !== 'undefined' && SEASON_DEFAULTS[tmdbId]) ? SEASON_DEFAULTS[tmdbId] : 1;
const viewsLabel = (item) => {
  const v = Math.round((item.votes || item.rating * 100 || 50) * (0.6 + (item.rating || 5) / 10));
  return v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v;
};

/* ---------- Card rendering ---------- */
const cardHTML = (item) => {
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
};

const continueCardHTML = (item) => {
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
};

const rowHTML = (title, items, route) => {
  if (!items?.length) return '';
  return `<div class="row">
    <div class="row-head"><h2>${esc(title)}</h2>${route ? `<span class="more" data-route="${esc(route)}">View all →</span>` : ''}</div>
    <div class="row-scroll">${items.map(cardHTML).join('')}</div>
  </div>`;
};

const continueRowHTML = (items) => {
  if (!items?.length) return '';
  return `<div class="row" id="cwRow">
    <div class="row-head"><h2>Continue Watching</h2><span class="more cw-clear" data-clear-history>Clear all</span></div>
    <div class="row-scroll">${items.map(continueCardHTML).join('')}</div>
  </div>`;
};

const myListRowHTML = (items) => {
  if (!items?.length) return '';
  return `<div class="row" id="myListRow">
    <div class="row-head"><h2>My List</h2></div>
    <div class="row-scroll">${items.map(cardHTML).join('')}</div>
  </div>`;
};

/* ---------- HERO ---------- */
let heroItems = [], heroIdx = 0, heroTimer = null;

const setHero = (idx) => {
  heroIdx = idx;
  const item = heroItems[idx];
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
};

const restartHeroTimer = () => {
  clearInterval(heroTimer);
  if (!heroItems.length) return;
  heroTimer = setInterval(() => setHero((heroIdx + 1) % heroItems.length), 6500);
};

const initHero = async (trendData) => {
  heroItems = (trendData || [])
    .filter(x => x.backdrop && x.overview)
    .slice(0, 6);
  
  $('#heroDots').innerHTML = heroItems.map((_, i) => `<span data-i="${i}"></span>`).join('');
  
  $$('#heroDots span').forEach(dot => {
    dot.onclick = () => {
      setHero(+dot.dataset.i);
      restartHeroTimer();
    };
  });
  
  if (heroItems.length) setHero(0);
  restartHeroTimer();
};

/* ---------- TRENDING ---------- */
const PERIOD = {
  '24h': { movie: () => api.trendingMoviesDay(), series: () => api.trendingTVDay() },
  '7d': { movie: () => api.trendingMovies(), series: () => api.trendingTV() },
  '30d': { movie: () => api.popularMovies(), series: () => api.popularTV() }
};

const trendListHTML = (items) => {
  return (items || []).slice(0, 8).map((item, i) => {
    indexItems([item]);
    return `<li class="trend-item" data-id="${esc(item.id)}">
      <span class="trend-rank">${String(i + 1).padStart(2, '0')}</span>
      <div class="trend-thumb" style="${posterStyle(item)}"></div>
      <div class="trend-info"><div class="t">${esc(item.title)}</div><div class="v">★ ${item.rating} · ${viewsLabel(item)} views</div></div>
    </li>`;
  }).join('');
};

const buildTrending = async () => {
  const [movies, series] = await Promise.allSettled([
    PERIOD['24h'].movie(),
    PERIOD['24h'].series()
  ]);
  
  const m = movies.status === 'fulfilled' ? movies.value : [];
  const s = series.status === 'fulfilled' ? series.value : [];
  
  return `<div class="trending">
    <h2>Trending on OnlyFlix</h2>
    <p class="sub">Internal popularity based on OnlyFlix views during the selected period.</p>
    <div class="trend-cols">
      <div class="trend-col" data-type="movie"><h3>Top Movies</h3>
        <div class="period-tabs"><button data-p="24h" class="active">24h</button><button data-p="7d">7d</button><button data-p="30d">30d</button></div>
        <ul class="trend-list">${trendListHTML(m)}</ul></div>
      <div class="trend-col" data-type="series"><h3>Top TV Shows</h3>
        <div class="period-tabs"><button data-p="24h" class="active">24h</button><button data-p="7d">7d</button><button data-p="30d">30d</button></div>
        <ul class="trend-list">${trendListHTML(s)}</ul></div>
    </div></div>`;
};

const bindTrending = () => {
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
};

/* ---------- HOME ---------- */
const renderHome = async () => {
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
    await initHero(trend);

    const history = getHistory();
    const mylist = getList();
    [...history, ...mylist].forEach(h => INDEX[h.id] = h);

    let html = '';
    if (history.length) html += continueRowHTML(history);
    if (mylist.length) html += myListRowHTML(mylist);
    html += rowHTML('Trending Now', trend, 'movie');
    html += rowHTML('Now Playing in Theaters', nowPlaying, 'movie');
    html += rowHTML('Top Rated Movies', topMovies, 'movie');
    html += rowHTML('Popular TV Shows', popularTV, 'series');
    html += rowHTML('Top Rated TV Shows', topTV, 'series');

    try {
      html += await buildTrending();
    } catch (err) {
      console.error('[renderHome] buildTrending failed:', err);
    }

    $('#view').innerHTML = html;
    bindTrending();
    restartHeroTimer();
  } catch (err) {
    console.error('[renderHome] fatal:', err);
    throw err;
  }
};

/* ---------- GRID ---------- */
let gridState = {}, gridLoading = false;

const renderGrid = async (type) => {
  $('#hero').style.display = 'none';
  $('#infoBlocks').classList.remove('show');
  
  gridState = {
    type,
    genre: 'all',
    year: 'all',
    sort: 'popularity.desc',
    page: 1,
    items: [],
    totalPages: 1
  };
  gridLoading = false;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 1949 }, (_, i) => currentYear - i);
  const azSort = type === 'movie' ? 'original_title.asc' : 'original_name.asc';
  const newestSort = type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc';

  $('#view').innerHTML = `
    <div class="page-head"><h1>${type === 'movie' ? 'Movies' : 'TV Shows'}</h1></div>
    <div class="filters">
      <select id="fGenre"><option value="all">All Genres</option>${ALL_GENRES.map(g => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}</select>
      <select id="fYear"><option value="all">All Years</option>${years.map(y => `<option>${y}</option>`).join('')}</select>
      <select id="fSort">
        <option value="popularity.desc">Sort: Popular</option>
        <option value="vote_average.desc">Top Rated</option>
        <option value="${newestSort}">Newest</option>
        <option value="${azSort}">A–Z</option>
      </select>
    </div>
    <div class="grid" id="grid"><div class="boot">Loading…</div></div>
    <button class="load-more" id="loadMore" style="display:none">Load More</button>`;

  $('#fGenre').onchange = () => { gridState.genre = $('#fGenre').value; resetGrid(); };
  $('#fYear').onchange = () => { gridState.year = $('#fYear').value; resetGrid(); };
  $('#fSort').onchange = () => { gridState.sort = $('#fSort').value; resetGrid(); };
  $('#loadMore').onclick = () => loadGridPage();
  
  resetGrid();
};

const resetGrid = () => {
  gridState.page = 1;
  gridState.items = [];
  gridLoading = false;
  $('#grid').innerHTML = '<div class="boot">Loading…</div>';
  loadGridPage(true);
};

const loadGridPage = async (fresh = false) => {
  if (gridLoading) return;
  gridLoading = true;
  
  try {
    const { type, genre, year, sort, page } = gridState;
    const { items, totalPages } = await api.discover(type, { genre, year, sort, page });
    
    indexItems(items);
    gridState.items = fresh ? items : gridState.items.concat(items);
    gridState.totalPages = totalPages;
    gridState.page = page + 1;
    
    const grid = $('#grid');
    grid.innerHTML = gridState.items.length 
      ? gridState.items.map(cardHTML).join('') 
      : '<div class="empty">No titles match your filters.</div>';
    
    $('#loadMore').style.display = 
      (gridState.page <= totalPages && gridState.items.length) ? 'block' : 'none';
  } catch (err) {
    $('#grid').innerHTML = `<div class="empty">Failed to load: ${esc(err.message)}</div>`;
  } finally {
    gridLoading = false;
  }
};

/* ---------- GENRES / YEARS ---------- */
const renderGenres = async () => {
  $('#hero').style.display = 'none';
  $('#infoBlocks').classList.remove('show');
  $('#view').innerHTML = `<div class="page-head"><h1>Browse by Genre</h1></div><div id="gwrap"><div class="boot">Loading…</div></div>`;
  
  const rows = await Promise.all(ALL_GENRES.slice(0, 10).map(async (g) => {
    try {
      const items = await api.byGenreRow('movie', g.id);
      indexItems(items);
      return rowHTML(g.name, items);
    } catch {
      return '';
    }
  }));
  
  $('#gwrap').innerHTML = rows.join('') || '<div class="empty">No genres.</div>';
};

const renderYears = async () => {
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
};

/* ---------- SEARCH ---------- */
const renderSearch = async (q) => {
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
};

/* ---------- ROUTER ---------- */
const route = (name) => {
  clearInterval(heroTimer);
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
};

/* ---------- DETAIL ---------- */
const openDetail = async (id) => {
  const stub = byId(id);
  if (!stub) return;
  
  clearInterval(heroTimer);
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
    
    episodesHTML = `<div class="eps"><div class="eps-head"><h4>Episodes</h4>
      <select id="seasonSel" data-tmdb="${esc(item.tmdbId)}">${seasonOpts}</select></div>
      <div class="ep-list" id="epList"><div class="boot">Loading episodes…</div></div></div>`;
  }

  const playLabel = item.type === 'series' ? ` S${startSeason}·E1` : '';
  
  $('#detailCard').innerHTML = `
    <button class="detail-close" data-close>&times;</button>
    <div class="detail-hero" style="${item.backdrop ? `background-image:url('${item.backdrop}')` : posterStyle(item)};background-size:cover;background-position:center"><div class="dfade"></div></div>
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
    </div>`;

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

  api.recommendations(item.type, item.tmdbId)
    .then(recs => {
      if (!recs?.length) return;
      indexItems(recs);
      const box = $('#moreLikeThis');
      if (box) {
        box.innerHTML = `<h4 class="mlt-head">More Like This</h4><div class="row-scroll">${recs.map(cardHTML).join('')}</div>`;
      }
    })
    .catch(() => {});
};

const closeDetail = () => {
  $('#detailModal').classList.remove('open');
  if (!$('#playerModal').classList.contains('open')) document.body.style.overflow = '';
  if ($('#hero').style.display !== 'none') restartHeroTimer();
};

/* ---------- TRAILER ---------- */
const openTrailer = (key) => {
  let overlay = $('#trailerModal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'trailerModal';
    overlay.className = 'trailer-modal';
    overlay.innerHTML = `<div class="trailer-box"><button class="trailer-close" data-close-trailer>×</button><div class="trailer-frame"><iframe id="trailerIframe" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></div></div>`;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeTrailer();
    });
    document.body.appendChild(overlay);
  }
  
  $('#trailerIframe').src = `https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
};

const closeTrailer = () => {
  const overlay = $('#trailerModal');
  if (!overlay) return;
  
  const iframe = $('#trailerIframe');
  if (iframe) iframe.src = '';
  
  overlay.classList.remove('open');
  if (!$('#detailModal').classList.contains('open') && !$('#playerModal').classList.contains('open')) {
    document.body.style.overflow = '';
  }
};

/* ---------- PLAYER ---------- */
let hlsInstance = null, PLAYER_CTX = null;
const FRAMED = (() => {
  try { return window.self !== window.top; }
  catch { return true; }
})();

const videoEl = () => $('#videoEl');
const embedEl = () => $('#embedEl');

const destroyHls = () => {
  if (hlsInstance) {
    try { hlsInstance.destroy(); }
    catch {}
    hlsInstance = null;
  }
};

const PROBE_TIMEOUT_MS = 4500;
const PROBE_CACHE_TTL_MS = 10 * 60 * 1000;
const probeCache = {};

const probeSource = (src, parentSignal) => {
  if (src.type === 'embed') return Promise.resolve(true);
  
  const cached = probeCache[src.url];
  if (cached && (Date.now() - cached.ts) < PROBE_CACHE_TTL_MS) {
    return Promise.resolve(cached.ok);
  }
  
  return new Promise(resolve => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    
    if (parentSignal) {
      parentSignal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    
    fetch(src.url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal, redirect: 'follow' })
      .then(() => {
        clearTimeout(timer);
        probeCache[src.url] = { ok: true, ts: Date.now() };
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        if (!parentSignal?.aborted) {
          probeCache[src.url] = { ok: false, ts: Date.now() };
        }
        resolve(false);
      });
  });
};

const sourceTag = (s) => s.type === 'embed' ? 'embed' : s.type === 'hls' ? 'HLS' : 'MP4';
const sourceLabel = (s) => s.label || s.url;

/* ---------- Server bar ---------- */
const renderServerBar = (sources, activeIdx) => {
  const bar = $('#serverBar');
  if (!bar) return;
  
  bar.innerHTML = sources.map((s, i) => {
    const cached = probeCache[s.url];
    const checked = cached && (Date.now() - cached.ts) < PROBE_CACHE_TTL_MS;
    const reachable = !checked || cached.ok || s.type === 'embed';
    
    const statusDot = s.type === 'embed' 
      ? '' 
      : checked 
        ? (cached.ok ? '<span class="srv-dot srv-ok"></span>' : '<span class="srv-dot srv-bad"></span>')
        : '<span class="srv-dot srv-pending"></span>';
    
    return `<button class="srv-btn${i === activeIdx ? ' active' : ''}${!reachable ? ' srv-unreachable' : ''}" data-srv="${i}" title="${esc(s.url)}">${statusDot}<span class="srv-name">${esc(sourceLabel(s))}</span><span class="srv-tag">${sourceTag(s)}</span></button>`;
  }).join('');

  $$('.srv-btn', bar).forEach(btn => {
    btn.onclick = () => {
      if (!PLAYER_CTX) return;
      const idx = +btn.dataset.srv;
      PLAYER_CTX.userChoseSource = true;
      
      const sel = $('#sourceSel');
      if (sel) sel.value = String(idx);
      
      setActiveServer(idx);
      loadSource(PLAYER_CTX.sources[idx]);
    };
  });
};

const setActiveServer = (idx) => {
  $$('.srv-btn', $('#serverBar')).forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });
};

const updateServerDot = (idx, ok) => {
  const btn = $('#serverBar')?.querySelector(`[data-srv="${idx}"]`);
  if (!btn) return;
  
  const dot = btn.querySelector('.srv-dot');
  if (!dot) return;
  
  dot.className = ok ? 'srv-dot srv-ok' : 'srv-dot srv-bad';
  dot.title = ok ? 'Reachable' : 'Unreachable';
  btn.classList.toggle('srv-unreachable', !ok);
};

/* ---------- CSS injection ---------- */
(() => {
  if (document.getElementById('srv-bar-style')) return;
  
  const style = document.createElement('style');
  style.id = 'srv-bar-style';
  style.textContent = `
    #serverBar { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 6px; background: rgba(0,0,0,0.55); border-bottom: 1px solid rgba(255,255,255,0.07); }
    .srv-bar-label { width: 100%; font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: rgba(255,255,255,0.4); margin-bottom: 2px; }
    .srv-btn { display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.75); font-size: 12px; font-family: inherit; cursor: pointer; transition: background 0.15s, border-color 0.15s, color 0.15s; white-space: nowrap; }
    .srv-btn:hover { background: rgba(255,255,255,0.13); border-color: rgba(255,255,255,0.3); color: #fff; }
    .srv-btn.active { background: var(--accent, #e50914); border-color: var(--accent, #e50914); color: #fff; font-weight: 600; }
    .srv-btn.srv-unreachable { opacity: 0.45; }
    .srv-btn.srv-unreachable:not(.active) { text-decoration: line-through; }
    .srv-name { max-width: 110px; overflow: hidden; text-overflow: ellipsis; }
    .srv-tag { font-size: 9px; text-transform: uppercase; letter-spacing: .06em; opacity: 0.55; border: 1px solid currentColor; border-radius: 3px; padding: 1px 4px; flex-shrink: 0; }
    .srv-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
    .srv-ok { background: #4caf50; }
    .srv-bad { background: #f44336; }
    .srv-pending { background: #ff9800; animation: srv-pulse 1s infinite; }
    @keyframes srv-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
  `;
  document.head.appendChild(style);
})();

/* ---------- openPlayer ---------- */
const openPlayer = (id, season, episode) => {
  const item = byId(id);
  if (!item) return;
  
  pushHistory(item);
  clearInterval(heroTimer);
  
  if (PLAYER_CTX?.probeAbort) PLAYER_CTX.probeAbort.abort();

  const trackId = (season && episode) ? `${id}-S${season}E${episode}` : id;
  PLAYER_CTX = {
    item,
    season: season ? +season : null,
    episode: episode ? +episode : null,
    trackId,
    userChoseSource: false,
    probeAbort: new AbortController()
  };

  const epTxt = (season && episode) 
    ? ` · S${season}·E${episode}` 
    : (item.type === 'series' ? ` · S${defaultSeason(item.tmdbId)}·E1` : '');
  
  $('#playerTitle').textContent = item.title + epTxt;

  const sources = resolveSources(item, PLAYER_CTX.season, PLAYER_CTX.episode);
  PLAYER_CTX.sources = sources;

  const sel = $('#sourceSel');
  if (sel) {
    sel.innerHTML = sources.map((s, i) => `<option value="${i}">${esc(sourceLabel(s))}</option>`).join('');
    sel.onchange = () => {
      PLAYER_CTX.userChoseSource = true;
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
  
  if (FRAMED) {
    const demoIdx = sources.findIndex(s => s.type !== 'embed' && isPlayable(s));
    if (demoIdx !== -1) defaultIdx = demoIdx;
  }

  renderServerBar(sources, defaultIdx);
  if (sel) sel.value = String(defaultIdx);
  loadSource(sources[defaultIdx]);

  sources.forEach((src, i) => {
    if (src.type === 'embed') return;
    
    probeSource(src, PLAYER_CTX.probeAbort.signal).then(ok => {
      if (!PLAYER_CTX || PLAYER_CTX.sources !== sources) return;
      updateServerDot(i, ok);
      
      const activeBtn = $('#serverBar')?.querySelector('.srv-btn.active');
      const activeIdx = activeBtn ? +activeBtn.dataset.srv : defaultIdx;
      
      if (!ok && activeIdx === i && !PLAYER_CTX.userChoseSource) {
        const nextBtn = Array.from($$('#serverBar .srv-btn')).find(
          b => !b.classList.contains('srv-unreachable') && +b.dataset.srv !== i
        );
        
        if (nextBtn) {
          const nextIdx = +nextBtn.dataset.srv;
          if (sel) sel.value = String(nextIdx);
          setActiveServer(nextIdx);
          loadSource(sources[nextIdx]);
        } else {
          $('#playerNote').innerHTML = `⚠️ No reachable servers for <strong>${esc(item.title)}</strong>. This title may not be indexed by any of the public embed providers.`;
        }
      }
    });
  });
};

const loadSource = (src) => {
  const video = videoEl();
  const embed = embedEl();
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
    
    note.innerHTML = (FRAMED 
      ? `⚠️ <strong>${esc(src.label)}</strong> server is blocked inside this sandboxed preview. ` 
      : `Playing via <strong>${esc(src.label)}</strong> server. If it doesn't load, `
    ) + `<a href="${src.url}" target="_blank" rel="noopener">open this server in a new tab ↗</a> or try another server above.`;
    return;
  }
  
  embed.style.display = 'none';
  embed.removeAttribute('src');
  video.style.display = 'block';
  controls.style.display = '';
  note.textContent = src.type === 'hls' ? 'Adaptive HLS stream (hls.js).' : 'Direct MP4 source.';
  
  video.playbackRate = parseFloat($('#speedSel').value) || 1;
  
  video.onloadedmetadata = () => {
    const savedTime = getProgress()[PLAYER_CTX.trackId];
    if (savedTime && savedTime > 5 && savedTime < (video.duration - 30)) {
      video.currentTime = savedTime;
      note.innerHTML = `${src.type === 'hls' ? 'Adaptive HLS stream.' : 'Direct MP4 source.'} <span style="color:var(--gold);font-weight:bold;">↻ Resumed from ${formatTime(savedTime)}</span>`;
    }
  };
  
  if (src.type === 'hls') {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src.url;
    } else if (window.Hls && Hls.isSupported()) {
      hlsInstance = new Hls({ enableWorker: true });
      hlsInstance.loadSource(src.url);
      hlsInstance.attachMedia(video);
      hlsInstance.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          note.textContent = 'HLS error: ' + data.type + ' — try another server above.';
        }
      });
    } else {
      video.src = src.url;
    }
  } else {
    video.src = src.url;
  }
  
  video.play()
    .then(() => $('#btnPlay').textContent = '❚❚')
    .catch(() => $('#btnPlay').textContent = '▶');
};

const closePlayer = () => {
  const video = videoEl();
  const embed = embedEl();
  
  if (PLAYER_CTX?.probeAbort) PLAYER_CTX.probeAbort.abort();
  
  if (PLAYER_CTX?.trackId && !isNaN(video.currentTime) && video.currentTime > 5) {
    saveProgress(PLAYER_CTX.trackId, video.currentTime);
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
};

const formatTime = (t) => {
  if (isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

const bindPlayer = () => {
  const video = videoEl();
  
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
    $('#btnMute').textContent = video.volume == 0 ? '🔇' : '🔊';
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
    $('#progressFilled').style.width = (video.currentTime / (video.duration || 1) * 100) + '%';
    $('#timeLabel').textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
    
    if (PLAYER_CTX?.trackId && video.currentTime > 5) {
      const now = Date.now();
      if (now - lastSave > 5000) {
        saveProgress(PLAYER_CTX.trackId, video.currentTime);
        lastSave = now;
      }
    }
  };
  
  video.onpause = () => {
    if (PLAYER_CTX?.trackId && video.currentTime > 5) {
      saveProgress(PLAYER_CTX.trackId, video.currentTime);
    }
  };
  
  video.onended = () => {
    $('#btnPlay').textContent = '▶';
    if (PLAYER_CTX?.trackId) clearProgress(PLAYER_CTX.trackId);
  };
  
  $('#progress').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    video.currentTime = ((e.clientX - rect.left) / rect.width) * (video.duration || 0);
  };
};

/* ---------- Event delegation ---------- */
document.addEventListener('click', (e) => {
  const removeBtn = e.target.closest('[data-remove]');
  if (removeBtn) {
    e.preventDefault();
    const remaining = removeHistory(removeBtn.dataset.remove);
    removeBtn.closest('.card')?.remove();
    if (!remaining.length) $('#cwRow')?.remove();
    return;
  }

  const bookmarkBtn = e.target.closest('[data-bookmark]');
  if (bookmarkBtn) {
    e.preventDefault();
    const item = byId(bookmarkBtn.dataset.bookmark);
    const nowIn = toggleList(item);
    
    bookmarkBtn.classList.toggle('active', nowIn);
    bookmarkBtn.textContent = bookmarkBtn.classList.contains('btn-list') 
      ? (nowIn ? '✓ In My List' : '+ My List') 
      : (nowIn ? '✓' : '+');
    bookmarkBtn.title = nowIn ? 'Remove from My List' : 'Add to My List';
    
    if (!nowIn) {
      const row = bookmarkBtn.closest('#myListRow');
      if (row) {
        bookmarkBtn.closest('.card')?.remove();
        if (!getList().length) row.remove();
      }
    }
    return;
  }

  if (e.target.closest('[data-clear-history]')) {
    e.preventDefault();
    storage.set(STORE.history.key, []);
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
  
  const trendItem = e.target.closest('.trend-item[data-id]');
  if (trendItem) {
    openDetail(trendItem.dataset.id);
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
  
  const video = videoEl();
  
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
let searchTimer = null;

$('#searchInput').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  const query = e.target.value.trim();
  
  searchTimer = setTimeout(() => {
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

/* ---------- INIT ---------- */
(async () => {
  $('#year').textContent = new Date().getFullYear();
  bindPlayer();
  
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
          Check console for details. Make sure:<br>
          • TMDB API key is valid in config.js<br>
          • Internet connection is working<br>
          • CORS isn't blocking requests
        </p>
        <button onclick="location.reload()" style="margin-top:20px;background:var(--accent);color:#fff;border:none;padding:12px 30px;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;">Retry</button>
      </div>
    `;
  }
})();
