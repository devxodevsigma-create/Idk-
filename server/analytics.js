// Turns raw games + hourly player counts into the numbers the dashboard shows.
// Works on any store with listGames(), getTimeline() and getSeries(id).

import { extractKeywords } from './lib/keywords.js';
import { GENRES, genreById } from './roblox/genres.js';

const DAY = 86_400_000;
export const RANGES = { '24h': 24, '7d': 168 };
export const MIN_TREND_GAMES = 3;
const MOVER_MIN_SHARE = 0.02;
const RISING_MIN_PLAYERS = 1000;
const SPARK_POINTS = 30;

// Bucket for games whose genre Roblox didn't report (only appears when needed).
export const UNCLASSIFIED = { id: 'unclassified', name: 'Unclassified', subgenres: [] };
const genreOf = (game) => (genreById.has(game.genre) ? game.genre : UNCLASSIFIED.id);

export function parseRange(value) {
  return Object.hasOwn(RANGES, value) ? value : '24h';
}

export function pctChange(now, before) {
  return before > 0 ? (now - before) / before : null;
}

function context(store, range) {
  const timeline = store.getTimeline();
  const start = Math.max(0, timeline.length - 1 - RANGES[range]);
  const games = store.listGames().map((game) => {
    const series = store.getSeries(game.id).slice(start);
    const playing = series.at(-1) ?? 0;
    const before = series[0] ?? 0;
    return { ...game, keywords: extractKeywords(game.name), series, playing, before, change: pctChange(playing, before) };
  });
  return {
    range,
    times: timeline.slice(start),
    now: timeline.at(-1),
    updatedAt: store.lastPolled ?? timeline.at(-1),
    games,
  };
}

function rollup(games, ctx) {
  const series = new Array(ctx.times.length).fill(0);
  for (const game of games) game.series.forEach((value, i) => { series[i] += value; });
  const playing = series.at(-1) ?? 0;
  const before = series[0] ?? 0;
  return { playing, change: pctChange(playing, before), gain: playing - before, games: games.length, series };
}

function points(series, times) {
  return series.map((v, i) => ({ t: times[i], v }));
}

// Evenly thinned series for sparklines, always keeping the latest point.
function spark(series) {
  const step = Math.max(1, Math.ceil(series.length / SPARK_POINTS));
  return series.filter((_, i) => (series.length - 1 - i) % step === 0);
}

function maxBy(items, score) {
  let best = null;
  for (const item of items) if (best === null || score(item) > score(best)) best = item;
  return best;
}

function byPlaying(a, b) {
  return b.playing - a.playing;
}

// Released inside the selected window.
const isNew = (game, ctx) => Date.parse(game.created) >= ctx.times[0];

function gameSummary(game, ctx) {
  return {
    id: game.id,
    placeId: game.rootPlaceId ?? null,
    name: game.name,
    genre: genreOf(game),
    genreName: genreById.get(game.genre)?.name ?? UNCLASSIFIED.name,
    subgenre: game.subgenre,
    creator: game.creator.name,
    created: game.created,
    iconUrl: game.iconUrl ?? null,
    playing: game.playing,
    change: game.change,
    isNew: isNew(game, ctx),
  };
}

function meta(ctx) {
  return { range: ctx.range, updatedAt: new Date(ctx.updatedAt).toISOString() };
}

function genreList(ctx) {
  return ctx.games.some((game) => genreOf(game) === UNCLASSIFIED.id) ? [...GENRES, UNCLASSIFIED] : GENRES;
}

function genreRows(ctx) {
  const total = ctx.games.reduce((sum, game) => sum + game.playing, 0);
  return genreList(ctx).map((genre) => {
    const games = ctx.games.filter((game) => genreOf(game) === genre.id);
    const r = rollup(games, ctx);
    const top = maxBy(games, (game) => game.playing);
    return {
      id: genre.id,
      name: genre.name,
      playing: r.playing,
      share: total ? r.playing / total : 0,
      change: r.change,
      gain: r.gain,
      games: r.games,
      topGame: top && { id: top.id, name: top.name, playing: top.playing },
      spark: spark(r.series),
    };
  }).sort(byPlaying);
}

function gamesByKeyword(ctx) {
  const map = new Map();
  for (const game of ctx.games) {
    for (const keyword of game.keywords) {
      if (!map.has(keyword)) map.set(keyword, []);
      map.get(keyword).push(game);
    }
  }
  return map;
}

function trendRow(keyword, games, ctx) {
  const r = rollup(games, ctx);
  const monthAgo = ctx.now - 30 * DAY;
  const top = maxBy(games, (game) => game.playing);
  return {
    keyword,
    playing: r.playing,
    change: r.change,
    gain: r.gain,
    games: r.games,
    newThisMonth: games.filter((game) => Date.parse(game.created) >= monthAgo).length,
    topGame: top && { id: top.id, name: top.name },
    spark: spark(r.series),
  };
}

function trendRows(ctx) {
  const rows = [];
  for (const [keyword, games] of gamesByKeyword(ctx)) {
    if (games.length >= MIN_TREND_GAMES) rows.push(trendRow(keyword, games, ctx));
  }
  return rows;
}

const growthScore = (row) => (row.playing >= RISING_MIN_PLAYERS && row.change !== null ? row.change : -Infinity);
export const TREND_SORTS = {
  hot: (a, b) => b.gain - a.gain,
  growth: (a, b) => growthScore(b) - growthScore(a),
  players: byPlaying,
  new: (a, b) => b.newThisMonth - a.newThisMonth || b.playing - a.playing,
};

function risingGames(ctx, limit = 8) {
  // Brand-new games first; games with no earlier count to compare against last.
  const score = (game) => (isNew(game, ctx) ? Infinity : game.change ?? -Infinity);
  return ctx.games
    .filter((game) => game.playing >= RISING_MIN_PLAYERS)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
    .map((game) => gameSummary(game, ctx));
}

export function overview(store, range) {
  const ctx = context(store, range);
  const platform = rollup(ctx.games, ctx);
  const peakIndex = platform.series.indexOf(Math.max(...platform.series));
  const genres = genreRows(ctx);
  const movers = genres.filter((genre) => genre.share >= MOVER_MIN_SHARE && genre.change !== null);

  return {
    ...meta(ctx),
    platform: {
      playing: platform.playing,
      change: platform.change,
      gamesTracked: ctx.games.length,
      peak: { value: platform.series[peakIndex], t: ctx.times[peakIndex] },
      series: points(platform.series, ctx.times),
    },
    genres: genres.map(({ spark: _spark, ...genre }) => genre),
    topGenre: genres[0] ?? null,
    fastestGenre: maxBy(movers, (genre) => genre.change),
    slowestGenre: maxBy(movers, (genre) => -genre.change),
    trends: trendRows(ctx).sort(TREND_SORTS.hot).slice(0, 8),
    rising: risingGames(ctx),
  };
}

export function genres(store, range) {
  const ctx = context(store, range);
  return { ...meta(ctx), genres: genreRows(ctx) };
}

export function genreDetail(store, range, id) {
  const genre = id === UNCLASSIFIED.id ? UNCLASSIFIED : genreById.get(id);
  if (!genre) return null;
  const ctx = context(store, range);
  const row = genreRows(ctx).find((r) => r.id === id);
  if (!row) return null;
  const games = ctx.games.filter((game) => genreOf(game) === id);
  const total = rollup(games, ctx);

  const subgenres = genre.subgenres
    .map((name) => {
      const r = rollup(games.filter((game) => game.subgenre === name), ctx);
      return { name, playing: r.playing, share: total.playing ? r.playing / total.playing : 0, change: r.change, games: r.games };
    })
    .sort(byPlaying);

  return {
    ...meta(ctx),
    genre: row,
    series: points(total.series, ctx.times),
    subgenres,
    games: games.sort(byPlaying).slice(0, 25).map((game) => gameSummary(game, ctx)),
  };
}

export function trends(store, range, sort) {
  const ctx = context(store, range);
  const order = Object.hasOwn(TREND_SORTS, sort) ? sort : 'hot';
  return {
    ...meta(ctx),
    sort: order,
    minGames: MIN_TREND_GAMES,
    trends: trendRows(ctx).sort(TREND_SORTS[order]).slice(0, 50),
  };
}

export function trendDetail(store, range, keyword) {
  const ctx = context(store, range);
  const word = keyword.toLowerCase();
  const games = ctx.games.filter((game) => game.keywords.includes(word));
  if (games.length < MIN_TREND_GAMES) return null;

  const row = trendRow(word, games, ctx);
  const genreMix = genreList(ctx).map((genre) => {
    const inGenre = games.filter((game) => genreOf(game) === genre.id);
    const playing = inGenre.reduce((sum, game) => sum + game.playing, 0);
    return { id: genre.id, name: genre.name, games: inGenre.length, playing, share: row.playing ? playing / row.playing : 0 };
  })
    .filter((genre) => genre.games > 0)
    .sort(byPlaying);

  return {
    ...meta(ctx),
    trend: row,
    series: points(rollup(games, ctx).series, ctx.times),
    genres: genreMix,
    games: games.sort(byPlaying).slice(0, 25).map((game) => gameSummary(game, ctx)),
  };
}
