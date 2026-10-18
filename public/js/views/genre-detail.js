import { api } from '../api.js';
import { barList, lineChart } from '../charts.js';
import { card, dataTable, delta, gameCell, pageHeader, statTile } from '../components.js';
import { h } from '../dom.js';
import { age, compact, full, percent, rangeText } from '../format.js';
import { tooltipRows } from '../tooltip.js';

export async function genreDetailView({ range, args: [id] }) {
  const data = await api(`/api/genres/${encodeURIComponent(id)}`, { range });
  const { genre, subgenres, games, series } = data;
  const { vs } = rangeText(range);

  const kpis = h('section', { class: 'kpis' },
    statTile({ label: 'Playing now', value: full(genre.playing) }),
    statTile({ label: 'Share of all players', value: percent(genre.share) }),
    statTile({ label: `Change ${vs}`, value: delta(genre.change) }),
    statTile({ label: 'Games tracked', value: full(genre.games) }));

  const subgenreCard = card({ title: 'Subgenres', subtitle: `Share of ${genre.name} players · change ${vs}` },
    subgenres.length
      ? barList(subgenres.map((sub) => ({
        label: sub.name,
        value: sub.share,
        valueText: percent(sub.share),
        meta: delta(sub.change),
        tooltip: () => tooltipRows(`${full(sub.playing)} playing`, `${sub.name} · ${sub.games} games`),
      })))
      : h('p', { class: 'note' }, 'Roblox doesn’t define subgenres for this genre.'));

  const gamesCard = card({ title: 'Top games', subtitle: `Most played ${genre.name} games right now` },
    games.length
      ? dataTable({
        caption: `Top ${genre.name} games`,
        rows: games,
        columns: [
          { label: '#', className: 'rank hide-narrow', render: (_, i) => i + 1 },
          { label: 'Game', render: (game) => gameCell(game, { showGenre: false }) },
          { label: 'Playing', numeric: true, render: (game) => compact(game.playing) },
          { label: 'Change', numeric: true, render: (game) => delta(game.change) },
          { label: 'Released', numeric: true, className: 'hide-narrow', render: (game) => age(game.created) },
        ],
      })
      : h('p', { class: 'note' }, 'No tracked games in this genre yet.'));

  return {
    source: data.source,
    updatedAt: data.updatedAt,
    node: h('div', { class: 'stack' },
      pageHeader({ title: genre.name, crumbs: [['Genres', '#/genres'], [genre.name]] }),
      kpis,
      h('div', { class: 'grid-2' },
        card({ title: `Players in ${genre.name}` }, lineChart({ points: series, label: `${genre.name} players`, range })),
        subgenreCard),
      gamesCard),
  };
}
