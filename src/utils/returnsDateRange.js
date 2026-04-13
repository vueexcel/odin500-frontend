/**
 * Include a returns row if its [startDate, endDate] overlaps the inclusive filter window.
 * Missing row dates → included (cannot filter).
 * Empty filter start or end → no filter (caller should skip filtering).
 */
export function returnsRowOverlapsRange(row, startIso, endIso) {
  const fs = String(startIso ?? '')
    .trim()
    .slice(0, 10);
  const fe = String(endIso ?? '')
    .trim()
    .slice(0, 10);
  if (!fs || !fe) return true;
  const rs = String(row.startDate ?? '').slice(0, 10);
  const re = String(row.endDate ?? '').slice(0, 10);
  if (!rs || !re) return true;
  return rs <= fe && re >= fs;
}

export function filterReturnsRows(rows, startIso, endIso) {
  if (!Array.isArray(rows)) return [];
  const fs = String(startIso ?? '').trim();
  const fe = String(endIso ?? '').trim();
  if (!fs || !fe) return rows;
  return rows.filter((r) => returnsRowOverlapsRange(r, fs, fe));
}
