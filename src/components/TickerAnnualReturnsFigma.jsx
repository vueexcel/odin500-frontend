import { useCallback, useId, useMemo, useState } from 'react';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { ChartDateApplyRow } from './ChartDateApplyRow.jsx';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';

/** Match `TickerLightweightChart` / dark ticker cards. */
const COL_BAR = '#2563eb';
const COL_ORANGE = '#f97316';
const COL_GRID = 'rgba(148, 163, 184, 0.14)';
const COL_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';
const COL_AXIS = '#94a3b8';
const COL_LABEL = '#e2e8f0';

/** “Nice” tick step for ~`targetCount` intervals across `span`. */
function pickNiceStep(span, targetCount) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / Math.max(2, targetCount);
  const pow10 = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-9)));
  const err = raw / pow10;
  let nice = 10;
  if (err <= 1.5) nice = 1;
  else if (err <= 3) nice = 2;
  else if (err <= 7) nice = 5;
  return nice * pow10;
}

function buildTicks(yMin, yMax, step) {
  const ticks = [];
  const k0 = Math.ceil((yMin - 1e-9) / step);
  const k1 = Math.floor((yMax + 1e-9) / step);
  for (let k = k0; k <= k1; k++) {
    const t = Math.round(k * step * 1e8) / 1e8;
    ticks.push(t);
  }
  if (!ticks.length) ticks.push(0);
  return ticks;
}

/**
 * Y-axis from data (min/max of series + 0, optional avg). Tick count grows when the chart is taller (`plotPx`).
 * @param {number[]} seriesValues
 * @param {number | null} avgExtra — include in domain so the average line stays visible
 * @param {number | undefined} plotPx — rendered SVG height in CSS px (resize)
 * @param {number} svgHeight — viewBox height of this chart
 * @param {number} innerHViewBox — plot inner height in SVG units
 */
function computePercentAxis(seriesValues, avgExtra, plotPx, svgHeight, innerHViewBox) {
  const vals = seriesValues.filter((v) => Number.isFinite(v));
  if (!vals.length) {
    return { yMin: -20, yMax: 60, ticks: [-20, -10, 0, 10, 20, 30, 40, 50, 60], step: 10 };
  }
  let lo = Math.min(0, ...vals);
  let hi = Math.max(0, ...vals);
  if (avgExtra != null && Number.isFinite(avgExtra)) {
    lo = Math.min(lo, avgExtra);
    hi = Math.max(hi, avgExtra);
  }
  let span = hi - lo;
  if (span < 1e-6) {
    lo -= 5;
    hi += 5;
    span = 10;
  }
  const pad = Math.max(span * 0.08, 2);
  lo -= pad;
  hi += pad;

  const effPlot = plotPx != null && Number.isFinite(plotPx) ? plotPx : svgHeight;
  const renderedInnerPx = innerHViewBox * (effPlot / svgHeight);
  const minPxPerTick = renderedInnerPx < 200 ? 28 : renderedInnerPx < 340 ? 22 : renderedInnerPx < 500 ? 18 : 14;
  const targetCount = Math.min(22, Math.max(5, Math.round(renderedInnerPx / minPxPerTick)));

  const step = pickNiceStep(hi - lo, targetCount);
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.ceil(hi / step) * step;
  const ticks = buildTicks(yMin, yMax, step);
  return { yMin, yMax, ticks, step };
}

function yForValueAxis(v, innerTop, innerH, yMin, yMax) {
  if (!Number.isFinite(v)) return innerTop + innerH / 2;
  const c = Math.min(yMax, Math.max(yMin, v));
  if (Math.abs(yMax - yMin) < 1e-12) return innerTop + innerH / 2;
  return innerTop + ((yMax - c) / (yMax - yMin)) * innerH;
}

function formatTickPct(t) {
  const r = Math.round(t * 10) / 10;
  if (Math.abs(r - Math.round(r)) < 1e-6) return `${Math.round(r)}%`;
  return `${r}%`;
}

function parseYear(period) {
  const m = String(period || '').match(/(\d{4})/);
  const y = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(y) ? y : NaN;
}

function median(nums) {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function donutSegPath(r0, r1, deg0, deg1) {
  const rad = Math.PI / 180;
  const x1 = r1 * Math.cos(deg0 * rad);
  const y1 = r1 * Math.sin(deg0 * rad);
  const x2 = r1 * Math.cos(deg1 * rad);
  const y2 = r1 * Math.sin(deg1 * rad);
  const x3 = r0 * Math.cos(deg1 * rad);
  const y3 = r0 * Math.sin(deg1 * rad);
  const x4 = r0 * Math.cos(deg0 * rad);
  const y4 = r0 * Math.sin(deg0 * rad);
  const large = Math.abs(deg1 - deg0) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 ${large} 0 ${x4} ${y4} Z`;
}

function labelOnDonut(r, degMid) {
  const rad = Math.PI / 180;
  return { x: r * Math.cos(degMid * rad), y: r * Math.sin(degMid * rad) };
}

function IcoTable() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 9h16M4 14h16M12 9v11" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IcoDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10m0 0l4-4m-4 4L8 10M6 18h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

/**
 * Figma-style annual returns + stats (uses `performance.annualReturns` from ticker-returns API).
 * @param {{ symbol: string, annualReturns?: unknown[], asOfDate?: string, plotHeight?: number, resizeStorageKey?: string, resizeDefaultHeight?: number }} props
 */
export function TickerAnnualReturnsFigma({
  symbol,
  annualReturns,
  asOfDate,
  plotHeight,
  resizeStorageKey,
  resizeDefaultHeight = 260
}) {
  const resize = useTickerPlotResize(resizeStorageKey ?? null, resizeDefaultHeight);
  const plotPx = resize.plotHeight ?? plotHeight;
  const clipComboId = useId().replace(/:/g, '');
  const clipSummaryId = useId().replace(/:/g, '');

  const [showTable, setShowTable] = useState(false);
  const [rangeApplied, setRangeApplied] = useState({ start: '', end: '' });

  const rows = useMemo(() => {
    if (!Array.isArray(annualReturns)) return [];
    return [...annualReturns]
      .map((r) => ({
        period: r.period,
        startDate: r.startDate,
        endDate: r.endDate,
        startPrice: r.startPrice,
        endPrice: r.endPrice,
        totalReturn: Number(r.totalReturn),
        year: parseYear(r.period)
      }))
      .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.totalReturn))
      .sort((a, b) => a.year - b.year);
  }, [annualReturns]);

  const displayRows = useMemo(
    () => filterReturnsRows(rows, rangeApplied.start, rangeApplied.end),
    [rows, rangeApplied.start, rangeApplied.end]
  );

  const stats = useMemo(() => {
    if (!displayRows.length) return null;
    const rets = displayRows.map((r) => r.totalReturn);
    const pos = displayRows.filter((r) => r.totalReturn > 0).length;
    const neg = displayRows.filter((r) => r.totalReturn < 0).length;
    const avg = rets.reduce((a, b) => a + b, 0) / rets.length;
    return {
      pos,
      neg,
      avg,
      max: Math.max(...rets),
      min: Math.min(...rets),
      med: median(rets)
    };
  }, [displayRows]);

  const onDownloadCsv = useCallback(() => {
    if (!displayRows.length) return;
    const headers = ['period', 'year', 'startDate', 'endDate', 'totalReturn', 'startPrice', 'endPrice'];
    const lines = [
      headers.join(','),
      ...displayRows.map((r) =>
        [
          csvEscape(r.period),
          r.year,
          csvEscape(r.startDate),
          csvEscape(r.endDate),
          r.totalReturn,
          r.startPrice ?? '',
          r.endPrice ?? ''
        ].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(symbol || 'ticker').toUpperCase()}-annual-returns.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayRows, symbol]);

  const comboSvg = useMemo(() => {
    if (!displayRows.length || !stats) return null;
    const W = 880;
    const H = 260;
    const padL = 52;
    const padR = 20;
    const padT = 16;
    const padB = 56;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = displayRows.length;
    const gap = 0.15;
    const bw = (iw / n) * (1 - gap);
    const step = iw / n;

    const returns = displayRows.map((r) => r.totalReturn);
    const { yMin, yMax, ticks: yTicks } = computePercentAxis(returns, stats.avg, plotPx, H, ih);

    const gridLines = yTicks.map((t) => {
      const y = yForValueAxis(t, padT, ih, yMin, yMax);
      return (
        <g key={t}>
          <line
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke={Math.abs(t) < 1e-6 ? COL_GRID_ZERO : COL_GRID}
            strokeWidth={Math.abs(t) < 1e-6 ? 1.35 : 1}
          />
          <text x={padL - 8} y={y + 4} textAnchor="end" fill={COL_AXIS} fontSize="11" fontWeight="600">
            {formatTickPct(t)}
          </text>
        </g>
      );
    });

    const barRects = displayRows.map((r, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValueAxis(0, padT, ih, yMin, yMax);
      const y1 = yForValueAxis(r.totalReturn, padT, ih, yMin, yMax);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      return (
        <rect key={`r-${r.year}`} x={x} y={top} width={bw} height={Math.max(h, 1)} rx={2} fill={COL_BAR}>
          <title>
            {r.year}: {r.totalReturn >= 0 ? '+' : ''}
            {r.totalReturn.toFixed(2)}% (Y {yMin.toFixed(0)}%–{yMax.toFixed(0)}%)
          </title>
        </rect>
      );
    });

    const barLabels = displayRows.map((r, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValueAxis(0, padT, ih, yMin, yMax);
      const y1 = yForValueAxis(r.totalReturn, padT, ih, yMin, yMax);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      const labY = r.totalReturn >= 0 ? top - 6 : top + h + 14;
      return (
        <text key={`t-${r.year}`} x={x + bw / 2} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="11" fontWeight="700">
          {r.totalReturn >= 0 ? '+' : ''}
          {r.totalReturn.toFixed(0)}%
        </text>
      );
    });

    const avgY = yForValueAxis(stats.avg, padT, ih, yMin, yMax);
    const avgLabelY = avgY < padT + 16 ? avgY + 14 : avgY - 5;

    const xLabels = displayRows.map((r, i) => {
      const cx = padL + i * step + step / 2;
      return (
        <text key={r.year} x={cx} y={H - 28} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="600">
          {r.year}
        </text>
      );
    });

    return (
      <svg
        className="ticker-annual-figma__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={tickerSvgPlotStyle(plotPx)}
        aria-label={`Annual returns bar chart, Y-axis ${formatTickPct(yMin)} to ${formatTickPct(yMax)} from data range; resize to show finer grid labels.`}
      >
        <defs>
          <clipPath id={clipComboId}>
            <rect x={padL} y={padT} width={iw} height={ih} />
          </clipPath>
        </defs>
        {gridLines}
        <g clipPath={`url(#${clipComboId})`}>{barRects}</g>
        <g pointerEvents="none">
          <title>
            Average {stats.avg >= 0 ? '+' : ''}
            {stats.avg.toFixed(2)}%
          </title>
          <line x1={padL} y1={avgY} x2={W - padR} y2={avgY} stroke={COL_ORANGE} strokeWidth={2.5} />
        </g>
        <text
          x={W - padR - 4}
          y={avgLabelY}
          textAnchor="end"
          fill={COL_ORANGE}
          fontSize="10"
          fontWeight="700"
          pointerEvents="none"
        >
          Av. {stats.avg >= 0 ? '+' : ''}
          {stats.avg.toFixed(1)}%
        </text>
        {barLabels}
        {xLabels}
      </svg>
    );
  }, [clipComboId, displayRows, stats, plotPx]);

  const summaryBars = useMemo(() => {
    if (!stats) return null;
    const items = [
      { key: 'max', label: 'Max', v: stats.max },
      { key: 'min', label: 'Min', v: stats.min },
      { key: 'avg', label: 'Average', v: stats.avg },
      { key: 'med', label: 'Median', v: stats.med }
    ];
    const W = 420;
    const H = 240;
    const padL = 48;
    const padR = 16;
    const padT = 12;
    const padB = 48;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = 4;
    const gap = 0.2;
    const bw = (iw / n) * (1 - gap);
    const step = iw / n;

    const sumVals = items.map((it) => it.v).filter((v) => Number.isFinite(v));
    const summaryPlotPx = plotPx != null ? Math.min(plotPx, 320) : 240;
    const { yMin: syMin, yMax: syMax, ticks: syTicks } = computePercentAxis(sumVals, null, summaryPlotPx, H, ih);

    const gridLines = syTicks.map((t) => {
      const y = yForValueAxis(t, padT, ih, syMin, syMax);
      return (
        <g key={t}>
          <line
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke={Math.abs(t) < 1e-6 ? COL_GRID_ZERO : COL_GRID}
            strokeWidth={Math.abs(t) < 1e-6 ? 1.35 : 1}
          />
          <text x={padL - 8} y={y + 4} textAnchor="end" fill={COL_AXIS} fontSize="11" fontWeight="600">
            {formatTickPct(t)}
          </text>
        </g>
      );
    });

    const barRects = items.map((it, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValueAxis(0, padT, ih, syMin, syMax);
      const y1 = yForValueAxis(it.v, padT, ih, syMin, syMax);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      return (
        <rect key={`sr-${it.key}`} x={x} y={top} width={bw} height={Math.max(h, 1)} rx={2} fill={COL_BAR} />
      );
    });

    const barTexts = items.map((it, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValueAxis(0, padT, ih, syMin, syMax);
      const y1 = yForValueAxis(it.v, padT, ih, syMin, syMax);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      const labY = !Number.isFinite(it.v) ? H / 2 : it.v >= 0 ? top - 5 : top + h + 14;
      return (
        <g key={`st-${it.key}`}>
          <text x={x + bw / 2} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="11" fontWeight="700">
            {!Number.isFinite(it.v)
              ? '—'
              : `${it.v >= 0 ? '+' : ''}${Number(it.v).toFixed(0)}%`}
          </text>
          <text x={x + bw / 2} y={H - 18} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="700">
            {it.label}
          </text>
        </g>
      );
    });

    return (
      <svg
        className="ticker-annual-figma__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={tickerSvgPlotStyle(plotPx != null ? Math.min(plotPx, 320) : null)}
      >
        <defs>
          <clipPath id={clipSummaryId}>
            <rect x={padL} y={padT} width={iw} height={ih} />
          </clipPath>
        </defs>
        {gridLines}
        <g clipPath={`url(#${clipSummaryId})`}>{barRects}</g>
        {barTexts}
      </svg>
    );
  }, [clipSummaryId, stats, plotPx]);

  const donut = useMemo(() => {
    if (!stats) return null;
    const total = stats.pos + stats.neg;
    const cx = 100;
    const cy = 100;
    const r0 = 52;
    const r1 = 82;
    const donutStyle = tickerSvgPlotStyle(plotPx != null ? Math.min(220, plotPx) : null);

    if (total === 0) {
      return (
        <svg className="ticker-annual-figma__donut-svg" viewBox="0 0 200 200" style={donutStyle}>
          <text x="100" y="104" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">
            No data
          </text>
        </svg>
      );
    }
    const start = -90;
    const endFull = start + 360;
    let paths;
    let labels;
    if (stats.neg === 0) {
      const d = donutSegPath(r0, r1, start, endFull);
      const lp = labelOnDonut((r0 + r1) / 2, start + 180);
      paths = <path d={d} fill={COL_BAR} />;
      labels = (
        <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
          {stats.pos}
        </text>
      );
    } else if (stats.pos === 0) {
      const d = donutSegPath(r0, r1, start, endFull);
      const lp = labelOnDonut((r0 + r1) / 2, start + 180);
      paths = <path d={d} fill={COL_ORANGE} />;
      labels = (
        <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
          {stats.neg}
        </text>
      );
    } else {
      const spanPos = (stats.pos / total) * 360;
      const endPos = start + spanPos;
      const pPos = donutSegPath(r0, r1, start, endPos);
      const pNeg = donutSegPath(r0, r1, endPos, endFull);
      const midPos = start + spanPos / 2;
      const midNeg = endPos + (endFull - endPos) / 2;
      const lp = labelOnDonut((r0 + r1) / 2, midPos);
      const ln = labelOnDonut((r0 + r1) / 2, midNeg);
      paths = (
        <>
          <path d={pPos} fill={COL_BAR} />
          <path d={pNeg} fill={COL_ORANGE} />
        </>
      );
      labels = (
        <>
          <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            {stats.pos}
          </text>
          <text x={ln.x} y={ln.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            {stats.neg}
          </text>
        </>
      );
    }
    return (
      <svg className="ticker-annual-figma__donut-svg" viewBox="0 0 200 200" style={donutStyle}>
        <g transform={`translate(${cx},${cy})`}>
          {paths}
          {labels}
        </g>
      </svg>
    );
  }, [stats, plotPx]);

  if (!rows.length) {
    return (
      <div className="ticker-annual-figma">
        <div className="ticker-annual-figma__section">
          <div className="ticker-annual-figma__toolbar">
            <span className="ticker-annual-figma__badge">Annual returns</span>
          </div>
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
            <p className="ticker-annual-figma__empty">
              No annual return series yet. Load completes after <strong>ticker-returns</strong> returns{' '}
              <code className="ticker-annual-figma__code">performance.annualReturns</code> for {String(symbol).toUpperCase()}.
            </p>
            {asOfDate ? (
              <p className="ticker-annual-figma__empty-sub">As of {asOfDate} from returns payload.</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-annual-figma">
      <div
        className={
          'ticker-annual-figma__section' + (resize.enabled ? ' ticker-annual-figma__section--resize' : '')
        }
      >
        <div className="ticker-annual-figma__toolbar">
          <span className="ticker-annual-figma__badge">Annual returns</span>
          <div className="ticker-annual-figma__actions">
            <button
              type="button"
              className="ticker-annual-figma__btn ticker-annual-figma__btn--primary"
              onClick={() => setShowTable((v) => !v)}
            >
              <IcoTable /> Show data tables
            </button>
            <button type="button" className="ticker-annual-figma__btn ticker-annual-figma__btn--outline" onClick={onDownloadCsv}>
              <IcoDownload /> Download CSV
            </button>
          </div>
        </div>
        <ChartDateApplyRow
          idPrefix="annual-figma"
          maxDate={asOfDate}
          onApply={({ start, end }) => setRangeApplied({ start, end })}
        />
        <div className="ticker-annual-figma__chart-card">
          {comboSvg ? (
            comboSvg
          ) : (
            <p className="ticker-annual-figma__empty" style={{ padding: '24px 16px' }}>
              No annual rows overlap the selected start/end dates. Clear the filter or widen the range.
            </p>
          )}
        </div>
        <div className="ticker-annual-figma__legend">
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden />
            Annual return (%)
          </span>
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-annual-figma__swatch-line" aria-hidden />
            Av. return (%)
          </span>
        </div>
        {showTable ? (
          <div className="ticker-annual-figma__table-wrap">
            <table className="ticker-annual-figma__table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Total return %</th>
                  <th>Start price</th>
                  <th>End price</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td>{r.startDate ?? '—'}</td>
                    <td>{r.endDate ?? '—'}</td>
                    <td>{r.totalReturn.toFixed(2)}</td>
                    <td>{r.startPrice != null ? Number(r.startPrice).toFixed(2) : '—'}</td>
                    <td>{r.endPrice != null ? Number(r.endPrice).toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {resize.enabled ? (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-valuemin={resize.ariaMin}
            aria-valuemax={resize.ariaMax}
            aria-valuenow={resize.ariaNow}
            className="ticker-chart-resize ticker-chart-resize--scope ticker-chart-resize--in-section"
            title="Drag to resize chart height. Double-click to reset."
            onPointerDown={resize.onPointerDown}
            onDoubleClick={resize.onDoubleClick}
          />
        ) : null}
      </div>

      <div className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar ticker-annual-figma__toolbar--stack">
          <span className="ticker-annual-figma__badge">Annual stats — positive / negative, min max</span>
        </div>
        <div className="ticker-annual-figma__split">
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--donut">
            {donut}
            <div className="ticker-annual-figma__legend ticker-annual-figma__legend--donut">
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden /># positive years
              </span>
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--orange" aria-hidden /># negative years
              </span>
            </div>
          </div>
          <div className="ticker-annual-figma__chart-card">{summaryBars}</div>
        </div>
      </div>
    </div>
  );
}
