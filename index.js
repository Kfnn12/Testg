export const BASE_API_URL = '[https://ogkgn.vercel.app](https://ogkgn.vercel.app)';
export const M3U8_PROXIES = [
  '[https://proxy1-delta-lake.vercel.app/m3u8-proxy?url=](https://proxy1-delta-lake.vercel.app/m3u8-proxy?url=)',
  '[https://hianimeproxy-olive.vercel.app/m3u8?url=](https://hianimeproxy-olive.vercel.app/m3u8?url=)',
  '[https://animepahe-proxy.vercel.app/m3u8-proxy?url=](https://animepahe-proxy.vercel.app/m3u8-proxy?url=)',
];

export async function fetchFromApi(path) {
  const response = await fetch(`${BASE_API_URL}${path}`);
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json();
}

export function normalizeAnime(anime) {
  if (!anime) return null;
  return {
    id: anime.id,
    name: anime.name,
    jname: anime.romaji || anime.japanese,
    poster: anime.posterImage || anime.poster,
    rating: anime.rating,
    episodes: anime.episodes || { sub: 0, dub: 0 },
    type: anime.type,
    duration: anime.duration,
  };
}

export function normalizeSpotlightAnime(anime) {
  if (!anime) return null;
  const rankMatch = anime.spotlight?.match(/#(\d+)/);
  const rank = rankMatch ? parseInt(rankMatch[1]) : 1;
  return {
    ...normalizeAnime(anime),
    rank,
    description: anime.synopsis || anime.description || '',
    otherInfo: [anime.type, anime.releaseDate, anime.quality].filter(Boolean),
  };
}
