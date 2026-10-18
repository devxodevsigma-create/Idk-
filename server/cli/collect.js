// npm run collect             poll every 5 minutes until stopped
// npm run collect -- --every 10m
// npm run collect -- --once   poll once and exit (for cron / Task Scheduler)

import { parseArgs } from 'node:util';
import { collectOnce, describe, parseDuration, startCollector } from '../collector.js';
import { getDatabase } from '../db.js';
import { createRobloxClient } from '../roblox/client.js';

const { values } = parseArgs({
  options: {
    once: { type: 'boolean', default: false },
    every: { type: 'string', default: process.env.COLLECT_EVERY ?? '5m' },
  },
});

const db = getDatabase();
const client = createRobloxClient();

if (values.once) {
  try {
    console.log(describe(await collectOnce({ db, client })));
  } catch (error) {
    console.error(`Poll failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    db.close();
  }
} else {
  const everyMs = parseDuration(values.every);
  console.log(`Collecting every ${values.every}. Press Ctrl+C to stop.`);
  startCollector({ db, client, everyMs });
}
