# Roblox Stats

A personal dashboard for tracking which **genres** and **trends** are popular on Roblox right now.

> **Status:** the dashboard runs on built-in **mock data** by default. A **live mode** collects real
> player counts from Roblox's public API for the games you choose to track (see [Live data](#live-data)).
> Not affiliated with Roblox Corporation.

## Run it

Needs Node.js 22.13 or newer. There are no dependencies to install.

```bash
npm start        # mock data, http://localhost:3000
npm run live     # real data you've collected, plus the collector running alongside
npm run dev      # mock data, restarts when server files change
npm test         # unit, API and collector tests
```

Use `PORT=4000 npm start` to pick another port.

## What's in it

| Page | What it shows |
|---|---|
| **Overview** (`#/`) | Players right now across tracked games, most popular / fastest-growing / weakest genre, hottest trend, genre share, genre movers, trending keywords, rising games |
| **Genres** (`#/genres`) | All 17 official Roblox genres with share of players, change and a sparkline |
| **Genre detail** (`#/genres/simulation`) | Players over time, subgenre split, top games |
| **Trends** (`#/trends`) | Keywords from game titles ("Egg", "Brainrot", "Valley"…), sortable by hottest, fastest growing, most players, most new games |
| **Trend detail** (`#/trends/egg`) | Players over time, which genres the keyword shows up in, the games using it |

Every page can switch between **24 hours** and **7 days**, and supports light and dark mode.

## Live data

1. **Pick games to track.** Copy game links from roblox.com:

   ```bash
   npm run track -- add https://www.roblox.com/games/1234567890/Some-Game https://www.roblox.com/games/...
   npm run track -- list
   npm run track -- remove <universe id>
   ```

   A bare number is treated as a place ID (the number in a game link). Use `u:<id>` for a universe ID.

2. **Start it.** `npm run live` serves the dashboard on the collected data and polls Roblox every
   5 minutes while it runs. To poll without the dashboard, use `npm run collect` (keeps polling) or
   `npm run collect -- --once` (one poll, for cron or Windows Task Scheduler).

3. **Wait for history.** Charts fill in as hours pass. The "vs 24h ago" changes need a day of data,
   and "vs 7 days ago" needs a week. Until then they compare against the oldest data there is.

Settings (environment variables): `COLLECT_EVERY` (default `5m`, minimum `1m`), `DB_PATH` (default
`data/roblox-stats.db`), `PORT`.

How live data behaves:

- Each poll saves every tracked game's player count, name, creator, genre and release date.
  Icons are fetched once per game.
- The dashboard uses the last poll in each hour. If the collector misses a few hours, the last count is
  carried forward for up to 6 hours; longer gaps show as 0.
- Games whose genre Roblox doesn't report go into an **Unclassified** genre.
- Game names link to the game on roblox.com.

> Built and tested against a fake Roblox server, because the environment it was built in can't reach
> Roblox. The first real run should confirm the genre fields (`genre_l1` / `genre_l2` in
> `server/roblox/normalize.js`). If every game shows up as Unclassified, those field names are the place to look.

## How it's built

```
server/
  index.js             starts the HTTP server (and the collector with --live)
  app.js               routes: static files from public/ + JSON API
  store.js             picks the data source: mock (default) or live
  analytics.js         genre shares, trends, risers… computed from raw data
  collector.js         polls Roblox for tracked games and saves the results
  db.js                SQLite tables (games, snapshots) via built-in node:sqlite
  data/mock-store.js   fake games + hourly player counts
  data/sqlite-store.js collected snapshots → hourly series
  cli/track.js         add / list / remove tracked games
  cli/collect.js       run the collector on its own
  lib/keywords.js      turns game titles into trend keywords
  roblox/client.js     Roblox public API calls (batching, retries, backoff)
  roblox/normalize.js  maps Roblox's game data onto the app's shape
  roblox/genres.js     official Roblox genre/subgenre list
public/
  index.html, css/styles.css
  js/main.js           hash router, range + theme toggles
  js/views/*.js        one file per page
  js/charts.js         line chart, bar lists, sparklines (plain SVG/HTML, no libraries)
test/                  node:test suites (the collector tests use a fake Roblox server)
```

### Data contract

The analytics only need a **store** with three methods. Both the mock store and the live store
implement them:

```js
store.listGames()   // [{ id, rootPlaceId, name, genre, subgenre, creator: { type, id, name }, created, maxPlayers, iconUrl }]
store.getTimeline() // hourly timestamps, oldest first, last one = "now" (up to 169 points = 7 days)
store.getSeries(id) // player counts for that game, one per timeline entry (0 = no data / not out yet)
```

`genre` is a slug like `roleplay-avatar-sim` (see `server/roblox/genres.js`), and `subgenre` is the
Roblox subgenre name.

### API

All endpoints take `?range=24h|7d` (default `24h`). In live mode they return `503` until the first poll.

| Endpoint | Returns |
|---|---|
| `GET /api/overview` | Platform total + series, genres, top/fastest/weakest genre, top trends, rising games |
| `GET /api/genres` | Every genre with players, share, change, sparkline, top game |
| `GET /api/genres/:id` | One genre: series, subgenres, top 25 games |
| `GET /api/trends?sort=hot\|growth\|players\|new` | Up to 50 keywords |
| `GET /api/trends/:keyword` | One keyword: series, genre mix, top 25 games |

### How the numbers work

- **Change** compares the latest hour with the same hour 24 hours (or 7 days) earlier, so the daily
  up-and-down cycle doesn't fake a trend.
- **Genre share** = players in a genre ÷ players across all tracked games.
- **Trends** come from splitting every game title into words, dropping filler words ("the", "update",
  "mega"…), merging simple plurals, and keeping words used by at least 3 games.
- **Hottest** = most players gained; **Fastest growing** = biggest % gain among keywords with at least
  1,000 players.
- **New** marks games released inside the selected window; "—" means there's no earlier count to
  compare against yet.

## Next steps

1. **First real run.** Track a handful of games, run `npm run live`, and check genres and icons come
   through (see the note under [Live data](#live-data)).
2. **Finding games automatically.** Grow the tracked list from Roblox's charts/discover lists, from
   groups' other games, and by checking newly created universe IDs, so trends cover more than a hand-picked list.
3. **Keep it running.** Live data only builds up while the collector runs, so it needs an always-on
   machine (an old laptop, a Raspberry Pi, or a small cloud server).
4. **Storage over time.** Snapshots every 5 minutes add up. Keep recent data at full detail and roll older
   data up into hourly rows.
5. **Game pages.** A page per game with its own history, using the data that's already collected.
6. **Respect rate limits.** Roblox's public endpoints are rate-limited and mostly undocumented. The
   client batches requests and backs off on `429`, but check Roblox's terms before polling heavily.
