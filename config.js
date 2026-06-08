/* ============================================================
   config.js — TMDB config + STREAM SOURCE RESOLVER LAYER (FIXED v2)
   ============================================================ */
const TMDB = {
  // SECURITY NOTE: this key is visible in client-side source.
  // Before public deployment, proxy TMDB requests through a serverless function
  // (e.g. Vercel/Netlify/Cloudflare Worker) so the key is never exposed.
  KEY: "c08b4db209448aa1ada119d2ba2f4ede",
  BASE: "https://api.themoviedb.org/3",
  IMG:  "https://image.tmdb.org/t/p/w500",
  IMG_LG: "https://image.tmdb.org/t/p/w1280",
  IMG_ORIG: "https://image.tmdb.org/t/p/original",
};

/* ------------------------------------------------------------
   Per-title hardcoded overrides.
   Format:
     "movie:TMDBID"            -> array of source objects
     "tv:TMDBID"               -> array (applies to whole show)
     "tv:TMDBID:S{n}E{n}"      -> array (applies to specific episode)
   Each source: { label, quality, type:"embed"|"mp4"|"hls", url }
   ------------------------------------------------------------ */
const SOURCE_REGISTRY = {
  // Example:
  // "movie:550": [{ label:"Hand-picked", quality:"1080p", type:"mp4", url:"https://.../fightclub.mp4" }],
};

/* ------------------------------------------------------------
   DEMO_POOL — public CORS-friendly test assets.
   FIX v2: only verified URLs. Removed Sintel.mp4 and TearsOfSteel.mp4
   from gtv-videos-bucket (don't exist in /sample/). Replaced the bogus
   unified-streaming `.ism/.m3u8` URL with the canonical Mux test stream.
   ------------------------------------------------------------ */
const DEMO_POOL = [
  {
    name: "Big Buck Bunny",
    variants: [
      { quality:"1080p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
      { quality:"auto",  type:"hls", url:"https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
    ]
  },
  {
    name: "Elephants Dream",
    variants: [
      { quality:"1080p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
    ]
  },
  {
    name: "For Bigger Blazes",
    variants: [
      { quality:"720p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
    ]
  },
  {
    name: "For Bigger Escapes",
    variants: [
      { quality:"720p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
    ]
  },
  {
    name: "For Bigger Joyrides",
    variants: [
      { quality:"720p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" },
    ]
  },
  {
    name: "Apple BipBop",
    variants: [
      { quality:"auto", type:"hls", url:"https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8" },
    ]
  },
];

// Universal fallback — appended to every result so users always have at least
// one working stream regardless of which pool entry was deterministically picked.
const UNIVERSAL_FALLBACK = [
  { label:"Fallback · Big Buck Bunny (MP4)", quality:"1080p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { label:"Fallback · Mux Test HLS",         quality:"auto",  type:"hls", url:"https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
];

/* ------------------------------------------------------------
   EMBED_SERVERS
   FIX v2:
   - 2Embed TV URL fixed (was missing `?` before query params).
   - SuperEmbed/MultiEmbed `directstream.php` removed — it returns a
     redirect / JSON, not iframe-playable HTML; loading it into an
     <iframe> just shows a blank page or a download prompt.
   ------------------------------------------------------------ */
const EMBED_SERVERS = [
  { name:"VidSrc",     movie:id      =>`https://vidsrc.to/embed/movie/${id}`,                  tv:(id,s,e)=>`https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name:"VidSrc.xyz", movie:id      =>`https://vidsrc.xyz/embed/movie/${id}`,                 tv:(id,s,e)=>`https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { name:"VidSrc.cc",  movie:id      =>`https://vidsrc.cc/v2/embed/movie/${id}`,               tv:(id,s,e)=>`https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
  { name:"Embed.su",   movie:id      =>`https://embed.su/embed/movie/${id}`,                   tv:(id,s,e)=>`https://embed.su/embed/tv/${id}/${s}/${e}` },
  { name:"AutoEmbed",  movie:id      =>`https://player.autoembed.cc/embed/movie/${id}`,        tv:(id,s,e)=>`https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { name:"VidLink",    movie:id      =>`https://vidlink.pro/movie/${id}`,                      tv:(id,s,e)=>`https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name:"2Embed",     movie:id      =>`https://www.2embed.cc/embed/${id}`,                    tv:(id,s,e)=>`https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}` },
  { name:"MoviesAPI",  movie:id      =>`https://moviesapi.club/movie/${id}`,                   tv:(id,s,e)=>`https://moviesapi.club/tv/${id}-${s}-${e}` },
  { name:"MultiEmbed", movie:id      =>`https://multiembed.mov/?video_id=${id}&tmdb=1`,        tv:(id,s,e)=>`https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
];

/* ------------------------------------------------------------
   resolveSources(item, season, episode) -> Array<source>
   Order: registry overrides → all embed servers → demo pool pick → universal fallback
   ------------------------------------------------------------ */
function resolveSources(item, season, episode){
  const isTV = item.type === "series" || item.type === "tv";
  const id   = item.tmdbId;
  const s    = season  || 1;
  const e    = episode || 1;

  let out = [];

  // 1) registry overrides (most specific first)
  const epKey = `tv:${id}:S${s}E${e}`;
  const key   = isTV ? `tv:${id}` : `movie:${id}`;
  if (isTV && SOURCE_REGISTRY[epKey]) out = out.concat(SOURCE_REGISTRY[epKey]);
  if (SOURCE_REGISTRY[key])           out = out.concat(SOURCE_REGISTRY[key]);

  // 2) every embed server
  EMBED_SERVERS.forEach(srv => {
    const url = isTV ? srv.tv(id, s, e) : srv.movie(id);
    out.push({ label: srv.name, quality: "auto", type: "embed", url });
  });

  // 3) deterministic demo pool pick per title (so same title = same demo across reloads)
  const pool = DEMO_POOL[(Math.abs(id|0)) % DEMO_POOL.length];
  pool.variants.forEach(v => out.push({
    label:   `Demo · ${pool.name}${v.quality === "auto" ? " (HLS)" : " · " + v.quality}`,
    quality: v.quality,
    type:    v.type,
    url:     v.url,
  }));

  // 4) universal fallback — guarantees at least one playable source
  //    even if the deterministically-picked pool entry is broken.
  out = out.concat(UNIVERSAL_FALLBACK);

  return out;
}
