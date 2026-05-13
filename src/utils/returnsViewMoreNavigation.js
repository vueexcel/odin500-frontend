import {
  DEFAULT_TICKER_ROUTE_SYMBOL,
  isMainTickerRoutePath,
  sanitizeTickerPageInput
} from './tickerUrlSync.js';

/** `/statistic/ticker-annual/SYM` … `/statistic/ticker-daily/SYM` (detail chart pages). */
const STAT_TICKER_RETURNS_DETAIL_RE =
  /^\/statistic\/(ticker-annual|ticker-quarterly|ticker-monthly|ticker-weekly|ticker-daily)\/[^/?#]+/i;

/**
 * @param {string} pathname
 * @returns {boolean}
 */
export function isStatisticTickerReturnsDetailPath(pathname) {
  return STAT_TICKER_RETURNS_DETAIL_RE.test(String(pathname || ''));
}

/**
 * Symbol from `/ticker/SYM` or `/statistic/ticker-* /SYM`.
 * @param {string} pathname
 * @returns {string} sanitized or ''
 */
export function extractReturnsContextSymbolFromPath(pathname) {
  const p = String(pathname || '');
  let m = p.match(/^\/ticker\/([^/?#]+)/i);
  if (m) return sanitizeTickerPageInput(decodeURIComponent(m[1]));
  m = p.match(/^\/statistic\/ticker-(?:annual|quarterly|monthly|weekly|daily)\/([^/?#]+)/i);
  if (m) return sanitizeTickerPageInput(decodeURIComponent(m[1]));
  return '';
}

/**
 * @param {string} [search]
 * @returns {string} sanitized symbol from `?ticker=` / `?symbol=` or ''
 */
export function extractTickerSymbolFromSearch(search) {
  const s = String(search || '');
  if (!s) return '';
  const qs = new URLSearchParams(s.startsWith('?') ? s.slice(1) : s);
  return (
    sanitizeTickerPageInput(qs.get('ticker') || '') ||
    sanitizeTickerPageInput(qs.get('symbol') || '') ||
    ''
  );
}

/**
 * @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} periodMode
 * @returns {'annual'|'quarterly'|'monthly'|'weekly'|'daily'}
 */
export function periodModeToStatisticDataSection(periodMode) {
  switch (periodMode) {
    case 'quarterly':
      return 'quarterly';
    case 'monthly':
      return 'monthly';
    case 'weekly':
      return 'weekly';
    case 'daily':
      return 'daily';
    default:
      return 'annual';
  }
}

/**
 * @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} periodMode
 * @returns {string} e.g. `ticker-monthly`
 */
function statisticReturnsPathKind(periodMode) {
  switch (periodMode) {
    case 'quarterly':
      return 'ticker-quarterly';
    case 'monthly':
      return 'ticker-monthly';
    case 'weekly':
      return 'ticker-weekly';
    case 'daily':
      return 'ticker-daily';
    default:
      return 'ticker-annual';
  }
}

/**
 * Deep statistic returns page: `/statistic/ticker-monthly/AAPL`.
 * @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} periodMode
 * @param {string} symbol
 */
export function buildStatisticReturnsDetailHref(periodMode, symbol) {
  const sym = sanitizeTickerPageInput(symbol) || DEFAULT_TICKER_ROUTE_SYMBOL;
  const kind = statisticReturnsPathKind(periodModeToStatisticDataSection(periodMode));
  return `/statistic/${kind}/${encodeURIComponent(sym)}`;
}

/**
 * Statistic tables hub with section scroll + symbol.
 * @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} dataSection
 * @param {string} symbol
 */
export function buildStatisticDataReturnsHref(dataSection, symbol) {
  const sym = sanitizeTickerPageInput(symbol) || DEFAULT_TICKER_ROUTE_SYMBOL;
  const section = periodModeToStatisticDataSection(dataSection);
  const params = new URLSearchParams({ section, symbol: sym });
  return `/statistic-data?${params.toString()}`;
}

/**
 * "View More" for returns charts: from main ticker → statistic detail page; from statistic detail → `/statistic-data` hub.
 *
 * @param {object} opts
 * @param {string} opts.pathname
 * @param {string} [opts.search]
 * @param {'annual'|'quarterly'|'monthly'|'weekly'|'daily'} opts.periodMode
 * @param {string} [opts.symbol] — chart symbol (preferred over URL)
 * @returns {string}
 */
export function getReturnsChartViewMoreHref({ pathname, search = '', periodMode, symbol }) {
  const fromPath = extractReturnsContextSymbolFromPath(pathname);
  const fromSearch = extractTickerSymbolFromSearch(search);
  const sym =
    sanitizeTickerPageInput(symbol) || fromPath || fromSearch || DEFAULT_TICKER_ROUTE_SYMBOL;
  const mode = periodModeToStatisticDataSection(periodMode);

  if (isMainTickerRoutePath(pathname)) {
    return buildStatisticReturnsDetailHref(mode, sym);
  }
  if (isStatisticTickerReturnsDetailPath(pathname)) {
    return buildStatisticDataReturnsHref(mode, sym);
  }
  return buildStatisticReturnsDetailHref(mode, sym);
}
