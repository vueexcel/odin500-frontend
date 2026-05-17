import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useDeferredValue
} from 'react';
import { createChart, PriceScaleMode } from 'lightweight-charts';
import { useSearchParams } from 'react-router-dom';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { AnnualReturnBarChart } from '../components/AnnualReturnBarChart.jsx';
import { ExcessReturnLineChart } from '../components/ExcessReturnLineChart.jsx';
import { PeriodicReturnBarChart } from '../components/PeriodicReturnBarChart.jsx';
import { TickerSection16Section17 } from '../components/TickerSection16Section17.jsx';
import { TickerSection23Section24 } from '../components/TickerSection23Section24.jsx';
import {fetchWithAuth, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { useTickerList } from '../hooks/useTickerList.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { LightweightChartAreaSkeleton } from '../components/ChartSkeletons.jsx';
import { ReturnsChartToolbar } from '../components/ReturnsChartToolbar.jsx';
import { ChartSectionIconActions } from '../components/ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';

const INDEX_OPTIONS = ['SPY', 'QQQ', 'DIA'];
const COLOR_BY_SERIES = {
  TICKER: '#3B6BC0',
  INDEX: '#E67E22',
  QQQ: '#A3A3A3',
  DIA: '#F4B400'
};
const MODE_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annually', label: 'Annually' }
];

/** Series keys for the main relative-strength line chart (chips + axis badges). */
const RS_CHART_SERIES_KEYS = ['TICKER', 'INDEX', 'QQQ', 'DIA'];

function textColorOnHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? '#0f172a' : '#ffffff';
}

function layoutBadgeTopsPx(keys, getRawY, containerHeight, minGap = 22, pad = 10) {
  const h = Number(containerHeight);
  if (!Number.isFinite(h) || h <= 0) return {};
  let items = keys
    .map((key) => {
      const raw = getRawY(key);
      const y = raw == null ? null : Number(raw);
      return { key, y: Number.isFinite(y) ? y : null };
    })
    .filter((x) => x.y != null);
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) {
    const prevTop = items[i - 1].y + minGap;
    if (items[i].y < prevTop) items[i].y = prevTop;
  }
  for (let i = items.length - 2; i >= 0; i--) {
    const nextTop = items[i + 1].y - minGap;
    if (items[i].y > nextTop) items[i].y = nextTop;
  }
  const out = {};
  for (const it of items) {
    const clamped = Math.min(Math.max(it.y, pad), h - pad);
    out[it.key] = clamped;
  }
  return out;
}

function getRsChartBgColor(isLight) {
  if (isLight) return '#f5f5f5';
  if (typeof window === 'undefined') return 'rgba(255, 255, 255, 0.03)';
  const cssVar = getComputedStyle(document.documentElement).getPropertyValue('--colors-opacity-bg-opacity-3').trim();
  return cssVar || 'rgba(255, 255, 255, 0.03)';
}

/** html2canvas onclone: hide chip remove buttons, loosen text like NormalizedPerformanceCard export. */
function applyRsSnapshotCloneFixes(clonedDoc, clonedRoot) {
  if (!(clonedRoot instanceof HTMLElement)) return;
  const snapStyle = clonedDoc.createElement('style');
  snapStyle.setAttribute('data-rs-export-snapshot', '1');
  snapStyle.textContent = `
    .np-card__chip-x { display: none !important; }
    .np-card__chip {
      overflow: visible !important;
      min-height: 44px !important;
    }
    .np-card__chip-main {
      flex: 0 1 auto !important;
      min-height: 40px !important;
      min-width: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      padding: 10px 12px 8px !important;
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
    }
    .np-card__chip-label {
      line-height: 1.5 !important;
      overflow: visible !important;
      white-space: nowrap !important;
      padding: 2px 0 6px 0 !important;
    }
    .np-chart-axis-badge {
      display: flex !important;
      align-items: center !important;
      line-height: 1.45 !important;
      padding: 11px 12px 11px 15px !important;
      box-sizing: border-box !important;
    }
    .np-chart-axis-badge__body {
      line-height: 1.45 !important;
      overflow: visible !important;
      min-height: 1.45em !important;
    }
  `;
  clonedDoc.head.appendChild(snapStyle);
  void clonedRoot.offsetHeight;
  clonedRoot.querySelectorAll('.np-chart-axis-badge').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const op = clonedDoc.defaultView?.getComputedStyle(node).opacity ?? '1';
    if (parseFloat(op) < 0.01) {
      node.remove();
      return;
    }
    const topStr = node.style.top;
    const centerY = parseFloat(topStr);
    if (Number.isFinite(centerY) && centerY > -9000) node.dataset.rsCenterY = String(centerY);
  });
  clonedRoot.querySelectorAll('.np-chart-axis-badge').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const centerStr = node.dataset.rsCenterY;
    const centerY = centerStr != null ? parseFloat(centerStr) : NaN;
    if (!Number.isFinite(centerY)) return;
    void node.offsetHeight;
    const h = node.offsetHeight;
    if (!(h > 0)) return;
    node.style.setProperty('transform', 'none', 'important');
    node.style.setProperty('top', `${Math.round(centerY - h / 2)}px`, 'important');
  });
}

async function dataUrlToPngFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/png' });
}

function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseMiddayMs(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function toChartTime(ms) {
  return Math.floor(ms / 1000);
}

function normalizeOhlcRows(rows) {
  if (!Array.isArray(rows)) return [];
  // API can return repeated same-day rows; keep the latest close per day.
  const byTime = new Map();
  for (const row of rows) {
    const iso = String(
      row?.Date ?? row?.date ?? row?.TradeDate ?? row?.tradeDate ?? row?.trade_date ?? row?.time ?? ''
    ).slice(0, 10);
    const close = Number(row?.AdjClose ?? row?.adjClose ?? row?.adj_close ?? row?.Close ?? row?.close);
    const t = parseMiddayMs(iso);
    if (!Number.isFinite(t) || !Number.isFinite(close) || close <= 0) continue;
    byTime.set(t, { t, close, iso });
  }
  const out = Array.from(byTime.values());
  out.sort((a, b) => a.t - b.t);
  return out;
}

function periodKey(t, mode) {
  const d = new Date(t);
  if (mode === 'weekly') {
    const first = new Date(d.getFullYear(), 0, 1);
    const dayMs = 86400000;
    const day = Math.floor((d.getTime() - first.getTime()) / dayMs) + 1;
    const week = Math.ceil(day / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  if (mode === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (mode === 'quarterly') return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  if (mode === 'annually') return String(d.getFullYear());
  return toIsoDate(d);
}

function aggregateRows(rows, mode) {
  if (mode === 'daily') return rows.map((row) => ({ ...row, period: row.iso }));
  const buckets = new Map();
  for (const row of rows) {
    const key = periodKey(row.t, mode);
    buckets.set(key, { ...row, period: key });
  }
  const out = Array.from(buckets.values());
  out.sort((a, b) => a.t - b.t);
  return out;
}

function makeTableSeries(rows, mode) {
  const grouped = aggregateRows(rows, mode);
  if (!grouped.length || !Number.isFinite(grouped[0].close) || grouped[0].close <= 0) return [];
  const base = grouped[0].close;
  return grouped.map((row, idx) => {
    const prev = idx > 0 ? grouped[idx - 1] : null;
    const dailyRet =
      prev && Number.isFinite(prev.close) && prev.close !== 0 ? ((row.close - prev.close) / prev.close) * 100 : 0;
    const rebased = (row.close / base) * 100;
    const cumulative = rebased - 100;
    return {
      period: row.period,
      t: row.t,
      raw: row.close,
      dailyRet,
      rebased,
      cumulative
    };
  });
}

/** Cumulative or period-over-period return comparison rows for stats charts (ticker vs chosen benchmark). */
function buildComparisonRows(seriesData, tickerSym, benchSym, mode, returnKind = 'cumulative') {
  const tSym = String(tickerSym || '').toUpperCase();
  const bSym = String(benchSym || '').toUpperCase();
  const tickerPoints = makeTableSeries(seriesData[tSym] || [], mode);
  const benchPoints = makeTableSeries(seriesData[bSym] || [], mode);
  if (!tickerPoints.length || !benchPoints.length) return [];
  const byPeriodBench = new Map(benchPoints.map((r) => [String(r.period), r]));
  const out = [];
  for (const tRow of tickerPoints) {
    const bRow = byPeriodBench.get(String(tRow.period));
    if (!bRow) continue;
    const tickerReturn =
      returnKind === 'period' ? Number(tRow.dailyRet) : Number(tRow.cumulative);
    const benchmarkReturn =
      returnKind === 'period' ? Number(bRow.dailyRet) : Number(bRow.cumulative);
    if (!Number.isFinite(tickerReturn) || !Number.isFinite(benchmarkReturn)) continue;
    out.push({
      period: String(tRow.period),
      tickerReturn,
      benchmarkReturn,
      excessReturn: tickerReturn - benchmarkReturn
    });
  }
  return out;
}

function sliceSeriesByIsoRange(seriesData, startIso, endIso) {
  const a = String(startIso || '').slice(0, 10);
  const b = String(endIso || '').slice(0, 10);
  if (!a || !b) return seriesData;
  const out = {};
  for (const [k, rows] of Object.entries(seriesData || {})) {
    if (!Array.isArray(rows)) {
      out[k] = rows;
      continue;
    }
    out[k] = rows.filter((r) => {
      const iso = String(r.iso || '').slice(0, 10);
      return iso && iso >= a && iso <= b;
    });
  }
  return out;
}

function mergeFetchIsoRanges(ranges) {
  let lo = null;
  let hi = null;
  for (const r of ranges) {
    if (!r || !r.start || !r.end) continue;
    const s = String(r.start).slice(0, 10);
    const e = String(r.end).slice(0, 10);
    if (lo == null || s < lo) lo = s;
    if (hi == null || e > hi) hi = e;
  }
  return lo && hi ? { start: lo, end: hi } : { start: '1990-01-01', end: toIsoDate(new Date()) };
}

function yearPairToIsoRange(yStartStr, yEndStr, currentYear) {
  const y0 = Math.min(Number(yStartStr) || currentYear, Number(yEndStr) || currentYear);
  const y1 = Math.max(Number(yStartStr) || currentYear, Number(yEndStr) || currentYear);
  return { start: `${y0}-01-01`, end: `${y1}-12-31` };
}

function fmtPct(v) {
  if (!Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtNum(v) {
  if (!Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  if (/^\d{4}-W\d{2}$/.test(iso) || /^\d{4}-Q[1-4]$/.test(iso) || /^\d{4}-\d{2}$/.test(iso) || /^\d{4}$/.test(iso)) {
    return iso;
  }
  const t = parseMiddayMs(iso);
  if (!Number.isFinite(t)) return String(iso);
  return new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function csvEscapeCell(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function triggerCsvDownload(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildRsLineTableRowsFromSeries(seriesList) {
  if (!Array.isArray(seriesList) || seriesList.length === 0) return [];
  const isoSet = new Set();
  for (const s of seriesList) {
    for (const p of s.data || []) {
      if (p?.iso != null && String(p.iso)) isoSet.add(String(p.iso));
    }
  }
  const periods = [...isoSet].sort((a, b) => String(a).localeCompare(String(b)));
  const valueByKeyPeriod = new Map();
  for (const s of seriesList) {
    for (const p of s.data || []) {
      valueByKeyPeriod.set(`${s.key}|${p.iso}`, p.value);
    }
  }
  return periods.map((period) => {
    const row = { period };
    for (const s of seriesList) {
      row[s.key] = valueByKeyPeriod.get(`${s.key}|${period}`);
    }
    return row;
  });
}

function pctToneClass(n) {
  if (!Number.isFinite(Number(n))) return '';
  if (Number(n) > 0) return 'ticker-num--up';
  if (Number(n) < 0) return 'ticker-num--down';
  return '';
}

const RS_MAIN_CHART_DEFAULT_H = 360;

/**
 * Main RS lightweight-charts plot; `plotHeight` injected by TickerChartResizeScope.
 */
function RsMainLineChartPlot({
  plotHeight = RS_MAIN_CHART_DEFAULT_H,
  chartHostRef,
  chartRef,
  loading,
  error,
  activeChartKeys,
  chartMetaByKey,
  axisBadgeTops,
  lastChartByKey,
  updateAxisBadgePositions
}) {
  const plotH = Math.round(Number(plotHeight) || RS_MAIN_CHART_DEFAULT_H);

  useEffect(() => {
    const chart = chartRef.current;
    const host = chartHostRef.current;
    if (host) {
      host.style.height = `${plotH}px`;
      host.style.minHeight = `${plotH}px`;
    }
    if (chart) {
      chart.applyOptions({ height: plotH });
      requestAnimationFrame(() => {
        requestAnimationFrame(() => updateAxisBadgePositions?.());
      });
    }
  }, [plotH, chartRef, chartHostRef, updateAxisBadgePositions]);

  return (
    <>
      {loading ? (
        <div className="relative-strength-page__chart-skel-overlay">
          <LightweightChartAreaSkeleton minHeight={plotH} className="relative-strength-page__chart-skel-fill" />
        </div>
      ) : null}
      {error ? <div className="relative-strength-page__state relative-strength-page__state--error">{error}</div> : null}
      <div className="np-chart-stack">
        <div
          ref={chartHostRef}
          className={
            'np-chart np-chart--interactive relative-strength-page__chart-host-inner' +
            (loading ? ' relative-strength-page__chart-host--loading' : '')
          }
          style={{ height: plotH, minHeight: plotH }}
        />
        {!error ? (
          <div className="np-chart-axis-tags" aria-hidden="true">
            {activeChartKeys.map((key) => {
              const s = chartMetaByKey.get(key);
              if (!s) return null;
              const top = axisBadgeTops[key];
              const bg = s.color;
              const fg = textColorOnHex(bg);
              const v = lastChartByKey[key];
              return (
                <div
                  key={key}
                  className="np-chart-axis-badge"
                  style={{
                    top: top == null ? -9999 : top,
                    opacity: top == null ? 0 : 1,
                    background: bg,
                    color: fg
                  }}
                >
                  <span className="np-chart-axis-badge__tick" style={{ borderRightColor: bg }} />
                  <div className="np-chart-axis-badge__body">
                    <span className="np-chart-axis-badge__sym">{s.label}</span>
                    <span className="np-chart-axis-badge__val">{fmtPct(v)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </>
  );
}

export default function RelativeStrengthTickerPage() {
  const [searchParams] = useSearchParams();
  const tickerFromQuery = sanitizeTickerPageInput(searchParams.get('ticker') || searchParams.get('symbol') || '');
  const tickerOptions = useTickerList();
  const docTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const isLight = docTheme === 'light';
  const chartPanelRef = useRef(null);
  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef(new Map());
  const activeChartKeysRef = useRef(RS_CHART_SERIES_KEYS);
  const lastChartValsRef = useRef({});
  const [loading, setLoading] = useState(false);
  /** Symbols currently being fetched for incremental (benchmark-only) loads — per-chart skeletons. */
  const [pendingFetchSymbols, setPendingFetchSymbols] = useState(() => new Set());
  const [error, setError] = useState('');
  const [indexSymbol, setIndexSymbol] = useState('SPY');
  const [benchCmpAnnual, setBenchCmpAnnual] = useState('SPY');
  const [benchCmpExcess, setBenchCmpExcess] = useState('SPY');
  const [benchCmpPeriodic, setBenchCmpPeriodic] = useState('SPY');
  const [tickerSymbol, setTickerSymbol] = useState(tickerFromQuery || 'AAPL');
  const [mode, setMode] = useState('monthly');
  const [seriesData, setSeriesData] = useState({});
  const [dailyStart, setDailyStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    return toIsoDate(d);
  });
  const [dailyEnd, setDailyEnd] = useState(() => toIsoDate(new Date()));
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(String(currentYear - 4));
  const [endYear, setEndYear] = useState(String(currentYear));
  const [activeChartKeys, setActiveChartKeys] = useState(() => [...RS_CHART_SERIES_KEYS]);
  const [axisBadgeTops, setAxisBadgeTops] = useState({});
  const defaultStatsYearStart = String(currentYear - 4);
  const defaultStatsYearEnd = String(currentYear);
  const [chartAnnualYearStart, setChartAnnualYearStart] = useState(defaultStatsYearStart);
  const [chartAnnualYearEnd, setChartAnnualYearEnd] = useState(defaultStatsYearEnd);
  const [chartExcessYearStart, setChartExcessYearStart] = useState(defaultStatsYearStart);
  const [chartExcessYearEnd, setChartExcessYearEnd] = useState(defaultStatsYearEnd);
  const [chartPeriodicYearStart, setChartPeriodicYearStart] = useState(defaultStatsYearStart);
  const [chartPeriodicYearEnd, setChartPeriodicYearEnd] = useState(defaultStatsYearEnd);
  const [statsDailyAnnualStart, setStatsDailyAnnualStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    return toIsoDate(d);
  });
  const [statsDailyAnnualEnd, setStatsDailyAnnualEnd] = useState(() => toIsoDate(new Date()));
  const [statsDailyExcessStart, setStatsDailyExcessStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    return toIsoDate(d);
  });
  const [statsDailyExcessEnd, setStatsDailyExcessEnd] = useState(() => toIsoDate(new Date()));
  const [statsDailyPeriodicStart, setStatsDailyPeriodicStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    return toIsoDate(d);
  });
  const [statsDailyPeriodicEnd, setStatsDailyPeriodicEnd] = useState(() => toIsoDate(new Date()));
  const [showMainRsTable, setShowMainRsTable] = useState(false);
  const [showStatsAnnualTable, setShowStatsAnnualTable] = useState(false);
  const [showStatsExcessTable, setShowStatsExcessTable] = useState(false);
  const [showStatsPeriodicTable, setShowStatsPeriodicTable] = useState(false);

  const yearOptions = useMemo(() => {
    const out = [];
    for (let y = currentYear; y >= 1990; y--) out.push({ id: String(y), label: String(y) });
    return out;
  }, [currentYear]);

  const tickerDropdownOptions = useMemo(() => {
    const items = Array.isArray(tickerOptions) && tickerOptions.length ? tickerOptions : ['AAPL', 'MSFT', 'NVDA', 'AMZN'];
    return items.map((sym) => ({ id: String(sym), label: String(sym) }));
  }, [tickerOptions]);

  const indexDropdownOptions = useMemo(() => INDEX_OPTIONS.map((v) => ({ id: v, label: v })), []);

  useEffect(() => {
    const ids = new Set(tickerDropdownOptions.map((opt) => opt.id));
    if (tickerSymbol && !ids.has(tickerSymbol)) {
      setTickerSymbol(tickerDropdownOptions[0]?.id || 'AAPL');
    }
  }, [tickerDropdownOptions, tickerSymbol]);

  useEffect(() => {
    if (tickerFromQuery) setTickerSymbol(tickerFromQuery);
  }, [tickerFromQuery]);

  const requestedSymbols = useMemo(() => {
    const out = [
      tickerSymbol,
      indexSymbol,
      benchCmpAnnual,
      benchCmpExcess,
      benchCmpPeriodic,
      'QQQ',
      'DIA'
    ]
      .map((s) => String(s || '').toUpperCase())
      .filter(Boolean);
    return Array.from(new Set(out));
  }, [tickerSymbol, indexSymbol, benchCmpAnnual, benchCmpExcess, benchCmpPeriodic]);

  const seriesDataRef = useRef(seriesData);
  seriesDataRef.current = seriesData;
  /** After a full load for `ticker|start|end`, benchmark-only changes merge without blocking the main chart. */
  const prevRsBlockingSigRef = useRef('');

  const requestRange = useMemo(() => {
    if (mode === 'daily') return { start: dailyStart, end: dailyEnd };
    const y0 = Math.min(Number(startYear) || currentYear, Number(endYear) || currentYear);
    const y1 = Math.max(Number(startYear) || currentYear, Number(endYear) || currentYear);
    return { start: `${y0}-01-01`, end: `${y1}-12-31` };
  }, [mode, dailyStart, dailyEnd, startYear, endYear, currentYear]);

  const chartAnnualIsoRange = useMemo(
    () => yearPairToIsoRange(chartAnnualYearStart, chartAnnualYearEnd, currentYear),
    [chartAnnualYearStart, chartAnnualYearEnd, currentYear]
  );
  const chartExcessIsoRange = useMemo(
    () => yearPairToIsoRange(chartExcessYearStart, chartExcessYearEnd, currentYear),
    [chartExcessYearStart, chartExcessYearEnd, currentYear]
  );
  const chartPeriodicIsoRange = useMemo(
    () => yearPairToIsoRange(chartPeriodicYearStart, chartPeriodicYearEnd, currentYear),
    [chartPeriodicYearStart, chartPeriodicYearEnd, currentYear]
  );

  const ohlcFetchRange = useMemo(() => {
    const parts = [requestRange, chartAnnualIsoRange, chartExcessIsoRange, chartPeriodicIsoRange];
    if (mode === 'daily') {
      parts.push(
        { start: statsDailyAnnualStart, end: statsDailyAnnualEnd },
        { start: statsDailyExcessStart, end: statsDailyExcessEnd },
        { start: statsDailyPeriodicStart, end: statsDailyPeriodicEnd }
      );
    }
    return mergeFetchIsoRanges(parts);
  }, [
    mode,
    requestRange,
    chartAnnualIsoRange,
    chartExcessIsoRange,
    chartPeriodicIsoRange,
    statsDailyAnnualStart,
    statsDailyAnnualEnd,
    statsDailyExcessStart,
    statsDailyExcessEnd,
    statsDailyPeriodicStart,
    statsDailyPeriodicEnd
  ]);

  const seriesDataForToolbar = useMemo(
    () => sliceSeriesByIsoRange(seriesData, requestRange.start, requestRange.end),
    [seriesData, requestRange.start, requestRange.end]
  );

  const seriesDataAnnualChart = useMemo(() => {
    if (mode === 'daily')
      return sliceSeriesByIsoRange(seriesData, statsDailyAnnualStart, statsDailyAnnualEnd);
    return sliceSeriesByIsoRange(seriesData, chartAnnualIsoRange.start, chartAnnualIsoRange.end);
  }, [seriesData, mode, statsDailyAnnualStart, statsDailyAnnualEnd, chartAnnualIsoRange.start, chartAnnualIsoRange.end]);

  const seriesDataExcessChart = useMemo(() => {
    if (mode === 'daily')
      return sliceSeriesByIsoRange(seriesData, statsDailyExcessStart, statsDailyExcessEnd);
    return sliceSeriesByIsoRange(seriesData, chartExcessIsoRange.start, chartExcessIsoRange.end);
  }, [seriesData, mode, statsDailyExcessStart, statsDailyExcessEnd, chartExcessIsoRange.start, chartExcessIsoRange.end]);

  const seriesDataPeriodicChart = useMemo(() => {
    if (mode === 'daily')
      return sliceSeriesByIsoRange(seriesData, statsDailyPeriodicStart, statsDailyPeriodicEnd);
    return sliceSeriesByIsoRange(seriesData, chartPeriodicIsoRange.start, chartPeriodicIsoRange.end);
  }, [seriesData, mode, statsDailyPeriodicStart, statsDailyPeriodicEnd, chartPeriodicIsoRange.start, chartPeriodicIsoRange.end]);

  /** Default calendar year span per frequency (non-daily uses start/end year dropdowns). */
  useEffect(() => {
    if (mode === 'daily') return;
    const end = String(currentYear);
    let start = end;
    if (mode === 'monthly') {
      start = String(currentYear - 4);
    } else if (mode === 'weekly') {
      start = end;
    } else if (mode === 'quarterly') {
      start = String(currentYear - 1);
    } else if (mode === 'annually') {
      start = String(currentYear - 4);
    }
    setStartYear(start);
    setEndYear(end);
  }, [mode, currentYear]);

  useEffect(() => {
    let cancelled = false;
    if (!canFetchProtectedApi()) {
      setError('Sign in to load relative strength data.');
      setSeriesData({});
      prevRsBlockingSigRef.current = '';
      setPendingFetchSymbols(new Set());
      return () => {
        cancelled = true;
      };
    }

    const blockingSig = `${String(tickerSymbol || '').toUpperCase()}|${ohlcFetchRange.start}|${ohlcFetchRange.end}`;
    const incremental =
      prevRsBlockingSigRef.current === blockingSig && prevRsBlockingSigRef.current !== '';

    const hasRowsForSym = (sym) => {
      const r = seriesDataRef.current[String(sym).toUpperCase()];
      return Array.isArray(r) && r.length > 0;
    };

    const symsToFetch = incremental
      ? requestedSymbols.filter((sym) => !hasRowsForSym(sym))
      : [...requestedSymbols];

    if (incremental && symsToFetch.length === 0) {
      setPendingFetchSymbols(new Set());
      return () => {
        cancelled = true;
      };
    }

    async function loadSeries() {
      if (incremental) {
        setPendingFetchSymbols(new Set(symsToFetch));
      } else {
        setLoading(true);
        setPendingFetchSymbols(new Set());
      }
      setError('');
      try {
        const rows = await Promise.all(
          symsToFetch.map(async (sym) => {
            const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker: sym, start_date: ohlcFetchRange.start, end_date: ohlcFetchRange.end })
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.success) throw new Error(payload?.error || `Unable to load ${sym}`);
            return [sym, normalizeOhlcRows(payload.data)];
          })
        );
        if (cancelled) return;
        if (incremental) {
          setSeriesData((prev) => {
            const next = { ...prev };
            for (const [k, v] of rows) {
              next[k] = v;
            }
            return next;
          });
        } else {
          setSeriesData(Object.fromEntries(rows));
          prevRsBlockingSigRef.current = blockingSig;
        }
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load chart data.');
        if (!incremental) {
          setSeriesData({});
          prevRsBlockingSigRef.current = '';
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPendingFetchSymbols(new Set());
        }
      }
    }

    void loadSeries();
    return () => {
      cancelled = true;
    };
  }, [requestedSymbols, ohlcFetchRange.start, ohlcFetchRange.end, tickerSymbol]);

  const chartSeries = useMemo(() => {
    const toChartPoints = (rows) => {
      const points = makeTableSeries(rows, mode);
      const uniq = new Map();
      for (const p of points) {
        const ts = toChartTime(p.t);
        uniq.set(ts, { time: ts, value: Number(p.cumulative.toFixed(4)), iso: p.period });
      }
      return Array.from(uniq.values()).sort((a, b) => a.time - b.time);
    };
    const ticker = toChartPoints(seriesDataForToolbar[tickerSymbol] || []);
    const selectedIndex = toChartPoints(seriesDataForToolbar[indexSymbol] || []);
    const qqq = toChartPoints(seriesDataForToolbar.QQQ || []);
    const dia = toChartPoints(seriesDataForToolbar.DIA || []);
    return [
      { key: 'TICKER', label: tickerSymbol || 'Ticker', color: COLOR_BY_SERIES.TICKER, data: ticker },
      { key: 'INDEX', label: indexSymbol, color: COLOR_BY_SERIES.INDEX, data: selectedIndex },
      { key: 'QQQ', label: 'QQQ', color: COLOR_BY_SERIES.QQQ, data: qqq },
      { key: 'DIA', label: 'DIA', color: COLOR_BY_SERIES.DIA, data: dia }
    ];
  }, [seriesDataForToolbar, tickerSymbol, indexSymbol, mode]);

  const filteredChartSeries = useMemo(() => {
    const byKey = new Map(chartSeries.map((s) => [s.key, s]));
    return activeChartKeys.map((k) => byKey.get(k)).filter(Boolean);
  }, [chartSeries, activeChartKeys]);

  const mainRsLineTableRows = useMemo(
    () => buildRsLineTableRowsFromSeries(filteredChartSeries),
    [filteredChartSeries]
  );

  const lastChartByKey = useMemo(() => {
    const out = {};
    for (const s of filteredChartSeries) {
      const d = s.data;
      const v = d.length ? Number(d[d.length - 1].value) : null;
      out[s.key] = Number.isFinite(v) ? v : null;
    }
    return out;
  }, [filteredChartSeries]);

  const compareSymbols = useMemo(() => {
    return Array.from(new Set([tickerSymbol, indexSymbol, 'QQQ', 'DIA'].map((s) => String(s || '').toUpperCase()).filter(Boolean)));
  }, [tickerSymbol, indexSymbol]);

  const tableRows = useMemo(() => {
    const mapByIso = new Map();
    for (const sym of compareSymbols) {
      const points = makeTableSeries(seriesDataForToolbar[sym] || [], mode);
      for (const point of points) {
        const key = point.period;
        if (!mapByIso.has(key)) mapByIso.set(key, { period: key, bySymbol: {} });
        mapByIso.get(key).bySymbol[sym] = point;
      }
    }
    return Array.from(mapByIso.values()).sort((a, b) => String(b.period).localeCompare(String(a.period)));
  }, [seriesDataForToolbar, mode, compareSymbols]);
  const comparisonRows = useMemo(
    () => buildComparisonRows(seriesDataForToolbar, tickerSymbol, indexSymbol, mode),
    [seriesDataForToolbar, tickerSymbol, indexSymbol, mode]
  );
  const comparisonRowsAnnual = useMemo(
    () => buildComparisonRows(seriesDataAnnualChart, tickerSymbol, benchCmpAnnual, mode, 'cumulative'),
    [seriesDataAnnualChart, tickerSymbol, benchCmpAnnual, mode]
  );
  const comparisonRowsExcess = useMemo(
    () => buildComparisonRows(seriesDataExcessChart, tickerSymbol, benchCmpExcess, mode, 'cumulative'),
    [seriesDataExcessChart, tickerSymbol, benchCmpExcess, mode]
  );
  const comparisonRowsPeriodic = useMemo(
    () => buildComparisonRows(seriesDataPeriodicChart, tickerSymbol, benchCmpPeriodic, mode, 'period'),
    [seriesDataPeriodicChart, tickerSymbol, benchCmpPeriodic, mode]
  );
  const deferredComparisonRowsAnnual = useDeferredValue(comparisonRowsAnnual);
  const deferredComparisonRowsExcess = useDeferredValue(comparisonRowsExcess);
  const deferredComparisonRowsPeriodic = useDeferredValue(comparisonRowsPeriodic);
  const modeForCmp = mode === 'annually' ? 'annual' : mode;
  const section16Rows = useMemo(() => {
    const recent = [...comparisonRows]
      .sort((a, b) => String(b.period).localeCompare(String(a.period)))
      .slice(0, 8);
    return recent.map((row) => ({
      label: fmtDate(row.period),
      value: Number.isFinite(row.excessReturn) ? Number(row.excessReturn) : null,
      symPct: Number.isFinite(row.tickerReturn) ? Number(row.tickerReturn) : null,
      tkPct: Number.isFinite(row.benchmarkReturn) ? Number(row.benchmarkReturn) : null,
      diff: Number.isFinite(row.excessReturn) ? Number(row.excessReturn) : null
    }));
  }, [comparisonRows]);
  const section17CompareRows = useMemo(
    () =>
      section16Rows.map((row) => ({
        label: row.label,
        symPct: row.symPct,
        spyPct: row.tkPct,
        diff: row.diff
      })),
    [section16Rows]
  );
  const benchmarkDropdownOptions = useMemo(
    () => INDEX_OPTIONS.map((v) => ({ id: v, label: v })),
    []
  );

  const downloadMainRsLineCsv = useCallback(() => {
    const rows = mainRsLineTableRows;
    if (!rows.length || !filteredChartSeries.length) return;
    const hdr = ['Period', ...filteredChartSeries.map((s) => s.label)];
    const lines = [hdr.map(csvEscapeCell).join(',')];
    for (const r of rows) {
      lines.push(
        [
          csvEscapeCell(r.period),
          ...filteredChartSeries.map((s) => {
            const v = r[s.key];
            return csvEscapeCell(Number.isFinite(Number(v)) ? String(Number(v)) : '');
          })
        ].join(',')
      );
    }
    triggerCsvDownload(
      `${String(tickerSymbol || 'ticker').toUpperCase()}-relative-strength-chart.csv`,
      lines.join('\n')
    );
  }, [mainRsLineTableRows, filteredChartSeries, tickerSymbol]);

  const downloadStatsAnnualCsv = useCallback(() => {
    const rows = comparisonRowsAnnual;
    if (!rows.length) return;
    const sym = String(tickerSymbol || '').toUpperCase();
    const bench = String(benchCmpAnnual || '').toUpperCase();
    const lines = [['Period', `${sym}_pct`, `${bench}_pct`].join(',')];
    for (const r of [...rows].reverse()) {
      lines.push([csvEscapeCell(r.period), csvEscapeCell(r.tickerReturn), csvEscapeCell(r.benchmarkReturn)].join(','));
    }
    triggerCsvDownload(`${sym}-vs-${bench}-annual-returns-bar-${mode}.csv`, lines.join('\n'));
  }, [comparisonRowsAnnual, tickerSymbol, benchCmpAnnual, mode]);

  const downloadStatsExcessCsv = useCallback(() => {
    const rows = comparisonRowsExcess;
    if (!rows.length) return;
    const sym = String(tickerSymbol || '').toUpperCase();
    const bench = String(benchCmpExcess || '').toUpperCase();
    const lines = [['Period', `excess_pct_${sym}_minus_${bench}`].join(',')];
    for (const r of [...rows].reverse()) {
      lines.push([csvEscapeCell(r.period), csvEscapeCell(r.excessReturn)].join(','));
    }
    triggerCsvDownload(`${sym}-vs-${bench}-excess-return-${mode}.csv`, lines.join('\n'));
  }, [comparisonRowsExcess, tickerSymbol, benchCmpExcess, mode]);

  const downloadStatsPeriodicCsv = useCallback(() => {
    const rows = comparisonRowsPeriodic;
    if (!rows.length) return;
    const sym = String(tickerSymbol || '').toUpperCase();
    const bench = String(benchCmpPeriodic || '').toUpperCase();
    const lines = [['Period', `${sym}_pct`, `${bench}_pct`, 'excess_pct'].join(',')];
    for (const r of [...rows].reverse()) {
      lines.push(
        [csvEscapeCell(r.period), csvEscapeCell(r.tickerReturn), csvEscapeCell(r.benchmarkReturn), csvEscapeCell(r.excessReturn)].join(',')
      );
    }
    triggerCsvDownload(`${sym}-vs-${bench}-period-returns-${mode}.csv`, lines.join('\n'));
  }, [comparisonRowsPeriodic, tickerSymbol, benchCmpPeriodic, mode]);

  useEffect(() => {
    activeChartKeysRef.current = activeChartKeys;
  }, [activeChartKeys]);

  useEffect(() => {
    lastChartValsRef.current = lastChartByKey;
  }, [lastChartByKey]);

  const updateAxisBadgePositions = useCallback(() => {
    const chart = chartRef.current;
    const host = chartHostRef.current;
    if (!chart || !host) return;
    const keys = activeChartKeysRef.current;
    const lastVals = lastChartValsRef.current;
    const height = host.clientHeight;
    const getRawY = (key) => {
      const line = seriesMapRef.current.get(key);
      const val = lastVals[key];
      if (!line || !Number.isFinite(val)) return null;
      const y = line.priceToCoordinate(val);
      return y == null ? null : Number(y);
    };
    setAxisBadgeTops(layoutBadgeTopsPx(keys, getRawY, height));
  }, []);

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth,
      height: RS_MAIN_CHART_DEFAULT_H,
      layout: {
        background: { color: getRsChartBgColor(isLight) },
        textColor: isLight ? '#4b5563' : '#9ca3af',
        attributionLogo: false
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' },
        horzLines: { color: isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.12)' }
      },
      leftPriceScale: { visible: false },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: 0.08 },
        mode: PriceScaleMode.Normal
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        rightOffset: 12
      },
      crosshair: {
        vertLine: { color: isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.3)' },
        horzLine: { color: isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.3)' }
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true
      }
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: host.clientWidth });
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesMapRef.current = new Map();
    };
  }, [isLight]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.timeScale().applyOptions({ timeVisible: mode === 'daily' });
  }, [mode]);

  useEffect(() => {
    const chart = chartRef.current;
    const host = chartHostRef.current;
    if (!chart || !host) return;
    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => updateAxisBadgePositions());
      });
    };
    run();
    const ro = new ResizeObserver(() => run());
    ro.observe(host);
    const ts = chart.timeScale();
    const onRange = () => run();
    ts.subscribeVisibleLogicalRangeChange(onRange);
    ts.subscribeVisibleTimeRangeChange(onRange);
    return () => {
      ro.disconnect();
      ts.unsubscribeVisibleLogicalRangeChange(onRange);
      ts.unsubscribeVisibleTimeRangeChange(onRange);
    };
  }, [updateAxisBadgePositions, docTheme, isLight]);

  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateAxisBadgePositions());
    });
  }, [filteredChartSeries, lastChartByKey, updateAxisBadgePositions]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    for (const [, seriesObj] of seriesMapRef.current.entries()) {
      chart.removeSeries(seriesObj);
    }
    seriesMapRef.current = new Map();
    for (const s of filteredChartSeries) {
      const line = chart.addLineSeries({
        color: s.color,
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false
      });
      line.setData(s.data.map((d) => ({ time: d.time, value: d.value })));
      seriesMapRef.current.set(s.key, line);
    }
    chart.timeScale().fitContent();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateAxisBadgePositions());
    });
  }, [filteredChartSeries, updateAxisBadgePositions]);

  const handleResetRsChartView = useCallback(() => {
    setActiveChartKeys([...RS_CHART_SERIES_KEYS]);
    const chart = chartRef.current;
    if (chart) {
      try {
        chart.timeScale().fitContent();
        chart.priceScale('right').applyOptions({ autoScale: true });
      } catch {
        /* ignore */
      }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateAxisBadgePositions());
    });
  }, [updateAxisBadgePositions]);

  const chartMetaByKey = useMemo(() => new Map(chartSeries.map((s) => [s.key, s])), [chartSeries]);

  const buildMainRsExportFilename = useCallback(
    () => buildTickerChartExportFilename(`relative-strength-${mode}`, tickerSymbol),
    [mode, tickerSymbol]
  );

  const getMainRsExportFallbackCanvas = useCallback(() => {
    const chart = chartRef.current;
    if (chart && typeof chart.takeScreenshot === 'function') {
      try {
        const canvas = chart.takeScreenshot();
        if (canvas) return canvas;
      } catch {
        /* ignore */
      }
    }
    const host = chartHostRef.current;
    const canvas = host?.querySelector('canvas');
    return canvas instanceof HTMLCanvasElement ? canvas : null;
  }, []);

  const getMainRsExportBackground = useCallback(
    (light) => {
      const root = chartPanelRef.current;
      if (root && typeof window !== 'undefined') {
        const c = window.getComputedStyle(root).backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
      }
      return getRsChartBgColor(light);
    },
    []
  );

  const modeDropdownOptions = MODE_OPTIONS;

  const statsRangeControlsAnnual = useMemo(() => {
    if (mode === 'daily') {
      return (
        <div className="relative-strength-page__date-row relative-strength-page__stats-chart-range" aria-label="Annual returns chart date range">
          <span className="ticker-page__label ticker-page__label--inline">From</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={statsDailyAnnualStart}
            max={statsDailyAnnualEnd}
            onChange={(e) => setStatsDailyAnnualStart(e.target.value)}
            aria-label="Annual chart start date"
          />
          <span className="ticker-page__label ticker-page__label--inline">To</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={statsDailyAnnualEnd}
            min={statsDailyAnnualStart}
            onChange={(e) => setStatsDailyAnnualEnd(e.target.value)}
            aria-label="Annual chart end date"
          />
        </div>
      );
    }
    return (
      <div className="relative-strength-page__year-row relative-strength-page__stats-chart-range" aria-label="Annual returns chart year range">
        <span className="ticker-page__label ticker-page__label--inline">From</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={chartAnnualYearStart}
          options={yearOptions}
          onChange={setChartAnnualYearStart}
          title="Annual chart start year"
          ariaLabelPrefix="Annual chart start year"
          size="sm"
          wideLabel
        />
        <span className="ticker-page__label ticker-page__label--inline">To</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={chartAnnualYearEnd}
          options={yearOptions}
          onChange={setChartAnnualYearEnd}
          title="Annual chart end year"
          ariaLabelPrefix="Annual chart end year"
          size="sm"
          wideLabel
        />
      </div>
    );
  }, [
    mode,
    yearOptions,
    chartAnnualYearStart,
    chartAnnualYearEnd,
    statsDailyAnnualStart,
    statsDailyAnnualEnd
  ]);

  const statsRangeControlsExcess = useMemo(() => {
    if (mode === 'daily') {
      return (
        <div className="relative-strength-page__date-row relative-strength-page__stats-chart-range" aria-label="Excess return chart date range">
          <span className="ticker-page__label ticker-page__label--inline">From</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={statsDailyExcessStart}
            max={statsDailyExcessEnd}
            onChange={(e) => setStatsDailyExcessStart(e.target.value)}
            aria-label="Excess chart start date"
          />
          <span className="ticker-page__label ticker-page__label--inline">To</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={statsDailyExcessEnd}
            min={statsDailyExcessStart}
            onChange={(e) => setStatsDailyExcessEnd(e.target.value)}
            aria-label="Excess chart end date"
          />
        </div>
      );
    }
    return (
      <div className="relative-strength-page__year-row relative-strength-page__stats-chart-range" aria-label="Excess return chart year range">
        <span className="ticker-page__label ticker-page__label--inline">From</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={chartExcessYearStart}
          options={yearOptions}
          onChange={setChartExcessYearStart}
          title="Excess chart start year"
          ariaLabelPrefix="Excess chart start year"
          size="sm"
          wideLabel
        />
        <span className="ticker-page__label ticker-page__label--inline">To</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={chartExcessYearEnd}
          options={yearOptions}
          onChange={setChartExcessYearEnd}
          title="Excess chart end year"
          ariaLabelPrefix="Excess chart end year"
          size="sm"
          wideLabel
        />
      </div>
    );
  }, [
    mode,
    yearOptions,
    chartExcessYearStart,
    chartExcessYearEnd,
    statsDailyExcessStart,
    statsDailyExcessEnd
  ]);

  const statsRangeControlsPeriodic = useMemo(() => {
    if (mode === 'daily') {
      return (
        <div className="relative-strength-page__date-row relative-strength-page__stats-chart-range" aria-label="Periodic returns chart date range">
          <span className="ticker-page__label ticker-page__label--inline">From</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={statsDailyPeriodicStart}
            max={statsDailyPeriodicEnd}
            onChange={(e) => setStatsDailyPeriodicStart(e.target.value)}
            aria-label="Periodic chart start date"
          />
          <span className="ticker-page__label ticker-page__label--inline">To</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={statsDailyPeriodicEnd}
            min={statsDailyPeriodicStart}
            onChange={(e) => setStatsDailyPeriodicEnd(e.target.value)}
            aria-label="Periodic chart end date"
          />
        </div>
      );
    }
    return (
      <div className="relative-strength-page__year-row relative-strength-page__stats-chart-range" aria-label="Periodic returns chart year range">
        <span className="ticker-page__label ticker-page__label--inline">From</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={chartPeriodicYearStart}
          options={yearOptions}
          onChange={setChartPeriodicYearStart}
          title="Periodic chart start year"
          ariaLabelPrefix="Periodic chart start year"
          size="sm"
          wideLabel
        />
        <span className="ticker-page__label ticker-page__label--inline">To</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={chartPeriodicYearEnd}
          options={yearOptions}
          onChange={setChartPeriodicYearEnd}
          title="Periodic chart end year"
          ariaLabelPrefix="Periodic chart end year"
          size="sm"
          wideLabel
        />
      </div>
    );
  }, [
    mode,
    yearOptions,
    chartPeriodicYearStart,
    chartPeriodicYearEnd,
    statsDailyPeriodicStart,
    statsDailyPeriodicEnd
  ]);

  const mainRsRangeControls = useMemo(() => {
    if (mode === 'daily') {
      return (
        <div className="relative-strength-page__date-row" aria-label="Relative strength chart date range">
          <span className="ticker-page__label ticker-page__label--inline">Start date</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={dailyStart}
            max={dailyEnd}
            onChange={(e) => setDailyStart(e.target.value)}
            aria-label="Start date"
          />
          <span className="ticker-page__label ticker-page__label--inline">End date</span>
          <input
            className="relative-strength-page__date-inp"
            type="date"
            value={dailyEnd}
            min={dailyStart}
            onChange={(e) => setDailyEnd(e.target.value)}
            aria-label="End date"
          />
        </div>
      );
    }
    return (
      <div className="relative-strength-page__year-row" aria-label="Relative strength chart year range">
        <span className="ticker-page__label ticker-page__label--inline">Start</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={startYear}
          options={yearOptions}
          onChange={setStartYear}
          title="Start year"
          ariaLabelPrefix="Start year"
          size="sm"
          wideLabel
        />
        <span className="ticker-page__label ticker-page__label--inline">End</span>
        <ThemedDropdown
          className="relative-strength-page__year-dd"
          value={endYear}
          options={yearOptions}
          onChange={setEndYear}
          title="End year"
          ariaLabelPrefix="End year"
          size="sm"
          wideLabel
        />
      </div>
    );
  }, [mode, dailyStart, dailyEnd, startYear, endYear, yearOptions]);

  return (
    <>
    <section className="relative-strength-page">
      <div className="relative-strength-page__topbar">
        <div className="relative-strength-page__head">
          <h1 className="relative-strength-page__title">Relative Strength</h1>
          <p className="relative-strength-page__sub">Compare normalized performance for ticker and market benchmarks.</p>
        </div>

        <div className="relative-strength-page__controls">
          {/* <ThemedDropdown
            className="relative-strength-page__dd"
            value={indexSymbol}
            options={indexDropdownOptions}
            onChange={setIndexSymbol}
            title="Index selection"
            ariaLabelPrefix="Index"
          /> */}
          <div className="relative-strength-page__ticker-search">
            <TickerSymbolCombobox
              symbol={tickerSymbol}
              onSymbolChange={(raw) => setTickerSymbol(sanitizeTickerPageInput(raw))}
              inputId="relative-strength-ticker-symbol"
              placeholder="Search ticker (e.g. AAPL)"
            />
          </div>
          <ThemedDropdown
            className="relative-strength-page__dd"
            value={mode}
            options={modeDropdownOptions}
            onChange={(id) => startTransition(() => setMode(id))}
            title="Frequency"
            ariaLabelPrefix="Frequency"
          />
        </div>
      </div>

      <div className="relative-strength-page__filter-row2">
        <div className="relative-strength-page__filter-row2-main">{mainRsRangeControls}</div>
        <div className="relative-strength-page__filter-row2-actions ticker-annual-figma__toolbar-end">
          <ReturnsChartToolbar
            className="relative-strength-page__main-rs-toolbar"
            showViewMore={false}
            onToggleTable={() => setShowMainRsTable((v) => !v)}
            showTable={showMainRsTable}
            onDownload={downloadMainRsLineCsv}
            downloadDisabled={!mainRsLineTableRows.length}
          />
          <ChartSectionIconActions
            snapshotRootRef={chartPanelRef}
            plotHostRef={chartHostRef}
            fullscreenTargetRef={chartPanelRef}
            buildFilename={buildMainRsExportFilename}
            disabled={loading}
            getBackgroundColor={getMainRsExportBackground}
            getFallbackCanvas={getMainRsExportFallbackCanvas}
            onclone={applyRsSnapshotCloneFixes}
            exportPreviewAlt="Exported relative strength chart"
          />
        </div>
      </div>

      <section
        ref={chartPanelRef}
        className="relative-strength-page__chart-card np-card relative-strength-page__chart-card--np"
        aria-label="Relative strength chart"
      >
        <div className="np-card__chips-row">
          <div className="np-card__chips">
            {activeChartKeys.map((key) => {
              const s = chartMetaByKey.get(key);
              if (!s) return null;
              return (
                <div key={key} className="np-card__chip">
                  <div className="np-card__chip-main">
                    <span className="np-card__chip-label">{s.label}</span>
                    <button
                      type="button"
                      className="np-card__chip-x"
                      aria-label={`Remove ${s.label}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveChartKeys((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x !== key)));
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <span className="np-card__chip-bar" style={{ background: s.color }} aria-hidden />
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="np-card__reset"
            onClick={handleResetRsChartView}
            disabled={loading}
            title="Show all series and reset chart zoom"
            aria-label="Reset chart series and zoom"
          >
            Reset
          </button>
        </div>

        <div className="np-chart-wrap">
          <TickerChartResizeScope
            storageKey="rs-main-line-plot-h"
            defaultHeight={RS_MAIN_CHART_DEFAULT_H}
            min={200}
            max={900}
            className="relative-strength-page__main-rs-resize-scope"
          >
            <RsMainLineChartPlot
              chartHostRef={chartHostRef}
              chartRef={chartRef}
              loading={loading}
              error={error}
              activeChartKeys={activeChartKeys}
              chartMetaByKey={chartMetaByKey}
              axisBadgeTops={axisBadgeTops}
              lastChartByKey={lastChartByKey}
              updateAxisBadgePositions={updateAxisBadgePositions}
            />
          </TickerChartResizeScope>
        </div>
        {showMainRsTable && mainRsLineTableRows.length ? (
          <div className="ticker-annual-figma__table-wrap relative-strength-page__rs-main-table-wrap">
            <table className="ticker-annual-figma__table">
              <thead>
                <tr>
                  <th>Period</th>
                  {filteredChartSeries.map((s) => (
                    <th key={s.key}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...mainRsLineTableRows].reverse().map((row) => (
                  <tr key={String(row.period)}>
                    <td>{fmtDate(row.period)}</td>
                    {filteredChartSeries.map((s) => (
                      <td key={s.key} className={pctToneClass(row[s.key])}>
                        {Number.isFinite(Number(row[s.key])) ? fmtPct(row[s.key]) : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
      <div className="stats-cmp-charts">
        <div className="ticker-annual-figma relative-strength-page__cmp-charts-figma" aria-label="Return comparison charts">
          <div className="relative-strength-page__cmp-chart-block">
            <TickerChartResizeScope
              storageKey="rs-stats-annual-plot-h"
              defaultHeight={300}
              min={200}
              max={560}
              className="relative-strength-page__cmp-resize-scope"
            >
              <AnnualReturnBarChart
                mode={modeForCmp}
                ticker={tickerSymbol}
                benchmarkIndex={benchCmpAnnual}
                theme={docTheme}
                rows={deferredComparisonRowsAnnual}
                benchmarkOptions={benchmarkDropdownOptions}
                onBenchmarkChange={setBenchCmpAnnual}
                controls={statsRangeControlsAnnual}
                showDataTable={showStatsAnnualTable}
                onToggleDataTable={() => setShowStatsAnnualTable((v) => !v)}
                onDownloadCsv={downloadStatsAnnualCsv}
                csvDisabled={!comparisonRowsAnnual.length}
                loading={loading || pendingFetchSymbols.has(String(benchCmpAnnual).toUpperCase())}
              />
            </TickerChartResizeScope>
            {showStatsAnnualTable && comparisonRowsAnnual.length ? (
              <div className="ticker-annual-figma__table-wrap relative-strength-page__stats-data-table">
                <table className="ticker-annual-figma__table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>{tickerSymbol} %</th>
                      <th>{benchCmpAnnual} %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...comparisonRowsAnnual].reverse().map((r) => (
                      <tr key={String(r.period)}>
                        <td>{fmtDate(r.period)}</td>
                        <td className={pctToneClass(r.tickerReturn)}>{fmtPct(r.tickerReturn)}</td>
                        <td className={pctToneClass(r.benchmarkReturn)}>{fmtPct(r.benchmarkReturn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <div className="relative-strength-page__cmp-chart-block">
            <TickerChartResizeScope
              storageKey="rs-stats-excess-plot-h"
              defaultHeight={280}
              min={200}
              max={560}
              className="relative-strength-page__cmp-resize-scope"
            >
              <ExcessReturnLineChart
                mode={modeForCmp}
                ticker={tickerSymbol}
                benchmarkIndex={benchCmpExcess}
                theme={docTheme}
                rows={deferredComparisonRowsExcess}
                benchmarkOptions={benchmarkDropdownOptions}
                onBenchmarkChange={setBenchCmpExcess}
                controls={statsRangeControlsExcess}
                showDataTable={showStatsExcessTable}
                onToggleDataTable={() => setShowStatsExcessTable((v) => !v)}
                onDownloadCsv={downloadStatsExcessCsv}
                csvDisabled={!comparisonRowsExcess.length}
                loading={loading || pendingFetchSymbols.has(String(benchCmpExcess).toUpperCase())}
              />
            </TickerChartResizeScope>
            {showStatsExcessTable && comparisonRowsExcess.length ? (
              <div className="ticker-annual-figma__table-wrap relative-strength-page__stats-data-table">
                <table className="ticker-annual-figma__table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>
                        Excess ({tickerSymbol} − {benchCmpExcess})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...comparisonRowsExcess].reverse().map((r) => (
                      <tr key={String(r.period)}>
                        <td>{fmtDate(r.period)}</td>
                        <td className={pctToneClass(r.excessReturn)}>{fmtPct(r.excessReturn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          <div className="relative-strength-page__cmp-chart-block">
            <TickerChartResizeScope
              storageKey="rs-stats-periodic-plot-h"
              defaultHeight={280}
              min={200}
              max={560}
              className="relative-strength-page__cmp-resize-scope"
            >
              <PeriodicReturnBarChart
                mode={modeForCmp}
                ticker={tickerSymbol}
                benchmarkIndex={benchCmpPeriodic}
                theme={docTheme}
                rows={deferredComparisonRowsPeriodic}
                benchmarkOptions={benchmarkDropdownOptions}
                onBenchmarkChange={setBenchCmpPeriodic}
                controls={statsRangeControlsPeriodic}
                showDataTable={showStatsPeriodicTable}
                onToggleDataTable={() => setShowStatsPeriodicTable((v) => !v)}
                onDownloadCsv={downloadStatsPeriodicCsv}
                csvDisabled={!comparisonRowsPeriodic.length}
                loading={loading || pendingFetchSymbols.has(String(benchCmpPeriodic).toUpperCase())}
              />
            </TickerChartResizeScope>
            {showStatsPeriodicTable && comparisonRowsPeriodic.length ? (
              <div className="ticker-annual-figma__table-wrap relative-strength-page__stats-data-table">
                <table className="ticker-annual-figma__table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>{tickerSymbol} %</th>
                      <th>{benchCmpPeriodic} %</th>
                      <th>Excess %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...comparisonRowsPeriodic].reverse().map((r) => (
                      <tr key={String(r.period)}>
                        <td>{fmtDate(r.period)}</td>
                        <td className={pctToneClass(r.tickerReturn)}>{fmtPct(r.tickerReturn)}</td>
                        <td className={pctToneClass(r.benchmarkReturn)}>{fmtPct(r.benchmarkReturn)}</td>
                        <td className={pctToneClass(r.excessReturn)}>{fmtPct(r.excessReturn)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </div>
        <section className="ticker-card ticker-card--rs-benchmark flex flex-col gap-2">
        <TickerSection16Section17
          rows={section16Rows}
          compareRows={section17CompareRows}
          relativeStrengthTitle={`Relative Strength`}
          relativeStrengthHeader={`Relative Strength (${indexSymbol} - ${tickerSymbol})`}
        />
          <TickerSection23Section24 pageSymbol={tickerSymbol} />
        </section>
      </div>

      {/* <div className="relative-strength-page__table-card">
        <div className="relative-strength-page__table-head">
          <h2>Comparison table</h2>
          <ThemedDropdown
            className="relative-strength-page__table-dd"
            value={mode}
            options={modeDropdownOptions}
            onChange={setMode}
            title="Table frequency"
            ariaLabelPrefix="Table frequency"
            size="sm"
            wideLabel
          />
        </div>
        <div className="relative-strength-page__table-wrap">
          <table className="relative-strength-page__table">
            <thead>
              <tr>
                <th rowSpan={2}>Period</th>
                <th colSpan={compareSymbols.length}>AdjClose</th>
                <th colSpan={compareSymbols.length}>Daily %</th>
                <th colSpan={compareSymbols.length}>Rebased %</th>
                <th colSpan={compareSymbols.length}>Cumulative %</th>
              </tr>
              <tr>
                {compareSymbols.map((s) => <th key={`h1-${s}`}>{s}</th>)}
                {compareSymbols.map((s) => <th key={`h2-${s}`}>{s}</th>)}
                {compareSymbols.map((s) => <th key={`h3-${s}`}>{s}</th>)}
                {compareSymbols.map((s) => <th key={`h4-${s}`}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, 60).map((row) => (
                <tr key={row.period}>
                  <td>{fmtDate(row.period)}</td>
                  {compareSymbols.map((s) => <td key={`r1-${row.period}-${s}`}>{fmtNum(row.bySymbol[s]?.raw)}</td>)}
                  {compareSymbols.map((s) => <td key={`r2-${row.period}-${s}`}>{fmtPct(row.bySymbol[s]?.dailyRet)}</td>)}
                  {compareSymbols.map((s) => <td key={`r3-${row.period}-${s}`}>{fmtPct(row.bySymbol[s]?.rebased)}</td>)}
                  {compareSymbols.map((s) => <td key={`r4-${row.period}-${s}`}>{fmtPct(row.bySymbol[s]?.cumulative)}</td>)}
                </tr>
              ))}
              {!tableRows.length ? (
                <tr>
                  <td colSpan={1 + compareSymbols.length * 4} className="relative-strength-page__empty">No data for selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div> */}
    </section>

    </>
  );
}
