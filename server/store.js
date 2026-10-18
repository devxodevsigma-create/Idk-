import { createMockStore } from './data/mock-store.js';

const HOUR = 3_600_000;
let cached = null;

// Picks the data source. Only "mock" exists today; a database-backed "live"
// store with the same three methods is the next step (see README).
export function getStore() {
  const source = process.env.DATA_SOURCE ?? 'mock';
  if (source !== 'mock') {
    throw new Error(`DATA_SOURCE=${source} isn't built yet. Only "mock" works for now (see "Next steps" in the README).`);
  }
  const hour = Math.floor(Date.now() / HOUR);
  if (cached?.hour !== hour) cached = { hour, store: createMockStore({ now: Date.now() }) };
  return cached.store;
}
