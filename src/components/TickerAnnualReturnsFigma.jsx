import { useCallback, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { useTickerPlotResize } from '../hooks/useTickerPlotResize.js';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { formatWeekAxisDate, isoYearWeekFromIsoDate } from '../utils/isoWeek.js';
import { periodModeNouns } from '../utils/periodModeNouns.js';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL } from '../utils/tickerUrlSync.js';

/** Match `TickerLightweightChart` / dark ticker cards. */
const COL_BAR = '#2563eb';
const COL_ORANGE = '#f97316';
const COL_GRID = 'rgba(148, 163, 184, 0.14)';
const COL_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';
const COL_AXIS = '#94a3b8';
const COL_LABEL = '#e2e8f0';
const YEAR_PALETTE = ['#38bdf8', '#f97316', '#64748b', '#eab308', '#7dd3fc', '#a78bfa', '#34d399', '#fb7185', '#f472b6', '#22d3ee'];

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

function parseQuarter(period) {
  const m = String(period || '').match(/^(\d{4})-Q([1-4])$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const q = parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(q)) return null;
  return { year, q };
}

function parseMonth(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  return { year, month };
}

function parseWeek(period) {
  const m = String(period || '').match(/^(\d{4})-W(\d{1,2})$/i);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  if (!Number.isFinite(year) || !Number.isFinite(week) || week < 1 || week > 53) return null;
  return { year, week };
}

function parseDaily(period) {
  const m = String(period || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
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
 * @param {{ symbol: string, annualReturns?: unknown[], asOfDate?: string, plotHeight?: number, resizeStorageKey?: string, resizeDefaultHeight?: number, periodMode?: 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'daily', suppressChartDateFilter?: boolean, showOpenPeriodPageButton?: boolean, toolbarControls?: import('react').ReactNode }} props
 */
export function TickerAnnualReturnsFigma({
  symbol,
  annualReturns,
  asOfDate,
  plotHeight,
  resizeStorageKey,
  resizeDefaultHeight = 260,
  periodMode = 'annual',
  suppressChartDateFilter = false,
  showOpenPeriodPageButton = false,
  toolbarControls = null
}) {
  const navigate = useNavigate();
  const resize = useTickerPlotResize(resizeStorageKey ?? null, resizeDefaultHeight);
  const plotPx = resize.plotHeight ?? plotHeight;
  const clipComboId = useId().replace(/:/g, '');
  const clipSummaryId = useId().replace(/:/g, '');

  const [showTable, setShowTable] = useState(false);

  const rows = useMemo(() => {
    if (!Array.isArray(annualReturns)) return [];
    const mapped = [...annualReturns]
      .map((r) => {
        const period = String(r?.period || '');
        const totalReturn = Number(r?.totalReturn);
        if (!Number.isFinite(totalReturn)) return null;
        if (periodMode === 'quarterly') {
          const q = parseQuarter(period);
          if (!q) return null;
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: q.year,
            quarter: q.q,
            rowKey: period,
            xLabel: period
          };
        }
        if (periodMode === 'monthly') {
          const m = parseMonth(period);
          if (!m) return null;
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: m.year,
            quarter: null,
            month: m.month,
            rowKey: period,
            xLabel: period
          };
        }
        if (periodMode === 'weekly') {
          let w = parseWeek(period);
          const iy = Number(r?.isoYear);
          const iw = Number(r?.isoWeek);
          if (!w && Number.isFinite(iy) && Number.isFinite(iw) && iw >= 1 && iw <= 53) {
            w = { year: iy, week: iw };
          }
          if (!w && /^\d{4}-\d{2}-\d{2}$/.test(period)) {
            const ip = isoYearWeekFromIsoDate(period);
            if (ip && ip.week >= 1 && ip.week <= 53) w = { year: ip.year, week: ip.week };
          }
          if (!w) return null;
          const endIso = String(r?.endDate ?? period ?? '').slice(0, 10);
          const dateLbl = formatWeekAxisDate(endIso);
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: w.year,
            quarter: null,
            month: null,
            week: w.week,
            rowKey: period,
            xLabel: dateLbl || period
          };
        }
        if (periodMode === 'daily') {
          const d = parseDaily(period);
          if (!d) return null;
          return {
            period,
            startDate: r?.startDate,
            endDate: r?.endDate,
            startPrice: r?.startPrice,
            endPrice: r?.endPrice,
            totalReturn,
            year: d.year,
            quarter: null,
            month: d.month,
            week: null,
            day: d.day,
            rowKey: period,
            xLabel: period
          };
        }
        const y = parseYear(period);
        if (!Number.isFinite(y)) return null;
        return {
          period,
          startDate: r?.startDate,
          endDate: r?.endDate,
          startPrice: r?.startPrice,
          endPrice: r?.endPrice,
          totalReturn,
          year: y,
          quarter: null,
          rowKey: String(y),
          xLabel: String(y)
        };
      })
      .filter(Boolean);
    mapped.sort(
      (a, b) =>
        a.year - b.year ||
        (a.quarter || 0) - (b.quarter || 0) ||
        (a.month || 0) - (b.month || 0) ||
        (a.week || 0) - (b.week || 0) ||
        (a.day || 0) - (b.day || 0)
    );
    return mapped;
  }, [annualReturns, periodMode]);

  const displayRows = useMemo(() => rows, [rows]);

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

  const pn = useMemo(() => periodModeNouns(periodMode), [periodMode]);

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
    a.download = `${String(symbol || 'ticker').toUpperCase()}-${periodMode === 'quarterly' ? 'quarterly' : periodMode === 'monthly' ? 'monthly' : periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'annual'}-returns.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [displayRows, symbol, periodMode]);

  const onViewMore = useCallback(() => {
    const section =
      periodMode === 'quarterly'
        ? 'quarterly'
        : periodMode === 'monthly'
          ? 'monthly'
          : periodMode === 'weekly'
            ? 'weekly'
            : periodMode === 'daily'
              ? 'daily'
              : 'annual';
    console.info('[view-more] annual figma click', {
      periodMode,
      fromPath: window.location.pathname,
      fromSearch: window.location.search,
      to: `/statistic-data?section=${section}`
    });
    navigate(`/statistic-data?section=${section}`);
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    setTimeout(() => {
      console.info('[view-more] annual figma post-nav check', {
        periodMode,
        currentPath: window.location.pathname,
        currentSearch: window.location.search
      });
    }, 150);
  }, [navigate, periodMode]);

  const onOpenPeriodPage = useCallback(() => {
    const symPart = String(symbol || '').trim() || DEFAULT_TICKER_ROUTE_SYMBOL;
    const suffix = '/' + encodeURIComponent(symPart);
    const path =
      periodMode === 'quarterly'
        ? '/ticker-quarterly'
        : periodMode === 'monthly'
          ? '/ticker-monthly'
          : periodMode === 'weekly'
            ? '/ticker-weekly'
            : periodMode === 'daily'
              ? '/ticker-daily'
              : '/ticker-annual';
    navigate(path + suffix);
  }, [navigate, periodMode, symbol]);

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
    const yearColors = new Map();
    if (periodMode === 'monthly') {
      const years = [...new Set(displayRows.map((r) => r.year))].sort((a, b) => a - b);
      years.forEach((y, i) => yearColors.set(y, YEAR_PALETTE[i % YEAR_PALETTE.length]));
    }

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
        <rect
          key={`r-${r.rowKey}`}
          x={x}
          y={top}
          width={bw}
          height={Math.max(h, 1)}
          rx={2}
          fill={periodMode === 'monthly' ? yearColors.get(r.year) || COL_BAR : COL_BAR}
        >
          <title>
            {r.year}: {r.totalReturn >= 0 ? '+' : ''}
            {r.totalReturn.toFixed(2)}% (Y {yMin.toFixed(0)}%–{yMax.toFixed(0)}%)
          </title>
        </rect>
      );
    });

    const shouldLabelBar = (r, i) => {
      if (periodMode === 'monthly') {
        if (n <= 24) return true;
        if (Math.abs(Number(r.totalReturn)) >= 12) return true; // keep only strong moves on dense monthly view
        return false;
      }
      if (periodMode === 'weekly') {
        // Weekly series is very dense; only annotate extreme moves.
        if (n <= 24) return true;
        if (Math.abs(Number(r.totalReturn)) >= 20) return true;
        return false;
      }
      if (periodMode === 'daily') {
        if (n <= 18) return true;
        if (Math.abs(Number(r.totalReturn)) >= 4) return true;
        return false;
      }
      if (periodMode === 'quarterly') {
        if (n <= 32) return true;
        return Math.abs(Number(r.totalReturn)) >= 15;
      }
      return true;
    };

    const barLabels = displayRows.map((r, i) => {
      if (!shouldLabelBar(r, i)) return null;
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValueAxis(0, padT, ih, yMin, yMax);
      const y1 = yForValueAxis(r.totalReturn, padT, ih, yMin, yMax);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      const labY = r.totalReturn >= 0 ? top - 6 : top + h + 14;
      return (
        <text key={`t-${r.rowKey}`} x={x + bw / 2} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="11" fontWeight="700">
          {r.totalReturn >= 0 ? '+' : ''}
          {r.totalReturn.toFixed(0)}%
        </text>
      );
    });

    const avgY = yForValueAxis(stats.avg, padT, ih, yMin, yMax);
    const avgLabelY = avgY < padT + 16 ? avgY + 14 : avgY - 5;

    const labelEvery =
      periodMode === 'monthly'
        ? n > 72
          ? 12
          : n > 48
            ? 6
            : n > 24
              ? 3
              : 1
        : n > 28
          ? 4
          : n > 14
            ? 2
            : 1;
    const xLabels = displayRows.map((r, i) => {
      if (periodMode === 'monthly') {
        const isJanuary = r.month === 1;
        if (!(isJanuary || i === 0 || i === n - 1 || i % labelEvery === 0)) return null;
      } else if (periodMode === 'weekly') {
        const isYearStart = r.week === 1;
        // Keep weekly axis clean: year markers only + final point.
        if (!(isYearStart || i === n - 1)) return null;
      } else if (periodMode === 'daily') {
        const isMonthStart = r.day === 1;
        if (!(isMonthStart || i === 0 || i === n - 1 || i % 5 === 0)) return null;
      } else if (i % labelEvery !== 0 && i !== n - 1) {
        return null;
      }
      const cx = padL + i * step + step / 2;
      const txt =
        periodMode === 'monthly'
          ? r.month === 1
            ? String(r.year)
            : r.xLabel
          : periodMode === 'weekly'
            ? r.week === 1
              ? String(r.year)
              : i === n - 1
                ? formatWeekAxisDate(String(r.endDate || r.period || '').slice(0, 10)) || String(r.year)
                : ''
            : periodMode === 'daily'
              ? r.day === 1
                ? `${String(r.month).padStart(2, '0')}/${String(r.day).padStart(2, '0')}`
                : String(r.day)
            : r.xLabel;
      return (
        <text key={`xl-${r.rowKey}`} x={cx} y={H - 28} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="600">
          {txt}
        </text>
      );
    });

    return (
      <svg
        className="ticker-annual-figma__svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={tickerSvgPlotStyle(plotPx)}
        aria-label={`${periodMode === 'quarterly' ? 'Quarterly' : periodMode === 'monthly' ? 'Monthly' : periodMode === 'weekly' ? 'Weekly' : periodMode === 'daily' ? 'Daily' : 'Annual'} returns bar chart, Y-axis ${formatTickPct(yMin)} to ${formatTickPct(yMax)} from data range; resize to show finer grid labels.`}
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
  }, [clipComboId, displayRows, stats, plotPx, periodMode]);

  const monthlyYearLegend = useMemo(() => {
    if (periodMode !== 'monthly' || !displayRows.length) return [];
    const years = [...new Set(displayRows.map((r) => r.year))].sort((a, b) => a - b);
    return years.map((y, i) => ({ year: y, color: YEAR_PALETTE[i % YEAR_PALETTE.length] }));
  }, [displayRows, periodMode]);

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
            <span className="ticker-annual-figma__badge">
              {periodMode === 'quarterly' ? 'Quarterly returns' : periodMode === 'monthly' ? 'Monthly returns' : periodMode === 'weekly' ? 'Weekly returns' : periodMode === 'daily' ? 'Daily returns' : 'Annual returns'}
            </span>
          </div>
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
            <p className="ticker-annual-figma__empty">
              No {periodMode === 'quarterly' ? 'quarterly' : periodMode === 'monthly' ? 'monthly' : periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'annual'} return series yet. Load completes after{' '}
              <strong>ticker-returns</strong> returns{' '}
              <code className="ticker-annual-figma__code">
                performance.{periodMode === 'quarterly' ? 'quarterlyReturns' : periodMode === 'monthly' ? 'monthlyReturns' : periodMode === 'weekly' ? 'weeklyReturns' : periodMode === 'daily' ? 'dailyReturns' : 'annualReturns'}
              </code>{' '}
              for {String(symbol).toUpperCase()}.
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
          <span className="ticker-annual-figma__badge">
            {periodMode === 'quarterly' ? 'Quarterly returns' : periodMode === 'monthly' ? 'Monthly returns' : periodMode === 'weekly' ? 'Weekly returns' : periodMode === 'daily' ? 'Daily returns' : 'Annual returns'}{' '}
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerAnnualReturns} align="end" />
          </span>
          <div className="ticker-annual-figma__actions">
            {toolbarControls}
            <button
              type="button"
              className="ticker-annual-figma__btn ticker-annual-figma__btn--outline"
              onClick={onViewMore}
            >
              View More
            </button>
            {showOpenPeriodPageButton ? (
              <button
                type="button"
                className="ticker-annual-figma__btn ticker-annual-figma__btn--outline"
                onClick={onOpenPeriodPage}
              >
                Open {periodMode === 'quarterly' ? 'Quarterly' : periodMode === 'monthly' ? 'Monthly' : periodMode === 'weekly' ? 'Weekly' : periodMode === 'daily' ? 'Daily' : 'Annual'} Page
              </button>
            ) : null}
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
          {periodMode === 'monthly' ? (
            monthlyYearLegend.map((it) => (
              <span key={`yl-${it.year}`} className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch" aria-hidden style={{ background: it.color }} />
                {it.year}
              </span>
            ))
          ) : (
            <span className="ticker-annual-figma__legend-item">
              <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden />
              {pn.statsLabel} return (%)
            </span>
          )}
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
                  <th>{periodMode === 'annual' ? 'Year' : 'Period'}</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Total return %</th>
                  <th>Start price</th>
                  <th>End price</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((r) => (
                  <tr key={r.rowKey}>
                    <td>{periodMode === 'annual' ? r.year : r.period}</td>
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
          <span className="ticker-annual-figma__badge">
            {pn.statsLabel} stats — positive / negative, min max{' '}
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerAnnualStats} align="end" />
          </span>
        </div>
        <div className="ticker-annual-figma__split">
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--donut">
            {donut}
            <div className="ticker-annual-figma__legend ticker-annual-figma__legend--donut">
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden />
                # positive {pn.lower}
              </span>
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--orange" aria-hidden />
                # negative {pn.lower}
              </span>
            </div>
          </div>
          <div className="ticker-annual-figma__chart-card">{summaryBars}</div>
        </div>
      </div>
    </div>
  );
}
