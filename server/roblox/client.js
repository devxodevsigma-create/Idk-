// Thin wrappers around Roblox's public web APIs (no API key needed).
// Requests are batched, spaced out, and retried on rate limits (429), server errors
// and network failures.

const DEFAULTS = {
  gamesApi: 'https://games.roblox.com',
  thumbnailsApi: 'https://thumbnails.roblox.com',
  universesApi: 'https://apis.roblox.com',
  batchSize: 50,
  batchDelayMs: 250,
  retries: 3,
  retryDelayMs: 2000,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createRobloxClient(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function getJson(url, attempt = 0) {
    const backoff = (ms) => sleep(ms || config.retryDelayMs * 2 ** attempt).then(() => getJson(url, attempt + 1));

    let res;
    try {
      res = await fetchImpl(url, { headers: { accept: 'application/json' } });
    } catch (error) {
      if (attempt < config.retries) return backoff();
      throw new Error(`Couldn't reach ${new URL(url).host} (${error.cause?.code ?? error.message})`);
    }
    if ((res.status === 429 || res.status >= 500) && attempt < config.retries) {
      return backoff(Number(res.headers.get('retry-after')) * 1000);
    }
    if (!res.ok) throw new Error(`Roblox API returned ${res.status} for ${url}`);
    return res.json();
  }

  async function inBatches(ids, fetchBatch) {
    const results = [];
    for (let i = 0; i < ids.length; i += config.batchSize) {
      if (i > 0) await sleep(config.batchDelayMs);
      results.push(...(await fetchBatch(ids.slice(i, i + config.batchSize).join(','))));
    }
    return results;
  }

  return {
    // Live player count, visits, favorites, creator, genre, created/updated dates.
    fetchGames: (universeIds) => inBatches(universeIds, async (ids) =>
      (await getJson(`${config.gamesApi}/v1/games?universeIds=${ids}`)).data ?? []),

    // Likes and dislikes.
    fetchVotes: (universeIds) => inBatches(universeIds, async (ids) =>
      (await getJson(`${config.gamesApi}/v1/games/votes?universeIds=${ids}`)).data ?? []),

    // Icon image URLs (served from rbxcdn.com).
    fetchIcons: (universeIds, size = '150x150') => inBatches(universeIds, async (ids) =>
      (await getJson(`${config.thumbnailsApi}/v1/games/icons?universeIds=${ids}&size=${size}&format=Png&isCircular=false`)).data ?? []),

    // Game links on roblox.com use place IDs; the endpoints above want universe IDs.
    universeIdForPlace: async (placeId) =>
      (await getJson(`${config.universesApi}/universes/v1/places/${placeId}/universe`)).universeId ?? null,
  };
}
