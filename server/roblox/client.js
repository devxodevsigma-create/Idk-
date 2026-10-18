// Thin wrappers around Roblox's public web APIs (no API key needed).
// Not used yet: the collector that calls these on a schedule is the next step
// (see "Next steps" in the README). Not yet tested against the live API.

const GAMES_API = 'https://games.roblox.com/v1/games';
const ICONS_API = 'https://thumbnails.roblox.com/v1/games/icons';
const UNIVERSES_API = 'https://apis.roblox.com/universes/v1/places';
const BATCH_SIZE = 50;

async function getJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`Roblox API returned ${res.status} for ${url}`);
  return res.json();
}

async function inBatches(ids, fetchBatch) {
  const results = [];
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    results.push(...(await fetchBatch(ids.slice(i, i + BATCH_SIZE).join(','))));
  }
  return results;
}

// Live player count, visits, favorites, creator, genre, created/updated dates.
export function fetchGames(universeIds) {
  return inBatches(universeIds, async (ids) => (await getJson(`${GAMES_API}?universeIds=${ids}`)).data);
}

// Likes and dislikes.
export function fetchVotes(universeIds) {
  return inBatches(universeIds, async (ids) => (await getJson(`${GAMES_API}/votes?universeIds=${ids}`)).data);
}

// Icon image URLs (served from rbxcdn.com).
export function fetchIcons(universeIds, size = '150x150') {
  return inBatches(universeIds, async (ids) =>
    (await getJson(`${ICONS_API}?universeIds=${ids}&size=${size}&format=Png&isCircular=false`)).data);
}

// Game links on roblox.com use place IDs; the endpoints above want universe IDs.
export async function universeIdForPlace(placeId) {
  return (await getJson(`${UNIVERSES_API}/${placeId}/universe`)).universeId;
}
