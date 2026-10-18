import assert from 'node:assert/strict';
import { once } from 'node:events';
import http from 'node:http';
import test, { after, beforeEach } from 'node:test';
import * as analytics from '../server/analytics.js';
import { collectOnce, parseDuration, parseTarget, resolveTargets } from '../server/collector.js';
import { createSqliteStore } from '../server/data/sqlite-store.js';
import { openDatabase } from '../server/db.js';
import { createRobloxClient } from '../server/roblox/client.js';
import { toGameRecord } from '../server/roblox/normalize.js';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 18, 10, 5);

// A stand-in for Roblox's APIs so the collector can be tested offline.
const fakeGames = new Map();
let rateLimitNext = 0;

function resetFakeGames() {
  fakeGames.clear();
  for (const game of [
    { id: 101, rootPlaceId: 1001, name: 'Steal a Brainrot Base', genre_l1: 'Simulation', genre_l2: 'Tycoon', playing: 1000 },
    { id: 102, rootPlaceId: 1002, name: 'Egg Obby', genre_l1: 'Obby & Platformer', genre_l2: 'Classic Obby', playing: 400 },
    { id: 103, rootPlaceId: 1003, name: 'Old Hangout', genre: 'All', playing: 50 },
  ]) {
    fakeGames.set(game.id, {
      creator: { id: 7, name: 'Brickforge Studio', type: 'Group' },
      visits: 10_000,
      maxPlayers: 12,
      created: '2025-01-01T00:00:00.000Z',
      updated: '2026-10-01T00:00:00.000Z',
      favoritedCount: 99,
      ...game,
    });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const ids = (url.searchParams.get('universeIds') ?? '').split(',').filter(Boolean).map(Number);
  const json = (body) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  if (rateLimitNext > 0) {
    rateLimitNext -= 1;
    res.writeHead(429);
    return res.end();
  }
  if (url.pathname === '/v1/games') return json({ data: ids.map((id) => fakeGames.get(id)).filter(Boolean) });
  if (url.pathname === '/v1/games/icons') {
    return json({ data: ids.map((id) => ({ targetId: id, state: 'Completed', imageUrl: `https://tr.rbxcdn.com/${id}.png` })) });
  }
  const place = /^\/universes\/v1\/places\/(\d+)\/universe$/.exec(url.pathname);
  if (place) {
    const game = [...fakeGames.values()].find((g) => g.rootPlaceId === Number(place[1]));
    return json({ universeId: game?.id ?? null });
  }
  res.writeHead(404);
  res.end();
});
server.listen(0);
await once(server, 'listening');
after(() => server.close());

const base = `http://localhost:${server.address().port}`;
const client = createRobloxClient({
  gamesApi: base,
  thumbnailsApi: base,
  universesApi: base,
  batchSize: 2,
  batchDelayMs: 0,
  retryDelayMs: 5,
});

let db;
beforeEach(() => {
  resetFakeGames();
  rateLimitNext = 0;
  db = openDatabase(':memory:');
});

test('parses game links, place IDs and universe IDs', () => {
  assert.deepEqual(parseTarget('https://www.roblox.com/games/109983668079237/Steal-a-Brainrot'), { placeId: 109983668079237 });
  assert.deepEqual(parseTarget('https://www.roblox.com/es/games/1234/x'), { placeId: 1234 });
  assert.deepEqual(parseTarget('1234'), { placeId: 1234 });
  assert.deepEqual(parseTarget('u:7709344486'), { universeId: 7709344486 });
  assert.equal(parseTarget('https://example.com/games/1'), null);
  assert.equal(parseTarget('hello'), null);
});

test('reads poll intervals and refuses anything faster than a minute', () => {
  assert.equal(parseDuration('5m'), 300_000);
  assert.equal(parseDuration('90s'), 90_000);
  assert.equal(parseDuration('1h'), 3_600_000);
  assert.throws(() => parseDuration('10s'));
  assert.throws(() => parseDuration('soon'));
});

test('maps Roblox genre fields onto the official taxonomy', () => {
  const record = toGameRecord(fakeGames.get(101));
  assert.equal(record.genre, 'simulation');
  assert.equal(record.subgenre, 'Tycoon');
  assert.equal(record.creator.type, 'group');
  assert.equal(toGameRecord(fakeGames.get(103)).genre, null);
});

test('resolves place IDs to universe IDs', async () => {
  const resolved = await resolveTargets(client, [{ placeId: 1002 }, { universeId: 5 }, { placeId: 9999 }]);
  assert.deepEqual(resolved.map((t) => t.universeId), [102, 5, null]);
});

test('a failed lookup is reported without losing the other targets', async () => {
  const offline = createRobloxClient({ universesApi: 'http://127.0.0.1:9', retries: 1, retryDelayMs: 5 });
  const [place, universe] = await resolveTargets(offline, [{ placeId: 1 }, { universeId: 5 }]);
  assert.match(place.error, /Couldn't reach 127\.0\.0\.1:9/);
  assert.equal(universe.universeId, 5);
});

test('collects tracked games, icons, and reports games Roblox did not return', async () => {
  db.trackGames([101, 102, 103, 404]);
  const result = await collectOnce({ db, client, now: T0 });
  assert.deepEqual(result, { tracked: 4, saved: 3, missing: 1, iconError: null });

  const games = db.listGames();
  assert.equal(games.length, 3);
  const brainrot = games.find((g) => g.id === 101);
  assert.equal(brainrot.name, 'Steal a Brainrot Base');
  assert.equal(brainrot.iconUrl, 'https://tr.rbxcdn.com/101.png');
  assert.equal(brainrot.rootPlaceId, 1001);
});

test('retries when Roblox rate-limits a request', async () => {
  db.trackGames([101]);
  rateLimitNext = 2;
  const result = await collectOnce({ db, client, now: T0 });
  assert.equal(result.saved, 1);
});

test('live store turns polls into hourly series the dashboard can use', async () => {
  db.trackGames([101, 102, 103]);
  for (const [hour, brainrot, obby] of [[0, 1000, 400], [1, 1500, 380], [2, 2000, 360]]) {
    fakeGames.get(101).playing = brainrot;
    fakeGames.get(102).playing = obby;
    await collectOnce({ db, client, now: T0 + hour * HOUR });
  }
  // A second poll in the same hour replaces that hour's value.
  fakeGames.get(101).playing = 2100;
  await collectOnce({ db, client, now: T0 + 2 * HOUR + 20 * 60_000 });

  const store = createSqliteStore(db);
  assert.equal(store.source, 'live');
  assert.equal(store.getTimeline().length, 3);
  assert.deepEqual(store.getSeries(101), [1000, 1500, 2100]);

  const overview = analytics.overview(store, '24h');
  assert.equal(overview.platform.playing, 2100 + 360 + 50);
  assert.equal(overview.platform.series.length, 3);
  assert.equal(overview.topGenre.id, 'simulation');
  assert.ok(overview.genres.some((g) => g.id === 'unclassified' && g.playing === 50));
  assert.equal(overview.updatedAt, new Date(T0 + 2 * HOUR + 20 * 60_000).toISOString());

  const genre = analytics.genreDetail(store, '24h', 'unclassified');
  assert.equal(genre.games[0].name, 'Old Hangout');
  assert.equal(genre.games[0].placeId, 1003);
});

test('short gaps carry the last count forward, long ones drop to zero', async () => {
  db.trackGames([101]);
  await collectOnce({ db, client, now: T0 });
  await collectOnce({ db, client, now: T0 + 3 * HOUR });
  await collectOnce({ db, client, now: T0 + 12 * HOUR });
  const series = createSqliteStore(db).getSeries(101);
  assert.equal(series.length, 13);
  assert.deepEqual(series.slice(0, 4), [1000, 1000, 1000, 1000]);
  assert.deepEqual(series.slice(4, 13), [1000, 1000, 1000, 1000, 1000, 1000, 0, 0, 1000]);
});

test('an empty database explains how to start collecting', () => {
  assert.throws(() => createSqliteStore(db), (error) => error.status === 503 && /npm run track/.test(error.message));
});
