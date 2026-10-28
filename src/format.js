const UNITS = [
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

/** @param {number} n @returns {string} */
export function compact(n) {
  for (const [size, unit] of UNITS) {
    if (n >= size) return `${Number((n / size).toFixed(1))}${unit}`;
  }
  return String(Math.round(n));
}

/** @param {number | null} hour @returns {string} */
export function hourLabel(hour) {
  if (hour === null) return '—';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** @param {{ first: string, last: string }} range @param {string} timeZone @returns {string} */
export function dateRange({ first, last }, timeZone) {
  const fmt = (iso, withYear) =>
    new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', ...(withYear && { year: 'numeric' }) }).format(new Date(iso));
  const year = (iso) => new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(new Date(iso));
  const sameYear = year(first) === year(last);
  return `${fmt(first, !sameYear)} – ${fmt(last, true)}`;
}

/** @param {string} s @returns {string} */
export function escapeXml(s) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);
}
