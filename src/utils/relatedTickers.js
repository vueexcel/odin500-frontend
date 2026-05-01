/** Shared helpers for “RELATED TICKERS”: index shortcuts + same-category peers from ticker-details rows. */

/** Fixed shortcuts shown beside RELATED TICKERS (Dow, Nasdaq 100, S&P 500). */
export const RELATED_INDEX_LINKS = [
  { slug: 'dow-jones', label: 'Dow Jones' },
  { slug: 'nasdaq-100', label: 'Nasdaq 100' },
  { slug: 'sp500', label: 'S&P 500' }
];

export function normalizeBucket(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Prefer peers sharing the same normalized industry/sub-industry bucket, then sector.
 * `categoryLabel` should be SubIndustry or Industry (see caller).
 */
export function pickRelatedByCategory(detailRows, sym, mySector, categoryLabel, limit = 10) {
  const rows = Array.isArray(detailRows) ? detailRows : [];
  const current = String(sym || '').toUpperCase().trim();
  const sectorKey = normalizeBucket(mySector);
  const industryKey = normalizeBucket(categoryLabel);
  const seen = new Set([current]);
  const out = [];

  const pushFrom = (sourceRows) => {
    for (const r of sourceRows) {
      const s = String(r.Symbol || r.symbol || '').toUpperCase().trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
      if (out.length >= limit) return true;
    }
    return false;
  };

  if (industryKey) {
    const sameIndustry = rows.filter(
      (r) =>
        normalizeBucket(r.Industry || r.industry || r.SubIndustry || r.subIndustry || r.subindustry) === industryKey
    );
    if (pushFrom(sameIndustry)) return out;
  }
  if (sectorKey) {
    const sameSector = rows.filter((r) => normalizeBucket(r.Sector || r.sector) === sectorKey);
    if (pushFrom(sameSector)) return out;
  }
  return out;
}
