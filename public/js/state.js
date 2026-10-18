// Per-browser preferences. Storage can be unavailable (private mode), so every
// access is guarded and the app still works without it.

function load(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not persisted; fine for a preference.
  }
}

const RANGES = ['24h', '7d'];

export const state = {
  range: RANGES.includes(load('range')) ? load('range') : '24h',
};

export function setRange(range) {
  state.range = RANGES.includes(range) ? range : '24h';
  save('range', state.range);
}
