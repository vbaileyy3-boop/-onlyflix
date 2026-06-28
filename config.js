/* ============================================================
   config.js — TMDB config + STREAM SOURCE RESOLVER (v8)
   ============================================================ */

const TMDB = {
  KEY: 'c08b4db209448aa1ada119d2ba2f4ede',
  BASE: 'https://api.themoviedb.org/3',
  IMG: 'https://image.tmdb.org/t/p/w500',
  IMG_LG: 'https://image.tmdb.org/t/p/w1280',
  IMG_ORIG: 'https://image.tmdb.org/t/p/original'
};

/* ------------------------------------------------------------
   SOURCE_REGISTRY — manual overrides for specific titles/episodes
   Key formats: "tv:{tmdbId}:S{season}E{episode}" | "tv:{tmdbId}" | "movie:{tmdbId}"
   ------------------------------------------------------------ */
const SOURCE_REGISTRY = {
  // Baddies USA: Chapter 2 — TMDB 309280, Season 1
  'tv:309280:S1E1': [
    { label: 'Vidara', type: 'embed', url: 'https://vidara.to/e/SiJHNfO2FSWYf' },
    { label: 'VTube', type: 'embed', url: 'https://vtbe.to/embed-lvea0dexzqzh.html' },
    { label: 'VOE', type: 'embed', url: 'https://voe.sx/e/5bnnbafkexkk' },
    { label: 'Vidmoly', type: 'embed', url: 'https://vidmoly.biz/embed-9qewdlh08ldg.html' }
  ],
  'tv:309280:S1E2': [
    { label: 'Vidara', type: 'embed', url: 'https://vidara.to/e/nWiQ5UJORjmxG' },
    { label: 'VTube', type: 'embed', url: 'https://vtbe.to/embed-y34wyvmdu26g.html' },
    { label: 'VOE', type: 'embed', url: 'https://voe.sx/e/7mhyukwe1nr8' },
    { label: 'Vidmoly', type: 'embed', url: 'https://vidmoly.biz/embed-76plc7ssenqb.html' }
  ],
  'tv:309280:S1E3': [
    { label: 'Vidara', type: 'embed', url: 'https://vidara.to/e/iAwZufpXqQmSL' },
    { label: 'VTube', type: 'embed', url: 'https://vtbe.to/embed-gz4x7vhaz9h0.html' },
    { label: 'VOE', type: 'embed', url: 'https://voe.sx/e/iw2gkhadkxfa' }
  ],
  'tv:309280:S1E4': [
    { label: 'Vidmoly', type: 'embed', url: 'https://vidmoly.biz/embed-ahttf7s4w0it.html' },
    { label: 'VTube', type: 'embed', url: 'https://vtbe.to/embed-m498rjyjetnr.html' },
    { label: 'VOE', type: 'embed', url: 'https://voe.sx/e/gjxqasre71gk' }
  ],
  'tv:309280:S1E5': [
    { label: 'Vidara', type: 'embed', url: 'https://vidara.to/e/LVrxWugxxE5O6' },
    { label: 'VTube', type: 'embed', url: 'https://vtbe.to/embed-sy9kn6spd7th.html' },
    { label: 'VOE', type: 'embed', url: 'https://voe.sx/e/sws1jeeukzgb' },
    { label: 'Playmogo', type: 'embed', url: 'https://playmogo.com/e/ygiwetx0orqn' }
  ]
};

/* ------------------------------------------------------------
   DEMO_POOL — public CORS-friendly test assets
   ------------------------------------------------------------ */
const DEMO_POOL = [
  {
    name: 'Big Buck Bunny',
    variants: [
      { type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
      { type: 'hls', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
    ]
  },
  {
    name: 'Elephants Dream',
    variants: [
      { type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' }
    ]
  },
  {
    name: 'For Bigger Blazes',
    variants: [
      { type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' }
    ]
  },
  {
    name: 'For Bigger Escapes',
    variants: [
      { type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' }
    ]
  },
  {
    name: 'For Bigger Joyrides',
    variants: [
      { type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' }
    ]
  },
  {
    name: 'Apple BipBop',
    variants: [
      { type: 'hls', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8' }
    ]
  }
];

const UNIVERSAL_FALLBACK = [
  { label: 'Fallback · Big Buck Bunny (MP4)', type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
  { label: 'Fallback · Mux Test HLS', type: 'hls', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
];

/* ------------------------------------------------------------
   EMBED_SERVERS — generic embed providers for any TMDB title
   ------------------------------------------------------------ */
const EMBED_SERVERS = [
  {
    name: 'VidSrc',
    movie: id => `https://vidsrc.to/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'VidSrc.xyz',
    movie: id => `https://vidsrc.xyz/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'VidSrc.cc',
    movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'Embed.su',
    movie: id => `https://embed.su/embed/movie/${id}`,
    tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'AutoEmbed',
    movie: id => `https://player.autoembed.cc/embed/movie/${id}`,
    tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}`
  },
  {
    name: 'VidLink',
    movie: id => `https://vidlink.pro/movie/${id}`,
    tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`
  },
  {
    name: '2Embed',
    movie: id => `https://www.2embed.cc/embed/${id}`,
    tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}`
  },
  {
    name: 'MoviesAPI',
    movie: id => `https://moviesapi.club/movie/${id}`,
    tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}`
  },
  {
    name: 'MultiEmbed',
    movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`
  }
];

/* ------------------------------------------------------------
   resolveSources(item, season, episode) -> Array<source>
   ------------------------------------------------------------ */
function resolveSources(item, season, episode) {
  const isTV = item.type === 'series' || item.type === 'tv';
  const id = item.tmdbId;
  const s = season ? +season : 1;
  const e = episode ? +episode : 1;

  const sources = [];

  // 1) Episode-specific registry
  if (isTV) {
    const epKey = `tv:${id}:S${s}E${e}`;
    if (SOURCE_REGISTRY[epKey]) {
      sources.push(...SOURCE_REGISTRY[epKey]);
    }
  }

  // 2) Show/movie-level registry
  const key = isTV ? `tv:${id}` : `movie:${id}`;
  if (SOURCE_REGISTRY[key]) {
    sources.push(...SOURCE_REGISTRY[key]);
  }

  // 3) Generic embed servers
  for (const server of EMBED_SERVERS) {
    sources.push({
      label: server.name,
      type: 'embed',
      url: isTV ? server.tv(id, s, e) : server.movie(id)
    });
  }

  // 4) Deterministic demo selection (stable across sessions)
  const poolIndex = Math.abs(parseInt(id, 10) || 0) % DEMO_POOL.length;
  const demo = DEMO_POOL[poolIndex];
  
  for (const variant of demo.variants) {
    sources.push({
      label: `Demo · ${demo.name}${variant.type === 'hls' ? ' (HLS)' : ''}`,
      type: variant.type,
      url: variant.url
    });
  }

  // 5) Universal fallback
  sources.push(...UNIVERSAL_FALLBACK);

  // Deduplicate by URL (first occurrence wins)
  const seen = new Set();
  return sources.filter(source => {
    if (!source.url) return false;
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
