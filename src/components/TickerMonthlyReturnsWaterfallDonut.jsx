import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ChartDateApplyRow } from './ChartDateApplyRow.jsx';
import { DataInfoTip } from './DataInfoTip.jsx';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';

const DEFAULT_YEAR = 2025;
const COL_INC = '#2563eb';
const COL_DEC = '#f97316';
const COL_NEU = '#64748b';
const COL_DONUT_POS = '#172554';
const COL_DONUT_NEG = '#f97316';
const DONUT_GAP_DEG = 2.35;
const R0 = 52;
const R1 = 82;

function parseMonthRow(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function parseYear(period) {
  const mm = String(period || '').match(/(\d{4})/);
  const y = mm ? parseInt(mm[1], 10) : NaN;
  return Number.isFinite(y) ? y : NaN;
}

function yForValue(v, innerTop, innerH, yMin, yMax) {
  const c = Math.min(yMax, Math.max(yMin, v));
  return innerTop + ((yMax - c) / (yMax - yMin)) * innerH;
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

/**
 * Waterfall (cumulative monthly returns for selected year) + donut (# positive / negative years from annual returns).
 * Renders below `TickerMonthlyReturnsChart`; does not replace it.
 */
export function TickerMonthlyReturnsWaterfallDonut({ symbol, monthlyReturns, annualReturns, asOfDate }) {
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const [monthRangeApplied, setMonthRangeApplied] = useState({ start: '', end: '' });
  const [annualRangeApplied, setAnnualRangeApplied] = useState({ start: '', end: '' });

  const monthRows = useMemo(() => {
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

  const displayMonthRows = useMemo(
    () => filterReturnsRows(monthRows, monthRangeApplied.start, monthRangeApplied.end),
    [monthRows, monthRangeApplied.start, monthRangeApplied.end]
  );

  const annualRows = useMemo(() => {
    if (!Array.isArray(annualReturns)) return [];
    return [...annualReturns]
      .map((r) => ({
        startDate: r.startDate,
        endDate: r.endDate,
        totalReturn: Number(r.totalReturn),
        year: parseYear(r.period)
      }))
      .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.totalReturn));
  }, [annualReturns]);

  const displayAnnualRows = useMemo(
    () => filterReturnsRows(annualRows, annualRangeApplied.start, annualRangeApplied.end),
    [annualRows, annualRangeApplied.start, annualRangeApplied.end]
  );

  const yearStats = useMemo(() => {
    const pos = displayAnnualRows.filter((r) => r.totalReturn > 0).length;
    const neg = displayAnnualRows.filter((r) => r.totalReturn < 0).length;
    return { pos, neg };
  }, [displayAnnualRows]);

  const availableYears = useMemo(() => {
    const ys = [...new Set(displayMonthRows.map((r) => r.year))].sort((a, b) => b - a);
    return ys;
  }, [displayMonthRows]);

  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);

  useEffect(() => {
    if (!availableYears.length) return;
    if (availableYears.includes(selectedYear)) return;
    setSelectedYear(availableYears.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : availableYears[0]);
  }, [availableYears, selectedYear]);

  const monthValues = useMemo(() => {
    const arr = Array.from({ length: 12 }, () => null);
    for (const r of displayMonthRows) {
      if (r.year === selectedYear) arr[r.month - 1] = r.totalReturn;
    }
    return arr;
  }, [displayMonthRows, selectedYear]);

  const waterfallSvg = useMemo(() => {
    const light = chartTheme === 'light';
    const COL_GRID = light ? 'rgba(15, 23, 42, 0.1)' : 'rgba(148, 163, 184, 0.14)';
    const COL_GRID_ZERO = light ? 'rgba(15, 23, 42, 0.22)' : 'rgba(148, 163, 184, 0.35)';
    const COL_AXIS = light ? '#334155' : '#94a3b8';
    const COL_LABEL = light ? '#0f172a' : '#e2e8f0';
    const COL_CONN = light ? 'rgba(15, 23, 42, 0.35)' : 'rgba(148, 163, 184, 0.45)';
    const COL_TOTAL = light ? '#475569' : COL_NEU;

    const deltas = monthValues.map((v) => (Number.isFinite(v) ? v : 0));
    const cum = [0];
    for (let i = 0; i < 12; i++) cum.push(cum[i] + deltas[i]);
    const cmin = Math.min(...cum);
    const cmax = Math.max(...cum);
    let yMin = Math.min(-20, Math.floor(cmin / 10) * 10);
    let yMax = Math.max(80, Math.ceil(cmax / 10) * 10);
    if (yMax <= yMin) yMax = yMin + 40;

    const W = 460;
    const H = 300;
    const padL = 50;
    const padR = 14;
    const padT = 20;
    const padB = 54;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = 12;
    const gap = 0.2;
    const bw = (iw / n) * (1 - gap);
    const step = iw / n;

    const ticks = [];
    for (let t = yMin; t <= yMax + 1e-9; t += 10) ticks.push(t);

    const gridLines = ticks.map((t, ti) => {
      const y = yForValue(t, padT, ih, yMin, yMax);
      return (
        <g key={`wf-y-${ti}`}>
          <line
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke={t === 0 ? COL_GRID_ZERO : COL_GRID}
            strokeWidth={t === 0 ? 1.35 : 1}
          />
          <text x={padL - 8} y={y + 4} textAnchor="end" fill={COL_AXIS} fontSize="10" fontWeight="600">
            {t}%
          </text>
        </g>
      );
    });

    const bars = [];
    const connectors = [];
    for (let i = 0; i < 12; i++) {
      const m = i + 1;
      const d = deltas[i];
      const c0 = cum[i];
      const c1 = cum[i + 1];
      const cx = padL + (i + 0.5) * step;
      const x = cx - bw / 2;
      const yTop = yForValue(Math.max(c0, c1), padT, ih, yMin, yMax);
      const yBot = yForValue(Math.min(c0, c1), padT, ih, yMin, yMax);
      const h = Math.max(Math.abs(yBot - yTop), 1);
      const top = Math.min(yTop, yBot);
      const fill = d > 0 ? COL_INC : d < 0 ? COL_DEC : COL_NEU;
      const labY = d >= 0 ? top - 5 : top + h + 13;
      bars.push(
        <g key={m}>
          <rect x={x} y={top} width={bw} height={h} rx={2} fill={fill} />
          <text x={cx} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="9.5" fontWeight="700">
            {d.toFixed(1)}%
          </text>
        </g>
      );
      if (i < 11) {
        const cxNext = padL + (i + 1.5) * step;
        const yJoin = yForValue(c1, padT, ih, yMin, yMax);
        const xR = cx + bw / 2;
        const xL = cxNext - bw / 2;
        if (xR < xL) {
          connectors.push(
            <line
              key={`br-${m}`}
              x1={xR}
              y1={yJoin}
              x2={xL}
              y2={yJoin}
              stroke={COL_CONN}
              strokeWidth={1.25}
              strokeDasharray="3 2"
            />
          );
        }
      }
    }

    const xLabels = Array.from({ length: 12 }, (_, i) => {
      const cx = padL + (i + 0.5) * step;
      return (
        <text key={i} x={cx} y={H - 22} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="600">
          {i + 1}
        </text>
      );
    });

    const endCum = cum[12];
    const totalLabel = (
      <text x={padL + iw / 2} y={H - 6} textAnchor="middle" fill={COL_TOTAL} fontSize="9" fontWeight="700">
        Year cumulative (Dec end): {endCum >= 0 ? '+' : ''}
        {endCum.toFixed(1)}%
      </text>
    );

    return (
      <svg className="ticker-annual-figma__svg ticker-monthly-adv__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {gridLines}
        {connectors}
        {bars}
        {xLabels}
        {totalLabel}
      </svg>
    );
  }, [monthValues, selectedYear, chartTheme]);

  const donutSvg = useMemo(() => {
    const light = chartTheme === 'light';
    const ringStroke = light ? '#e2e8f0' : '#0d1520';
    const emptyFill = light ? '#64748b' : '#94a3b8';
    const { pos, neg } = yearStats;
    const total = pos + neg;
    const cx = 100;
    const cy = 100;
    if (total === 0) {
      return (
        <svg className="ticker-annual-figma__donut-svg" viewBox="0 0 200 200">
          <text x="100" y="104" textAnchor="middle" fill={emptyFill} fontSize="12" fontWeight="600">
            No annual data
          </text>
        </svg>
      );
    }
    const start = -90;
    const endFull = start + 360;
    let paths;
    let labels;
    if (neg === 0) {
      const d = donutSegPath(R0, R1, start, endFull);
      const lp = labelOnDonut((R0 + R1) / 2, start + 180);
      paths = <path d={d} fill={COL_DONUT_POS} stroke={ringStroke} strokeWidth="2.5" />;
      labels = (
        <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
          {pos}
        </text>
      );
    } else if (pos === 0) {
      const d = donutSegPath(R0, R1, start, endFull);
      const lp = labelOnDonut((R0 + R1) / 2, start + 180);
      paths = <path d={d} fill={COL_DONUT_NEG} stroke={ringStroke} strokeWidth="2.5" />;
      labels = (
        <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
          {neg}
        </text>
      );
    } else {
      const avail = 360 - DONUT_GAP_DEG;
      const spanPos = (pos / total) * avail;
      const spanNeg = (neg / total) * avail;
      const endPos = start + spanPos;
      const pPos = donutSegPath(R0, R1, start, endPos);
      const pNeg = donutSegPath(R0, R1, endPos + DONUT_GAP_DEG, endPos + DONUT_GAP_DEG + spanNeg);
      const midPos = start + spanPos / 2;
      const midNeg = endPos + DONUT_GAP_DEG + spanNeg / 2;
      const lp = labelOnDonut((R0 + R1) / 2, midPos);
      const ln = labelOnDonut((R0 + R1) / 2, midNeg);
      paths = (
        <>
          <path d={pPos} fill={COL_DONUT_POS} stroke={ringStroke} strokeWidth="2.5" />
          <path d={pNeg} fill={COL_DONUT_NEG} stroke={ringStroke} strokeWidth="2.5" />
        </>
      );
      labels = (
        <>
          <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            {pos}
          </text>
          <text x={ln.x} y={ln.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            {neg}
          </text>
        </>
      );
    }
    return (
      <svg className="ticker-annual-figma__donut-svg" viewBox="0 0 200 200">
        <g transform={`translate(${cx},${cy})`}>
          {paths}
          {labels}
        </g>
      </svg>
    );
  }, [yearStats, chartTheme]);

  const symU = String(symbol || 'ticker').toUpperCase();
  const yearOptions = availableYears.length ? availableYears : [DEFAULT_YEAR];
  const hasMonthlySource = monthRows.length > 0;
  const hasMonthly = displayMonthRows.length > 0;
  const hasAnnualSource = annualRows.length > 0;
  const hasAnnual = displayAnnualRows.length > 0;
  const monthlyFilteredEmpty = hasMonthlySource && !hasMonthly;
  const annualFilteredEmpty = hasAnnualSource && !hasAnnual;

  return (
    <div className="ticker-monthly-adv">
      
      <div className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar">
          <span className="ticker-annual-figma__badge">Monthly returns — waterfall &amp; year mix</span>
        </div>

        <div className="ticker-monthly-adv__split">
          <div className="ticker-monthly-adv__panel ticker-annual-figma__chart-card">
            <div className="ticker-monthly-adv__panel-head">
              <div className="ticker-monthly-adv__title-block">
                <span className="ticker-monthly-adv__panel-title">Cumulative monthly</span>
                <DataInfoTip align="end">
                  <p className="ticker-data-tip__p">
                    <strong>Waterfall</strong>: for the selected calendar year, each column is a month (1 = Jan … 12 = Dec). Each bar runs from the{' '}
                    <strong>cumulative return</strong> at the start of the month to the cumulative after applying that month’s{' '}
                    <strong>totalReturn</strong> from <code className="ticker-data-tip__code">performance.monthlyReturns</code>.
                  </p>
                  <p className="ticker-data-tip__p">
                    <strong>Blue</strong> = month with positive <strong>totalReturn</strong>; <strong>orange</strong> = negative; <strong>grey</strong>{' '}
                    = 0% (or no row — treated as 0 for the bridge). Dashed lines connect the running total into the next month.
                  </p>
                  <p className="ticker-data-tip__p">
                    Bar labels are the <strong>single-month</strong> %, not the cumulative level. Bottom line shows cumulative % after month 12
                    (approx. compounded path in % points, not a multiplicative compound factor).
                  </p>
                  {asOfDate ? (
                    <p className="ticker-data-tip__p">
                      Year <strong>{selectedYear}</strong>. Returns as of <strong>{asOfDate}</strong> for <strong>{symU}</strong>.
                    </p>
                  ) : (
                    <p className="ticker-data-tip__p">
                      Year <strong>{selectedYear}</strong>, symbol <strong>{symU}</strong>.
                    </p>
                  )}
                </DataInfoTip>
              </div>
              <div className="ticker-monthly__select-wrap">
                <label className="ticker-monthly__select-label" htmlFor="ticker-monthly-adv-year">
                  Year
                </label>
                <select
                  id="ticker-monthly-adv-year"
                  className="ticker-monthly__select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  disabled={!hasMonthlySource}
                  aria-label="Year for waterfall"
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
              idPrefix="monthly-waterfall"
              maxDate={asOfDate}
              onApply={({ start, end }) => setMonthRangeApplied({ start, end })}
            />
            {monthlyFilteredEmpty ? (
              <div className="ticker-monthly-adv__empty">No monthly rows overlap the selected date range.</div>
            ) : hasMonthly ? (
              waterfallSvg
            ) : (
              <div className="ticker-monthly-adv__empty">No monthly returns to plot.</div>
            )}
            <div className="ticker-monthly-adv__legend-row">
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-monthly-adv__sw inc" aria-hidden />
                Increase
              </span>
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-monthly-adv__sw dec" aria-hidden />
                Decrease
              </span>
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-monthly-adv__sw neu" aria-hidden />
                Total
              </span>
            </div>
          </div>

          <div className="ticker-monthly-adv__panel ticker-annual-figma__chart-card ticker-monthly-adv__panel--donut">
            <div className="ticker-monthly-adv__panel-head ticker-monthly-adv__panel-head--donut">
              <span className="ticker-monthly-adv__panel-spacer" aria-hidden />
              <span className="ticker-monthly-adv__panel-title">Year mix</span>
              <div className="ticker-monthly-adv__panel-tip">
                <DataInfoTip align="end">
                  <p className="ticker-data-tip__p">
                    <strong>Donut</strong>: counts <strong>calendar years</strong> in <code className="ticker-data-tip__code">performance.annualReturns</code>{' '}
                    with <strong>totalReturn &gt; 0</strong> (navy segment) vs <strong>&lt; 0</strong> (orange). Years with exactly 0% are excluded from both
                    counts.
                  </p>
                  <p className="ticker-data-tip__p">
                    Use the panel’s <strong>Start date / End date</strong> row (Submit) to filter annual rows independently of the waterfall year
                    dropdown. The waterfall has its own date filter.
                  </p>
                  {asOfDate ? (
                    <p className="ticker-data-tip__p">
                      Returns as of <strong>{asOfDate}</strong>.
                    </p>
                  ) : null}
                </DataInfoTip>
              </div>
            </div>
            <ChartDateApplyRow
              idPrefix="monthly-donut-annual"
              maxDate={asOfDate}
              onApply={({ start, end }) => setAnnualRangeApplied({ start, end })}
            />
            {annualFilteredEmpty ? (
              <div className="ticker-monthly-adv__empty">No annual rows overlap the selected date range.</div>
            ) : hasAnnual ? (
              donutSvg
            ) : (
              <div className="ticker-monthly-adv__empty">No annual returns for this donut.</div>
            )}
            <div className="ticker-monthly-adv__legend-row">
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-monthly-adv__sw donut-pos" aria-hidden /># positive years
              </span>
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-monthly-adv__sw donut-neg" aria-hidden /># negative years
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
