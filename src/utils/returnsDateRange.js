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

/**
 * Client-side filter for returns rows.
 * Supports partial bounds (only start or only end). For rows with `period` in YYYY-MM-DD (daily),
 * compares on that calendar day so filters work without timezone drift.
 */
export function filterReturnsRows(rows, startIso, endIso) {
  if (!Array.isArray(rows)) return [];
  const fs = String(startIso ?? '').trim().slice(0, 10);
  const fe = String(endIso ?? '').trim().slice(0, 10);
  if (!fs && !fe) return rows;

  return rows.filter((r) => {
    const period = String(r.period ?? '').slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      if (fs && period < fs) return false;
      if (fe && period > fe) return false;
      return true;
    }
    const rs = String(r.startDate ?? '').slice(0, 10);
    const re = String(r.endDate ?? '').slice(0, 10);
    if (!rs || !re) return true;
    if (fs && fe) return rs <= fe && re >= fs;
    if (fs && !fe) return re >= fs;
    if (!fs && fe) return rs <= fe;
    return true;
  });
}
