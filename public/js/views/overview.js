import { api } from '../api.js';
import { barList, divergingBars, lineChart, sparkline } from '../charts.js';
import { card, dataTable, delta, gameCell, statTile } from '../components.js';
import { h } from '../dom.js';
import { compact, dateTime, full, percent, rangeText, signedCompact, signedPercent, titleCase } from '../format.js';
import { tooltipRows } from '../tooltip.js';

const SHARE_LIMIT = 10;
const MOVER_MIN_SHARE = 0.01;

export async function overviewView({ range }) {
  const data = await api('/api/overview', { range });
  const { vs, span } = rangeText(range);
  const { platform, topGenre, fastestGenre, slowestGenre, trends, rising } = data;
  const hotTrend = trends[0];

  const hero = h('section', { class: 'card hero' },
    h('div', {},
      h('div', { class: 'eyebrow' }, 'Playing now'),
      h('div', { class: 'hero-figure' }, full(platform.playing)),
      h('div', { class: 'hero-delta' }, delta(platform.change), ` ${vs}`),
      h('dl', { class: 'hero-meta' },
        h('div', {}, h('dt', {}, 'Games tracked'), h('dd', {}, full(platform.gamesTracked))),
        h('div', {}, h('dt', {}, `Peak · ${span.toLowerCase()}`),
          h('dd', {}, `${compact(platform.peak.value)} · ${dateTime(platform.peak.t)}`)))),
    h('div', {}, lineChart({ points: platform.series, label: 'Players across tracked games', range, height: 220 })));

  const kpis = h('section', { class: 'kpis', 'aria-label': 'Highlights' },
    topGenre && statTile({
      label: 'Most popular genre',
      value: topGenre.name,
      detail: `${percent(topGenre.share)} of players`,
      href: `#/genres/${topGenre.id}`,
    }),
    fastestGenre && statTile({
      label: 'Fastest-growing genre',
      value: fastestGenre.name,
      detail: [delta(fastestGenre.change), ` ${vs}`],
      href: `#/genres/${fastestGenre.id}`,
    }),
    slowestGenre && statTile({
      label: 'Weakest genre',
      value: slowestGenre.name,
      detail: [delta(slowestGenre.change), ` ${vs}`],
      href: `#/genres/${slowestGenre.id}`,
    }),
    hotTrend && statTile({
      label: 'Hottest trend',
      value: `“${titleCase(hotTrend.keyword)}” games`,
      detail: `${signedCompact(hotTrend.gain)} players · ${hotTrend.games} games`,
      href: `#/trends/${hotTrend.keyword}`,
    }));

  const shareCard = card({
    title: 'Share of players by genre',
    subtitle: `Top ${SHARE_LIMIT} of ${data.genres.length} genres · change ${vs}`,
    footer: h('a', { href: '#/genres' }, 'All genres →'),
  }, barList(data.genres.slice(0, SHARE_LIMIT).map((genre) => ({
    label: genre.name,
    value: genre.share,
    valueText: percent(genre.share),
    meta: delta(genre.change),
    href: `#/genres/${genre.id}`,
    tooltip: () => tooltipRows(`${full(genre.playing)} playing`, `${genre.name} · ${percent(genre.share)} of players`),
  }))));

  const movers = data.genres
    .filter((genre) => genre.share >= MOVER_MIN_SHARE && genre.change != null)
    .sort((a, b) => b.change - a.change);
  const moversCard = card({
    title: 'Genre movers',
    subtitle: `Change in players ${vs} · genres with at least 1% of players`,
  }, divergingBars(movers.map((genre) => ({
    label: genre.name,
    value: genre.change,
    valueText: signedPercent(genre.change),
    href: `#/genres/${genre.id}`,
    tooltip: () => tooltipRows(signedPercent(genre.change), `${genre.name} · ${full(genre.playing)} playing`),
  }))));

  const trendsCard = card({
    title: 'Trending keywords',
    subtitle: `Words in game titles that gained the most players ${vs}`,
    footer: h('a', { href: '#/trends' }, 'All trends →'),
  }, dataTable({
    caption: 'Trending keywords',
    rows: trends,
    columns: [
      { label: 'Keyword', render: (t) => h('a', { class: 'strong-link', href: `#/trends/${t.keyword}` }, titleCase(t.keyword)) },
      { label: 'Players', numeric: true, render: (t) => compact(t.playing) },
      { label: 'Change', numeric: true, render: (t) => delta(t.change) },
      { label: 'Games', numeric: true, className: 'hide-narrow', render: (t) => full(t.games) },
      { label: span, className: 'hide-narrow', render: (t) => sparkline(t.spark) },
    ],
  }));

  const risingCard = card({
    title: 'Rising games',
    subtitle: `Biggest jump in players ${vs} · at least 1,000 playing`,
  }, dataTable({
    caption: 'Rising games',
    rows: rising,
    columns: [
      { label: 'Game', render: (game) => gameCell(game) },
      { label: 'Playing', numeric: true, render: (game) => compact(game.playing) },
      { label: 'Change', numeric: true, render: (game) => delta(game.change) },
    ],
  }));

  return {
    source: data.source,
    updatedAt: data.updatedAt,
    node: h('div', { class: 'stack' },
      hero,
      kpis,
      h('div', { class: 'grid-2' }, shareCard, moversCard),
      h('div', { class: 'grid-2' }, trendsCard, risingCard)),
  };
}
