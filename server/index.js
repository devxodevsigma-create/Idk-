import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;

createApp().listen(port, () => {
  console.log(`Roblox Stats running at http://localhost:${port} (data: ${process.env.DATA_SOURCE ?? 'mock'})`);
});
