/* ============================================================
   app.js — OnlyFlix UI (TMDB live) + multi-format player (FIXED v6)
   ============================================================
   Changes vs v2:
   - openDetail: "Play S1·E1" button now passes the correct starting
     season from SEASON_DEFAULTS (config.js) instead of always S1.
   - openDetail: seasonSel now pre-selects the SEASON_DEFAULTS season
     so the episode list loads the right season on first open.
   - Both fixes share the same helper: defaultSeasonFor(tmdbId).
   ============================================================ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

/* in-memory index so byId() works for anything we've rendered */
const INDEX = {};
function indexItems(arr){ (arr||[]).forEach(it=>{ if(it&&it.id) INDEX[it.id]=it; }); return arr; }
function byId(id){ return INDEX[id]; }

/* ---- helper: look up SEASON_DEFAULTS from config.js ---- */
function defaultSeasonFor(tmdbId){
  return (typeof SEASON_DEFAULTS !== "undefined" && SEASON_DEFAULTS[tmdbId])
    ? SEASON_DEFAULTS[tmdbId]
    : 1;
}

/* ---------- watch history ---------- */
const HKEY="onlyflix_history";
const getHistory=()=>{try{return JSON.parse(localStorage.getItem(HKEY)||"[]")}catch(e){return[]}};
function pushHistory(it){
  let h=getHistory().filter(x=>x.id!==it.id);
  h.unshift({id:it.id,type:it.type,tmdbId:it.tmdbId,title:it.title,poster:it.poster,backdrop:it.backdrop,year:it.year,rating:it.rating,genres:it.genres||[],overview:it.overview});
  h=h.slice(0,18);
  try{ localStorage.setItem(HKEY,JSON.stringify(h)); }catch(e){ console.error("History write blocked",e); }
}
function removeHistory(id){
  const h=getHistory().filter(x=>x.id!==id);
  try{ localStorage.setItem(HKEY,JSON.stringify(h)); }catch(e){ console.error("History write blocked",e); }
  return h;
}

/* ---------- My List (watchlist) ---------- */
const LKEY="onlyflix_mylist";
const getList=()=>{try{return JSON.parse(localStorage.getItem(LKEY)||"[]")}catch(e){return[]}};
const inList=id=>getList().some(x=>x.id===id);
function toggleList(it){
  if(!it) return false;
  let l=getList();
  if(l.some(x=>x.id===it.id)){ l=l.filter(x=>x.id!==it.id); }
  else { l.unshift({id:it.id,type:it.type,tmdbId:it.tmdbId,title:it.title,poster:it.poster,backdrop:it.backdrop,year:it.year,rating:it.rating,genres:it.genres||[],overview:it.overview}); l=l.slice(0,60); }
  try{ localStorage.setItem(LKEY,JSON.stringify(l)); }catch(e){ console.error("List write blocked",e); }
  return l.some(x=>x.id===it.id);
}

/* ---------- playback progress memory ---------- */
const PKEY = "onlyflix_progress";
const getProgress  = () => { try { return JSON.parse(localStorage.getItem(PKEY)||"{}") } catch(e) { return {} } };
const saveProgress = (id,time) => { try { const p=getProgress(); p[id]=time; localStorage.setItem(PKEY,JSON.stringify(p)); } catch(e) {} };
const clearProgress= (id)      => { try { const p=getProgress(); delete p[id]; localStorage.setItem(PKEY,JSON.stringify(p)); } catch(e) {} };

/* ---------- XSS helper ---------- */
function escapeHTML(str){
  return String(str ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
const h = escapeHTML;

/* ---------- card / row render ---------- */
function posterBg(it){ return it.poster ? `background-image:url('${it.poster}')` : `background:#1a1a24`; }

function cardHTML(it){
  indexItems([it]);
  const genre = it.genres && it.genres[0] ? ' · ' + h(it.genres[0]) : '';
  const saved = inList(it.id);
  return `<div class="card" data-id="${h(it.id)}">
    <div class="poster" style="${posterBg(it)}">
      <span class="badge-type">${it.type==='series'?'TV':'Movie'}</span>
      ${it.rating?`<span class="badge-rating">★ ${it.rating}</span>`:''}
      <button class="bm-btn${saved?' active':''}" data-bookmark="${h(it.id)}" title="${saved?'Remove from My List':'Add to My List'}" aria-label="My List">${saved?'✓':'+'}</button>
      <div class="play-ico"><div>▶</div></div>
    </div>
    <div class="card-sub">${h(it.title)}</div>
    <div class="card-sub2">${it.year||''}${genre}</div>
  </div>`;
}

function rowHTML(title,items,route){
  if(!items || !items.length) return "";
  return `<div class="row">
    <div class="row-head"><h2>${h(title)}</h2>${route?`<span class="more" data-route="${h(route)}">View all →</span>`:''}</div>
    <div class="row-scroll">${items.map(cardHTML).join("")}</div>
  </div>`;
}

/* ---- Continue Watching row: cards carry a remove (×) button ---- */
function continueCardHTML(it){
  indexItems([it]);
  const genre = it.genres && it.genres[0] ? ' · ' + h(it.genres[0]) : '';
  return `<div class="card cw-card" data-id="${h(it.id)}">
    <div class="poster" style="${posterBg(it)}">
      <span class="badge-type">${it.type==='series'?'TV':'Movie'}</span>
      ${it.rating?`<span class="badge-rating">★ ${it.rating}</span>`:''}
      <button class="cw-remove" data-remove="${h(it.id)}" title="Remove from Continue Watching" aria-label="Remove">×</button>
      <div class="play-ico"><div>▶</div></div>
    </div>
    <div class="card-sub">${h(it.title)}</div>
    <div class="card-sub2">${it.year||''}${genre}</div>
  </div>`;
}
function continueRowHTML(items){
  if(!items || !items.length) return "";
  return `<div class="row" id="cwRow">
    <div class="row-head"><h2>Continue Watching</h2><span class="more cw-clear" data-clear-history>Clear all</span></div>
    <div class="row-scroll">${items.map(continueCardHTML).join("")}</div>
  </div>`;
}

/* ---- My List row ---- */
function myListRowHTML(items){
  if(!items || !items.length) return "";
  return `<div class="row" id="myListRow">
    <div class="row-head"><h2>My List</h2></div>
    <div class="row-scroll">${items.map(cardHTML).join("")}</div>
  </div>`;
}

/* ---------- HERO ---------- */
let heroItems=[], heroIdx=0, heroTimer=null;
function setHero(i){
  heroIdx=i; const it=heroItems[i]; if(!it) return; indexItems([it]);
  $("#heroBg").style.cssText=(it.backdrop?`background-image:url('${it.backdrop}')`:posterBg(it))+";background-size:cover;background-position:center top;";
  $("#heroContent").innerHTML=`
    <span class="hero-badge">${it.type==='series'?'Featured Series':'Featured Movie'}</span>
    <h1 class="hero-title">${h(it.title)}</h1>
    <div class="hero-meta">
      ${it.rating?`<span class="rating">★ ${it.rating}</span>`:''}
      ${it.year?`<span>${it.year}</span>`:''}
      <span class="genres">${h((it.genres||[]).slice(0,3).join(", "))}</span>
    </div>
    <p class="hero-overview">${h((it.overview||'').slice(0,210))}${(it.overview||'').length>210?'…':''}</p>
    <div class="hero-actions">
      <button class="btn btn-play" data-play="${h(it.id)}">▶ Play</button>
      <button class="btn btn-info" data-detail="${h(it.id)}">ⓘ More Info</button>
    </div>`;
  $$("#heroDots span").forEach((s,k)=>s.classList.toggle("active",k===i));
}
function restartHeroTimer(){
  clearInterval(heroTimer);
  if(!heroItems.length) return;
  heroTimer=setInterval(()=>setHero((heroIdx+1)%heroItems.length),6500);
}

async function initHero(trendData){
  heroItems=(trendData||[]).filter(x=>x.backdrop&&x.overview).slice(0,6);
  $("#heroDots").innerHTML=heroItems.map((_,i)=>`<span data-i="${i}"></span>`).join("");
  $$("#heroDots span").forEach(s=>s.onclick=()=>{setHero(+s.dataset.i);restartHeroTimer();});
  if(heroItems.length) setHero(0);
  restartHeroTimer();
}

/* ---------- TRENDING board ---------- */
const PERIOD = {
  "24h": { movie: ()=>api.trendingMoviesDay(), series: ()=>api.trendingTVDay() },
  "7d":  { movie: ()=>api.trendingMovies(),    series: ()=>api.trendingTV()    },
  "30d": { movie: ()=>api.popularMovies(),     series: ()=>api.popularTV()     },
};
function viewsLabel(it){
  const v=Math.round((it.votes||it.rating*100||50)*(0.6+(it.rating||5)/10));
  return v>=1000?(v/1000).toFixed(1)+"K":v;
}
function trendListHTML(items){
  return (items||[]).slice(0,8).map((it,i)=>{
    indexItems([it]);
    return `
    <li class="trend-item" data-id="${h(it.id)}">
      <span class="trend-rank">${String(i+1).padStart(2,'0')}</span>
      <div class="trend-thumb" style="${posterBg(it)}"></div>
      <div class="trend-info"><div class="t">${h(it.title)}</div><div class="v">★ ${it.rating} · ${viewsLabel(it)} views</div></div>
    </li>`;
  }).join("");
}
async function buildTrending(){
  const settled=await Promise.allSettled([PERIOD["24h"].movie(),PERIOD["24h"].series()]);
  const [m,t]=settled.map(r=>r.status==="fulfilled"?r.value:[]);
  return `<div class="trending">
    <h2>Trending on OnlyFlix</h2>
    <p class="sub">Internal popularity based on OnlyFlix views during the selected period.</p>
    <div class="trend-cols">
      <div class="trend-col" data-type="movie"><h3>Top Movies</h3>
        <div class="period-tabs"><button data-p="24h" class="active">24h</button><button data-p="7d">7d</button><button data-p="30d">30d</button></div>
        <ul class="trend-list">${trendListHTML(m)}</ul></div>
      <div class="trend-col" data-type="series"><h3>Top TV Shows</h3>
        <div class="period-tabs"><button data-p="24h" class="active">24h</button><button data-p="7d">7d</button><button data-p="30d">30d</button></div>
        <ul class="trend-list">${trendListHTML(t)}</ul></div>
    </div></div>`;
}
function bindTrending(){
  $$(".trend-col").forEach(col=>{
    const type=col.dataset.type;
    $$(".period-tabs button",col).forEach(b=>b.onclick=async()=>{
      $$(".period-tabs button",col).forEach(x=>x.classList.remove("active"));
      b.classList.add("active");
      const list=$(".trend-list",col);
      list.innerHTML='<li class="trend-skel">Loading…</li>';
      try{
        const items=await PERIOD[b.dataset.p][type]();
        list.innerHTML=trendListHTML(indexItems(items));
      }catch(e){
        console.error("[bindTrending] failed",e);
        list.innerHTML='<li class="empty">Failed to load.</li>';
      }
    });
  });
}

/* ---------- HOME ---------- */
async function renderHome(){
  $("#hero").style.display="flex"; $("#infoBlocks").classList.add("show");
  $("#view").innerHTML='<div class="boot">Loading…</div>';

  const settled=await Promise.allSettled([
    api.trendingAll(), api.nowPlaying(), api.topMovies(), api.popularTV(), api.topTV()
  ]);
  const [trend,nowp,topm,popt,topt]=settled.map(r=>r.status==="fulfilled"?r.value:[]);
  [trend,nowp,topm,popt,topt].forEach(indexItems);

  await initHero(trend);

  const hist=getHistory(); hist.forEach(hh=>INDEX[hh.id]=hh);
  const mylist=getList(); mylist.forEach(m=>INDEX[m.id]=m);
  let html="";
  if(hist.length) html+=continueRowHTML(hist);
  if(mylist.length) html+=myListRowHTML(mylist);
  html+=rowHTML("Trending Now",trend,'movie');
  html+=rowHTML("Now Playing in Theaters",nowp,'movie');
  html+=rowHTML("Top Rated Movies",topm,'movie');
  html+=rowHTML("Popular TV Shows",popt,'series');
  html+=rowHTML("Top Rated TV Shows",topt,'series');

  try{ html+=await buildTrending(); }
  catch(e){ console.error("[renderHome] buildTrending failed",e); }

  $("#view").innerHTML=html;
  bindTrending();
  restartHeroTimer();
}

/* ---------- GRID (Movies / TV) ---------- */
let gridState={};
let gridLoading=false;

async function renderGrid(type){
  $("#hero").style.display="none"; $("#infoBlocks").classList.remove("show");
  gridState={type,genre:"all",year:"all",sort:"popularity.desc",page:1,items:[],totalPages:1};
  gridLoading=false;
  const years=[]; for(let y=new Date().getFullYear();y>=1950;y--) years.push(y);

  const azSort = type==='movie' ? 'original_title.asc' : 'original_name.asc';
  const newestSort = type==='movie' ? 'primary_release_date.desc' : 'first_air_date.desc';

  $("#view").innerHTML=`
    <div class="page-head"><h1>${type==='movie'?'Movies':'TV Shows'}</h1></div>
    <div class="filters">
      <select id="fGenre"><option value="all">All Genres</option>${ALL_GENRES.map(g=>`<option value="${h(g.id)}">${h(g.name)}</option>`).join("")}</select>
      <select id="fYear"><option value="all">All Years</option>${years.map(y=>`<option>${y}</option>`).join("")}</select>
      <select id="fSort">
        <option value="popularity.desc">Sort: Popular</option>
        <option value="vote_average.desc">Top Rated</option>
        <option value="${newestSort}">Newest</option>
        <option value="${azSort}">A–Z</option>
      </select>
    </div>
    <div class="grid" id="grid"><div class="boot">Loading…</div></div>
    <button class="load-more" id="loadMore" style="display:none">Load More</button>`;

  $("#fGenre").onchange=e=>{gridState.genre=e.target.value;resetGrid();};
  $("#fYear").onchange =e=>{gridState.year =e.target.value;resetGrid();};
  $("#fSort").onchange =e=>{gridState.sort =e.target.value;resetGrid();};
  $("#loadMore").onclick=()=>loadGridPage();
  resetGrid();
}
function resetGrid(){
  gridState.page=1; gridState.items=[]; gridLoading=false;
  $("#grid").innerHTML='<div class="boot">Loading…</div>';
  loadGridPage(true);
}
async function loadGridPage(fresh=false){
  if(gridLoading) return;
  gridLoading=true;
  try{
    const {type,genre,year,sort,page}=gridState;
    const {items,totalPages}=await api.discover(type,{genre,year,sort,page});
    indexItems(items);
    gridState.items=fresh?items:gridState.items.concat(items);
    gridState.totalPages=totalPages; gridState.page=page+1;
    const g=$("#grid");
    g.innerHTML=gridState.items.length?gridState.items.map(cardHTML).join(""):'<div class="empty">No titles match your filters.</div>';
    $("#loadMore").style.display=(gridState.page<=totalPages && gridState.items.length)?"block":"none";
  }catch(e){
    console.error("[loadGridPage] failed",e);
    $("#grid").innerHTML=`<div class="empty">Failed to load: ${h(e.message)}</div>`;
  }finally{
    gridLoading=false;
  }
}

/* ---------- GENRES ---------- */
async function renderGenres(){
  $("#hero").style.display="none"; $("#infoBlocks").classList.remove("show");
  $("#view").innerHTML=`<div class="page-head"><h1>Browse by Genre</h1></div><div id="gwrap"><div class="boot">Loading…</div></div>`;
  const picks=ALL_GENRES.slice(0,10);
  const rows=await Promise.all(picks.map(async g=>{
    try{
      const items=await api.byGenreRow("movie",g.id); indexItems(items);
      return rowHTML(g.name,items);
    }catch(e){ console.error("[renderGenres] genre",g.name,e); return ""; }
  }));
  $("#gwrap").innerHTML=rows.join("")||'<div class="empty">No genres.</div>';
}

/* ---------- YEARS ---------- */
async function renderYears(){
  $("#hero").style.display="none"; $("#infoBlocks").classList.remove("show");
  const years=[]; for(let y=new Date().getFullYear();y>=new Date().getFullYear()-9;y--) years.push(y);
  $("#view").innerHTML=`<div class="page-head"><h1>Browse by Year</h1></div><div id="ywrap"><div class="boot">Loading…</div></div>`;
  const rows=await Promise.all(years.map(async y=>{
    try{
      const {items}=await api.discover("movie",{year:y,sort:"popularity.desc",page:1}); indexItems(items);
      return rowHTML(`${y}`,items.slice(0,16));
    }catch(e){ console.error("[renderYears] year",y,e); return ""; }
  }));
  $("#ywrap").innerHTML=rows.join("");
}

/* ---------- SEARCH ---------- */
async function renderSearch(q){
  $("#hero").style.display="none"; $("#infoBlocks").classList.remove("show");
  const safeQ=h(q);
  $("#view").innerHTML=`<div class="page-head"><h1>Search: "${safeQ}"</h1></div><div class="grid" id="sgrid"><div class="boot">Searching…</div></div>`;
  try{
    const items=await api.search(q); indexItems(items);
    $("#sgrid").innerHTML=items.length?items.map(cardHTML).join(""):`<div class="empty">No results for "${safeQ}".</div>`;
  }catch(e){
    console.error("[renderSearch] failed",e);
    $("#sgrid").innerHTML=`<div class="empty">Search failed: ${h(e.message)}</div>`;
  }
}

/* ---------- ROUTER ---------- */
function route(name){
  clearInterval(heroTimer);
  $$(".main-nav a").forEach(a=>a.classList.toggle("active",a.dataset.route===name));
  window.scrollTo({top:0});
  if(name==="home")        renderHome();
  else if(name==="movie")  renderGrid("movie");
  else if(name==="series") renderGrid("series");
  else if(name==="genres") renderGenres();
  else if(name==="years")  renderYears();
}

/* ---------- DETAIL ---------- */
async function openDetail(id){
  const stub=byId(id); if(!stub) return;
  clearInterval(heroTimer);
  $("#detailCard").innerHTML=`<button class="detail-close" data-close>&times;</button><div class="boot" style="padding:80px">Loading…</div>`;
  $("#detailModal").classList.add("open"); document.body.style.overflow="hidden";

  let it; try{ it=await api.details(stub.type,stub.tmdbId); }catch(e){ console.error("[openDetail] fallback to stub",e); it=stub; }
  indexItems([it]);

  // FIX v3: use SEASON_DEFAULTS to pick the correct starting season for
  // the dropdown and the "Play S1·E1" button label/data attributes.
  const startSeason = defaultSeasonFor(it.tmdbId);

  let eps="";
  if(it.type==="series" && it.seasons && it.seasons.length){
    const seasonOpts=it.seasons.map(s=>`<option value="${s.season_number}"${s.season_number===startSeason?' selected':''}>Season ${s.season_number}</option>`).join("");
    eps=`<div class="eps"><div class="eps-head"><h4>Episodes</h4>
      <select id="seasonSel" data-tmdb="${h(it.tmdbId)}">${seasonOpts}</select></div>
      <div class="ep-list" id="epList"><div class="boot">Loading episodes…</div></div></div>`;
  }

  // "Play" button: pass startSeason so resolveSources gets the right season
  // even before the user interacts with the episode list.
  const playLabel = it.type==='series' ? ` S${startSeason}·E1` : '';
  $("#detailCard").innerHTML=`
    <button class="detail-close" data-close>&times;</button>
    <div class="detail-hero" style="${it.backdrop?`background-image:url('${it.backdrop}')`:posterBg(it)};background-size:cover;background-position:center"><div class="dfade"></div></div>
    <div class="detail-body">
      <h2>${h(it.title)}</h2>
      ${it.tagline?`<p class="tagline">${h(it.tagline)}</p>`:''}
      <div class="detail-meta">
        ${it.rating?`<span class="rating">★ ${it.rating}</span>`:''}
        ${it.year?`<span>${it.year}</span>`:''}
        ${it.runtime?`<span>${it.runtime} min</span>`:(it.latest?`<span>${h(it.latest)}</span>`:'')}
        <span class="tag">${it.type==='series'?'TV Series':'Movie'}</span>
        ${(it.genres||[]).map(g=>`<span class="tag">${h(g)}</span>`).join("")}
      </div>
      <p class="ov">${h(it.overview||'')}</p>
      ${it.cast && it.cast.length ? `<p class="cast"><strong>Cast:</strong> ${h(it.cast.join(", "))}</p>` : ''}
      <div class="detail-actions">
        <button class="btn btn-play" data-play="${h(it.id)}" data-s="${startSeason}" data-e="1">▶ Play${playLabel}</button>
        ${it.trailerKey?`<button class="btn btn-trailer" data-trailer="${h(it.trailerKey)}">▶ Trailer</button>`:''}
        <button class="btn btn-list${inList(it.id)?' active':''}" data-bookmark="${h(it.id)}">${inList(it.id)?'✓ In My List':'+ My List'}</button>
        <button class="btn btn-info" data-close>Close</button>
      </div>
      ${eps}
      <div id="moreLikeThis" class="mlt"></div>
    </div>`;

  if(it.type==="series" && it.seasons && it.seasons.length){
    const sel=$("#seasonSel");
    const load=async()=>{
      $("#epList").innerHTML='<div class="boot">Loading episodes…</div>';
      try{
        const list=await api.season(it.tmdbId,sel.value);
        $("#epList").innerHTML=list.map(ep=>`
          <div class="ep" data-play="${h(it.id)}" data-s="${sel.value}" data-e="${ep.episode_number}">
            <span class="epn">S${sel.value}·E${ep.episode_number}</span>
            <span class="ept">${h(ep.name||('Episode '+ep.episode_number))}</span>
            ${ep.vote_average?`<span class="epr">★ ${ep.vote_average.toFixed(1)}</span>`:''}
            <span class="epp">▶</span>
          </div>`).join("")||'<div class="empty">No episodes.</div>';
      }catch(e){
        console.error("[openDetail] season load failed",e);
        $("#epList").innerHTML=`<div class="empty">Failed to load episodes.</div>`;
      }
    };
    sel.onchange=load; load();
  }

  // More Like This (TMDB recommendations) — non-blocking
  api.recommendations(it.type, it.tmdbId).then(recs=>{
    if(!recs || !recs.length) return;
    indexItems(recs);
    const box=$("#moreLikeThis");
    if(box) box.innerHTML=`<h4 class="mlt-head">More Like This</h4><div class="row-scroll">${recs.map(cardHTML).join("")}</div>`;
  }).catch(()=>{});
}
function closeDetail(){
  $("#detailModal").classList.remove("open");
  if(!$("#playerModal").classList.contains("open")) document.body.style.overflow="";
  if($("#hero").style.display!=="none") restartHeroTimer();
}

/* ---------- Trailer overlay (YouTube) ---------- */
function openTrailer(key){
  let ov=$("#trailerModal");
  if(!ov){
    ov=document.createElement("div");
    ov.id="trailerModal"; ov.className="trailer-modal";
    ov.innerHTML=`<div class="trailer-box"><button class="trailer-close" data-close-trailer aria-label="Close">×</button><div class="trailer-frame"><iframe id="trailerIframe" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe></div></div>`;
    ov.addEventListener("click",ev=>{ if(ev.target===ov) closeTrailer(); });
    document.body.appendChild(ov);
  }
  $("#trailerIframe").src=`https://www.youtube.com/embed/${encodeURIComponent(key)}?autoplay=1&rel=0`;
  ov.classList.add("open"); document.body.style.overflow="hidden";
}
function closeTrailer(){
  const ov=$("#trailerModal"); if(!ov) return;
  const ifr=$("#trailerIframe"); if(ifr) ifr.src="";
  ov.classList.remove("open");
  if(!$("#detailModal").classList.contains("open") && !$("#playerModal").classList.contains("open")) document.body.style.overflow="";
}

/* ============================================================
   PLAYER — Sources Resolver & Embed Controller
   ============================================================ */
let hlsInstance=null, PLAYER_CTX=null;
const FRAMED=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
const vEl=()=>$("#videoEl"), ifrEl=()=>$("#embedEl");
function destroyHls(){ if(hlsInstance){try{hlsInstance.destroy()}catch(e){} hlsInstance=null;} }

const PROBE_TIMEOUT_MS   = 4500;
const PROBE_CACHE_TTL_MS = 10 * 60 * 1000;
const _probeCache = {};

function probeSource(src, parentSignal){
  // Cross-origin <iframe> embeds cannot be liveness-checked from JS: a no-cors
  // HEAD yields an opaque "success" or rejects on hosts that don't answer HEAD —
  // both meaningless for iframe loadability. Probing them only produced false
  // "unreachable" flags that kicked the player off curated embeds onto generic
  // ones (VidSrc). Treat embeds as always OK; never network-probe them.
  if (src.type === "embed") return Promise.resolve(true);
  const cached = _probeCache[src.url];
  if (cached && (Date.now() - cached.ts) < PROBE_CACHE_TTL_MS) {
    return Promise.resolve(cached.ok);
  }
  return new Promise(resolve => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
    if (parentSignal) parentSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
    fetch(src.url, { method: "HEAD", mode: "no-cors", signal: ctrl.signal, redirect: "follow" })
      .then(() => {
        clearTimeout(timer);
        _probeCache[src.url] = { ok: true, ts: Date.now() };
        resolve(true);
      })
      .catch(() => {
        clearTimeout(timer);
        if (!parentSignal || !parentSignal.aborted) {
          _probeCache[src.url] = { ok: false, ts: Date.now() };
        }
        resolve(false);
      });
  });
}

window.clearProbeCache = () => { for (const k in _probeCache) delete _probeCache[k]; };

function sourceTag(s){ return s.type === 'embed' ? 'embed' : s.type === 'hls' ? 'HLS' : 'MP4'; }
function sourceLabel(s, status){ return `${s.label} · ${sourceTag(s)}${status ? ' · ' + status : ''}`; }

function openPlayer(id,season,episode){
  const it=byId(id); if(!it) return;
  pushHistory(it);
  clearInterval(heroTimer);

  if (PLAYER_CTX && PLAYER_CTX.probeAbort) PLAYER_CTX.probeAbort.abort();

  const trackId=(season&&episode)?`${id}-S${season}E${episode}`:id;
  PLAYER_CTX={
    item:it,
    season:season?+season:null,
    episode:episode?+episode:null,
    trackId,
    userChoseSource:false,
    probeAbort:new AbortController(),
  };
  const epTxt=(season&&episode)?` · S${season}·E${episode}`:(it.type==='series'?` · S${defaultSeasonFor(it.tmdbId)}·E1`:'');
  $("#playerTitle").textContent=it.title+epTxt;

  const sources=resolveSources(it,PLAYER_CTX.season,PLAYER_CTX.episode);
  PLAYER_CTX.sources=sources;
  const sel=$("#sourceSel");

  sel.innerHTML=sources.map((s,i)=>{
    if (s.type === "embed") {
      // embeds are never probed -> no status text, never disabled
      return `<option value="${i}">${h(sourceLabel(s,null))}</option>`;
    }
    const cached=_probeCache[s.url];
    const status=(cached && (Date.now()-cached.ts)<PROBE_CACHE_TTL_MS)
      ? (cached.ok ? null : 'unreachable')
      : 'checking…';
    return `<option value="${i}"${cached && !cached.ok ? ' disabled' : ''}>${h(sourceLabel(s,status))}</option>`;
  }).join("");
  sel.onchange=()=>{
    PLAYER_CTX.userChoseSource=true;
    loadSource(sources[+sel.value]);
  };
  $("#playerModal").classList.add("open"); document.body.style.overflow="hidden";

  const isPlayable = (s)=>{ const c=_probeCache[s.url]; return !c || c.ok; };
  let defIdx = sources.findIndex(isPlayable);
  if (defIdx === -1) defIdx = 0;
  if (FRAMED) {
    const demoIdx = sources.findIndex((s)=>s.type!=="embed" && isPlayable(s));
    if (demoIdx !== -1) defIdx = demoIdx;
  }
  sel.value=String(defIdx);
  loadSource(sources[defIdx]);

  sources.forEach((src,i)=>{
    if (src.type === "embed") return;   // can't reliably probe cross-origin embeds
    probeSource(src, PLAYER_CTX.probeAbort.signal).then(ok=>{
      if (!PLAYER_CTX || PLAYER_CTX.sources !== sources) return;
      const opt = sel.options[i];
      if (!opt) return;
      opt.textContent = sourceLabel(src, ok ? null : 'unreachable');
      opt.disabled = !ok;

      if (!ok && +sel.value === i && !PLAYER_CTX.userChoseSource) {
        const next = Array.from(sel.options).find(o => !o.disabled);
        if (next) {
          sel.value = next.value;
          loadSource(sources[+next.value]);
        } else {
          $("#playerNote").innerHTML = `⚠️ No reachable servers for <strong>${h(it.title)}</strong>. This title may not be indexed by any of the public embed providers.`;
        }
      }
    });
  });
}

function loadSource(src){
  const v=vEl(), ifr=ifrEl(), controls=$("#videoControls"), note=$("#playerNote");
  destroyHls();
  if(src.type==="embed"){
    v.pause(); v.removeAttribute("src"); v.load(); v.style.display="none";
    controls.style.display="none";
    ifr.style.display="block"; ifr.src=src.url;
    note.innerHTML=(FRAMED
      ? `⚠️ <strong>${h(src.label)}</strong> server is blocked inside this sandboxed preview. `
      : `Playing via <strong>${h(src.label)}</strong> server. If it doesn't load, `)
      + `<a href="${src.url}" target="_blank" rel="noopener">open this server in a new tab ↗</a> or pick another server / the Demo source above.`;
    return;
  }
  ifr.style.display="none"; ifr.removeAttribute("src");
  v.style.display="block"; controls.style.display="";
  note.textContent=src.type==="hls"?"Adaptive HLS stream (hls.js).":"Direct MP4 source.";
  v.playbackRate=parseFloat($("#speedSel").value)||1;
  v.onloadedmetadata=()=>{
    const savedTime=getProgress()[PLAYER_CTX.trackId];
    if(savedTime && savedTime>5 && savedTime<(v.duration-30)){
      v.currentTime=savedTime;
      note.innerHTML=`${src.type==="hls"?"Adaptive HLS stream.":"Direct MP4 source."} <span style="color:var(--gold);font-weight:bold;">↻ Resumed from ${fmt(savedTime)}</span>`;
    }
  };
  if(src.type==="hls"){
    if(v.canPlayType("application/vnd.apple.mpegurl")){ v.src=src.url; }
    else if(window.Hls && Hls.isSupported()){
      hlsInstance=new Hls({enableWorker:true});
      hlsInstance.loadSource(src.url);
      hlsInstance.attachMedia(v);
      hlsInstance.on(Hls.Events.ERROR,(_,d)=>{ if(d.fatal) note.textContent="HLS error: "+d.type+" — try another source."; });
    } else { v.src=src.url; }
  } else { v.src=src.url; }
  v.play().then(()=>$("#btnPlay").textContent="❚❚").catch(()=>$("#btnPlay").textContent="▶");
}

function closePlayer(){
  const v=vEl(), ifr=ifrEl();
  if (PLAYER_CTX && PLAYER_CTX.probeAbort) PLAYER_CTX.probeAbort.abort();
  if(PLAYER_CTX && PLAYER_CTX.trackId && !isNaN(v.currentTime) && v.currentTime>5){
    saveProgress(PLAYER_CTX.trackId, v.currentTime);
  }
  destroyHls();
  v.pause(); v.removeAttribute("src"); v.load();
  ifr.removeAttribute("src");
  $("#playerModal").classList.remove("open");
  if(!$("#detailModal").classList.contains("open")) document.body.style.overflow="";
  if($("#hero").style.display!=="none" && !$("#detailModal").classList.contains("open")) restartHeroTimer();
}

const fmt=t=>{ if(isNaN(t)) return "0:00"; const m=Math.floor(t/60), s=Math.floor(t%60); return `${m}:${String(s).padStart(2,'0')}`; };

function bindPlayer(){
  const v=vEl();
  $("#btnPlay").onclick=()=>{ if(v.paused){ v.play(); $("#btnPlay").textContent="❚❚"; } else { v.pause(); $("#btnPlay").textContent="▶"; } };
  $("#btnBack").onclick=()=>v.currentTime=Math.max(0,v.currentTime-10);
  $("#btnFwd").onclick =()=>v.currentTime=Math.min(v.duration||0,v.currentTime+10);
  $("#btnMute").onclick=()=>{ v.muted=!v.muted; $("#btnMute").textContent=v.muted?"🔇":"🔊"; };
  $("#volSlider").oninput=e=>{ v.volume=+e.target.value; v.muted=false; $("#btnMute").textContent=v.volume==0?"🔇":"🔊"; };
  $("#speedSel").onchange=e=>v.playbackRate=parseFloat(e.target.value);
  $("#btnFull").onclick=()=>{ const w=$("#videoWrap"); if(!document.fullscreenElement) w.requestFullscreen?.(); else document.exitFullscreen?.(); };

  let lastSave=0;
  v.ontimeupdate=()=>{
    $("#progressFilled").style.width=(v.currentTime/(v.duration||1)*100)+"%";
    $("#timeLabel").textContent=`${fmt(v.currentTime)} / ${fmt(v.duration)}`;
    if(PLAYER_CTX && PLAYER_CTX.trackId && v.currentTime>5){
      const now=Date.now();
      if(now-lastSave>5000){ saveProgress(PLAYER_CTX.trackId,v.currentTime); lastSave=now; }
    }
  };
  v.onpause=()=>{
    if(PLAYER_CTX && PLAYER_CTX.trackId && v.currentTime>5){
      saveProgress(PLAYER_CTX.trackId, v.currentTime);
    }
  };
  v.onended=()=>{
    $("#btnPlay").textContent="▶";
    if(PLAYER_CTX && PLAYER_CTX.trackId) clearProgress(PLAYER_CTX.trackId);
  };
  $("#progress").onclick=e=>{ const r=e.currentTarget.getBoundingClientRect(); v.currentTime=((e.clientX-r.left)/r.width)*(v.duration||0); };
}

/* ---------- delegated clicks ---------- */
document.addEventListener("click",e=>{
  const rm=e.target.closest("[data-remove]");
  if(rm){
    e.preventDefault(); e.stopPropagation();
    const remaining=removeHistory(rm.dataset.remove);
    const card=rm.closest(".card"); if(card) card.remove();
    if(!remaining.length){ const row=$("#cwRow"); if(row) row.remove(); }
    return;
  }
  const bm=e.target.closest("[data-bookmark]");
  if(bm){
    e.preventDefault(); e.stopPropagation();
    const it=byId(bm.dataset.bookmark);
    const nowIn=toggleList(it);
    bm.classList.toggle("active", nowIn);
    if(bm.classList.contains("btn-list")) bm.textContent = nowIn ? "✓ In My List" : "+ My List";
    else bm.textContent = nowIn ? "✓" : "+";
    bm.title = nowIn ? "Remove from My List" : "Add to My List";
    if(!nowIn){ const mrow=bm.closest("#myListRow"); if(mrow){ const c=bm.closest(".card"); if(c) c.remove(); if(!getList().length) mrow.remove(); } }
    return;
  }
  const ch=e.target.closest("[data-clear-history]");
  if(ch){ e.preventDefault(); e.stopPropagation(); try{localStorage.removeItem(HKEY);}catch(_){} const row=$("#cwRow"); if(row) row.remove(); return; }
  const tr=e.target.closest("[data-trailer]");
  if(tr){ e.preventDefault(); e.stopPropagation(); openTrailer(tr.dataset.trailer); return; }
  if(e.target.closest("[data-close-trailer]")){ closeTrailer(); return; }
  const r=e.target.closest("[data-route]");      if(r){e.preventDefault();route(r.dataset.route);return;}
  const play=e.target.closest("[data-play]");    if(play){e.preventDefault();openPlayer(play.dataset.play,play.dataset.s,play.dataset.e);return;}
  const det=e.target.closest("[data-detail]");   if(det){e.preventDefault();openDetail(det.dataset.detail);return;}
  const card=e.target.closest(".card[data-id]"); if(card){openDetail(card.dataset.id);return;}
  const ti=e.target.closest(".trend-item[data-id]"); if(ti){openDetail(ti.dataset.id);return;}
  if(e.target.closest("[data-close]"))        closeDetail();
  if(e.target.closest("[data-close-player]")) closePlayer();
});
document.addEventListener("keydown",e=>{
  if(e.key==="Escape"){ closeTrailer(); closePlayer(); closeDetail(); return; }
  if(!$("#playerModal").classList.contains("open")) return;
  const tag=(e.target.tagName||"").toLowerCase();
  if(tag==="input"||tag==="select"||tag==="textarea") return;
  const v=vEl();
  switch(e.key){
    case " ": case "k":
      e.preventDefault();
      if(v.paused){ v.play(); $("#btnPlay").textContent="❚❚"; } else { v.pause(); $("#btnPlay").textContent="▶"; }
      break;
    case "ArrowLeft":  e.preventDefault(); v.currentTime=Math.max(0,v.currentTime-10); break;
    case "ArrowRight": e.preventDefault(); v.currentTime=Math.min(v.duration||0,v.currentTime+10); break;
    case "f": case "F":
      e.preventDefault();
      { const w=$("#videoWrap"); if(!document.fullscreenElement) w.requestFullscreen?.(); else document.exitFullscreen?.(); }
      break;
    case "m": case "M":
      e.preventDefault();
      v.muted=!v.muted; $("#btnMute").textContent=v.muted?"🔇":"🔊";
      break;
  }
});

/* ---------- search input ---------- */
let searchTimer=null;
$("#searchInput").addEventListener("input",e=>{
  clearTimeout(searchTimer);
  const q=e.target.value.trim();
  searchTimer=setTimeout(()=>{ if(q.length>=2) renderSearch(q); else if(q.length===0) route("home"); },300);
});

/* ---------- header scroll ---------- */
window.addEventListener("scroll",()=>$("#header").classList.toggle("scrolled",window.scrollY>30));

/* ---------- INIT ---------- */
(async function init(){
  $("#year").textContent=new Date().getFullYear();
  bindPlayer();
  try{
    await loadGenres();
    await renderHome();
  }catch(e){
    $("#view").innerHTML=`<div class="empty">Failed to load TMDB data: ${h(e.message)}. Check the API key / network.</div>`;
  }
})();
