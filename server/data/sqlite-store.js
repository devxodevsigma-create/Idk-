// Live data source: reads what the collector saved and serves it in the same
// shape as the mock store (hourly timeline, one player count per hour per game).

const HOUR = 3_600_000;
const HISTORY_HOURS = 168;
// Hours the collector missed are filled with the last count, up to this many hours.
const MAX_GAP_HOURS = 6;

export function createSqliteStore(db) {
  const { first, last } = db.snapshotRange();
  if (last == null) {
    throw Object.assign(
      new Error('No data collected yet. Add games with "npm run track" and start collecting with "npm run live" (see the README).'),
      { status: 503 },
    );
  }

  // The timeline only covers hours we actually have data for (at most 7 days).
  const endHour = Math.floor(last / HOUR);
  const startHour = Math.max(Math.floor(first / HOUR), endHour - HISTORY_HOURS);
  const timeline = Array.from({ length: endHour - startHour + 1 }, (_, i) => (startHour + i) * HOUR);

  const games = db.listGames();
  const series = new Map(games.map((game) => [game.id, new Array(timeline.length).fill(null)]));
  for (const row of db.hourlySnapshots(startHour * HOUR)) {
    const values = series.get(row.id);
    if (values) values[row.hour - startHour] = row.playing;
  }
  for (const values of series.values()) fillGaps(values);

  return {
    source: 'live',
    lastPolled: last,
    listGames: () => games,
    getTimeline: () => timeline,
    getSeries: (id) => series.get(id) ?? [],
  };
}

// Before a game's first poll the count is 0 (not tracked yet); short gaps after
// that carry the last count forward, longer ones drop to 0.
function fillGaps(values) {
  let lastKnown = 0;
  let gap = 0;
  values.forEach((value, i) => {
    if (value !== null) {
      lastKnown = value;
      gap = 0;
    } else {
      gap += 1;
      values[i] = gap <= MAX_GAP_HOURS ? lastKnown : 0;
    }
  });
}
