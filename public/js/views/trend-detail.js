import { api } from '../api.js';
import { barList, lineChart } from '../charts.js';
import { card, dataTable, delta, gameCell, pageHeader, statTile } from '../components.js';
import { h } from '../dom.js';
import { age, compact, full, percent, rangeText, titleCase } from '../format.js';
import { tooltipRows } from '../tooltip.js';

export async function trendDetailView({ range, args: [keyword] }) {
  const data = await api(`/api/trends/${encodeURIComponent(keyword)}`, { range });
  const { trend, genres, games, series } = data;
  const { vs } = rangeText(range);
  const title = `“${titleCase(trend.keyword)}” games`;

  const kpis = h('section', { class: 'kpis' },
    statTile({ label: 'Playing now', value: full(trend.playing) }),
    statTile({ label: `Change ${vs}`, value: delta(trend.change) }),
    statTile({ label: 'Games using it', value: full(trend.games) }),
    statTile({ label: 'New in the last 30 days', value: full(trend.newThisMonth) }));

  const genreCard = card({ title: 'Genre mix', subtitle: 'Where this keyword’s players are' },
    barList(genres.map((genre) => ({
      label: genre.name,
      value: genre.share,
      valueText: percent(genre.share),
      meta: `${genre.games} ${genre.games === 1 ? 'game' : 'games'}`,
      href: `#/genres/${genre.id}`,
      tooltip: () => tooltipRows(`${full(genre.playing)} playing`, genre.name),
    }))));

  const shown = games.length < trend.games ? ` · top ${games.length} of ${trend.games}` : '';
  const gamesCard = card({ title: 'Games', subtitle: `Most played first${shown}` }, dataTable({
    caption: `${title}`,
    rows: games,
    columns: [
      { label: 'Game', render: (game) => gameCell(game) },
      { label: 'Playing', numeric: true, render: (game) => compact(game.playing) },
      { label: 'Change', numeric: true, render: (game) => delta(game.change) },
      { label: 'Released', numeric: true, className: 'hide-narrow', render: (game) => age(game.created) },
    ],
  }));

  return {
    source: data.source,
    updatedAt: data.updatedAt,
    node: h('div', { class: 'stack' },
      pageHeader({ title, crumbs: [['Trends', '#/trends'], [titleCase(trend.keyword)]] }),
      kpis,
      h('div', { class: 'grid-2' },
        card({ title: `Players in ${title}` }, lineChart({ points: series, label: `Players in ${title}`, range })),
        genreCard),
      gamesCard),
  };
}
