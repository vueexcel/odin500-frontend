import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChartDateApplyRow } from './ChartDateApplyRow.jsx';
import { DataInfoTip } from './DataInfoTip.jsx';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { formatWeekAxisDate, isoYearWeekFromIsoDate } from '../utils/isoWeek.js';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';
import { getReturnsChartViewMoreHref } from '../utils/returnsViewMoreNavigation.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL } from '../utils/tickerUrlSync.js';
import { MonthlyReturnsChartSkeleton } from './ChartSkeletons.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ReturnsChartClickableTitle } from './ReturnsChartClickableTitle.jsx';
import { ChartSectionIconActions, useChartFullscreen } from './ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';

const COL_BAR = '#2563eb';
const COL_BAR_NEG = '#f59e0b';
const COL_AVG = '#f97316';
const COL_GRID = 'rgba(148, 163, 184, 0.14)';
const COL_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';
const COL_AXIS = '#94a3b8';
const COL_LABEL = '#e2e8f0';

const DEFAULT_YEAR = 2025;
/** Weekly statistic chart year picker lists every calendar year in this span (descending in UI). */
const WEEKLY_YEAR_SELECT_MIN = 1980;

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

function parseMonthRow(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function parseWeekRow(period) {
  const m = String(period || '').match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (!Number.isFinite(year) || week < 1 || week > 53) return null;
  return { year, month: week };
}

/** Slot weekly rows on the ISO week grid using api isoYear/isoWeek or period (YYYY-Www or end date). */
function weeklyRowMeta(r) {
  const wy = Number(r?.isoYear);
  const wk = Number(r?.isoWeek);
  if (Number.isFinite(wy) && Number.isFinite(wk) && wk >= 1 && wk <= 53) {
    return { year: wy, month: wk };
  }
  const fromLegacy = parseWeekRow(r.period);
  if (fromLegacy) return fromLegacy;
  const p = String(r?.period || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) {
    const iw = isoYearWeekFromIsoDate(p);
    if (iw && iw.week >= 1 && iw.week <= 53) return { year: iw.year, month: iw.week };
  }
  return null;
}

function parseDailyRow(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month: day };
}

function yForValue(v, innerTop, innerH, yMin, yMax) {
  const c = Math.min(yMax, Math.max(yMin, v));
  return innerTop + ((yMax - c) / (yMax - yMin)) * innerH;
}

/**
 * Monthly returns for one calendar year (Figma-style), with year dropdown + info tip.
 * @param {{ symbol: string, monthlyReturns?: unknown[], asOfDate?: string, plotHeight?: number, resizeStorageKey?: string, resizeDefaultHeight?: number, periodMode?: 'monthly' | 'weekly' | 'daily', suppressChartDateFilter?: boolean, showOpenPeriodPageButton?: boolean, useThemedYearDropdown?: boolean, defaultToLatestYear?: boolean, hideChartDateApplyRow?: boolean, chartToolbarExtras?: import('react').ReactNode, loading?: boolean }} props
 */
export function TickerMonthlyReturnsChart({
  symbol,
  monthlyReturns,
  asOfDate,
  plotHeight,
  resizeStorageKey,
  resizeDefaultHeight = 278,
  periodMode = 'monthly',
  suppressChartDateFilter = false,
  showOpenPeriodPageButton = false,
  useThemedYearDropdown = false,
  defaultToLatestYear = false,
  hideChartDateApplyRow = false,
  chartToolbarExtras = null,
  loading = false
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMonthlyMode = periodMode === 'monthly';
  const [showTable, setShowTable] = useState(false);
  const [rangeApplied, setRangeApplied] = useState({ start: '', end: '' });
  const showDateApplyRow = !isMonthlyMode && !suppressChartDateFilter && !hideChartDateApplyRow;
  const sectionRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartFsShellRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const { isFullscreen: chartFs } = useChartFullscreen(chartFsShellRef);
  const resize = useTickerPlotResize(resizeStorageKey ?? null, resizeDefaultHeight);
  const plotPx = resize.plotHeight ?? plotHeight;

  const rows = useMemo(() => {
    if (!Array.isArray(monthlyReturns)) return [];
    const out = [];
    for (const r of monthlyReturns) {
      const meta =
        periodMode === 'weekly'
          ? weeklyRowMeta(r)
          : periodMode === 'daily'
            ? parseDailyRow(r.period)
            : parseMonthRow(r.period);
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
  }, [monthlyReturns, periodMode]);

  const filteredRows = useMemo(
    () =>
      suppressChartDateFilter ? rows : filterReturnsRows(rows, rangeApplied.start, rangeApplied.end),
    [rows, rangeApplied.start, rangeApplied.end, suppressChartDateFilter]
  );

  const availableYears = useMemo(() => {
    const ys = [...new Set(filteredRows.map((r) => r.year))].sort((a, b) => b - a);
    return ys;
  }, [filteredRows]);

  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR);

  useEffect(() => {
    if (!availableYears.length) return;
    if (availableYears.includes(selectedYear)) return;
    if (defaultToLatestYear) {
      setSelectedYear(availableYears[0]);
      return;
    }
    setSelectedYear(availableYears.includes(DEFAULT_YEAR) ? DEFAULT_YEAR : availableYears[0]);
  }, [availableYears, selectedYear, defaultToLatestYear]);

  const monthValues = useMemo(() => {
    const size = periodMode === 'weekly' ? 53 : periodMode === 'daily' ? 31 : 12;
    const arr = Array.from({ length: size }, () => null);
    for (const r of filteredRows) {
      if (r.year === selectedYear && r.month >= 1 && r.month <= size) arr[r.month - 1] = r.totalReturn;
    }
    return arr;
  }, [filteredRows, selectedYear, periodMode]);

  /** Map ISO week index (1–53) → short date label for the x-axis (week ending). */
  const weekAxisLabels = useMemo(() => {
    const m = new Map();
    if (periodMode !== 'weekly') return m;
    for (const r of filteredRows) {
      if (r.year !== selectedYear) continue;
      const slot = r.month;
      if (slot < 1 || slot > 53) continue;
      const end = String(r.endDate || '').slice(0, 10);
      const iso = /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : String(r.period || '').slice(0, 10);
      const lbl = formatWeekAxisDate(iso);
      if (lbl) m.set(slot, lbl);
    }
    return m;
  }, [filteredRows, selectedYear, periodMode]);

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
  const avgReturn = useMemo(() => {
    const vals = monthValues.filter((v) => v != null && Number.isFinite(v));
    if (!vals.length) return null;
    return vals.reduce((sum, v) => sum + Number(v), 0) / vals.length;
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
    const n = periodMode === 'weekly' ? 53 : periodMode === 'daily' ? 31 : 12;
    const gap = periodMode === 'weekly' ? 0.05 : periodMode === 'daily' ? 0.1 : 0.22;
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
    for (let m = 1; m <= n; m++) {
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
          <rect x={x} y={top} width={bw} height={Math.max(h, 1)} rx={2} fill={v < 0 ? COL_BAR_NEG : COL_BAR} />
          {chartFs || (periodMode !== 'weekly' && periodMode !== 'daily') ? (
            <text x={x + bw / 2} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="10" fontWeight="700">
              {v.toFixed(1)}%
            </text>
          ) : null}
        </g>
      );
    }

    const every = periodMode === 'weekly' ? 4 : periodMode === 'daily' ? 5 : 1;
    const xLabels = Array.from({ length: n }, (_, i) => {
      if ((periodMode === 'weekly' || periodMode === 'daily') && i % every !== 0 && i !== n - 1) return null;
      const cx = padL + i * step + step / 2;
      if (periodMode === 'weekly') {
        const lbl = weekAxisLabels.get(i + 1);
        if (!lbl) return null;
        return (
          <text key={i} x={cx} y={H - 22} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="600">
            {lbl}
          </text>
        );
      }
      return (
        <text key={i} x={cx} y={H - 22} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="600">
          {periodMode === 'daily' ? i + 1 : i + 1}
        </text>
      );
    });

    const avgLine =
      avgReturn != null && Number.isFinite(avgReturn) ? (
        <g>
          <line
            x1={padL}
            y1={yForValue(avgReturn, padT, ih, yMin, yMax)}
            x2={W - padR}
            y2={yForValue(avgReturn, padT, ih, yMin, yMax)}
            stroke={COL_AVG}
            strokeWidth={1.5}
          />
          <text
            x={W - padR}
            y={yForValue(avgReturn, padT, ih, yMin, yMax) - 5}
            textAnchor="end"
            fill={COL_AVG}
            fontSize="10"
            fontWeight="700"
          >
            Avg {avgReturn.toFixed(1)}%
          </text>
        </g>
      ) : null;

    return (
      <svg
        className="ticker-annual-figma__svg ticker-monthly__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={tickerSvgPlotStyle(plotPx)}
      >
        {gridLines}
        {bars}
        {avgLine}
        {xLabels}
      </svg>
    );
  }, [avgReturn, chartFs, monthValues, yMin, yMax, plotPx, periodMode, weekAxisLabels]);

  const symU = String(symbol || 'ticker').toUpperCase();
  const yearOptions = useMemo(() => {
    if (hideChartDateApplyRow && periodMode === 'weekly') {
      const hi = Math.max(2026, new Date().getFullYear());
      const arr = [];
      for (let y = hi; y >= WEEKLY_YEAR_SELECT_MIN; y -= 1) arr.push(y);
      return arr;
    }
    return availableYears.length ? availableYears : [DEFAULT_YEAR];
  }, [hideChartDateApplyRow, periodMode, availableYears]);
  /** Always present newest-first (2026, 2025, …) in menus and native selects. */
  const sortedYearOptionsDesc = useMemo(
    () => [...yearOptions].sort((a, b) => b - a),
    [yearOptions]
  );
  const yearDropdownOptions = useMemo(
    () => sortedYearOptionsDesc.map((y) => ({ id: String(y), label: String(y) })),
    [sortedYearOptionsDesc]
  );
  const selectedYearRows = useMemo(
    () => filteredRows.filter((r) => r.year === selectedYear).sort((a, b) => a.month - b.month),
    [filteredRows, selectedYear]
  );
  const onDownloadCsv = useCallback(() => {
    if (!selectedYearRows.length) return;
    const headers = ['period', 'year', 'month', 'startDate', 'endDate', 'totalReturn'];
    const lines = [
      headers.join(','),
      ...selectedYearRows.map((r) =>
        [csvEscape(r.period), r.year, r.month, csvEscape(r.startDate), csvEscape(r.endDate), r.totalReturn].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${symU}-${periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'monthly'}-returns-${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedYearRows, selectedYear, symU, periodMode]);

  const onViewMore = useCallback(() => {
    const to = getReturnsChartViewMoreHref({
      pathname: location.pathname,
      search: location.search,
      periodMode,
      symbol
    });
    navigate(to);
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [navigate, location.pathname, location.search, periodMode, symbol]);

  const buildExportFilename = useCallback(
    () => buildTickerChartExportFilename(`${periodMode}-returns`, symbol),
    [periodMode, symbol]
  );
  const chartExportDisabled = loading || !selectedYearRows.length;

  const onOpenPeriodPage = useCallback(() => {
    const symPart = String(symbol || '').trim() || DEFAULT_TICKER_ROUTE_SYMBOL;
    const suffix = '/' + encodeURIComponent(symPart);
    const base =
      periodMode === 'weekly'
        ? '/statistic/ticker-weekly'
        : periodMode === 'daily'
          ? '/statistic/ticker-daily'
          : '/statistic/ticker-monthly';
    navigate(base + suffix);
  }, [navigate, periodMode, symbol]);

  const yearToolbarDropdown =
    !suppressChartDateFilter || useThemedYearDropdown ? (
      <div className="ticker-monthly__select-wrap ticker-monthly__select-wrap--toolbar">
        <label className="ticker-monthly__select-label" htmlFor="ticker-monthly-year-toolbar">
          Year
        </label>
        <ThemedDropdown
          buttonId="ticker-monthly-year-toolbar"
          className="ticker-monthly__select-dd"
          size="sm"
          value={String(selectedYear)}
          options={yearDropdownOptions}
          onChange={(v) => setSelectedYear(Number(v))}
          title="Year"
          ariaLabelPrefix="Year"
          labelFallback={String(selectedYear)}
          menuMaxHeight={
            hideChartDateApplyRow && periodMode === 'weekly' ? 'min(260px, 45vh)' : undefined
          }
        />
      </div>
    ) : null;
  const showYearInToolbar = isMonthlyMode || hideChartDateApplyRow;

  const yearTrailingSelect =
    !isMonthlyMode && !suppressChartDateFilter && !hideChartDateApplyRow ? (
      <div className="ticker-monthly__select-wrap">
        <label className="ticker-monthly__select-label" htmlFor="ticker-monthly-year-trailing">
          Year
        </label>
        <ThemedDropdown
          buttonId="ticker-monthly-year-trailing"
          className="ticker-monthly__select-dd"
          size="sm"
          value={String(selectedYear)}
          options={yearDropdownOptions}
          onChange={(v) => setSelectedYear(Number(v))}
          title="Year"
          ariaLabelPrefix="Year"
          labelFallback={String(selectedYear)}
        />
      </div>
    ) : null;

  const monthlyRangeControls = (
    <>
      {chartToolbarExtras}
      {showYearInToolbar ? yearToolbarDropdown : yearTrailingSelect}
    </>
  );

  const monthlyExtraActions = showOpenPeriodPageButton ? (
    <button type="button" className="ticker-annual-figma__btn ticker-annual-figma__btn--outline shrink-0" onClick={onOpenPeriodPage}>
      Open {periodMode === 'weekly' ? 'Weekly' : periodMode === 'daily' ? 'Daily' : 'Monthly'} Page
    </button>
  ) : null;

  if (!rows.length) {
    if (loading) {
      return (
        <MonthlyReturnsChartSkeleton
          periodMode={periodMode}
          plotHeightPx={plotPx ?? resizeDefaultHeight}
          resizeEnabled={resize.enabled}
        />
      );
    }
    return (
      <div className="ticker-monthly">

        <div
          ref={sectionRef}
          className={
            'ticker-annual-figma__section' + (resize.enabled ? ' ticker-annual-figma__section--resize' : '')
          }
        >
          <div className="ticker-monthly__head">
            <div className="ticker-monthly__title-block">
              <div className="flex align-centers"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <g clip-path="url(#clip0_609_23954)">
                  <path d="M7.82031 1.25781V6.17969H12.7422C12.7422 4.87433 12.2236 3.62243 11.3006 2.6994C10.3776 1.77637 9.12567 1.25781 7.82031 1.25781Z" stroke="white" stroke-width="0.875" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M6.17969 2.89844C5.20623 2.89844 4.25464 3.1871 3.44524 3.72792C2.63584 4.26875 2.005 5.03744 1.63247 5.93679C1.25995 6.83615 1.16248 7.82577 1.35239 8.78052C1.5423 9.73527 2.01106 10.6123 2.6994 11.3006C3.38774 11.9889 4.26473 12.4577 5.21948 12.6476C6.17423 12.8375 7.16386 12.7401 8.06321 12.3675C8.96257 11.995 9.73126 11.3642 10.2721 10.5548C10.8129 9.74536 11.1016 8.79377 11.1016 7.82031H6.17969V2.89844Z" stroke="white" stroke-width="0.875" stroke-linecap="round" stroke-linejoin="round" />
                </g>
                <defs>
                  <clipPath id="clip0_609_23954">
                    <rect width="14" height="14" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              </div>
              <ReturnsChartClickableTitle className="ticker-monthly__title uppercase" onClick={onViewMore}>
                {periodMode === 'weekly' ? 'WEEKLY STATISTICS' : periodMode === 'daily' ? 'DAILY STATISTICS' : 'MONTHLY STATISTICS'}
              </ReturnsChartClickableTitle>
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
            {!suppressChartDateFilter ? (
              <ThemedDropdown
                className="ticker-monthly__select-dd"
                size="sm"
                value={String(selectedYear)}
                options={yearDropdownOptions}
                onChange={() => { }}
                title="Year"
                ariaLabelPrefix="Year"
                labelFallback={String(selectedYear)}
                disabled
              />
            ) : null}
            <ChartSectionIconActions
              snapshotRootRef={sectionRef}
              plotHostRef={chartCardRef}
              fullscreenTargetRef={chartFsShellRef}
              buildFilename={buildExportFilename}
              disabled
              exportPreviewAlt={`${periodMode} returns for ${symU}`}
            />
          </div>
          {chartToolbarExtras ? (
            <div className="flex flex-wrap items-center gap-2 px-1 py-1">{chartToolbarExtras}</div>
          ) : null}
          {showDateApplyRow ? (
            <ChartDateApplyRow
              idPrefix="monthly-returns-empty"
              maxDate={asOfDate}
              onApply={({ start, end }) => setRangeApplied({ start, end })}
            />
          ) : null}
          <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
            <div ref={chartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
              <p className="ticker-annual-figma__empty">
                No {periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'monthly'} return data for <strong>{symU}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-monthly">
      <div
        ref={sectionRef}
        className={
          'ticker-annual-figma__section' + (resize.enabled ? ' ticker-annual-figma__section--resize' : '')
        }
      >
        <div className="ticker-monthly__head">
          <div className="ticker-monthly__title-block">
            <div className="flex align-centers"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <g clip-path="url(#clip0_609_23954)">
                <path d="M7.82031 1.25781V6.17969H12.7422C12.7422 4.87433 12.2236 3.62243 11.3006 2.6994C10.3776 1.77637 9.12567 1.25781 7.82031 1.25781Z" stroke="white" stroke-width="0.875" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M6.17969 2.89844C5.20623 2.89844 4.25464 3.1871 3.44524 3.72792C2.63584 4.26875 2.005 5.03744 1.63247 5.93679C1.25995 6.83615 1.16248 7.82577 1.35239 8.78052C1.5423 9.73527 2.01106 10.6123 2.6994 11.3006C3.38774 11.9889 4.26473 12.4577 5.21948 12.6476C6.17423 12.8375 7.16386 12.7401 8.06321 12.3675C8.96257 11.995 9.73126 11.3642 10.2721 10.5548C10.8129 9.74536 11.1016 8.79377 11.1016 7.82031H6.17969V2.89844Z" stroke="white" stroke-width="0.875" stroke-linecap="round" stroke-linejoin="round" />
              </g>
              <defs>
                <clipPath id="clip0_609_23954">
                  <rect width="14" height="14" fill="white" />
                </clipPath>
              </defs>
            </svg>
            </div>
            <ReturnsChartClickableTitle className="ticker-monthly__title uppercase" onClick={onViewMore}>
              {periodMode === 'weekly' ? 'WEEKLY STATISTICS' : periodMode === 'daily' ? 'DAILY STATISTICS' : 'MONTHLY STATISTICS'}
            </ReturnsChartClickableTitle>
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
          <div className="ticker-monthly__head-right">
            <ReturnsChartToolbar
              className="ticker-monthly__toolbar min-w-0"
              rangeControls={monthlyRangeControls}
              showViewMore={false}
              onToggleTable={() => setShowTable((v) => !v)}
              showTable={showTable}
              onDownload={onDownloadCsv}
              downloadDisabled={!selectedYearRows.length}
              extraActions={monthlyExtraActions}
            />
            <ChartSectionIconActions
              snapshotRootRef={sectionRef}
              plotHostRef={chartCardRef}
              fullscreenTargetRef={chartFsShellRef}
              buildFilename={buildExportFilename}
              disabled={chartExportDisabled}
              exportPreviewAlt={`${periodMode} returns chart for ${symU}`}
            />
          </div>
        </div>
        {showDateApplyRow ? (
          <ChartDateApplyRow
            idPrefix="monthly-returns"
            maxDate={asOfDate}
            onApply={({ start, end }) => setRangeApplied({ start, end })}
          />
        ) : null}

        <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
          <div ref={chartCardRef} className="ticker-annual-figma__chart-card">
            {rows.length > 0 && !filteredRows.length ? (
              <p className="ticker-annual-figma__empty" style={{ padding: '1.25rem' }}>
                No monthly rows overlap the selected date range.
              </p>
            ) : (
              chart
            )}
          </div>
        </div>

        <div className="ticker-annual-figma__legends ticker-monthly__legend justify-center" >
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-monthly__swatch" aria-hidden />
            {selectedYear}
          </span>
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-annual-figma__swatch-line" style={{ borderTopColor: COL_AVG }} aria-hidden />
            Avg return
          </span>
        </div>
        {showTable ? (
          <div className="ticker-annual-figma__table-wrap">
            <table className="ticker-annual-figma__table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Total Return</th>
                </tr>
              </thead>
              <tbody>
                {[...selectedYearRows].reverse().map((r) => (
                  <tr key={`mr-row-${r.period}`}>
                    <td>{r.period}</td>
                    <td>{r.startDate || '—'}</td>
                    <td>{r.endDate || '—'}</td>
                    <td className={r.totalReturn >= 0 ? 'ticker-num--up' : 'ticker-num--down'}>
                      {r.totalReturn >= 0 ? '+' : ''}
                      {r.totalReturn.toFixed(2)}%
                    </td>
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
    </div>
  );
}
