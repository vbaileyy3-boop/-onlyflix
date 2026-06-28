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

/* ---------- Source registry ---------- */
const SOURCE_REGISTRY = {
  'tv:309280:S1E1': [
    { label: 'VidSrc', type: 'embed', url: 'https://vidsrc.to/embed/tv/309280/1/1' },
    { label: 'VidSrc.xyz', type: 'embed', url: 'https://vidsrc.xyz/embed/tv/309280/1/1' },
    { label: 'VidSrc.cc', type: 'embed', url: 'https://vidsrc.cc/v2/embed/tv/309280?season=1&episode=1' },
    { label: 'Embed.su', type: 'embed', url: 'https://embed.su/embed/tv/309280/1/1' },
    { label: 'AutoEmbed', type: 'embed', url: 'https://player.autoembed.cc/embed/tv/309280/1/1' },
    { label: 'VidLink', type: 'embed', url: 'https://vidlink.pro/tv/309280/1/1' },
    { label: '2Embed', type: 'embed', url: 'https://www.2embed.cc/embedtv/309280?season=1&episode=1' },
    { label: 'MoviesAPI', type: 'embed', url: 'https://moviesapi.club/tv/309280-1-1' },
    { label: 'MultiEmbed', type: 'embed', url: 'https://multiembed.mov/?video_id=309280&tmdb=1&season=1&episode=1' }
  ],
  'tv:309280:S1E2': [
    { label: 'VidSrc', type: 'embed', url: 'https://vidsrc.to/embed/tv/309280/1/2' },
    { label: 'VidSrc.xyz', type: 'embed', url: 'https://vidsrc.xyz/embed/tv/309280/1/2' },
    { label: 'VidSrc.cc', type: 'embed', url: 'https://vidsrc.cc/v2/embed/tv/309280?season=1&episode=2' },
    { label: 'Embed.su', type: 'embed', url: 'https://embed.su/embed/tv/309280/1/2' },
    { label: 'AutoEmbed', type: 'embed', url: 'https://player.autoembed.cc/embed/tv/309280/1/2' },
    { label: 'VidLink', type: 'embed', url: 'https://vidlink.pro/tv/309280/1/2' },
    { label: '2Embed', type: 'embed', url: 'https://www.2embed.cc/embedtv/309280?season=1&episode=2' },
    { label: 'MoviesAPI', type: 'embed', url: 'https://moviesapi.club/tv/309280-1-2' },
    { label: 'MultiEmbed', type: 'embed', url: 'https://multiembed.mov/?video_id=309280&tmdb=1&season=1&episode=2' }
  ],
  'tv:309280:S1E3': [
    { label: 'VidSrc', type: 'embed', url: 'https://vidsrc.to/embed/tv/309280/1/3' },
    { label: 'VidSrc.xyz', type: 'embed', url: 'https://vidsrc.xyz/embed/tv/309280/1/3' },
    { label: 'VidSrc.cc', type: 'embed', url: 'https://vidsrc.cc/v2/embed/tv/309280?season=1&episode=3' },
    { label: 'Embed.su', type: 'embed', url: 'https://embed.su/embed/tv/309280/1/3' },
    { label: 'AutoEmbed', type: 'embed', url: 'https://player.autoembed.cc/embed/tv/309280/1/3' },
    { label: 'VidLink', type: 'embed', url: 'https://vidlink.pro/tv/309280/1/3' },
    { label: '2Embed', type: 'embed', url: 'https://www.2embed.cc/embedtv/309280?season=1&episode=3' },
    { label: 'MoviesAPI', type: 'embed', url: 'https://moviesapi.club/tv/309280-1-3' },
    { label: 'MultiEmbed', type: 'embed', url: 'https://multiembed.mov/?video_id=309280&tmdb=1&season=1&episode=3' }
  ],
  'tv:309280:S1E4': [
    { label: 'VidSrc', type: 'embed', url: 'https://vidsrc.to/embed/tv/309280/1/4' },
    { label: 'VidSrc.xyz', type: 'embed', url: 'https://vidsrc.xyz/embed/tv/309280/1/4' },
    { label: 'VidSrc.cc', type: 'embed', url: 'https://vidsrc.cc/v2/embed/tv/309280?season=1&episode=4' },
    { label: 'Embed.su', type: 'embed', url: 'https://embed.su/embed/tv/309280/1/4' },
    { label: 'AutoEmbed', type: 'embed', url: 'https://player.autoembed.cc/embed/tv/309280/1/4' },
    { label: 'VidLink', type: 'embed', url: 'https://vidlink.pro/tv/309280/1/4' },
    { label: '2Embed', type: 'embed', url: 'https://www.2embed.cc/embedtv/309280?season=1&episode=4' },
    { label: 'MoviesAPI', type: 'embed', url: 'https://moviesapi.club/tv/309280-1-4' },
    { label: 'MultiEmbed', type: 'embed', url: 'https://multiembed.mov/?video_id=309280&tmdb=1&season=1&episode=4' }
  ],
  'tv:309280:S1E5': [
    { label: 'VidSrc', type: 'embed', url: 'https://vidsrc.to/embed/tv/309280/1/5' },
    { label: 'VidSrc.xyz', type: 'embed', url: 'https://vidsrc.xyz/embed/tv/309280/1/5' },
    { label: 'VidSrc.cc', type: 'embed', url: 'https://vidsrc.cc/v2/embed/tv/309280?season=1&episode=5' },
    { label: 'Embed.su', type: 'embed', url: 'https://embed.su/embed/tv/309280/1/5' },
    { label: 'AutoEmbed', type: 'embed', url: 'https://player.autoembed.cc/embed/tv/309280/1/5' },
    { label: 'VidLink', type: 'embed', url: 'https://vidlink.pro/tv/309280/1/5' },
    { label: '2Embed', type: 'embed', url: 'https://www.2embed.cc/embedtv/309280?season=1&episode=5' },
    { label: 'MoviesAPI', type: 'embed', url: 'https://moviesapi.club/tv/309280-1-5' },
    { label: 'MultiEmbed', type: 'embed', url: 'https://multiembed.mov/?video_id=309280&tmdb=1&season=1&episode=5' }
  ]
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
  { name: 'VidSrc', movie: id => `https://vidsrc.to/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: 'VidSrc.xyz', movie: id => `https://vidsrc.xyz/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { name: 'VidSrc.cc', movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`, tv: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}?season=${s}&episode=${e}` },
  { name: 'Embed.su', movie: id => `https://embed.su/embed/movie/${id}`, tv: (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { name: 'AutoEmbed', movie: id => `https://player.autoembed.cc/embed/movie/${id}`, tv: (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { name: 'VidLink', movie: id => `https://vidlink.pro/movie/${id}`, tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name: '2Embed', movie: id => `https://www.2embed.cc/embed/${id}`, tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}?s=${s}&e=${e}` },
  { name: 'MoviesAPI', movie: id => `https://moviesapi.club/movie/${id}`, tv: (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}` },
  { name: 'MultiEmbed', movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`, tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` }
];

/* ---------- Resolver ---------- */
export function resolveSources(item, season, episode) {
  const isTV = item.type === 'series' || item.type === 'tv';
  const id = item.tmdbId;
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
