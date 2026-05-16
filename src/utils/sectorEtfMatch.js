const SECTOR_ETF_KEYS = ['XLB', 'XLK', 'XLF', 'XLV', 'XLI', 'XLE', 'XLY', 'XLP', 'XLU', 'XLRE', 'XLC'];

/**
 * Map SPDR sector ETF tickers to TickerDetails `Sector` strings (GICS naming varies).
 * @param {string} etfKey Uppercase ETF key (e.g. XLK).
 * @param {string} sectorField Raw Sector column from ticker-details row.
 * @returns {boolean}
 */
export function rowMatchesSectorEtf(etfKey, sectorField) {
  const k = String(etfKey || '')
    .trim()
    .toUpperCase();
  const sec = String(sectorField || '').trim();
  if (!k || !sec) return false;
  const s = sec.toLowerCase();

  /** @type {Record<string, (t: string) => boolean>} */
  const tests = {
    XLB: (t) => t.includes('material'),
    XLK: (t) => t.includes('technology') || t.includes('information tech'),
    XLF: (t) => t.includes('financial'),
    XLV: (t) => t.includes('health'),
    XLI: (t) => t.includes('industrial'),
    XLE: (t) => /\benergy\b/.test(t) || t.startsWith('energy'),
    XLY: (t) => t.includes('discretionary') || t.includes('consumer disc'),
    XLP: (t) => t.includes('staples') || t.includes('consumer stap'),
    XLU: (t) => t.includes('utilit'),
    XLRE: (t) => t.includes('real estate'),
    XLC: (t) => t.includes('communication')
  };
  const fn = tests[k];
  return fn ? fn(s) : false;
}

/**
 * Resolve a ticker-details `Sector` string to a `/sector-data/:slug` route key (e.g. xlk).
 * @param {string} sectorField
 * @returns {string | null}
 */
export function sectorFieldToEtfSlug(sectorField) {
  const sec = String(sectorField || '').trim();
  if (!sec) return null;
  for (const key of SECTOR_ETF_KEYS) {
    if (rowMatchesSectorEtf(key, sec)) return key.toLowerCase();
  }
  return null;
}
