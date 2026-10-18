// npm start       dashboard on mock data
// npm run live    dashboard on collected data, with the collector running alongside

import { createApp } from './app.js';

const live = process.argv.includes('--live');
if (live) process.env.DATA_SOURCE = 'live';
const port = Number(process.env.PORT) || 3000;

createApp().listen(port, () => {
  console.log(`Roblox Stats running at http://localhost:${port} (data: ${process.env.DATA_SOURCE ?? 'mock'})`);
});

if (live) {
  const [{ startCollector, parseDuration }, { getDatabase }, { createRobloxClient }] = await Promise.all([
    import('./collector.js'),
    import('./db.js'),
    import('./roblox/client.js'),
  ]);
  const every = process.env.COLLECT_EVERY ?? '5m';
  console.log(`Collecting every ${every}.`);
  startCollector({ db: getDatabase(), client: createRobloxClient(), everyMs: parseDuration(every) });
}
