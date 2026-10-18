import { api } from '../api.js';
import { sparkline } from '../charts.js';
import { card, dataTable, delta, pageHeader } from '../components.js';
import { h } from '../dom.js';
import { compact, full, percent, rangeText } from '../format.js';

export async function genresView({ range }) {
  const data = await api('/api/genres', { range });
  const { vs } = rangeText(range);

  const multiples = h('div', { class: 'multiples' }, data.genres.map((genre) =>
    h('a', { class: 'card multiple', href: `#/genres/${genre.id}` },
      h('div', { class: 'multiple-head' }, h('span', { class: 'multiple-name' }, genre.name), delta(genre.change)),
      h('div', { class: 'multiple-value' }, compact(genre.playing), h('span', { class: 'multiple-share' }, ` · ${percent(genre.share)}`)),
      genre.playing > 0
        ? sparkline(genre.spark, { width: 200, height: 36, fluid: true })
        : h('div', { class: 'multiple-empty' }, 'No tracked games yet'))));

  const table = card({ title: 'All genres', subtitle: `Change ${vs}` }, dataTable({
    caption: 'All genres',
    rows: data.genres,
    columns: [
      { label: 'Genre', render: (genre) => h('a', { class: 'strong-link', href: `#/genres/${genre.id}` }, genre.name) },
      { label: 'Players', numeric: true, className: 'hide-narrow', render: (genre) => full(genre.playing) },
      { label: 'Share', numeric: true, render: (genre) => percent(genre.share) },
      { label: 'Change', numeric: true, render: (genre) => delta(genre.change) },
      { label: 'Games', numeric: true, className: 'hide-narrow', render: (genre) => full(genre.games) },
      { label: 'Top game', className: 'hide-narrow', render: (genre) => genre.topGame?.name ?? '—' },
    ],
  }));

  return {
    source: data.source,
    updatedAt: data.updatedAt,
    node: h('div', { class: 'stack' },
      pageHeader({
        title: 'Genres',
        description: `Players in each of Roblox’s ${data.genres.length} official genres, added up across every tracked game.`,
      }),
      multiples,
      table),
  };
}
