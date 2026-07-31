/* ============================================================
   config.js — CINEMAX config + source resolver
   ============================================================ */

export const TMDB = {
  KEY: 'c08b4db209448aa1ada119d2ba2f4ede',
  BASE: 'https://api.themoviedb.org/3',
  IMG: 'https://image.tmdb.org/t/p/w500',
  IMG_LG: 'https://image.tmdb.org/t/p/w1280',
  IMG_ORIG: 'https://image.tmdb.org/t/p/original'
};

/* ---------- Source registry (Overrides / Specific hardcoded links) ---------- */
const SOURCE_REGISTRY = {
  // Manual overrides for specific TMDB IDs or episodes go here if needed.
  // Dynamic lookup is automatically handled by EMBED_SERVERS below.
};

/* ---------- Demo pool ---------- */
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
    variants: [{ type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' }]
  },
  {
    name: 'For Bigger Blazes',
    variants: [{ type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' }]
  },
  {
    name: 'For Bigger Escapes',
    variants: [{ type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' }]
  },
  {
    name: 'For Bigger Joyrides',
    variants: [{ type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' }]
  },
  {
    name: 'Apple BipBop',
    variants: [{ type: 'hls', url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8' }]
  }
];

const UNIVERSAL_FALLBACK = [
  { label: 'Fallback · Big Buck Bunny (MP4)', type: 'mp4', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
  { label: 'Fallback · Mux Test HLS', type: 'hls', url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8' }
];

/* ---------- Embed servers ---------- */
const EMBED_SERVERS = [
  // High-Speed Primary Servers
  { name: 'VidSrc.to', movie: id => `https://vidsrc.to/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: 'VidLink', movie: id => `https://vidlink.pro/movie/${id}`, tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name: 'Embed.su', movie: id => `https://embed.su/embed/movie/${id}`, tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { name: 'VidBinge', movie: id => `https://vidbinge.dev/embed/movie/${id}`, tv: (id, s, e) => `https://vidbinge.dev/embed/tv/${id}/${s}/${e}` },
  
  // Secondary Mirror Servers
  { name: 'VidSrc.xyz', movie: id => `https://vidsrc.xyz/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { name: 'VidSrc.pro', movie: id => `https://vidsrc.pro/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.pro/embed/tv/${id}/${s}/${e}` },
  { name: 'VidSrc.cc', movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}?season=${s}&episode=${e}` },
  { name: 'VidSrc.me', movie: id => `https://vidsrc.me/embed/movie?tmdb=${id}`, tv: (id, s, e) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${e}` },
  
  // Backup & Multi-Source Players
  { name: 'AutoEmbed', movie: id => `https://player.autoembed.cc/embed/movie/${id}`, tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { name: 'SmashyStream', movie: id => `https://embed.smashystream.com/playere.php?tmdb=${id}`, tv: (id, s, e) => `https://embed.smashystream.com/playere.php?tmdb=${id}&season=${s}&episode=${e}` },
  { name: 'RiveStream', movie: id => `https://rive.stream/embed?type=movie&id=${id}`, tv: (id, s, e) => `https://rive.stream/embed?type=tv&id=${id}&season=${s}&episode=${e}` },
  { name: '2Embed', movie: id => `https://www.2embed.cc/embed/${id}`, tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}?season=${s}&episode=${e}` },
  { name: 'MoviesAPI', movie: id => `https://moviesapi.club/movie/${id}`, tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}` },
  { name: 'MultiEmbed', movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`, tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
  { name: 'NontonGo', movie: id => `https://www.nontongo.win/embed/movie/${id}`, tv: (id, s, e) => `https://www.nontongo.win/embed/tv/${id}/${s}/${e}` }
];

/* ---------- Resolver ---------- */
export function resolveSources(item, season, episode) {
  const isTV = item.type === 'series' || item.type === 'tv';
  const id = item.tmdbId || item.id;
  const s = season ? +season : 1;
  const e = episode ? +episode : 1;

  const sources = [];

  // 1) Episode-specific registry
  if (isTV) {
    const epKey = `tv:${id}:S${s}E${e}`;
    if (SOURCE_REGISTRY[epKey]) sources.push(...SOURCE_REGISTRY[epKey]);
  }

  // 2) Show/movie-level registry
  const key = isTV ? `tv:${id}` : `movie:${id}`;
  if (SOURCE_REGISTRY[key]) sources.push(...SOURCE_REGISTRY[key]);

  // 3) Generic embed servers
  for (const server of EMBED_SERVERS) {
    sources.push({
      label: server.name,
      type: 'embed',
      url: isTV ? server.tv(id, s, e) : server.movie(id)
    });
  }

  // 4) Demo pool
  const demo = DEMO_POOL[Math.abs(parseInt(id, 10) || 0) % DEMO_POOL.length];
  for (const variant of demo.variants) {
    sources.push({
      label: `Demo · ${demo.name}`,
      type: variant.type,
      url: variant.url
    });
  }

  // 5) Universal fallback
  sources.push(...UNIVERSAL_FALLBACK);

  // Deduplicate by URL
  const seen = new Set();
  return sources.filter(src => {
    if (!src.url || seen.has(src.url)) return false;
    seen.add(src.url);
    return true;
  });
}
