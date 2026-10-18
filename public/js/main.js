import { emptyState } from './components.js';
import { time } from './format.js';
import { save, setRange, state } from './state.js';
import { hideTooltip } from './tooltip.js';
import { genreDetailView } from './views/genre-detail.js';
import { genresView } from './views/genres.js';
import { overviewView } from './views/overview.js';
import { trendDetailView } from './views/trend-detail.js';
import { trendsView } from './views/trends.js';

const routes = [
  { pattern: /^\/$/, nav: 'overview', view: overviewView },
  { pattern: /^\/genres$/, nav: 'genres', view: genresView },
  { pattern: /^\/genres\/([a-z0-9-]+)$/, nav: 'genres', view: genreDetailView },
  { pattern: /^\/trends$/, nav: 'trends', view: trendsView },
  { pattern: /^\/trends\/([a-z]+)$/, nav: 'trends', view: trendDetailView },
];

const view = document.getElementById('view');
const updated = document.getElementById('updated');
const badge = document.getElementById('source-badge');
let renderId = 0;
let lastPath = null;

function parseHash() {
  const [path, query = ''] = (location.hash.replace(/^#/, '') || '/').split('?');
  return { path, params: new URLSearchParams(query) };
}

async function render() {
  const id = ++renderId;
  const { path, params } = parseHash();
  const route = routes.find((r) => r.pattern.test(path));

  hideTooltip();
  syncChrome(route?.nav);
  view.classList.add('is-loading');

  try {
    const result = route
      ? await route.view({ range: state.range, params, args: path.match(route.pattern).slice(1) })
      : { node: emptyState('Page not found', 'That page does not exist.') };
    if (id !== renderId) return;

    view.replaceChildren(result.node);
    if (result.updatedAt) updated.textContent = `Data as of ${time(result.updatedAt)}`;
    badge.hidden = result.source !== 'mock';
    if (path !== lastPath) {
      window.scrollTo(0, 0);
      lastPath = path;
    }
  } catch (error) {
    if (id !== renderId) return;
    badge.hidden = true;
    const titles = { 404: 'Not found', 503: 'No data yet' };
    view.replaceChildren(emptyState(titles[error.status] ?? 'Something went wrong',
      error.status === 404 ? 'There is no data for this page.' : error.message));
  } finally {
    if (id === renderId) view.classList.remove('is-loading');
  }
}

function syncChrome(activeNav) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === activeNav) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  for (const button of document.querySelectorAll('[data-range]')) {
    button.setAttribute('aria-pressed', String(button.dataset.range === state.range));
  }
}

for (const button of document.querySelectorAll('[data-range]')) {
  button.addEventListener('click', () => {
    if (button.dataset.range === state.range) return;
    setRange(button.dataset.range);
    render();
  });
}

document.getElementById('theme-toggle').addEventListener('click', () => {
  const root = document.documentElement;
  const current = root.dataset.theme ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.dataset.theme = current === 'dark' ? 'light' : 'dark';
  save('theme', root.dataset.theme);
});

window.addEventListener('hashchange', render);
render();
