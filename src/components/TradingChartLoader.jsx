/**
 * Shared chart-area loader: empty chart shell with a centered spinner.
 * Use wherever a chart fetch runs so users never see an empty plot flash.
 */
export default function TradingChartLoader({
  label = 'Loading chart data…',
  sublabel = 'Fetching quotes & constituents',
  className = ''
}) {
  return (
    <div
      className={`trading-chart-loader ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="trading-chart-loader__chart">
        <div className="trading-chart-loader__center">
          <div className="trading-chart-loader__spinner" aria-hidden />
          <p className="trading-chart-loader__title">{label}</p>
          {sublabel ? <p className="trading-chart-loader__sub">{sublabel}</p> : null}
        </div>
      </div>
    </div>
  );
}
