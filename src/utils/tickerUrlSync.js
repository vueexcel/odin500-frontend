/** Default when `?ticker=` / `?symbol=` is missing or invalid (e.g. Odin Signals). */
export const DEFAULT_TICKERS_PAGE_SYMBOL = 'NVDA';

/** Canonical `/ticker/:symbol` segment when no symbol is provided (matches ticker page defaults). */
export const DEFAULT_TICKER_ROUTE_SYMBOL = 'AAPL';

/** Canonical `/indices/:slug` when no slug is provided (matches Index page default). */
export const DEFAULT_INDEX_ROUTE_SLUG = 'sp500';

/** True for main ticker page `/ticker`, `/ticker/SYM` — not `/ticker-annual`, etc. */
export function isMainTickerRoutePath(pathname) {
  const p = String(pathname || '');
  return p === '/ticker' || /^\/ticker\/[^/]+/.test(p);
}

/** True for `/indices`, `/indices/slug` — not unrelated paths. */
export function isMainIndicesRoutePath(pathname) {
  const p = String(pathname || '');
  return p === '/indices' || /^\/indices\/[^/]+/.test(p);
}

export function sanitizeTickerPageInput(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 20);
}

/** For ticker search APIs: keep spaces (company names); case sent as typed (DB ilike is case-insensitive). */
export function sanitizeTickerSearchInput(raw) {
  return String(raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9.\s-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 48);
}

/** URL `?ticker=` or legacy `?symbol=`; falls back to {@link DEFAULT_TICKERS_PAGE_SYMBOL} when missing/invalid. */
export function resolveTickersPageSymbol(searchParams) {
  const raw =
    searchParams.get('ticker') ||
    searchParams.get('symbol') ||
    '';
  const s = sanitizeTickerPageInput(raw);
  return s || DEFAULT_TICKERS_PAGE_SYMBOL;
}
