import { h } from './dom.js';

const tip = () => document.getElementById('tooltip');

// Value first (what the reader is after), then what it describes.
export function tooltipRows(value, ...labels) {
  return [h('span', { class: 'tt-value' }, value), ...labels.map((label) => h('span', { class: 'tt-label' }, label))];
}

export function showTooltip(content, clientX, clientY) {
  const el = tip();
  el.replaceChildren(...content);
  el.hidden = false;
  const { width, height } = el.getBoundingClientRect();
  let left = clientX + 14;
  let top = clientY - height - 12;
  if (left + width > window.innerWidth - 8) left = clientX - width - 14;
  if (top < 8) top = clientY + 16;
  el.style.transform = `translate(${Math.max(8, left)}px, ${top}px)`;
}

export function hideTooltip() {
  tip().hidden = true;
}

export function attachTooltip(el, content) {
  if (!content) return;
  el.addEventListener('pointermove', (event) => showTooltip(content(), event.clientX, event.clientY));
  el.addEventListener('pointerleave', hideTooltip);
  el.addEventListener('focus', () => {
    const box = el.getBoundingClientRect();
    showTooltip(content(), box.left + box.width / 2, box.top);
  });
  el.addEventListener('blur', hideTooltip);
}
