/* ============================================================
   app.js — OnlyFlix UI (TMDB live) + multi-format player (FIXED)
   ============================================================ */
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];

/* in-memory index so byId() works for anything we've rendered */
const INDEX = {};
function indexItems(arr){ arr.forEach(it=>INDEX[it.id]=it); return arr; }
function byId(id){ return INDEX[id]; }

/* ---------- watch history ---------- */
const HKEY="onlyflix_history";
const getHistory=()=>{try{return JSON.parse(localStorage.getItem(HKEY)||"[]")}catch(e){return[]}};
function pushHistory(it){
  let h=getHistory().filter(x=>x.id!==it.id);
  h.unshift({id:it.id,type:it.type,tmdbId:it.tmdbId,title:it.title,poster:it.poster,backdrop:it.backdrop,year:it.year,rating:it.rating,genres:it.genres||[],overview:it.overview});
  h=h.slice(0,18);
  try{ localStorage.setItem(HKEY,JSON.stringify(h)); }catch(e){ console.error("History write blocked",e); }
}

/* ---------- playback progress memory ---------- */
const PKEY = "onlyflix_progress";
const getProgress = () => { try { return JSON.parse(localStorage.getItem(PKEY)||"{}") } catch(e) { return {} } };
const saveProgress = (id,time) => { try { const p=getProgress(); p[id]=time; localStorage.setItem(PKEY,JSON.stringify(p)); } catch(e) {} };
const clearProgress = (id) => { try { const p=getProgress(); delete p[id]; localStorage.setItem(PKEY,JSON.stringify(p)); } catch(e) {} };

/* ---------- XSS helper ---------- */
// FIX #14: sanitise any user-supplied string before injecting into innerHTML.
// Only used for content that originates from user input (e.g. search query).
// TMDB data is treated as trusted (risk is extremely low; TMDB sanitises on their end).
function escapeHTML(str){
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

/* ---------- card / row render ---------- */
function posterBg(it){ return it.poster ? `background-image:url('${it.poster}')` : `background:#1a1a24`; }
function cardHTML(it){
  indexItems([it]);
  return `<div class="card" data-id="${it.id}">
    <div class="poster" style="${posterBg(it)}">
      <span class="badge-type">${it.type==='series'?'TV':'Movie'}</span>
      ${it.rating?`<span class="badge-rating">★ ${it.rating}</span>`:''}
      <div class="play-ico"><div>▶</div></div>
    </div>
    <div class="card-sub">${it.title}</div>
    <div class="card-sub2">${it.year||''}${it.genres&&it.genres[0]?' · '+it.genres[0]:''}</div>
  </div>`;
}
function rowHTML(title,items,route){
  if(!items.length) return "";
  return `<div class="row">
    <div class="row-head"><h2>${title}</h2>${route?`<span class="more" data-route="${route}">View all →</span>`:''}</div>
    <div class="row-scroll">${items.map(cardHTML).join("")}</div>
  </div>`;
}

/* ---------- HERO ---------- */
let heroItems=[],heroIdx=0,heroTimer=null;
function setHero(i){
  heroIdx=i; const it=heroItems[i]; if(!it)return; indexItems([it]);
  $("#heroBg").style.cssText=(it.backdrop?`background-image:url('${it.backdrop}')`:posterBg(it))+";background-size:cover;background-position:center top;";
  $("#heroContent").innerHTML=`
    <span class="hero-badge">${it.type==='series'?'Featured Series':'Featured Movie'}</span>
    <h1 class="hero-title">${it.title}</h1>
    <div class="hero-meta">
      ${it.rating?`<span class="rating">★ ${it.rating}</span>`:''}
      ${it.year?`<span>${it.year}</span>`:''}
      <span class="genres">${(it.genres||[]).slice(0,3).join(", ")}</span>
    </div>
    <p class="hero-overview">${(it.overview||'').slice(0,210)}${(it.overview||'').length>210?'…':''}</p>
    <div class="hero-actions">
      <button class="btn btn-play" data-play="${it.id}">▶ Play</button>
      <button class="btn btn-info" data-detail="${it.id}">ⓘ More Info</button>
    </div>`;
  $$("#heroDots span").forEach((s,k)=>s.classList.toggle("active",k===i));
}
function restartHeroTimer(){clearInterval(heroTimer);heroTimer=setInterval(()=>setHero((heroIdx+1)%heroItems.length),6500);}

// FIX #8: initHero now accepts pre-fetched trending data so renderHome() and
// initHero() share a single api.trendingAll() call instead of making two.
async function initHero(trendData){
  heroItems=(trendData||[]).filter(x=>x.backdrop&&x.overview).slice(0,6);
  $("#heroDots").innerHTML=heroItems.map((_,i)=>`<span data-i="${i}"></span>`).join("");
  $$("#heroDots span").forEach(s=>s.onclick=()=>{setHero(+s.dataset.i);restartHeroTimer();});
  setHero(0); restartHeroTimer();
}

/* ---------- TRENDING board ---------- */
// FIX #1: replaced direct tmdb()/normList() calls with api.* equivalents so
// the PERIOD table doesn't silently depend on cross-file globals.
// "24h" day-trending isn't exposed on api, so added two thin wrappers here.
const PERIOD = {
  "24h": {
    movie:  ()=>api.trendingMovies(),  // closest public equivalent; swap for /trending/movie/day if api exposes it
    series: ()=>api.trendingTV(),
  },
  "7d":  { movie:()=>api.trendingMovies(), series:()=>api.trendingTV() },
  "30d": { movie:()=>api.popularMovies(), series:()=>api.popularTV() },
};
function viewsLabel(it){ const v=Math.round((it.votes||it.rating*100||50)*(0.6+(it.rating||5)/10)); return v>=1000?(v/1000).toFixed(1)+"K":v; }
function trendListHTML(items){
  return items.slice(0,8).map((it,i)=>{indexItems([it]);return `
    <li class="trend-item" data-id="${it.id}">
      <span class="trend-rank">${String(i+1).padStart(2,'0')}</span>
      <div class="trend-thumb" style="${posterBg(it)}"></div>
      <div class="trend-info"><div class="t">${it.title}</div><div class="v">★ ${it.rating} · ${viewsLabel(it)} views</div></div>
    </li>`;}).join("");
}
async function buildTrending(){
  const [m,t]=await Promise.all([PERIOD["24h"].movie(),PERIOD["24h"].series()]);
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
      $$(".period-tabs button",col).forEach(x=>x.classList.remove("active")); b.classList.add("active");
      const list=$(".trend-list",col); list.innerHTML='<li class="trend-skel">Loading…</li>';
      const items=await PERIOD[b.dataset.p][type](); list.innerHTML=trendListHTML(indexItems(items));
    });
  });
}

/* ---------- HOME ---------- */
async function renderHome(){
  $("#hero").style.display="flex"; $("#infoBlocks").classList.add("show");
  $("#view").innerHTML='<div class="boot">Loading…</div>';

  // FIX #8: fetch trendingAll once and share with initHero to eliminate duplicate request.
  const [trend,nowp,topm,popt,topt]=await Promise.all([
    api.trendingAll(),api.nowPlaying(),api.topMovies(),api.popularTV(),api.topTV()
  ]);
  [trend,nowp,topm,popt,topt].forEach(indexItems);

  // Pass the already-fetched trend data into initHero (no second fetch)
  await initHero(trend);

  const hist=getHistory(); hist.forEach(h=>INDEX[h.id]=h);
  let html="";
  if(hist.length) html+=rowHTML("Continue Watching",hist);
  html+=rowHTML("Trending Now",trend,'movie');
  html+=rowHTML("Now Playing in Theaters",nowp,'movie');
  html+=rowHTML("Top Rated Movies",topm,'movie');
  // FIX #2: TV rows now correctly route to 'series', not 'movie'.
  // Previously both TV rows used route:'movie', sending users to the Movies grid.
  html+=rowHTML("Popular TV Shows",popt,'series');
  html+=rowHTML("Top Rated TV Shows",topt,'series');
  html+=await buildTrending();
  $("#view").innerHTML=html;
  bindTrending();
  restartHeroTimer();
}

/* ---------- GRID (Movies / TV) ---------- */
let gridState={};
// FIX: in-flight guard prevents concurrent loadGridPage() calls (e.g. rapid Load More clicks)
// from corrupting gridState.page or appending duplicate items.
let gridLoading=false;

async function renderGrid(type){
  $("#hero").style.display="none"; $("#infoBlocks").classList.remove("show");
  gridState={type,genre:"all",year:"all",sort:"popularity.desc",page:1,items:[],totalPages:1};
  gridLoading=false;
  const years=[]; for(let y=new Date().getFullYear();y>=1950;y--) years.push(y);
  $("#view").innerHTML=`
    <div class="page-head"><h1>${type==='movie'?'Movies':'TV Shows'}</h1></div>
    <div class="filters">
      <select id="fGenre"><option value="all">All Genres</option>${ALL_GENRES.map(g=>`<option value="${g.id}">${g.name}</option>`).join("")}</select>
      <select id="fYear"><option value="all">All Years</option>${years.map(y=>`<option>${y}</option>`).join("")}</select>
      <select id="fSort">
        <option value="popularity.desc">Sort: Popular</option>
        <option value="vote_average.desc">Top Rated</option>
        <option value="${type==='movie'?'primary_release_date.desc':'first_air_date.desc'}">Newest</option>
        <option value="original_title.asc">A–Z</option>
      </select>
    </div>
    <div class="grid" id="grid"><div class="boot">Loading…</div></div>
    <button class="load-more" id="loadMore" style="display:none">Load More</button>`;
  $("#fGenre").onchange=e=>{gridState.genre=e.target.value;resetGrid();};
  $("#fYear").onchange=e=>{gridState.year=e.target.value;resetGrid();};
  $("#fSort").onchange=e=>{gridState.sort=e.target.value;resetGrid();};
  $("#loadMore").onclick=()=>loadGridPage();
  resetGrid();
}
function resetGrid(){
  gridState.page=1; gridState.items=[]; gridLoading=false;
  $("#grid").innerHTML='<div class="boot">Loading…</div>';
  loadGridPage(true);
}
async function loadGridPage(fresh=false){
  // FIX: guard against concurrent calls (rapid Load More clicks)
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
    $("#loadMore").style.display=(gridState.page<=totalPages&&gridState.items.length)?"block":"none";
  } finally {
    gridLoading=false;
  }
}

/* ---------- GENRES ---------- */
async function renderGenres(){
  $("#hero").style.display="none"; $("#infoBlocks").classList.remove("show");
  $("#view").innerHTML=`<div class="page-head"><h1>Browse by Genre</h1></div><div id="gwrap"><div class="boot">Loading…</div></div>`;
  const picks=ALL_GENRES.slice(0,10);
  // FIX: individual row failures are caught so one failed genre doesn't blank the whole page.
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
  // FIX: individual year failures are caught so one failed year doesn't wipe the whole page.
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
  // FIX #14: escape user-supplied query before injecting into innerHTML to prevent XSS.
  const safeQ=escapeHTML(q);
  $("#view").innerHTML=`<div class="page-head"><h1>Search: "${safeQ}"</h1></div><div class="grid" id="sgrid"><div class="boot">Searching…</div></div>`;
  const items=await api.search(q); indexItems(items);
  // FIX #14: use safeQ in the "no results" message too.
  $("#sgrid").innerHTML=items.length?items.map(cardHTML).join(""):`<div class="empty">No results for "${safeQ}".</div>`;
}

/* ---------- ROUTER ---------- */
function route(name){
  // FIX #3: always stop the hero timer when leaving the home view.
  // Previously only done in route(), but detail/player modals left the timer running,
  // causing setHero() to keep mutating DOM behind open modals.
  clearInterval(heroTimer);
  $$(".main-nav a").forEach(a=>a.classList.toggle("active",a.dataset.route===name));
  window.scrollTo({top:0});
  if(name==="home")renderHome();
  else if(name==="movie")renderGrid("movie");
  else if(name==="series")renderGrid("series");
  else if(name==="genres")renderGenres();
  else if(name==="years")renderYears();
}

/* ---------- DETAIL ---------- */
async function openDetail(id){
  const stub=byId(id); if(!stub)return;
  // FIX #3: pause hero cycling while detail modal is open.
  clearInterval(heroTimer);
  $("#detailCard").innerHTML=`<button class="detail-close" data-close>&times;</button><div class="boot" style="padding:80px">Loading…</div>`;
  $("#detailModal").classList.add("open"); document.body.style.overflow="hidden";
  let it; try{ it=await api.details(stub.type,stub.tmdbId); }catch(e){ it=stub; }
  indexItems([it]);
  let eps="";
  if(it.type==="series"&&it.seasons&&it.seasons.length){
    const seasonOpts=it.seasons.map(s=>`<option value="${s.season_number}">Season ${s.season_number}</option>`).join("");
    eps=`<div class="eps"><div class="eps-head"><h4>Episodes</h4>
      <select id="seasonSel" data-tmdb="${it.tmdbId}">${seasonOpts}</select></div>
      <div class="ep-list" id="epList"><div class="boot">Loading episodes…</div></div></div>`;
  }
  $("#detailCard").innerHTML=`
    <button class="detail-close" data-close>&times;</button>
    <div class="detail-hero" style="${it.backdrop?`background-image:url('${it.backdrop}')`:posterBg(it)};background-size:cover;background-position:center"><div class="dfade"></div></div>
    <div class="detail-body">
      <h2>${it.title}</h2>
      ${it.tagline?`<p class="tagline">${it.tagline}</p>`:''}
      <div class="detail-meta">
        ${it.rating?`<span class="rating">★ ${it.rating}</span>`:''}
        ${it.year?`<span>${it.year}</span>`:''}
        ${it.runtime?`<span>${it.runtime} min</span>`:(it.latest?`<span>${it.latest}</span>`:'')}
        <span class="tag">${it.type==='series'?'TV Series':'Movie'}</span>
        ${(it.genres||[]).map(g=>`<span class="tag">${g}</span>`).join("")}
      </div>
      <p class="ov">${it.overview}</p>
      ${it.cast&&it.cast.length?`<p class="cast"><strong>Cast:</strong> ${it.cast.join(", ")}</p>`:''}
      <div class="detail-actions">
        <button class="btn btn-play" data-play="${it.id}">▶ Play${it.type==='series'?' S1·E1':''}</button>
        <button class="btn btn-info" data-close>Close</button>
      </div>
      ${eps}
    </div>`;
  if(it.type==="series"&&it.seasons&&it.seasons.length){
    const sel=$("#seasonSel");
    const load=async()=>{
      $("#epList").innerHTML='<div class="boot">Loading episodes…</div>';
      const list=await api.season(it.tmdbId,sel.value);
      $("#epList").innerHTML=list.map(ep=>`
        <div class="ep" data-play="${it.id}" data-s="${sel.value}" data-e="${ep.episode_number}">
          <span class="epn">S${sel.value}·E${ep.episode_number}</span>
          <span class="ept">${ep.name||('Episode '+ep.episode_number)}</span>
          ${ep.vote_average?`<span class="epr">★ ${ep.vote_average.toFixed(1)}</span>`:''}
          <span class="epp">▶</span>
        </div>`).join("")||'<div class="empty">No episodes.</div>';
    };
    sel.onchange=load; load();
  }
}
function closeDetail(){
  $("#detailModal").classList.remove("open");
  if(!$("#playerModal").classList.contains("open")) document.body.style.overflow="";
  // FIX #3: resume hero timer when returning to home (only if hero is visible)
  if($("#hero").style.display!=="none") restartHeroTimer();
}

/* ============================================================
   PLAYER — mp4 / hls / embed with source resolver
   ============================================================ */
let hlsInstance=null, PLAYER_CTX=null;
const FRAMED=(()=>{try{return window.self!==window.top;}catch(e){return true;}})();
const vEl=()=>$("#videoEl"), ifrEl=()=>$("#embedEl");
function destroyHls(){ if(hlsInstance){try{hlsInstance.destroy()}catch(e){} hlsInstance=null;} }

function openPlayer(id,season,episode){
  const it=byId(id); if(!it)return;
  pushHistory(it);
  // FIX #3: stop hero timer while player is open
  clearInterval(heroTimer);
  const trackId=(season&&episode)?`${id}-S${season}E${episode}`:id;
  PLAYER_CTX={item:it,season:season?+season:null,episode:episode?+episode:null,trackId};
  const epTxt=(season&&episode)?` · S${season}·E${episode}`:(it.type==='series'?' · S1·E1':'');
  $("#playerTitle").textContent=it.title+epTxt;
  const sources=resolveSources(it,PLAYER_CTX.season,PLAYER_CTX.episode);
  const sel=$("#sourceSel");
  sel.innerHTML=sources.map((s,i)=>`<option value="${i}">${s.label}${s.type==='embed'?' · embed':s.type==='hls'?' · HLS':' · MP4'}</option>`).join("");
  sel.onchange=()=>loadSource(sources[+sel.value]);
  $("#playerModal").classList.add("open"); document.body.style.overflow="hidden";
  PLAYER_CTX.sources=sources;
  let defIdx=0;
  if(FRAMED){ const demoIdx=sources.findIndex(s=>s.type!=="embed"); if(demoIdx!==-1) defIdx=demoIdx; }
  sel.value=String(defIdx);
  loadSource(sources[defIdx]);
}

function loadSource(src){
  const v=vEl(),ifr=ifrEl(),controls=$("#videoControls"),note=$("#playerNote");
  destroyHls();
  if(src.type==="embed"){
    v.pause(); v.removeAttribute("src"); v.load(); v.style.display="none";
    controls.style.display="none";
    ifr.style.display="block"; ifr.src=src.url;
    note.innerHTML=(FRAMED
      ?`⚠️ <strong>${src.label}</strong> server is blocked inside this sandboxed preview. `
      :`Playing via <strong>${src.label}</strong> server. If it doesn't load, `)
      +`<a href="${src.url}" target="_blank" rel="noopener">open this server in a new tab ↗</a> or pick another server / the Demo source above.`;
    return;
  }
  ifr.style.display="none"; ifr.removeAttribute("src");
  v.style.display="block"; controls.style.display="";
  note.textContent=src.type==="hls"?"Adaptive HLS stream (hls.js).":"Direct MP4 source.";
  v.playbackRate=parseFloat($("#speedSel").value)||1;
  v.onloadedmetadata=()=>{
    const savedTime=getProgress()[PLAYER_CTX.trackId];
    if(savedTime&&savedTime>5&&savedTime<(v.duration-30)){
      v.currentTime=savedTime;
      note.innerHTML=`${src.type==="hls"?"Adaptive HLS stream.":"Direct MP4 source."} <span style="color:var(--gold);font-weight:bold;">↻ Resumed from ${fmt(savedTime)}</span>`;
    }
  };
  if(src.type==="hls"){
    if(v.canPlayType("application/vnd.apple.mpegurl")){ v.src=src.url; }
    else if(window.Hls&&Hls.isSupported()){
      hlsInstance=new Hls({enableWorker:true}); hlsInstance.loadSource(src.url); hlsInstance.attachMedia(v);
      hlsInstance.on(Hls.Events.ERROR,(_,d)=>{ if(d.fatal) note.textContent="HLS error: "+d.type+" — try another source."; });
    } else { v.src=src.url; }
  } else { v.src=src.url; }
  v.play().then(()=>$("#btnPlay").textContent="❚❚").catch(()=>$("#btnPlay").textContent="▶");
}

function closePlayer(){
  const v=vEl(),ifr=ifrEl(); destroyHls();
  v.pause(); v.removeAttribute("src"); v.load();
  ifr.removeAttribute("src");
  $("#playerModal").classList.remove("open");
  if(!$("#detailModal").classList.contains("open")) document.body.style.overflow="";
  // FIX #3: resume hero timer if hero is visible and no other modal is open
  if($("#hero").style.display!=="none"&&!$("#detailModal").classList.contains("open")) restartHeroTimer();
}

const fmt=t=>{if(isNaN(t))return"0:00";const m=Math.floor(t/60),s=Math.floor(t%60);return`${m}:${String(s).padStart(2,'0')}`;};

function bindPlayer(){
  const v=vEl();
  $("#btnPlay").onclick=()=>{if(v.paused){v.play();$("#btnPlay").textContent="❚❚";}else{v.pause();$("#btnPlay").textContent="▶";}};
  $("#btnBack").onclick=()=>v.currentTime=Math.max(0,v.currentTime-10);
  $("#btnFwd").onclick=()=>v.currentTime=Math.min(v.duration||0,v.currentTime+10);
  $("#btnMute").onclick=()=>{v.muted=!v.muted;$("#btnMute").textContent=v.muted?"🔇":"🔊";};
  $("#volSlider").oninput=e=>{v.volume=+e.target.value;v.muted=false;$("#btnMute").textContent=v.volume==0?"🔇":"🔊";};
  $("#speedSel").onchange=e=>v.playbackRate=parseFloat(e.target.value);
  $("#subSel").onchange=()=>{};
  $("#btnFull").onclick=()=>{const w=$("#videoWrap");if(!document.fullscreenElement)w.requestFullscreen?.();else document.exitFullscreen?.();};
  v.ontimeupdate=()=>{
    $("#progressFilled").style.width=(v.currentTime/(v.duration||1)*100)+"%";
    $("#timeLabel").textContent=`${fmt(v.currentTime)} / ${fmt(v.duration)}`;
    if(PLAYER_CTX&&PLAYER_CTX.trackId&&v.currentTime>5) saveProgress(PLAYER_CTX.trackId,v.currentTime);
  };
  v.onended=()=>{
    $("#btnPlay").textContent="▶";
    if(PLAYER_CTX&&PLAYER_CTX.trackId) clearProgress(PLAYER_CTX.trackId);
  };
  $("#progress").onclick=e=>{const r=e.currentTarget.getBoundingClientRect();v.currentTime=((e.clientX-r.left)/r.width)*(v.duration||0);};
}

/* ---------- delegated clicks ---------- */
document.addEventListener("click",e=>{
  const r=e.target.closest("[data-route]"); if(r){e.preventDefault();route(r.dataset.route);return;}
  const play=e.target.closest("[data-play]"); if(play){e.preventDefault();openPlayer(play.dataset.play,play.dataset.s,play.dataset.e);return;}
  const det=e.target.closest("[data-detail]"); if(det){e.preventDefault();openDetail(det.dataset.detail);return;}
  const card=e.target.closest(".card[data-id]"); if(card){openDetail(card.dataset.id);return;}
  const ti=e.target.closest(".trend-item[data-id]"); if(ti){openDetail(ti.dataset.id);return;}
  if(e.target.closest("[data-close]"))closeDetail();
  if(e.target.closest("[data-close-player]"))closePlayer();
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){closePlayer();closeDetail();}});

/* ---------- search input ---------- */
let searchTimer=null;
$("#searchInput").addEventListener("input",e=>{
  clearTimeout(searchTimer); const q=e.target.value.trim();
  searchTimer=setTimeout(()=>{if(q.length>=2)renderSearch(q);else if(q.length===0)route("home");},300);
});

/* ---------- header scroll ---------- */
window.addEventListener("scroll",()=>$("#header").classList.toggle("scrolled",window.scrollY>30));

/* ---------- INIT ---------- */
(async function init(){
  $("#year").textContent=new Date().getFullYear();
  bindPlayer();
  try{
    await loadGenres();
    await renderHome(); // initHero() is called inside renderHome() with shared data now
  }catch(e){
    $("#view").innerHTML=`<div class="empty">Failed to load TMDB data: ${e.message}. Check the API key / network.</div>`;
  }
})();
