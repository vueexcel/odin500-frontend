import { useMemo, useRef } from 'react';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';
import { StatsCmpChartToolbarHead } from './StatsCmpChartToolbarHead.jsx';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function AnnualReturnBarChart({
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
  /** Optional: shorten / format x-axis period labels (Relative Strength only). */
  formatXAxisLabel = null,
  /** Max x-axis labels to show (subsampling when many rows). */
  xAxisMaxLabels = 16,
  /** When set, shows drag handle + persists height (Relative Strength only). */
  resizeStorageKey = null,
  resizeDefaultHeight = 300,
  /** When set by `TickerChartResizeScope` via cloneElement, parent owns the drag handle. */
  plotHeight: plotHeightProp = null
}) {
  const W = 1020;
  const H = 330;
  const padL = 64;
  const padR = 18;
  const padT = 16;
  const padB = 62;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const vals = rows.flatMap((r) => [Number(r.tickerReturn), Number(r.benchmarkReturn)]).filter(Number.isFinite);
  const minV = vals.length ? Math.min(0, ...vals) : -10;
  const maxV = vals.length ? Math.max(0, ...vals) : 20;
  const span = Math.max(1, maxV - minV);
  const yMin = minV - span * 0.08;
  const yMax = maxV + span * 0.08;
  const y = (v) => padT + ((yMax - v) / (yMax - yMin)) * ih;
  const zeroY = y(0);
  const n = Math.max(1, rows.length);
  const groupW = iw / n;
  const barW = Math.max(6, Math.min(28, groupW * 0.28));

  const externalH =
    plotHeightProp != null && Number.isFinite(Number(plotHeightProp)) ? Math.round(Number(plotHeightProp)) : null;
  const internalResize = useTickerPlotResize(
    externalH != null ? null : resizeStorageKey || null,
    resizeDefaultHeight,
    200,
    560
  );
  const heightPx = externalH ?? internalResize.plotHeight;
  const resizeChrome = externalH != null || internalResize.enabled;
  const svgPlotStyle = resizeChrome && heightPx != null ? tickerSvgPlotStyle(heightPx) : undefined;

  const xLabelStride = useMemo(() => {
    const cap = Math.max(4, Number(xAxisMaxLabels) || 16);
    return Math.max(1, Math.ceil(n / cap));
  }, [n, xAxisMaxLabels]);

  const scopeStyle =
    internalResize.enabled && externalH == null && heightPx != null
      ? { '--ticker-resize-plot-h': `${Math.round(heightPx)}px` }
      : undefined;

  const rootClass = [
    'stats-cmp-chart',
    resizeChrome ? 'stats-cmp-chart--plot-resize' : '',
    internalResize.enabled && externalH == null ? 'ticker-chart-resize-scope' : ''
  ]
    .filter(Boolean)
    .join(' ');

  const sectionRef = useRef(null);
  const plotHostRef = useRef(null);
  const exportSymbol = `${ticker}-vs-${benchmarkIndex}`;

  return (
    <section ref={sectionRef} className={rootClass} style={scopeStyle}>
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
        exportChartSlug={`rs-annual-${mode}`}
        exportSymbol={exportSymbol}
        exportPreviewAlt={`${ticker} vs ${benchmarkIndex} annual returns chart`}
      />
      {loading ? (
        <StatsCmpChartSkeleton variant="groupedBar" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <>
          <div ref={plotHostRef} className="stats-cmp-chart__plot-host">
            <div className="stats-cmp-chart__legend">
              <span>
                <i className="stats-cmp-chart__sw stats-cmp-chart__sw--ticker" /> {ticker}
              </span>
              <span>
                <i className="stats-cmp-chart__sw stats-cmp-chart__sw--bench1" /> {benchmarkIndex}
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="stats-cmp-chart__svg" preserveAspectRatio="xMidYMid meet" style={svgPlotStyle}>
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
                const tH = Math.abs(zeroY - tY);
                const bH = Math.abs(zeroY - bY);
                const showX =
                  n <= 1 || i % xLabelStride === 0 || i === n - 1 || (i === 0 && xLabelStride > 1);
                const periodStr = String(r.period ?? '');
                const xText = typeof formatXAxisLabel === 'function' ? formatXAxisLabel(periodStr) : periodStr;
                return (
                  <g key={r.period}>
                    <rect
                      x={cx - barW - 2}
                      y={Math.min(tY, zeroY)}
                      width={barW}
                      height={Math.max(1, tH)}
                      className="stats-cmp-chart__bar stats-cmp-chart__bar--ticker"
                    />
                    <rect
                      x={cx + 2}
                      y={Math.min(bY, zeroY)}
                      width={barW}
                      height={Math.max(1, bH)}
                      className="stats-cmp-chart__bar stats-cmp-chart__bar--bench1"
                    />
                    <text
                      x={cx - barW / 2 - 2}
                      y={tY < zeroY ? tY - 6 : tY + 12}
                      textAnchor="middle"
                      className="stats-cmp-chart__bar-label"
                    >
                      {fmtPct(r.tickerReturn)}
                    </text>
                    <text
                      x={cx + barW / 2 + 2}
                      y={bY < zeroY ? bY - 6 : bY + 12}
                      textAnchor="middle"
                      className="stats-cmp-chart__bar-label"
                    >
                      {fmtPct(r.benchmarkReturn)}
                    </text>
                    {showX ? (
                      <text x={cx} y={H - 14} textAnchor="middle" className="stats-cmp-chart__x" title={periodStr}>
                        {xText}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </svg>
            <div className="stats-cmp-chart__titlebox">
              {ticker} vs {benchmarkIndex} — {mode} Returns
            </div>
            <div className="stats-cmp-chart__caption">
              {ticker} versus {benchmarkIndex} calendar-{mode} returns.
            </div>
          </div>
          {internalResize.enabled && externalH == null ? (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-valuemin={internalResize.ariaMin}
              aria-valuemax={internalResize.ariaMax}
              aria-valuenow={internalResize.ariaNow}
              className="ticker-chart-resize ticker-chart-resize--scope"
              title="Drag to resize chart height. Double-click to reset."
              onPointerDown={internalResize.onPointerDown}
              onDoubleClick={internalResize.onDoubleClick}
            />
          ) : null}
        </>
      )}
    </section>
  );
}
