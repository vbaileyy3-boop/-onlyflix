if (embed) { embed.src = ''; embed.style.display = 'none'; }
  if (video) video.style.display = 'block';
  if (controls) controls.style.display = 'flex';
  if (note) note.innerHTML = `Playing direct stream: <strong>${esc(src.label || 'Direct Source')}</strong>`;

  const savedProgress = state.progress[state.player?.id] || 0;

  // Track and process playback stream formats
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
      // Native HLS fallback logic (e.g., Apple Safari)
      video.src = src.url;
      video.addEventListener('loadedmetadata', () => {
        if (savedProgress) video.currentTime = savedProgress;
        video.play().catch(err => console.warn('[Player] Native autoplay blocked:', err));
      }, { once: true });
    } else {
      if (note) note.innerHTML = `<span class="text-red-400">HLS playback streams are not natively supported in this browser.</span>`;
    }
  } else {
    // Standard direct multimedia container pathways (MP4/WebM)
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

/* ---------- Stream Fallback Routing Engine ---------- */
function handlePlayerError() {
  if (!state.player) return;
  
  const nextIdx = state.player.activeIdx + 1;
  if (nextIdx < state.player.sources.length) {
    console.warn(`[Player] Current mirror failed. Automatically shifting to stream layer index: ${nextIdx}`);
    state.player.activeIdx = nextIdx;
    loadSource(state.player.sources[nextIdx]);
    renderServerBar(state.player.sources, nextIdx);
  } else {
    const note = $('#playerNote');
    if (note) note.innerHTML = `<span class="text-red-400">All direct content streams failed. Please switch servers manually using the options layout.</span>`;
  }
}

/* ---------- Player Lifecycle Modules ---------- */
export async function openPlayer(id, season, episode) {
  const item = byId(id);
  if (!item) return;

  clearInterval(state.heroTimer);
  document.body.style.overflow = 'hidden';

  const modal = $('#playerModal');
  if (modal) modal.classList.remove('hidden');

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

  // Instantly map initial server availability array map
  renderServerBar(sources, 0);
  loadSource(sources[0]);

  // Execute non-blocking trace calls asynchronously to balance connection status lights
  sources.forEach(async (src, index) => {
    await probeSource(src);
    if (state.player && state.player.id === item.id) {
      renderServerBar(state.player.sources, state.player.activeIdx);
    }
  });
}

function closePlayer() {
  const modal = $('#playerModal');
  if (modal) modal.classList.add('hidden');

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

/* ---------- Progressive UI Controls ---------- */
function initPlayerControls() {
  const video = $('#videoEl');
  if (!video) return;

  video.ontimeupdate = () => {
    if (!state.player) return;
    const cur = video.currentTime;
    const dur = video.duration;

    if (cur > 5 && dur > 0) {
      saveProgress(state.player.id, cur);

      const bar = $('#videoProgressBar');
      if (bar) bar.style.width = `${(cur / dur) * 100}%`;

      const clock = $('#videoTimeDisplay');
      if (clock) clock.textContent = `${formatTime(cur)} / ${formatTime(dur)}`;
    }
  };

  video.onended = () => {
    if (!state.player) return;
    clearProgress(state.player.id);
    console.log('[Player] Target layout reached end of file bounds.');
  };
}

/* ---------- Global Action Event Bus ---------- */
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

      bookmarkBtn.textContent = added ? '✓ In Watchlist' : '+ Watchlist';
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

  // Debounced execution matching inputs for query text updates
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
}

/* ---------- Module Orchestration Initialization ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  window.currentRoute = 'home';
  try {
    await loadGenres();
  } catch (err) {
    console.error('[CINEMAX] Initialization genre map synchronization error:', err);
  }
  initGlobalListeners();
  initPlayerControls();
  route('home');
});
