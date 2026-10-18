// npm run track -- add <roblox game link | place id | u:universe id> ...
// npm run track -- list
// npm run track -- remove <universe id> ...

import { parseTarget, resolveTargets } from '../collector.js';
import { getDatabase } from '../db.js';
import { createRobloxClient } from '../roblox/client.js';

const USAGE = `Usage:
  npm run track -- add <roblox game link | place id | u:universe id> ...
  npm run track -- list
  npm run track -- remove <universe id> ...

Example:
  npm run track -- add https://www.roblox.com/games/1234567890/Some-Game`;

const [command, ...args] = process.argv.slice(2);
const db = getDatabase();

try {
  if (command === 'add' && args.length) await add(args);
  else if (command === 'list') list();
  else if (command === 'remove' && args.length) remove(args);
  else {
    console.log(USAGE);
    process.exitCode = 1;
  }
} finally {
  db.close();
}

async function add(inputs) {
  const targets = [];
  for (const input of inputs) {
    const target = parseTarget(input);
    if (target) targets.push({ input, ...target });
    else console.log(`Skipped "${input}": not a roblox.com game link, place ID or u:<universe id>.`);
  }

  const resolved = await resolveTargets(createRobloxClient(), targets);
  const found = resolved.filter((target) => target.universeId);
  for (const target of resolved) {
    if (target.universeId) console.log(`Tracking universe ${target.universeId} (${target.input})`);
    else if (target.error) console.log(`Couldn't look up "${target.input}": ${target.error}`);
    else console.log(`Couldn't find a game for "${target.input}".`);
  }
  db.trackGames(found.map((target) => target.universeId));
  if (found.length) console.log('\nNames and player counts appear after the next poll ("npm run collect -- --once" to poll now).');
}

function list() {
  const games = db.trackedGames();
  if (!games.length) return console.log('No games tracked yet.\n\n' + USAGE);
  for (const game of games) {
    const polled = game.polledAt ? new Date(game.polledAt).toLocaleString() : 'not polled yet';
    console.log(`${String(game.id).padEnd(14)} ${game.name ?? '(name pending)'}  ·  last poll: ${polled}`);
  }
  console.log(`\n${games.length} ${games.length === 1 ? 'game' : 'games'} tracked.`);
}

function remove(inputs) {
  for (const input of inputs) {
    if (!/^\d+$/.test(input)) {
      console.log(`Skipped "${input}": use the universe ID shown by "npm run track -- list".`);
    } else if (db.untrackGame(Number(input))) {
      console.log(`Stopped tracking ${input}. Its history is kept.`);
    } else {
      console.log(`${input} isn't being tracked.`);
    }
  }
}
