import { useRef } from 'react';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';
import { StatsCmpChartToolbarHead } from './StatsCmpChartToolbarHead.jsx';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function PeriodicReturnBarChart({
  mode,
  ticker,
  benchmarkIndex,
  startYear,
  endYear,
  selectedYear,
  startDate,
  endDate,
  theme = 'dark',
  rows = [],
  benchmarkOptions = [],
  onBenchmarkChange = () => {},
  controls = null,
  showDataTable = false,
  onToggleDataTable,
  onDownloadCsv,
  csvDisabled = false,
  loading = false,
  /** When set by `TickerChartResizeScope` via cloneElement. */
  plotHeight = null
}) {
  const W = 1020;
  const H = 300;
  const padL = 58;
  const padR = 18;
  const padT = 16;
  const padB = 48;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const vals = rows.flatMap((r) => [Number(r.tickerReturn), Number(r.benchmarkReturn)]).filter(Number.isFinite);
  const minV = vals.length ? Math.min(0, ...vals) : -8;
  const maxV = vals.length ? Math.max(0, ...vals) : 8;
  const span = Math.max(1, maxV - minV);
  const yMin = minV - span * 0.08;
  const yMax = maxV + span * 0.08;
  const y = (v) => padT + ((yMax - v) / (yMax - yMin)) * ih;
  const zeroY = y(0);
  const n = Math.max(1, rows.length);
  const groupW = iw / n;
  const barW = Math.max(4, Math.min(16, groupW * 0.32));

  const resizeChrome = plotHeight != null && Number.isFinite(Number(plotHeight));
  const hPx = resizeChrome ? Math.round(Number(plotHeight)) : null;
  const svgPlotStyle = resizeChrome && hPx != null ? tickerSvgPlotStyle(hPx) : undefined;
  const rootClass = ['stats-cmp-chart', resizeChrome ? 'stats-cmp-chart--plot-resize' : ''].filter(Boolean).join(' ');

  const sectionRef = useRef(null);
  const plotHostRef = useRef(null);
  const exportSymbol = `${ticker}-vs-${benchmarkIndex}`;

  return (
    <section ref={sectionRef} className={rootClass}>
      <StatsCmpChartToolbarHead
        sectionRef={sectionRef}
        plotHostRef={plotHostRef}
        controls={controls}
        benchmarkIndex={benchmarkIndex}
        benchmarkOptions={benchmarkOptions}
        onBenchmarkChange={onBenchmarkChange}
        showDataTable={showDataTable}
        onToggleDataTable={onToggleDataTable}
        onDownloadCsv={onDownloadCsv}
        csvDisabled={csvDisabled}
        exportDisabled={loading || !rows.length}
        exportChartSlug={`rs-periodic-${mode}`}
        exportSymbol={exportSymbol}
        exportPreviewAlt={`${ticker} vs ${benchmarkIndex} periodic returns chart`}
      />
      {loading ? (
        <StatsCmpChartSkeleton variant="denseBars" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <div ref={plotHostRef} className="stats-cmp-chart__plot-host">
          <div className="stats-cmp-chart__legend">
            <span>
              <i className="stats-cmp-chart__sw stats-cmp-chart__sw--ticker" /> {ticker}
            </span>
            <span>
              <i className="stats-cmp-chart__sw stats-cmp-chart__sw--bench2" /> {benchmarkIndex}
            </span>
          </div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="stats-cmp-chart__svg"
            preserveAspectRatio="xMidYMid meet"
            style={svgPlotStyle}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((k) => {
              const t = yMin + (yMax - yMin) * k;
              const yy = y(t);
              return (
                <g key={`yg-${k}`}>
                  <line x1={padL} y1={yy} x2={W - padR} y2={yy} className="stats-cmp-chart__grid" />
                  <text x={padL - 8} y={yy} textAnchor="end" dominantBaseline="middle" className="stats-cmp-chart__y-axis">
                    {fmtPct(t)}
                  </text>
                </g>
              );
            })}
            <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} className="stats-cmp-chart__zero" />
            {rows.map((r, i) => {
              const cx = padL + i * groupW + groupW / 2;
              const tY = y(r.tickerReturn);
              const bY = y(r.benchmarkReturn);
              return (
                <g key={r.period}>
                  <rect
                    x={cx - barW - 1}
                    y={Math.min(tY, zeroY)}
                    width={barW}
                    height={Math.max(1, Math.abs(zeroY - tY))}
                    className="stats-cmp-chart__bar stats-cmp-chart__bar--ticker"
                  />
                  <rect
                    x={cx + 1}
                    y={Math.min(bY, zeroY)}
                    width={barW}
                    height={Math.max(1, Math.abs(zeroY - bY))}
                    className="stats-cmp-chart__bar stats-cmp-chart__bar--bench2"
                  />
                  <text
                    x={cx - barW / 2 - 1}
                    y={tY < zeroY ? tY - 6 : tY + 12}
                    textAnchor="middle"
                    className="stats-cmp-chart__bar-label"
                  >
                    {fmtPct(r.tickerReturn)}
                  </text>
                  <text
                    x={cx + barW / 2 + 1}
                    y={bY < zeroY ? bY - 6 : bY + 12}
                    textAnchor="middle"
                    className="stats-cmp-chart__bar-label"
                  >
                    {fmtPct(r.benchmarkReturn)}
                  </text>
                  {i % Math.max(1, Math.ceil(rows.length / 12)) === 0 || i === rows.length - 1 ? (
                    <text x={cx} y={H - 14} textAnchor="middle" className="stats-cmp-chart__x">
                      {r.period}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
