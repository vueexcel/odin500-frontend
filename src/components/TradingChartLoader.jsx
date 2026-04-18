import { useId } from 'react';

/**
 * Shared chart-area loader: trading-terminal styling (grid + candlesticks).
 * Use wherever a chart fetch runs so users never see an empty plot flash.
 */
export default function TradingChartLoader({
  label = 'Loading chart data…',
  sublabel = 'Fetching quotes & constituents',
  className = ''
}) {
  const uid = useId().replace(/:/g, '');
  const gid = `tcl-grid-${uid}`;
  return (
    <div
      className={`trading-chart-loader ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={label}
    >
      <div className="trading-chart-loader__frame">
        <div className="trading-chart-loader__scan" aria-hidden />
        <svg
          className="trading-chart-loader__viz"
          viewBox="0 0 240 96"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <pattern id={gid} width="12" height="12" patternUnits="userSpaceOnUse">
              <path
                d="M 12 0 L 0 0 0 12"
                fill="none"
                stroke="rgba(71, 85, 105, 0.45)"
                strokeWidth="0.45"
              />
            </pattern>
          </defs>
          <rect width="240" height="96" fill={`url(#${gid})`} opacity="0.55" />
          <path
            className="trading-chart-loader__spark"
            d="M 8 72 L 32 48 L 56 62 L 80 28 L 104 40 L 128 18 L 152 34 L 176 22 L 200 38 L 224 12"
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <g className="trading-chart-loader__candles">
            <line className="trading-chart-loader__wick" x1="24" y1="68" x2="24" y2="32" />
            <rect className="trading-chart-loader__body trading-chart-loader__body--up" x="18" y="40" width="12" height="22" rx="1" />
            <line className="trading-chart-loader__wick" x1="56" y1="72" x2="56" y2="44" />
            <rect className="trading-chart-loader__body trading-chart-loader__body--down" x="50" y="46" width="12" height="18" rx="1" />
            <line className="trading-chart-loader__wick" x1="88" y1="76" x2="88" y2="36" />
            <rect className="trading-chart-loader__body trading-chart-loader__body--up" x="82" y="38" width="12" height="28" rx="1" />
            <line className="trading-chart-loader__wick" x1="120" y1="70" x2="120" y2="24" />
            <rect className="trading-chart-loader__body trading-chart-loader__body--up" x="114" y="30" width="12" height="32" rx="1" />
            <line className="trading-chart-loader__wick" x1="152" y1="74" x2="152" y2="48" />
            <rect className="trading-chart-loader__body trading-chart-loader__body--down" x="146" y="50" width="12" height="16" rx="1" />
            <line className="trading-chart-loader__wick" x1="184" y1="78" x2="184" y2="40" />
            <rect className="trading-chart-loader__body trading-chart-loader__body--up" x="178" y="42" width="12" height="26" rx="1" />
            <line className="trading-chart-loader__wick" x1="216" y1="72" x2="216" y2="52" />
            <rect className="trading-chart-loader__body trading-chart-loader__body--down" x="210" y="56" width="12" height="12" rx="1" />
          </g>
        </svg>
        <div className="trading-chart-loader__pulse" aria-hidden>
          <span className="trading-chart-loader__pulse-dot" />
          <span className="trading-chart-loader__pulse-dot" />
          <span className="trading-chart-loader__pulse-dot" />
        </div>
        <p className="trading-chart-loader__title">{label}</p>
        <p className="trading-chart-loader__sub">{sublabel}</p>
      </div>
    </div>
  );
}
