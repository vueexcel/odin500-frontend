import { useEffect, useMemo, useState } from 'react';
import { ChartDateApplyRow } from './ChartDateApplyRow.jsx';
import { DataInfoTip } from './DataInfoTip.jsx';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';

const COL_BAR = '#2563eb';
const COL_GRID = 'rgba(148, 163, 184, 0.14)';
const COL_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';
const COL_AXIS = '#94a3b8';
const COL_LABEL = '#e2e8f0';

const DEFAULT_YEAR = 2025;

function parseMonthRow(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function yForValue(v, innerTop, innerH, yMin, yMax) {
  const c = Math.min(yMax, Math.max(yMin, v));
  return innerTop + ((yMax - c) / (yMax - yMin)) * innerH;
}

/**
 * Monthly returns for one calendar year (Figma-style), with year dropdown + info tip.
 * @param {{ symbol: string, monthlyReturns?: unknown[], asOfDate?: string, plotHeight?: number }} props
 */
export function TickerMonthlyReturnsChart({ symbol, monthlyReturns, asOfDate, plotHeight }) {
  const [rangeApplied, setRangeApplied] = useState({ start: '', end: '' });

  const rows = useMemo(() => {
    if (!Array.isArray(monthlyReturns)) return [];
    const out = [];
    for (const r of monthlyReturns) {
      const meta = parseMonthRow(r.period);
      if (!meta) continue;
      const tr = Number(r.totalReturn);
      if (!Number.isFinite(tr)) continue;
      out.push({
        period: r.period,
        startDate: r.startDate,
        endDate: r.endDate,
        totalReturn: tr,
        year: meta.year,
        month: meta.month
      });
    }
    out.sort((a, b) => a.year - b.year || a.month - b.month);
    return out;
  }, [monthlyReturns]);

  const filteredRows = useMemo(
    () => filterReturnsRows(rows, rangeApplied.start, rangeApplied.end),
    [rows, rangeApplied.start, rangeApplied.end]
  );

  const availableYears = useMemo(() => {
    const ys = [...new Set(filteredRows.map((r) => r.year))].sort((a, b) => b - a);
    return ys;
  }, [filteredRows]);

  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);

  useEffect(() => {
    if (!availableYears.length) return;
    if (availableYears.includes(selectedYear)) return;
    setSelectedYear(availableYears.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : availableYears[0]);
  }, [availableYears, selectedYear]);

  const monthValues = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => null);
    for (const r of filteredRows) {
      if (r.year === selectedYear) arr[r.month - 1] = r.totalReturn;
    }
    return arr;
  }, [filteredRows, selectedYear]);

  const { yMin, yMax } = useMemo(() => {
    const vals = monthValues.filter((v) => v != null && Number.isFinite(v));
    if (!vals.length) return { yMin: -15, yMax: 25 };
    let lo = Math.min(-15, ...vals);
    let hi = Math.max(25, ...vals);
    lo = Math.floor(lo / 5) * 5;
    hi = Math.ceil(hi / 5) * 5;
    if (hi <= lo) hi = lo + 5;
    return { yMin: lo, yMax: hi };
  }, [monthValues]);

  const chart = useMemo(() => {
    const W = 720;
    const H = 278;
    const padL = 48;
    const padR = 18;
    const padT = 22;
    const padB = 52;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = 12;
    const gap = 0.22;
    const bw = (iw / n) * (1 - gap);
    const step = iw / n;

    const ticks = [];
    for (let t = yMin; t <= yMax + 1e-9; t += 5) ticks.push(t);

    const gridLines = ticks.map((t, ti) => {
      const y = yForValue(t, padT, ih, yMin, yMax);
      return (
        <g key={`g-${ti}-${t}`}>
          <line
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke={t === 0 ? COL_GRID_ZERO : COL_GRID}
            strokeWidth={t === 0 ? 1.35 : 1}
          />
          <text x={padL - 8} y={y + 4} textAnchor="end" fill={COL_AXIS} fontSize="10" fontWeight="600">
            {Number.isInteger(t) ? `${t}%` : `${t.toFixed(1)}%`}
          </text>
        </g>
      );
    });

    const bars = [];
    for (let m = 1; m <= 12; m++) {
      const v = monthValues[m - 1];
      if (!Number.isFinite(v)) continue;
      const i = m - 1;
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValue(0, padT, ih, yMin, yMax);
      const y1 = yForValue(v, padT, ih, yMin, yMax);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      const labY = v >= 0 ? top - 6 : top + h + 14;
      bars.push(
        <g key={m}>
          <rect x={x} y={top} width={bw} height={Math.max(h, 1)} rx={2} fill={COL_BAR} />
          <text x={x + bw / 2} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="10" fontWeight="700">
            {v.toFixed(1)}%
          </text>
        </g>
      );
    }

    const xLabels = Array.from({ length: 12 }, (_, i) => {
      const cx = padL + i * step + step / 2;
      return (
        <text key={i} x={cx} y={H - 22} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="600">
          {i + 1}
        </text>
      );
    });

    return (
      <svg
        className="ticker-annual-figma__svg ticker-monthly__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={tickerSvgPlotStyle(plotHeight)}
      >
        {gridLines}
        {bars}
        {xLabels}
      </svg>
    );
  }, [monthValues, yMin, yMax, plotHeight]);

  const symU = String(symbol || 'ticker').toUpperCase();
  const yearOptions = availableYears.length ? availableYears : [DEFAULT_YEAR];

  if (!rows.length) {
    return (
      <div className="ticker-monthly">
        
        <div className="ticker-annual-figma__section">
          <div className="ticker-monthly__head">
            <div className="ticker-monthly__title-block">
              <span className="ticker-monthly__title">Monthly returns</span>
              <DataInfoTip align="end">
                <p className="ticker-data-tip__p">
                  <strong>Monthly returns</strong> use <code className="ticker-data-tip__code">performance.monthlyReturns</code> from{' '}
                  <code className="ticker-data-tip__code">POST /api/market/ticker-returns</code>. Each row is one calendar month (
                  <code className="ticker-data-tip__code">YYYY-MM</code>) with <strong>totalReturn</strong> (% change from{' '}
                  <strong>startPrice</strong> to <strong>endPrice</strong> over that month).
                </p>
                <p className="ticker-data-tip__p">
                  The chart shows <strong>twelve bars</strong> (months 1–12) for the <strong>year you select</strong> in the dropdown. Missing
                  months have no bar.
                </p>
                <p className="ticker-data-tip__p">No monthly rows for {symU} yet.</p>
              </DataInfoTip>
            </div>
            <select className="ticker-monthly__select" value={selectedYear} disabled aria-label="Year">
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <ChartDateApplyRow
            idPrefix="monthly-returns-empty"
            maxDate={asOfDate}
            onApply={({ start, end }) => setRangeApplied({ start, end })}
          />
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
            <p className="ticker-annual-figma__empty">
              No <code className="ticker-annual-figma__code">monthlyReturns</code> in the returns payload for {symU}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-monthly">
      <div className="ticker-annual-figma__section">
        <div className="ticker-monthly__head">
          <div className="ticker-monthly__title-block">
            <span className="ticker-monthly__title">Monthly returns</span>
            <DataInfoTip align="end">
              <p className="ticker-data-tip__p">
                <strong>Data</strong>: <code className="ticker-data-tip__code">performance.monthlyReturns</code> from{' '}
                <code className="ticker-data-tip__code">POST /api/market/ticker-returns</code> (same payload as annual / quarterly blocks on
                this page). Each element is one calendar month with <strong>period</strong> <code className="ticker-data-tip__code">YYYY-MM</code>,{' '}
                <strong>startDate</strong>, <strong>endDate</strong>, <strong>startPrice</strong>, <strong>endPrice</strong>, and{' '}
                <strong>totalReturn</strong> (percent price change over that month, computed server-side).
              </p>
              <p className="ticker-data-tip__p">
                <strong>Chart</strong>: for the <strong>selected year</strong>, month <strong>1–12</strong> on the x-axis are January–December.
                Each bar height is that month’s <strong>totalReturn</strong>. The y-axis uses a <strong>5% grid</strong>, spanning at least{' '}
                <strong>−15%</strong> to <strong>+25%</strong> and expanding in 5% steps if any return in that year falls outside that band.
              </p>
              <p className="ticker-data-tip__p">
                <strong>Year dropdown</strong>: lists every calendar year present in the monthly series. Default is <strong>2025</strong> when
                that year exists; otherwise the most recent year with data is selected automatically.
              </p>
              {asOfDate ? (
                <p className="ticker-data-tip__p">
                  Returns as of <strong>{asOfDate}</strong> for <strong>{symU}</strong>.
                </p>
              ) : (
                <p className="ticker-data-tip__p">
                  Symbol <strong>{symU}</strong>.
                </p>
              )}
            </DataInfoTip>
          </div>
          <div className="ticker-monthly__select-wrap">
            <label className="ticker-monthly__select-label" htmlFor="ticker-monthly-year">
              Year
            </label>
            <select
              id="ticker-monthly-year"
              className="ticker-monthly__select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Select year for monthly returns"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <ChartDateApplyRow
          idPrefix="monthly-returns"
          maxDate={asOfDate}
          onApply={({ start, end }) => setRangeApplied({ start, end })}
        />

        <div className="ticker-annual-figma__chart-card">
          {rows.length > 0 && !filteredRows.length ? (
            <p className="ticker-annual-figma__empty" style={{ padding: '1.25rem' }}>
              No monthly rows overlap the selected date range.
            </p>
          ) : (
            chart
          )}
        </div>

        <div className="ticker-annual-figma__legend ticker-monthly__legend">
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-monthly__swatch" aria-hidden />
            {selectedYear}
          </span>
        </div>
      </div>
    </div>
  );
}
