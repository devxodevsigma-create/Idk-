import { h, setAttrs, svg } from './dom.js';
import { compact, dateTime, dayLabel, full, hourLabel } from './format.js';
import { attachTooltip, hideTooltip, showTooltip, tooltipRows } from './tooltip.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function niceTicks(max, count = 4) {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw);
  const steps = Math.ceil(max / step);
  return Array.from({ length: steps + 1 }, (_, i) => i * step);
}

// Redraws whenever the container's width changes; stops once it leaves the page.
function observeWidth(el, draw) {
  let lastWidth = 0;
  const observer = new ResizeObserver(([entry]) => {
    if (!el.isConnected) return observer.disconnect();
    const width = Math.round(entry.contentRect.width);
    if (width && width !== lastWidth) {
      lastWidth = width;
      draw();
    }
  });
  observer.observe(el);
}

// Single-series area chart with a crosshair tooltip and a "show data" table.
export function lineChart({ points, label, range, height = 240 }) {
  const plot = h('div', { class: 'chart-plot', style: { '--h': `${height}px` } });
  observeWidth(plot, () => drawLine(plot, { points, label, range, height }));
  return h('figure', { class: 'chart' }, plot, dataTable(points, label));
}

function drawLine(plot, { points, label, range, height }) {
  const width = plot.clientWidth;
  if (!width || !points.length) return;

  const m = { top: 14, right: 58, bottom: 26, left: 44 };
  const iw = Math.max(10, width - m.left - m.right);
  const ih = height - m.top - m.bottom;
  const ticks = niceTicks(Math.max(...points.map((p) => p.v)));
  const yMax = ticks.at(-1);
  const last = points.length - 1;
  const x = (i) => m.left + (last ? (i / last) * iw : iw / 2);
  const y = (v) => m.top + ih - (v / yMax) * ih;

  const root = svg('svg', {
    class: 'chart-svg',
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    tabindex: 0,
    role: 'img',
    'aria-label': `${label}. Use the arrow keys to read values.`,
  });

  for (const tick of ticks) {
    root.append(
      svg('line', { class: tick === 0 ? 'axis' : 'grid', x1: m.left, x2: m.left + iw, y1: y(tick), y2: y(tick) }),
      svg('text', { class: 'tick', x: m.left - 8, y: y(tick), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, compact(tick)),
    );
  }

  points.forEach((point, i) => {
    const hour = new Date(point.t).getHours();
    const isTick = range === '7d' ? hour === 0 : hour % 6 === 0;
    const px = x(i);
    if (!isTick || px < m.left + 14 || px > m.left + iw - 14) return;
    root.append(svg('text', { class: 'tick', x: px, y: height - 6, 'text-anchor': 'middle' },
      range === '7d' ? dayLabel(point.t) : hourLabel(point.t)));
  });

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const end = points[last];
  root.append(
    svg('path', { class: 'area', d: `${line}L${x(last).toFixed(1)},${y(0)}L${x(0).toFixed(1)},${y(0)}Z` }),
    svg('path', { class: 'line', d: line }),
    svg('circle', { class: 'dot', cx: x(last), cy: y(end.v), r: 4 }),
    svg('text', { class: 'end-label', x: x(last) + 10, y: y(end.v), 'dominant-baseline': 'middle' }, compact(end.v)),
  );

  const crosshair = svg('line', { class: 'crosshair', y1: m.top, y2: m.top + ih, visibility: 'hidden' });
  const marker = svg('circle', { class: 'dot', r: 4, visibility: 'hidden' });
  const hit = svg('rect', { class: 'hit', x: m.left, y: m.top, width: iw, height: ih });
  root.append(crosshair, marker, hit);

  let active = null;
  const show = (i, clientX, clientY) => {
    active = i;
    const px = x(i);
    const py = y(points[i].v);
    setAttrs(crosshair, { x1: px, x2: px, visibility: 'visible' });
    setAttrs(marker, { cx: px, cy: py, visibility: 'visible' });
    if (clientX == null) {
      const box = root.getBoundingClientRect();
      clientX = box.left + px;
      clientY = box.top + py;
    }
    showTooltip(tooltipRows(full(points[i].v), `${label} · ${dateTime(points[i].t)}`), clientX, clientY);
  };
  const hide = () => {
    active = null;
    crosshair.setAttribute('visibility', 'hidden');
    marker.setAttribute('visibility', 'hidden');
    hideTooltip();
  };
  const indexAt = (clientX) => {
    const box = root.getBoundingClientRect();
    return clamp(Math.round(((clientX - box.left - m.left) / iw) * last), 0, last);
  };

  for (const type of ['pointermove', 'pointerdown']) {
    hit.addEventListener(type, (event) => show(indexAt(event.clientX), event.clientX, event.clientY));
  }
  hit.addEventListener('pointerleave', hide);
  root.addEventListener('focus', () => show(last));
  root.addEventListener('blur', hide);
  root.addEventListener('keydown', (event) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, Home: -Infinity, End: Infinity }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    show(clamp((active ?? last) + step, 0, last));
  });

  plot.replaceChildren(root);
}

function dataTable(points, label) {
  return h('details', { class: 'chart-data' },
    h('summary', {}, 'Show data'),
    h('div', { class: 'table-wrap' },
      h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Time'), h('th', { scope: 'col', class: 'num' }, label))),
        h('tbody', {}, [...points].reverse().map((p) =>
          h('tr', {}, h('td', {}, dateTime(p.t)), h('td', { class: 'num' }, full(p.v))))))));
}

// Horizontal bars sorted by the caller. item: { label, value, valueText, meta, href, tooltip }
export function barList(items) {
  const max = Math.max(0, ...items.map((item) => item.value)) || 1;
  return h('ol', { class: 'bars' }, items.map((item) => {
    const row = h(item.href ? 'a' : 'div', { class: 'bar-row', href: item.href },
      h('span', { class: 'bar-label', title: item.label }, item.label),
      h('span', { class: 'bar-track' },
        h('span', { class: 'bar', style: { '--r': item.value / max } }),
        h('span', { class: 'bar-value' }, item.valueText)),
      h('span', { class: 'bar-meta' }, item.meta));
    attachTooltip(row, item.tooltip);
    return h('li', {}, row);
  }));
}

// Bars growing left (negative) or right (positive) from a zero line.
// item: { label, value (fraction, or null for "new"), valueText, href, tooltip }
export function divergingBars(items) {
  const maxAbs = Math.max(0, ...items.map((item) => Math.abs(item.value ?? 0))) || 1;
  return h('ol', { class: 'bars' }, items.map((item) => {
    const ratio = Math.abs(item.value ?? 0) / maxAbs;
    const bar = h('span', { class: 'div-bar', style: { '--r': ratio } });
    const value = h('span', { class: 'div-value' }, item.valueText);
    const negative = item.value != null && item.value < 0;
    const row = h(item.href ? 'a' : 'div', { class: 'div-row', href: item.href },
      h('span', { class: 'bar-label', title: item.label }, item.label),
      h('span', { class: 'div-chart' },
        h('span', { class: 'div-neg' }, negative && [value, bar]),
        h('span', { class: 'div-pos' }, negative ? null : item.value == null ? value : [bar, value])));
    attachTooltip(row, item.tooltip);
    return h('li', {}, row);
  }));
}

export function sparkline(values, { width = 96, height = 28, fluid = false } = {}) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pad = 3;
  const x = (i) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values.length - 1;
  return svg('svg', {
    class: fluid ? 'spark spark-fluid' : 'spark',
    width: fluid ? null : width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: fluid ? 'none' : null,
    'aria-hidden': 'true',
  },
  svg('path', { class: 'spark-line', d }),
  fluid ? null : svg('circle', { class: 'spark-dot', cx: x(last), cy: y(values[last]), r: 3 }));
}
