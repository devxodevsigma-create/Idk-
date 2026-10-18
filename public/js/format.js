const compactFormat = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const fullFormat = new Intl.NumberFormat('en');
const hourFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric' });
const dayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export const compact = (n) => compactFormat.format(n);
export const full = (n) => fullFormat.format(n);
export const percent = (x) => `${(x * 100).toFixed(1)}%`;

export function signedPercent(x) {
  if (x == null) return 'New';
  const value = Math.abs(x * 100);
  const digits = value >= 100 ? 0 : 1;
  const text = value.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${x < 0 ? '−' : '+'}${text}%`;
}

export function signedCompact(n) {
  return `${n < 0 ? '−' : '+'}${compact(Math.abs(n))}`;
}

export const hourLabel = (t) => hourFormat.format(t);
export const dayLabel = (t) => dayFormat.format(t);
export const dateTime = (t) => dateTimeFormat.format(t);
export const time = (t) => timeFormat.format(new Date(t));

export function age(iso) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days < 1) return 'Today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function titleCase(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function rangeText(range) {
  return range === '7d'
    ? { vs: 'vs 7 days ago', span: 'Last 7 days' }
    : { vs: 'vs 24h ago', span: 'Last 24 hours' };
}
