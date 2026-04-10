export const DEFAULT_TICKERS_PAGE_SYMBOL = 'NVDA';

export function sanitizeTickerPageInput(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.-]/g, '')
    .slice(0, 20);
}

/** URL ?ticker=… (or legacy ?symbol=…); falls back to default when missing/invalid. */
export function resolveTickersPageSymbol(searchParams) {
  const raw =
    searchParams.get('ticker') ||
    searchParams.get('symbol') ||
    '';
  const s = sanitizeTickerPageInput(raw);
  return s || DEFAULT_TICKERS_PAGE_SYMBOL;
}
