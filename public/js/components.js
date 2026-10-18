import { h } from './dom.js';
import { signedPercent } from './format.js';

export function card({ title, subtitle, footer, className }, ...body) {
  return h('section', { class: ['card', className].filter(Boolean).join(' ') },
    (title || subtitle) && h('header', { class: 'card-head' },
      title && h('h2', { class: 'card-title' }, title),
      subtitle && h('p', { class: 'card-sub' }, subtitle)),
    ...body,
    footer && h('footer', { class: 'card-foot' }, footer));
}

// Signed change with an arrow, so direction never relies on color alone.
// No change value means there's nothing to compare against: "New" for fresh releases, "—" otherwise.
export function delta(change, { isNew = false } = {}) {
  if (change == null) return h('span', { class: 'delta delta-new' }, isNew ? 'New' : '—');
  const direction = change > 0.0005 ? 'up' : change < -0.0005 ? 'down' : 'flat';
  const arrow = { up: '▲', down: '▼', flat: '●' }[direction];
  return h('span', { class: `delta delta-${direction}` }, h('span', { 'aria-hidden': 'true' }, arrow), ' ', signedPercent(change));
}

export function statTile({ label, value, detail, href }) {
  return h(href ? 'a' : 'div', { class: 'card tile', href },
    h('div', { class: 'tile-label' }, label),
    h('div', { class: 'tile-value' }, value),
    detail && h('div', { class: 'tile-detail' }, detail));
}

// columns: [{ label, render(row), numeric?, className? }]
export function dataTable({ columns, rows, caption }) {
  const cellClass = (column) => [column.numeric && 'num', column.className].filter(Boolean).join(' ') || null;
  return h('div', { class: 'table-wrap' },
    h('table', { class: 'table' },
      caption && h('caption', { class: 'sr-only' }, caption),
      h('thead', {}, h('tr', {}, columns.map((column) => h('th', { scope: 'col', class: cellClass(column) }, column.label)))),
      h('tbody', {}, rows.map((row, i) =>
        h('tr', {}, columns.map((column) => h('td', { class: cellClass(column) }, column.render(row, i))))))));
}

export function gameCell(game, { showGenre = true } = {}) {
  const meta = [showGenre ? game.genreName : game.subgenre, game.creator].filter(Boolean).join(' · ');
  const icon = game.iconUrl
    ? h('img', { class: 'game-icon', src: game.iconUrl, alt: '', width: 32, height: 32, loading: 'lazy' })
    : h('span', { class: 'game-icon', 'aria-hidden': 'true' }, game.name.trim().charAt(0) || '?');
  const name = game.placeId
    ? h('a', {
      class: 'game-name',
      href: `https://www.roblox.com/games/${game.placeId}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      title: `Open ${game.name} on Roblox`,
    }, game.name)
    : h('div', { class: 'game-name', title: game.name }, game.name);
  return h('div', { class: 'game' }, icon, h('div', { class: 'game-text' }, name, h('div', { class: 'game-meta' }, meta)));
}

export function pageHeader({ title, description, crumbs }) {
  return h('header', { class: 'page-head' },
    crumbs && h('nav', { class: 'crumbs', 'aria-label': 'Breadcrumb' },
      crumbs.flatMap(([label, href], i) => [
        i > 0 && h('span', { 'aria-hidden': 'true' }, '›'),
        href ? h('a', { href }, label) : h('span', { 'aria-current': 'page' }, label),
      ])),
    h('h1', {}, title),
    description && h('p', {}, description));
}

export function segmented({ label, options, value, onChange }) {
  return h('div', { class: 'segmented', role: 'group', 'aria-label': label },
    options.map(([key, text]) =>
      h('button', { type: 'button', 'aria-pressed': String(key === value), onClick: () => onChange(key) }, text)));
}

export function emptyState(title, message) {
  return h('div', { class: 'empty' }, h('h1', {}, title), h('p', {}, message));
}
