import { sanitizeTickerPageInput } from './tickerUrlSync.js';

/**
 * Relative Strength hub with optional ticker query.
 * @param {string} [ticker]
 * @returns {string}
 */
export function buildRelativeStrengthTickerHref(ticker) {
  const sym = sanitizeTickerPageInput(ticker);
  const qs = new URLSearchParams();
  if (sym) qs.set('ticker', sym);
  const q = qs.toString();
  return `/relative-strength/ticker${q ? `?${q}` : ''}`;
}
