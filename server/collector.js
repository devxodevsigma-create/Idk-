// Polls Roblox for every tracked game and saves the results.

import { toGameRecord } from './roblox/normalize.js';

const MIN_INTERVAL_MS = 60_000;

export async function collectOnce({ db, client, now = Date.now() }) {
  const ids = db.trackedIds();
  if (!ids.length) return { tracked: 0, saved: 0, missing: 0 };

  const records = (await client.fetchGames(ids)).map(toGameRecord);
  db.savePoll(records, now);

  // Icons are nice to have; a failure here shouldn't lose the poll above.
  let iconError = null;
  const needIcons = db.idsMissingIcons();
  if (needIcons.length) {
    try {
      const icons = await client.fetchIcons(needIcons);
      db.saveIcons(icons.filter((icon) => icon.state === 'Completed' && icon.imageUrl?.startsWith('https://')));
    } catch (error) {
      iconError = error.message;
    }
  }

  return { tracked: ids.length, saved: records.length, missing: ids.length - records.length, iconError };
}

export function startCollector({ db, client, everyMs, log = console.log }) {
  let timer = null;
  let stopped = false;

  const run = async () => {
    try {
      log(`[collector] ${describe(await collectOnce({ db, client }))}`);
    } catch (error) {
      log(`[collector] poll failed: ${error.message}`);
    } finally {
      if (!stopped) timer = setTimeout(run, everyMs);
    }
  };

  run();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}

export function describe({ tracked, saved, missing, iconError }) {
  if (!tracked) return 'no games tracked yet. Add some with "npm run track -- add <roblox game link>"';
  const parts = [`saved ${saved}/${tracked} games`];
  if (missing) parts.push(`${missing} not returned by Roblox (private or deleted?)`);
  if (iconError) parts.push(`icons failed: ${iconError}`);
  return parts.join(', ');
}

// "5m", "90s", "1h" -> milliseconds. Anything under a minute is refused to go easy on Roblox.
export function parseDuration(text) {
  const match = /^(\d+)\s*(s|m|h)$/i.exec(String(text).trim());
  if (!match) throw new Error(`Can't read "${text}" as a duration. Use something like 5m, 90s or 1h.`);
  const ms = Number(match[1]) * { s: 1000, m: 60_000, h: 3_600_000 }[match[2].toLowerCase()];
  if (ms < MIN_INTERVAL_MS) throw new Error('Poll at most once a minute.');
  return ms;
}

// Accepts roblox.com game links, bare place IDs, or "u:<universe id>".
export function parseTarget(text) {
  const universe = /^u(?:niverse)?:(\d+)$/i.exec(text);
  if (universe) return { universeId: Number(universe[1]) };
  const link = /roblox\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?games\/(\d+)/i.exec(text);
  if (link) return { placeId: Number(link[1]) };
  if (/^\d+$/.test(text)) return { placeId: Number(text) };
  return null;
}

// Turns parsed targets into universe IDs, looking up place IDs on Roblox.
// A failed lookup is reported on that target instead of stopping the rest.
export async function resolveTargets(client, targets) {
  const resolved = [];
  for (const target of targets) {
    try {
      const universeId = target.universeId ?? (await client.universeIdForPlace(target.placeId));
      resolved.push({ ...target, universeId });
    } catch (error) {
      resolved.push({ ...target, universeId: null, error: error.message });
    }
  }
  return resolved;
}
