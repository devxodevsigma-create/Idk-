import { createMockStore } from './data/mock-store.js';

const HOUR = 3_600_000;
let mock = null;
let live = null;

// Picks the data source: "mock" (default) or "live" (what the collector saved).
export async function getStore() {
  const source = process.env.DATA_SOURCE ?? 'mock';
  if (source === 'mock') return mockStore();
  if (source === 'live') return liveStore();
  throw new Error(`Unknown DATA_SOURCE "${source}". Use "mock" or "live".`);
}

function mockStore() {
  const hour = Math.floor(Date.now() / HOUR);
  if (mock?.hour !== hour) mock = { hour, store: createMockStore({ now: Date.now() }) };
  return mock.store;
}

// Loaded on demand so mock mode never touches SQLite. Rebuilt after each new poll.
async function liveStore() {
  const [{ getDatabase }, { createSqliteStore }] = await Promise.all([
    import('./db.js'),
    import('./data/sqlite-store.js'),
  ]);
  const db = getDatabase();
  const { last } = db.snapshotRange();
  if (last == null || live?.last !== last) live = { last, store: createSqliteStore(db) };
  return live.store;
}
