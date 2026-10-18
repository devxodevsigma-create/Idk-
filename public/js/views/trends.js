import { api } from '../api.js';
import { sparkline } from '../charts.js';
import { card, dataTable, delta, pageHeader, segmented } from '../components.js';
import { h } from '../dom.js';
import { compact, full, rangeText, signedCompact, titleCase } from '../format.js';

const SORTS = [
  ['hot', 'Hottest'],
  ['growth', 'Fastest growing'],
  ['players', 'Most players'],
  ['new', 'Most new games'],
];

const SORT_NOTES = {
  hot: (vs) => `Ranked by how many players the keyword gained ${vs}.`,
  growth: (vs) => `Ranked by percentage growth ${vs} (keywords with at least 1,000 players).`,
  players: () => 'Ranked by how many people are playing games with this keyword right now.',
  new: () => 'Ranked by how many games with this keyword came out in the last 30 days.',
};

export async function trendsView({ range, params }) {
  const data = await api('/api/trends', { range, sort: params.get('sort') });
  const { vs, span } = rangeText(range);
  // On phones keep the keyword, its change, and whatever column the current sort ranks by.
  const narrow = (sort) => (sort === data.sort ? null : 'hide-narrow');

  const table = card({ title: `${data.trends.length} trending keywords`, subtitle: SORT_NOTES[data.sort](vs) }, dataTable({
    caption: 'Trending keywords',
    rows: data.trends,
    columns: [
      { label: '#', className: 'rank hide-narrow', render: (_, i) => i + 1 },
      { label: 'Keyword', render: (t) => h('a', { class: 'strong-link', href: `#/trends/${t.keyword}` }, titleCase(t.keyword)) },
      { label: 'Players', numeric: true, className: narrow('players'), render: (t) => compact(t.playing) },
      { label: 'Change', numeric: true, render: (t) => delta(t.change) },
      { label: 'Player gain', numeric: true, className: narrow('hot'), render: (t) => signedCompact(t.gain) },
      { label: 'Games', numeric: true, className: 'hide-narrow', render: (t) => full(t.games) },
      { label: 'New (30 days)', numeric: true, className: narrow('new'), render: (t) => full(t.newThisMonth) },
      { label: span, className: 'hide-narrow', render: (t) => sparkline(t.spark) },
    ],
  }));

  return {
    source: data.source,
    updatedAt: data.updatedAt,
    node: h('div', { class: 'stack' },
      pageHeader({
        title: 'Trends',
        description: `Keywords pulled from the titles of tracked games. A word counts as a trend once at least ${data.minGames} games use it.`,
      }),
      h('div', {}, segmented({
        label: 'Sort trends',
        options: SORTS,
        value: data.sort,
        onChange: (sort) => { location.hash = `#/trends?sort=${sort}`; },
      })),
      table),
  };
}
