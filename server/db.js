// SQLite storage for live data, using Node's built-in node:sqlite (Node 22.13+).
// One row per tracked game, plus one row per game per poll with its player count.

import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

export const DEFAULT_DB_PATH = fileURLToPath(new URL('../data/roblox-stats.db', import.meta.url));

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS games (
    universe_id   INTEGER PRIMARY KEY,
    root_place_id INTEGER,
    name          TEXT,
    genre         TEXT,
    subgenre      TEXT,
    creator_type  TEXT,
    creator_id    INTEGER,
    creator_name  TEXT,
    created       TEXT,
    updated       TEXT,
    max_players   INTEGER,
    visits        INTEGER,
    favorites     INTEGER,
    icon_url      TEXT,
    tracked       INTEGER NOT NULL DEFAULT 1,
    added_at      INTEGER NOT NULL,
    polled_at     INTEGER
  );

  CREATE TABLE IF NOT EXISTS snapshots (
    universe_id INTEGER NOT NULL,
    ts          INTEGER NOT NULL,
    playing     INTEGER NOT NULL,
    PRIMARY KEY (universe_id, ts)
  ) WITHOUT ROWID;

  CREATE INDEX IF NOT EXISTS snapshots_by_time ON snapshots (ts);
`;

let shared = null;

// The database the server and collector share (DB_PATH, or data/roblox-stats.db).
export function getDatabase() {
  shared ??= openDatabase(process.env.DB_PATH ?? DEFAULT_DB_PATH);
  return shared;
}

export function openDatabase(file) {
  if (file !== ':memory:') mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL'); // lets the dashboard read while the collector writes
  db.exec(SCHEMA);
  return createQueries(db);
}

function createQueries(db) {
  const transaction = (fn) => (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  const sql = {
    track: db.prepare(`
      INSERT INTO games (universe_id, added_at) VALUES (?, ?)
      ON CONFLICT (universe_id) DO UPDATE SET tracked = 1`),
    untrack: db.prepare('UPDATE games SET tracked = 0 WHERE universe_id = ? AND tracked = 1'),
    trackedIds: db.prepare('SELECT universe_id AS id FROM games WHERE tracked = 1 ORDER BY universe_id'),
    trackedGames: db.prepare(`
      SELECT universe_id AS id, name, polled_at AS polledAt FROM games
      WHERE tracked = 1 ORDER BY name IS NULL, name`),
    saveGame: db.prepare(`
      UPDATE games SET root_place_id = ?, name = ?, genre = ?, subgenre = ?, creator_type = ?,
        creator_id = ?, creator_name = ?, created = ?, updated = ?, max_players = ?, visits = ?,
        favorites = ?, polled_at = ?
      WHERE universe_id = ?`),
    saveSnapshot: db.prepare('INSERT OR REPLACE INTO snapshots (universe_id, ts, playing) VALUES (?, ?, ?)'),
    missingIcons: db.prepare('SELECT universe_id AS id FROM games WHERE tracked = 1 AND name IS NOT NULL AND icon_url IS NULL'),
    saveIcon: db.prepare('UPDATE games SET icon_url = ? WHERE universe_id = ?'),
    listGames: db.prepare(`
      SELECT universe_id AS id, root_place_id AS rootPlaceId, name, genre, subgenre,
        creator_type AS creatorType, creator_id AS creatorId, creator_name AS creatorName,
        created, max_players AS maxPlayers, icon_url AS iconUrl
      FROM games WHERE tracked = 1 AND name IS NOT NULL`),
    snapshotRange: db.prepare('SELECT MIN(ts) AS first, MAX(ts) AS last FROM snapshots'),
    // The last poll in each hour, per game.
    hourlySnapshots: db.prepare(`
      SELECT s.universe_id AS id, s.ts / 3600000 AS hour, s.playing AS playing
      FROM snapshots s
      JOIN (
        SELECT universe_id, MAX(ts) AS ts FROM snapshots
        WHERE ts >= ? GROUP BY universe_id, ts / 3600000
      ) latest ON latest.universe_id = s.universe_id AND latest.ts = s.ts`),
  };

  return {
    trackGames: transaction((ids, now = Date.now()) => {
      for (const id of ids) sql.track.run(id, now);
    }),
    untrackGame: (id) => sql.untrack.run(id).changes > 0,
    trackedIds: () => sql.trackedIds.all().map((row) => row.id),
    trackedGames: () => sql.trackedGames.all(),

    // Saves one poll: fresh metadata for each game plus its player count at `ts`.
    savePoll: transaction((records, ts) => {
      for (const r of records) {
        sql.saveGame.run(r.rootPlaceId, r.name, r.genre, r.subgenre, r.creator.type, r.creator.id,
          r.creator.name, r.created, r.updated, r.maxPlayers, r.visits, r.favorites, ts, r.id);
        sql.saveSnapshot.run(r.id, ts, r.playing);
      }
    }),

    idsMissingIcons: () => sql.missingIcons.all().map((row) => row.id),
    saveIcons: transaction((icons) => {
      for (const icon of icons) sql.saveIcon.run(icon.imageUrl, icon.targetId);
    }),

    listGames: () => sql.listGames.all().map((row) => ({
      id: row.id,
      rootPlaceId: row.rootPlaceId,
      name: row.name,
      genre: row.genre,
      subgenre: row.subgenre,
      creator: { type: row.creatorType, id: row.creatorId, name: row.creatorName },
      created: row.created,
      maxPlayers: row.maxPlayers,
      iconUrl: row.iconUrl,
    })),
    snapshotRange: () => sql.snapshotRange.get(),
    hourlySnapshots: (sinceTs) => sql.hourlySnapshots.all(sinceTs),
    close: () => db.close(),
  };
}
