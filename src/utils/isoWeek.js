/**
 * ISO week year and week number (1–53) for a calendar date string YYYY-MM-DD.
 * Matches the same Thursday-based rule used elsewhere in the ticker app.
 * @param {string} isoLike
 * @returns {{ year: number, week: number } | null}
 */
export function isoYearWeekFromIsoDate(isoLike) {
  const iso = String(isoLike || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: isoYear, week: weekNo };
}

/** Compact axis label for ISO dates (avoids long strings on dense weekly charts). */
export function formatWeekAxisDate(iso) {
  const s = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const d = new Date(s + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
