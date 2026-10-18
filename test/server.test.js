import assert from 'node:assert/strict';
import { once } from 'node:events';
import test, { after } from 'node:test';
import { createApp } from '../server/app.js';

const server = createApp().listen(0);
await once(server, 'listening');
const base = `http://localhost:${server.address().port}`;
after(() => server.close());

test('serves the dashboard', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /<title>Roblox Stats<\/title>/);
});

test('overview API returns mock data for the requested range', async () => {
  const res = await fetch(`${base}/api/overview?range=7d`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.source, 'mock');
  assert.equal(body.range, '7d');
  assert.ok(body.platform.playing > 0);
});

test('unknown API routes, genres and keywords are 404s', async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  assert.equal((await fetch(`${base}/api/genres/not-a-genre`)).status, 404);
  assert.equal((await fetch(`${base}/api/trends/zzzz`)).status, 404);
});

test('static files cannot escape the public folder', async () => {
  assert.equal((await fetch(`${base}/..%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/..%2f..%2fetc%2fpasswd`)).status, 404);
});
