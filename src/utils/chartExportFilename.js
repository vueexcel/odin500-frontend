/**
 * PNG filename for chart snapshot exports.
 * @param {string} chartSlug e.g. `annual-returns`
 * @param {string} [symbol]
 */
export function buildTickerChartExportFilename(chartSlug, symbol) {
  const slug = String(chartSlug || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const sym =
    String(symbol || 'chart')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'CHART';
  return `${slug}-${sym}-${new Date().toISOString().slice(0, 10)}.png`;
}
