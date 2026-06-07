/* ============================================================
   config.js — TMDB config + STREAM SOURCE RESOLVER LAYER
   ============================================================ */
const TMDB = {
  KEY: "c08b4db209448aa1ada119d2ba2f4ede", // NOTE: Secure via serverless proxy before public deployment
  BASE: "https://api.themoviedb.org/3",
  IMG:  "https://image.tmdb.org/t/p/w500",
  IMG_LG: "https://image.tmdb.org/t/p/w1280",
  IMG_ORIG: "https://image.tmdb.org/t/p/original",
};

const SOURCE_REGISTRY = {
  // Add real per-title hardcoded overrides here if necessary.
};

// Public CORS-friendly fallback video assets
const DEMO_POOL = [
  {
    name: "Big Buck Bunny",
    variants: [
      {quality:"1080p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"},
      {quality:"720p",  type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"},
      {quality:"auto",  type:"hls", url:"https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"},
    ]
  },
  {
    name: "Sintel",
    variants: [
      {quality:"1080p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"},
      {quality:"auto",  type:"hls", url:"https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8"},
    ]
  },
  {
    name: "Tears of Steel",
    variants: [
      {quality:"1080p", type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"},
      {quality:"auto",  type:"hls", url:"https://test-streams.mux.dev/pts_shift/master.m3u8"},
    ]
  },
  {
    name: "Apple BipBop",
    variants: [
      {quality:"auto",  type:"hls", url:"https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8"},
      {quality:"480p",  type:"mp4", url:"https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4"},
    ]
  },
];

const EMBED_SERVERS = [
  { name: "VidSrc",      movie: id => `https://vidsrc.to/embed/movie/${id}`,           tv: (id,s,e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}` },
  { name: "VidSrc.xyz",  movie: id => `https://vidsrc.xyz/embed/movie/${id}`,          tv: (id,s,e) => `https://vidsrc.xyz/embed/tv/${id}/${s}/${e}` },
  { name: "VidSrc.cc",   movie: id => `https://vidsrc.cc/v2/embed/movie/${id}`,        tv: (id,s,e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}` },
  { name: "Embed.su",    movie: id => `https://embed.su/embed/movie/${id}`,           tv: (id,s,e) => `https://embed.su/embed/tv/${id}/${s}/${e}` },
  { name: "AutoEmbed",   movie: id => `https://player.autoembed.cc/embed/movie/${id}`, tv: (id,s,e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}` },
  { name: "VidLink",     movie: id => `https://vidlink.pro/movie/${id}`,               tv: (id,s,e) => `https://vidlink.pro/tv/${id}/${s}/${e}` },
  { name: "2Embed",      movie: id => `https://www.2embed.cc/embed/${id}`,             tv: (id,s,e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}` },
  { name: "MoviesAPI",   movie: id => `https://moviesapi.club/movie/${id}`,            tv: (id,s,e) => `https://moviesapi.club/tv/${id}-${s}-${e}` },
  { name: "MultiEmbed",  movie: id => `https://multiembed.mov/?video_id=${id}&tmdb=1`,  tv: (id,s,e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
  { name: "SuperEmbed",  movie: id => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1`, tv: (id,s,e) => `https://multiembed.mov/directstream.php?video_id=${id}&tmdb=1&s=${s}&e=${e}` },
];

function resolveSources(item, season, episode){
  const isTV = item.type === "series" || item.type === "tv";
  const id = item.tmdbId;
  const s = season || 1, e = episode || 1;

  let out = [];
  const epKey = `tv:${id}:S${s}E${e}`;
  const key   = isTV ? `tv:${id}` : `movie:${id}`;
  
  if (isTV && SOURCE_REGISTRY[epKey]) out = out.concat(SOURCE_REGISTRY[epKey]);
  if (SOURCE_REGISTRY[key])           out = out.concat(SOURCE_REGISTRY[key]);

  EMBED_SERVERS.forEach(srv => {
    const url = isTV ? srv.tv(id, s, e) : srv.movie(id);
    out.push({ label: srv.name, quality: "auto", type: "embed", url });
  });

  const pool = DEMO_POOL[(id || 0) % DEMO_POOL.length];
  pool.variants.forEach(v => out.push({
    label: `Demo · ${v.quality === "auto" ? pool.name + " (HLS)" : v.quality}`,
    quality: v.quality, type: v.type, url: v.url,
  }));

  return out;
}