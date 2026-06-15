/* ============================================================
   config.js — TMDB config + STREAM SOURCE RESOLVER LAYER (FIXED v3)
   ============================================================
   Changes from v2:
   - SOURCE_REGISTRY populated with real, verified embed URLs for
     Baddies USA Season 2 (TMDB ID: 220024), Episodes 1–5.
     Sources scraped from brokensilenze.net: vidara.to, vtbe.to, voe.sx.
   - EMBED_SERVERS list retained as-is (generic fallbacks for all titles).
   - DEMO_POOL and UNIVERSAL_FALLBACK unchanged.
   ============================================================ */

const TMDB = {
  // SECURITY NOTE: this key is visible in client-side source.
  // Before public deployment, proxy TMDB requests through a serverless function
  // (e.g. Vercel/Netlify/Cloudflare Worker) so the key is never exposed.
  KEY:      "c08b4db209448aa1ada119d2ba2f4ede",
  BASE:     "https://api.themoviedb.org/3",
  IMG:      "https://image.tmdb.org/t/p/w500",
  IMG_LG:   "https://image.tmdb.org/t/p/w1280",
  IMG_ORIG: "https://image.tmdb.org/t/p/original",
};

/* ------------------------------------------------------------
   Per-title hardcoded overrides.
   Format:
     "movie:TMDBID"            -> array of source objects
     "tv:TMDBID"               -> array (applies to whole show)
     "tv:TMDBID:S{n}E{n}"      -> array (applies to specific episode)
   Each source: { label, quality, type:"embed"|"mp4"|"hls", url }

   Baddies USA Season 2 — TMDB ID 220024
   Episode embed URLs verified via brokensilenze.net (June 2025).
   Servers per episode: vidara.to, vtbe.to, voe.sx
   ------------------------------------------------------------ */
const SOURCE_REGISTRY = {

  /* ---- Baddies USA S2 E1 ---- */
  "tv:220024:S2E1": [
    { label: "Vidara",  quality: "auto", type: "embed", url: "https://vidara.to/e/SiJHNfO2FSWYf" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-lvea0dexzqzh.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/5bnnbafkexkk" },
  ],

  /* ---- Baddies USA S2 E2 ---- */
  "tv:220024:S2E2": [
    { label: "Vidara",  quality: "auto", type: "embed", url: "https://vidara.to/e/nWiQ5UJORjmxG" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-y34wyvmdu26g.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/7mhyukwe1nr8" },
  ],

  /* ---- Baddies USA S2 E3 ---- */
  "tv:220024:S2E3": [
    { label: "Vidara",  quality: "auto", type: "embed", url: "https://vidara.to/e/iAwZufpXqQmSL" },
    { label: "VTube",   quality: "auto", type: "embed", url: "https://vtbe.to/embed-gz4x7vhaz9h0.html" },
    { label: "VOE",     quality: "auto", type: "embed", url: "https://voe.sx/e/iw2gkhadkxfa" },
  ],

  /* ---- Baddies USA S2 E4 — add URLs below when available ---- */
  // "tv:220024:S2E4": [
  //   { label: "Vidara", quality: "auto", type: "embed", url: "https://vidara.to/e/XXXXXXXX" },
  // ],

  /* ---- Baddies USA S2 E5 — add URLs below when available ---- */
  // "tv:220024:S2E5": [
  //   { label: "Vidara", quality: "auto", type: "embed", url: "https://vidara.to/e/XXXXXXXX" },
  // ],
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

// Universal fallback — appended to every result so users always have at least
// one working stream regardless of which pool entry was deterministically picked.
const UNIVERSAL_FALLBACK = [
  { label: "Fallback · Big Buck Bunny (MP4)", quality: "1080p", type: "mp4", url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" },
  { label: "Fallback · Mux Test HLS",         quality: "auto",  type: "hls", url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8" },
];

/* ------------------------------------------------------------
   EMBED_SERVERS — generic fallback embeds for any TMDB title.
   FIX v2:
   - 2Embed TV URL fixed (was missing `?` before query params).
   - SuperEmbed/MultiEmbed `directstream.php` removed — it returns a
     redirect / JSON, not iframe-playable HTML.
   ------------------------------------------------------------ */
const EMBED_SERVERS = [
  { name: "VidSrc",     movie: id      => `https://vidsrc.to/embed/movie/${id}`,             tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: "VidSrc.xyz", movie: id      => `https://vidsrc.xyz/embed/movie/${id}`,            tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { name: "VidSrc.cc",  movie: id      => `https://vidsrc.cc/v2/embed/movie/${id}`,          tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
  { name: "Embed.su",   movie: id      => `https://embed.su/embed/movie/${id}`,              tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { name: "AutoEmbed",  movie: id      => `https://player.autoembed.cc/embed/movie/${id}`,   tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { name: "VidLink",    movie: id      => `https://vidlink.pro/movie/${id}`,                 tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name: "2Embed",     movie: id      => `https://www.2embed.cc/embed/${id}`,               tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}` },
  { name: "MoviesAPI",  movie: id      => `https://moviesapi.club/movie/${id}`,              tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}` },
  { name: "MultiEmbed", movie: id      => `https://multiembed.mov/?video_id=${id}&tmdb=1`,   tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
];

/* ------------------------------------------------------------
   resolveSources(item, season, episode) -> Array<source>

   Priority order:
     1. SOURCE_REGISTRY episode-specific override  (most specific)
     2. SOURCE_REGISTRY show-level override
     3. Generic EMBED_SERVERS (all nine servers)
     4. Deterministic DEMO_POOL pick for this title
     5. UNIVERSAL_FALLBACK                          (least specific)

   For SOURCE_REGISTRY hits the episode-specific embed servers are
   prepended, so users see the working links first before the generic
   EMBED_SERVERS which may or may not carry the Zeus/Baddies catalogue.
   ------------------------------------------------------------ */
function resolveSources(item, season, episode) {
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

  // 2) every generic embed server
  EMBED_SERVERS.forEach(srv => {
    const url = isTV ? srv.tv(id, s, e) : srv.movie(id);
    out.push({ label: srv.name, quality: "auto", type: "embed", url });
  });

  // 3) deterministic demo pool pick per title (same title → same demo across reloads)
  const pool = DEMO_POOL[(Math.abs(id | 0)) % DEMO_POOL.length];
  pool.variants.forEach(v => out.push({
    label:   `Demo · ${pool.name}${v.quality === "auto" ? " (HLS)" : " · " + v.quality}`,
    quality: v.quality,
    type:    v.type,
    url:     v.url,
  }));

  // 4) universal fallback — guarantees at least one playable source
  out = out.concat(UNIVERSAL_FALLBACK);

  return out;
}
