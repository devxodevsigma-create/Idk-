# Roblox Stats

A personal dashboard for tracking which **genres** and **trends** are popular on Roblox right now.

> **Status: mockup.** Every number comes from a built-in mock data generator. The pages, API and
> analytics are real and are built so a live data source can be dropped in later without changing them.
> Not affiliated with Roblox Corporation.

## Run it

Needs Node.js 20 or newer. There are no dependencies to install.

```bash
npm start        # http://localhost:3000
npm run dev      # same, restarts when server files change
npm test         # unit + API tests
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

## How it's built

```
server/
  index.js          starts the HTTP server
  app.js            routes: static files from public/ + JSON API
  store.js          picks the data source (only "mock" for now)
  analytics.js      genre shares, trends, risers… computed from raw data
  data/mock-store.js   fake games + hourly player counts
  lib/keywords.js   turns game titles into trend keywords
  roblox/genres.js  official Roblox genre/subgenre list
  roblox/client.js  wrappers for Roblox's public APIs (not wired up yet)
public/
  index.html, css/styles.css
  js/main.js        hash router, range + theme toggles
  js/views/*.js     one file per page
  js/charts.js      line chart, bar lists, sparklines (plain SVG/HTML, no libraries)
test/               node:test suites
```

### Data contract

The analytics only need a **store** with three methods. The mock store implements them today; a real
database-backed store has to implement the same three:

```js
store.listGames()   // [{ id, name, genre, subgenre, creator: { type, id, name }, created, maxPlayers, iconUrl }]
store.getTimeline() // hourly timestamps, oldest first, last one = "now" (169 points = 7 days)
store.getSeries(id) // player counts for that game, one per timeline entry (0 = not out yet)
```

`genre` is a slug like `roleplay-avatar-sim` (see `server/roblox/genres.js`), and `subgenre` is the
Roblox subgenre name.

### API

All endpoints take `?range=24h|7d` (default `24h`).

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

## Next steps

1. **Collector.** A background job that, every few minutes, calls `fetchGames()` in
   `server/roblox/client.js` for the tracked universe IDs and saves `(universe_id, time, playing)` rows.
   Poll the top games often (every 1–5 min) and the long tail less often.
2. **Database.** SQLite is enough to start (`games` table + `snapshots` table). Add a `sqlite` store
   in `server/store.js` that implements the three methods above by rounding snapshots to the hour.
3. **Finding games.** Start from a hand-picked list of universe IDs, then grow it from Roblox's
   charts/discover lists, from groups' other games, and by checking newly created universe IDs.
4. **Genres.** Map the genre/subgenre fields from the games API onto the slugs in `genres.js`
   (check the exact field names against a live response first).
5. **Icons.** Fill `iconUrl` from `fetchIcons()` and show it in `gameCell()` instead of the letter.
6. **Respect rate limits.** Roblox's public endpoints are rate-limited and mostly undocumented: batch
   requests, cache results, back off on `429`, and check Roblox's terms before polling heavily.
