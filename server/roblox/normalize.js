import { GENRES, slugify } from './genres.js';

// Maps one game from games.roblox.com/v1/games onto the shape the app stores.
// Genre comes from the genre_l1 / genre_l2 fields (Roblox's 2024 taxonomy); games
// without a recognised value end up as "Unclassified" in the dashboard.
export function toGameRecord(raw) {
  const genre = GENRES.find((g) => g.id === slugify(raw.genre_l1 ?? ''));
  const subgenre = genre?.subgenres.find((name) => slugify(name) === slugify(raw.genre_l2 ?? '')) ?? null;
  return {
    id: raw.id,
    rootPlaceId: raw.rootPlaceId ?? null,
    name: raw.name,
    genre: genre?.id ?? null,
    subgenre,
    creator: {
      type: raw.creator?.type === 'Group' ? 'group' : 'user',
      id: raw.creator?.id ?? null,
      name: raw.creator?.name ?? 'Unknown creator',
    },
    created: raw.created ?? null,
    updated: raw.updated ?? null,
    maxPlayers: raw.maxPlayers ?? null,
    visits: raw.visits ?? null,
    favorites: raw.favoritedCount ?? null,
    playing: raw.playing ?? 0,
  };
}
