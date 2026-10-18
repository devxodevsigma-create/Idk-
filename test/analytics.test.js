import assert from 'node:assert/strict';
import test from 'node:test';
import * as analytics from '../server/analytics.js';
import { createMockStore } from '../server/data/mock-store.js';
import { GENRES, genreById } from '../server/roblox/genres.js';

const NOW = Date.UTC(2026, 9, 18, 12, 30);
const store = createMockStore({ now: NOW });

test('mock games use real Roblox genres and subgenres', () => {
  for (const game of store.listGames()) {
    const genre = genreById.get(game.genre);
    assert.ok(genre, `${game.name} has unknown genre ${game.genre}`);
    if (genre.subgenres.length) assert.ok(genre.subgenres.includes(game.subgenre), `${game.name}: ${game.subgenre}`);
    else assert.equal(game.subgenre, null);
  }
});

test('mock data is the same for the same hour', () => {
  assert.deepEqual(createMockStore({ now: NOW }).listGames(), store.listGames());
});

test('genre shares cover every genre and add up to 100%', () => {
  const { genres } = analytics.genres(store, '24h');
  assert.equal(genres.length, GENRES.length);
  const total = genres.reduce((sum, genre) => sum + genre.share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('range sets the length of every series', () => {
  assert.equal(analytics.overview(store, '24h').platform.series.length, 25);
  assert.equal(analytics.overview(store, '7d').platform.series.length, 169);
  assert.equal(analytics.parseRange('1y'), '24h');
});

test('trends only include keywords shared by enough games, sorted as asked', () => {
  const { trends, minGames } = analytics.trends(store, '24h', 'hot');
  assert.ok(trends.length > 0);
  for (const trend of trends) assert.ok(trend.games >= minGames);
  for (let i = 1; i < trends.length; i++) assert.ok(trends[i - 1].gain >= trends[i].gain);
});

test('details agree with the list views', () => {
  const [topTrend] = analytics.trends(store, '24h', 'players').trends;
  assert.equal(analytics.trendDetail(store, '24h', topTrend.keyword).trend.playing, topTrend.playing);

  const [topGenre] = analytics.genres(store, '24h').genres;
  const detail = analytics.genreDetail(store, '24h', topGenre.id);
  assert.equal(detail.genre.playing, topGenre.playing);
  assert.equal(detail.subgenres.reduce((sum, sub) => sum + sub.playing, 0), topGenre.playing);
});

test('unknown genres and keywords return null', () => {
  assert.equal(analytics.genreDetail(store, '24h', 'not-a-genre'), null);
  assert.equal(analytics.trendDetail(store, '24h', 'zzzz'), null);
});

test('pctChange has no value without a baseline', () => {
  assert.equal(analytics.pctChange(10, 0), null);
  assert.equal(analytics.pctChange(15, 10), 0.5);
});
