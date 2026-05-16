import { useRef } from 'react';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';
import { StatsCmpChartToolbarHead } from './StatsCmpChartToolbarHead.jsx';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';

function fmtEx(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n).toFixed(1);
  return n < 0 ? `(${abs}%)` : `${abs}%`;
}

function fmtAxisPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function ExcessReturnLineChart({
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
  const vals = rows.map((r) => Number(r.excessReturn)).filter(Number.isFinite);
  const minV = vals.length ? Math.min(0, ...vals) : -8;
  const maxV = vals.length ? Math.max(0, ...vals) : 8;
  const span = Math.max(1, maxV - minV);
  const yMin = minV - span * 0.1;
  const yMax = maxV + span * 0.1;
  const y = (v) => padT + ((yMax - v) / (yMax - yMin)) * ih;
  const x = (i) => padL + (iw * i) / Math.max(1, rows.length - 1);
  const zeroY = y(0);
  const path = rows
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(r.excessReturn)}`)
    .join(' ');
  const area = rows.length
    ? `${path} L ${x(rows.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z`
    : '';

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
        exportChartSlug={`rs-excess-${mode}`}
        exportSymbol={exportSymbol}
        exportPreviewAlt={`${ticker} excess return vs ${benchmarkIndex} chart`}
      />
      {loading ? (
        <StatsCmpChartSkeleton variant="line" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <div ref={plotHostRef} className="stats-cmp-chart__plot-host">
          <div className="stats-cmp-chart__legend">
            <span>
              <i className="stats-cmp-chart__sw stats-cmp-chart__sw--line" /> Excess ({ticker} - {benchmarkIndex})
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
                    {fmtAxisPct(t)}
                  </text>
                </g>
              );
            })}
            <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} className="stats-cmp-chart__zero" />
            <path d={area} className="stats-cmp-chart__area" />
            <path d={path} className="stats-cmp-chart__line" />
            {rows.map((r, i) => (
              <g key={r.period}>
                <circle cx={x(i)} cy={y(r.excessReturn)} r="3" className="stats-cmp-chart__dot" />
                <text x={x(i)} y={y(r.excessReturn) - 8} textAnchor="middle" className="stats-cmp-chart__line-label">
                  {fmtEx(r.excessReturn)}
                </text>
                {i % Math.max(1, Math.ceil(rows.length / 12)) === 0 || i === rows.length - 1 ? (
                  <text x={x(i)} y={H - 14} textAnchor="middle" className="stats-cmp-chart__x">
                    {r.period}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
        </div>
      )}
    </section>
  );
}
