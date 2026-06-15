/* ============================================================
   config.js — TMDB config + STREAM SOURCE RESOLVER LAYER (FIXED v7)
   ============================================================
   Root cause (final): TMDB registers "Baddies USA: Chapter 2" with
   only ONE season, numbered Season 1. So when the player calls
   resolveSources(item, 1, 4) for S1·E4, it builds key "tv:309280:S1E4".
   Previous versions used S2E* keys which never matched.
   All keys are now S1E* to match what TMDB and the UI actually pass.
   ============================================================ */

const TMDB = {
  KEY:      "c08b4db209448aa1ada119d2ba2f4ede",
  BASE:     "https://api.themoviedb.org/3",
  IMG:      "https://image.tmdb.org/t/p/w500",
  IMG_LG:   "https://image.tmdb.org/t/p/w1280",
  IMG_ORIG: "https://image.tmdb.org/t/p/original",
};

/* ------------------------------------------------------------
   SOURCE_REGISTRY
   Keys must match exactly what resolveSources() builds:
     "tv:{tmdbId}:S{season}E{episode}"
   TMDB shows this series as Season 1, so all keys are S1E*.
   ------------------------------------------------------------ */
const SOURCE_REGISTRY = {

  /* ================================================================
     Baddies USA: Chapter 2  —  TMDB ID 309280, Season 1
     Embed URLs verified via brokensilenze.net, June 14 2026.
     ================================================================ */

  /* ---- S1 E1 – "Home of the Brave" (May 17, 2026) ---- */
  "tv:309280:S1E1": [
    { label: "Vidara",  quality: "auto", type: "embed", url: "https://vidara.to/e/SiJHNfO2FSWYf" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-lvea0dexzqzh.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/5bnnbafkexkk" },
    { label: "Vidmoly", quality: "auto", type: "embed", url: "https://vidmoly.biz/embed-9qewdlh08ldg.html" },
  ],

  /* ---- S1 E2 – "Checked at Soundcheck" (May 25, 2026) ---- */
  "tv:309280:S1E2": [
    { label: "Vidara",  quality: "auto", type: "embed", url: "https://vidara.to/e/nWiQ5UJORjmxG" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-y34wyvmdu26g.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/7mhyukwe1nr8" },
    { label: "Vidmoly", quality: "auto", type: "embed", url: "https://vidmoly.biz/embed-76plc7ssenqb.html" },
  ],

  /* ---- S1 E3 – "It's Indeed Showtime" (May 31, 2026) ---- */
  "tv:309280:S1E3": [
    { label: "Vidara",  quality: "auto", type: "embed", url: "https://vidara.to/e/iAwZufpXqQmSL" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-gz4x7vhaz9h0.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/iw2gkhadkxfa" },
  ],

  /* ---- S1 E4 – "We Know What This Means" (Jun 7, 2026) ---- */
  "tv:309280:S1E4": [
    { label: "Vidmoly", quality: "auto", type: "embed", url: "https://vidmoly.biz/embed-ahttf7s4w0it.html" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-m498rjyjetnr.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/gjxqasre71gk" },
  ],

  /* ---- S1 E5 (Jun 14, 2026) ---- */
  "tv:309280:S1E5": [
    { label: "Vidara",  quality: "auto", type: "embed", url: "https://vidara.to/e/LVrxWugxxE5O6" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-sy9kn6spd7th.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/sws1jeeukzgb" },
    { label: "Playmogo",quality: "auto", type: "embed", url: "https://playmogo.com/e/ygiwetx0orqn" },
  ],

};

/* ------------------------------------------------------------
   DEMO_POOL — public CORS-friendly test assets.
   ------------------------------------------------------------ */
const DEMO_POOL = [
  {
    name: "Big Buck Bunny",
    variants: [
      { quality: "1080p", type: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
      { quality: "auto",  type: "hls", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
    ]
  },
  {
    name: "Elephants Dream",
    variants: [
      { quality: "1080p", type: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4" },
    ]
  },
  {
    name: "For Bigger Blazes",
    variants: [
      { quality: "720p", type: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" },
    ]
  },
  {
    name: "For Bigger Escapes",
    variants: [
      { quality: "720p", type: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4" },
    ]
  },
  {
    name: "For Bigger Joyrides",
    variants: [
      { quality: "720p", type: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4" },
    ]
  },
  {
    name: "Apple BipBop",
    variants: [
      { quality: "auto", type: "hls", url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8" },
    ]
  },
];

const UNIVERSAL_FALLBACK = [
  { label: "Fallback · Big Buck Bunny (MP4)", quality: "1080p", type: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { label: "Fallback · Mux Test HLS",         quality: "auto",  type: "hls", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
];

/* ------------------------------------------------------------
   EMBED_SERVERS — generic fallback embeds for any TMDB title.
   ------------------------------------------------------------ */
const EMBED_SERVERS = [
  { name: "VidSrc",     movie: id => `https://vidsrc.to/embed/movie/${id}`,             tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: "VidSrc.xyz", movie: id => `https://vidsrc.xyz/embed/movie/${id}`,            tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { name: "VidSrc.cc",  movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`,          tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
  { name: "Embed.su",   movie: id => `https://embed.su/embed/movie/${id}`,              tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { name: "AutoEmbed",  movie: id => `https://player.autoembed.cc/embed/movie/${id}`,   tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { name: "VidLink",    movie: id => `https://vidlink.pro/movie/${id}`,                 tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name: "2Embed",     movie: id => `https://www.2embed.cc/embed/${id}`,               tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}` },
  { name: "MoviesAPI",  movie: id => `https://moviesapi.club/movie/${id}`,              tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}` },
  { name: "MultiEmbed", movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`,   tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
];

/* ------------------------------------------------------------
   resolveSources(item, season, episode) -> Array<source>

   Priority:
     1. SOURCE_REGISTRY episode-specific key  (most specific)
     2. SOURCE_REGISTRY show-level key
     3. Generic EMBED_SERVERS
     4. Deterministic DEMO_POOL pick
     5. UNIVERSAL_FALLBACK
   ------------------------------------------------------------ */
function resolveSources(item, season, episode) {
  const isTV = item.type === "series" || item.type === "tv";
  const id   = item.tmdbId;
  const s    = season  ? +season  : 1;
  const e    = episode ? +episode : 1;

  let out = [];

  // 1 & 2) registry overrides
  const key = isTV ? `tv:${id}` : `movie:${id}`;
  if (isTV) {
    const epKey = `tv:${id}:S${s}E${e}`;
    if (SOURCE_REGISTRY[epKey]) out = out.concat(SOURCE_REGISTRY[epKey]);
  }
  if (SOURCE_REGISTRY[key]) out = out.concat(SOURCE_REGISTRY[key]);

  // 3) generic embed servers
  EMBED_SERVERS.forEach(srv => {
    const url = isTV ? srv.tv(id, s, e) : srv.movie(id);
    out.push({ label: srv.name, quality: "auto", type: "embed", url });
  });

  // 4) deterministic demo pool pick
  const numId = Math.abs(parseInt(id, 10) || 0);
  const pool  = DEMO_POOL[numId % DEMO_POOL.length];
  pool.variants.forEach(v => out.push({
    label:   `Demo · ${pool.name}${v.quality === "auto" ? " (HLS)" : " · " + v.quality}`,
    quality: v.quality,
    type:    v.type,
    url:     v.url,
  }));

  // 5) universal fallback
  out = out.concat(UNIVERSAL_FALLBACK);

  // dedup by url (keeps first/highest-priority occurrence)
  const seen = new Set();
  out = out.filter(s => (s.url && !seen.has(s.url)) ? seen.add(s.url) : false);

  return out;
}
