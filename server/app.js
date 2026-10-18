import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as analytics from './analytics.js';
import { getStore } from './store.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const range = (query) => analytics.parseRange(query.get('range'));

const API_ROUTES = [
  [/^\/api\/health$/, (store) => ({ ok: true })],
  [/^\/api\/overview$/, (store, query) => analytics.overview(store, range(query))],
  [/^\/api\/genres$/, (store, query) => analytics.genres(store, range(query))],
  [/^\/api\/genres\/([a-z0-9-]+)$/, (store, query, id) => analytics.genreDetail(store, range(query), id)],
  [/^\/api\/trends$/, (store, query) => analytics.trends(store, range(query), query.get('sort'))],
  [/^\/api\/trends\/([a-z]+)$/, (store, query, keyword) => analytics.trendDetail(store, range(query), keyword)],
];

export function createApp() {
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' });
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname.startsWith('/api/')) return handleApi(url, res);
      return await serveStatic(url.pathname, res);
    } catch (error) {
      console.error(error);
      return sendJson(res, 500, { error: error.message });
    }
  });
}

function handleApi(url, res) {
  for (const [pattern, handler] of API_ROUTES) {
    const match = url.pathname.match(pattern);
    if (!match) continue;
    const store = getStore();
    const body = handler(store, url.searchParams, ...match.slice(1));
    if (!body) return sendJson(res, 404, { error: 'Not found' });
    return sendJson(res, 200, { source: store.source, ...body });
  }
  return sendJson(res, 404, { error: 'Not found' });
}

async function serveStatic(pathname, res) {
  let file;
  try {
    const relative = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
    file = path.join(PUBLIC_DIR, relative);
  } catch {
    return sendText(res, 400, 'Bad request');
  }
  if (!file.startsWith(PUBLIC_DIR)) return sendText(res, 404, 'Not found');

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME_TYPES[path.extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': MIME_TYPES['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}
