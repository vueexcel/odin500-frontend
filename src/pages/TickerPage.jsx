import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DataInfoTip } from '../components/DataInfoTip.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerMonthlyReturnsWaterfallDonut } from '../components/TickerMonthlyReturnsWaterfallDonut.jsx';
import { TickerQuarterlyReturnsChart } from '../components/TickerQuarterlyReturnsChart.jsx';
import { TickerSection16Section17 } from '../components/TickerSection16Section17.jsx';
import { TickerSection23Section24 } from '../components/TickerSection23Section24.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import TradingChartLoader from '../components/TradingChartLoader.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import {
  IconChartTypeDropdown,
  TICKER_CHART_TYPE_OPTIONS,
  TickerLightweightChart
} from '../components/TickerLightweightChart.jsx';
import { useGeneralNewsFeed } from '../hooks/useGeneralNewsFeed.js';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { toDateInput } from '../utils/misc.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';

const TIMEFRAMES = ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', '20Y', 'ALL'];
/** Must stay ≤ backend `OHLC_SIGNALS_MAX_RANGE_DAYS` (default 40000). */
const MAX_SIGNAL_RANGE_DAYS = 40000;
const BENCHMARK = 'SPY';

/** Persisted main-chart pixel height (drag resize). */
const CHART_USER_H_KEY = 'odin_ticker_chart_h';
const CHART_H_MIN = 200;
const CHART_H_MAX = 1400;

const RESIZE_KEY_ANNUAL_FIGMA = 'odin_ticker_resize_annual_figma';
const RESIZE_KEY_ANNUAL_POSNEG = 'odin_ticker_resize_annual_posneg';
const RESIZE_KEY_QUARTERLY = 'odin_ticker_resize_quarterly';
const RESIZE_KEY_MONTHLY = 'odin_ticker_resize_monthly';
const RESIZE_KEY_MONTHLY_ADV = 'odin_ticker_resize_monthly_waterfall';
const RETURNS_DEFAULT_START = '2018-01-01';
/** Long-window returns for Benchmark vs Ticker section (matches section table range). */
const TABLE_LONG_START_DATE = '2005-01-01';
/** Default section benchmark ticker when group is S&P 500 (`TickerSection23Section24` GROUPS[0]). */
const SECTION_LONG_DEFAULT_BENCHMARK = 'SPX';

const MAX_NEWS_ITEMS = 120;
const NEWS_PAGE_SIZE = 5;

const PERF_COLS = [
  { label: '1M', period: 'Last Month' },
  { label: '3M', period: 'Last 3 months' },
  { label: 'YTD', period: 'Year to Date (YTD)' },
  { label: '1Y', period: 'Last 1 year' }
];

/** Maps comparison table row → `dynamicPeriods[].period` name (null = computed from OHLC). */
const COMPARE_ROWS = [
  { key: '1D', period: 'Last date' },
  { key: '5D', period: 'Week' },
  { key: 'MTD', period: null, mtd: true },
  { key: '1M', period: 'Last Month' },
  { key: 'QTD', period: null, qtd: true },
  { key: '3M', period: 'Last 3 months' },
  { key: '6M', period: 'Last 6 months' },
  { key: 'YTD', period: 'Year to Date (YTD)' },
  { key: '1Y', period: 'Last 1 year' },
  { key: '3Y', period: 'Last 3 years' },
  { key: '5Y', period: 'Last 5 years' },
  { key: '10Y', period: 'Last 10 years' },
  { key: '20Y', period: 'Last 20 years' }
];

const RELATIVE_INDEX_OPTIONS = [
  { key: 'sp500', label: 'S&P 500', apiIndex: 'sp500' },
  { key: 'dow-jones', label: 'Dow Jones', apiIndex: 'Dow Jones' },
  { key: 'nasdaq-composite', label: 'Nasdaq Composite', apiIndex: 'nasdaq composite' },
  { key: 'nasdaq-100', label: 'Nasdaq 100', apiIndex: 'Nasdaq 100' }
];
const RELATED_INDEX_LINKS = [
  { slug: 'dow-jones', label: 'Dow Jones' },
  { slug: 'sp500', label: 'S&P 500' },
  { slug: 'nasdaq-100', label: 'Nasdaq' }
];

function yesterdayIsoForLongTable() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateInput(d);
}

/** Resolve one ticker payload from single or batched `/ticker-returns` response. */
function pickTickerReturnsFromPayload(payload, ticker) {
  const u = String(ticker || '').toUpperCase().trim();
  if (!payload || !u) return null;
  if (payload.batch === true && payload.byTicker && payload.byTicker[u] != null) {
    const row = payload.byTicker[u];
    if (row && row.success === false) return null;
    return row;
  }
  if (!payload.batch && String(payload.ticker || '').toUpperCase() === u) return payload;
  return null;
}

/** Merge partial `ticker-*-returns` / `ticker-core-returns` payloads into one `returnsSym`-style object. */
function mergeTickerReturns(prev, patch) {
  if (!patch || patch.success === false) return prev;
  const pPrev = prev?.performance || {};
  const pNext = patch.performance || {};
  const pick = (key) => {
    const nextVal = pNext[key];
    const prevVal = pPrev[key];
    if (nextVal === undefined) return prevVal;
    if (Array.isArray(nextVal) && nextVal.length === 0 && Array.isArray(prevVal) && prevVal.length > 0) return prevVal;
    return nextVal;
  };
  return {
    ...prev,
    ...patch,
    ticker: patch.ticker ?? prev?.ticker,
    asOfDate: patch.asOfDate ?? prev?.asOfDate,
    success: true,
    performance: {
      dynamicPeriods: pick('dynamicPeriods') ?? [],
      predefinedPeriods: pick('predefinedPeriods') ?? [],
      annualReturns: pick('annualReturns') ?? [],
      quarterlyReturns: pick('quarterlyReturns') ?? [],
      monthlyReturns: pick('monthlyReturns') ?? [],
      customRange: pick('customRange') ?? []
    }
  };
}

function describeTickerIndex(rawIndex) {
  const s = String(rawIndex || '').trim();
  if (!s) return 'Other';
  const lower = s.toLowerCase();
  if (lower.includes('s&p') || lower.includes('sp500') || lower.includes('snp') || lower.includes('sp 500')) {
    return 'S&P 500';
  }
  if (lower.includes('dow')) return 'Dow Jones';
  if (lower.includes('nasdaq')) return 'Nasdaq';
  if (lower.includes('etf')) return 'ETF';
  if (lower === 'us') return 'Other';
  return s;
}

function pickNum(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      const n = Number(row[key]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function toIso(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Cap how far `start` can be before `end` so inclusive calendar-day span ≤ `maxInclusiveDays`
 * (matches backend ohlc-signals-indicator: floor((end-start)/1d)+1 ≤ max).
 */
function clampStartToMaxDays(start, end, maxInclusiveDays) {
  const maxDiffMs = (maxInclusiveDays - 1) * 86400000;
  const diff = end.getTime() - start.getTime();
  if (diff <= maxDiffMs) return start;
  return new Date(end.getTime() - maxDiffMs);
}

/**
 * First calendar date in a backward walk from `endIso` until `sessionCount` Mon–Fri
 * sessions have been included (the end date counts if it is a weekday).
 */
function startDateForLastTradingSessions(endIso, sessionCount) {
  const end = new Date(String(endIso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(end.getTime()) || sessionCount < 1) return String(endIso).slice(0, 10);
  let d = new Date(end);
  let counted = 0;
  for (;;) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) counted += 1;
    if (counted >= sessionCount) break;
    d.setDate(d.getDate() - 1);
  }
  return toIso(d);
}

/**
 * @param {string} tf
 * @param {string} endIso as-of / chart end (YYYY-MM-DD)
 * @param {{ min: string, max: string } | null} [bounds] first/last OHLC dates from `/api/market/ohlc-ticker-bounds` (for ALL)
 */
function rangeForTimeframe(tf, endIso, bounds = null) {
  const end = new Date(String(endIso).slice(0, 10) + 'T12:00:00');
  if (Number.isNaN(end.getTime())) {
    const t = new Date();
    return { start: toIso(new Date(t.getTime() - 370 * 86400000)), end: toIso(t) };
  }
  const endStr = String(endIso).slice(0, 10);
  if (tf === '1D') {
    const startStr = startDateForLastTradingSessions(endStr, 3);
    const startD = new Date(startStr + 'T12:00:00');
    const capped = clampStartToMaxDays(startD, end, MAX_SIGNAL_RANGE_DAYS);
    return { start: toIso(capped), end: endStr };
  }
  if (tf === '5D') {
    const startStr = startDateForLastTradingSessions(endStr, 5);
    const startD = new Date(startStr + 'T12:00:00');
    const capped = clampStartToMaxDays(startD, end, MAX_SIGNAL_RANGE_DAYS);
    return { start: toIso(capped), end: endStr };
  }
  const start = new Date(end);
  switch (tf) {
    case 'MTD':
      start.setTime(new Date(end.getFullYear(), end.getMonth(), 1).getTime());
      break;
    case '1M':
      start.setDate(end.getDate() - 35);
      break;
    case 'QTD':
      start.setTime(new Date(end.getFullYear(), Math.floor(end.getMonth() / 3) * 3, 1).getTime());
      break;
    case '3M':
      start.setDate(end.getDate() - 95);
      break;
    case '6M':
      start.setDate(end.getDate() - 185);
      break;
    case 'YTD':
      start.setTime(new Date(end.getFullYear(), 0, 1).getTime());
      break;
    case '1Y':
      start.setDate(end.getDate() - 370);
      break;
    case '3Y':
      start.setDate(end.getDate() - 1100);
      break;
    case '5Y':
      start.setDate(end.getDate() - 1825);
      break;
    case '10Y': {
      const t = new Date(end);
      t.setFullYear(t.getFullYear() - 10);
      start.setTime(t.getTime());
      break;
    }
    case '20Y': {
      const t = new Date(end);
      t.setFullYear(t.getFullYear() - 20);
      start.setTime(t.getTime());
      break;
    }
    case 'ALL':
      if (bounds?.min) {
        const minD = new Date(String(bounds.min).slice(0, 10) + 'T12:00:00');
        if (!Number.isNaN(minD.getTime())) {
          start.setTime(minD.getTime() > end.getTime() ? end.getTime() : minD.getTime());
        } else {
          start.setDate(end.getDate() - (MAX_SIGNAL_RANGE_DAYS - 1));
        }
      } else {
        start.setDate(end.getDate() - (MAX_SIGNAL_RANGE_DAYS - 1));
      }
      break;
    default:
      start.setDate(end.getDate() - 370);
  }
  const capped = clampStartToMaxDays(start, end, MAX_SIGNAL_RANGE_DAYS);
  return { start: toIso(capped), end: endStr };
}

/** User custom chart range: validate, order, cap span, cap end to dataset as-of. */
function normalizeCustomChartRange(startStr, endStr, asOfIso) {
  const ns = String(startStr || '').trim();
  const ne = String(endStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ns) || !/^\d{4}-\d{2}-\d{2}$/.test(ne)) return null;
  let sd = new Date(ns + 'T12:00:00');
  let ed = new Date(ne + 'T12:00:00');
  if (Number.isNaN(sd.getTime()) || Number.isNaN(ed.getTime())) return null;
  if (sd > ed) {
    const t = sd;
    sd = ed;
    ed = t;
  }
  const cap = new Date(String(asOfIso || '').slice(0, 10) + 'T12:00:00');
  if (!Number.isNaN(cap.getTime()) && ed > cap) ed = cap;
  if (sd > ed) sd = new Date(ed);
  const capped = clampStartToMaxDays(sd, ed, MAX_SIGNAL_RANGE_DAYS);
  return { start: toIso(capped), end: toIso(ed) };
}

function sortRowsAsc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = rowDateToTimeKey(a);
    const tb = rowDateToTimeKey(b);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

function signalBucket(sig) {
  const s = String(sig || 'N')
    .trim()
    .toUpperCase();
  if (!s || s === 'N' || s === 'NULL') return 'N';
  if (/^L1/.test(s)) return 'L1';
  if (/^L2/.test(s)) return 'L2';
  if (s.startsWith('L')) return 'L3';
  if (/^S1/.test(s)) return 'S1';
  if (/^S2/.test(s)) return 'S2';
  if (s.startsWith('S')) return 'S3';
  return 'N';
}

function formatPct(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const s = (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
  return s;
}

function formatPx(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatVolLong(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(Math.round(v));
}

function annualizedVol(closes) {
  if (!closes || closes.length < 5) return null;
  const lr = [];
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) lr.push(Math.log(b / a));
  }
  if (lr.length < 2) return null;
  const mean = lr.reduce((s, x) => s + x, 0) / lr.length;
  const varSample = lr.reduce((s, x) => s + (x - mean) ** 2, 0) / (lr.length - 1);
  const daily = Math.sqrt(varSample);
  return Math.round(daily * Math.sqrt(252) * 100 * 10) / 10;
}

function pickDynamic(dynamicPeriods, periodName) {
  if (!periodName || !Array.isArray(dynamicPeriods)) return null;
  const row = dynamicPeriods.find((r) => r.period === periodName);
  return row && row.totalReturn != null ? Number(row.totalReturn) : null;
}

function periodReturnFromRows(sortedAsc, startFilter) {
  if (!sortedAsc.length) return null;
  const last = sortedAsc[sortedAsc.length - 1];
  const lastClose = pickNum(last, ['Close', 'close']);
  const first = sortedAsc.find(startFilter);
  if (!first) return null;
  const firstClose = pickNum(first, ['Close', 'close']);
  if (firstClose == null || lastClose == null || firstClose === 0) return null;
  return ((lastClose - firstClose) / firstClose) * 100;
}

function mtdFromRows(sortedAsc) {
  if (!sortedAsc.length) return null;
  const last = sortedAsc[sortedAsc.length - 1];
  const lastIso = rowDateToTimeKey(last);
  if (!lastIso) return null;
  const lastD = new Date(lastIso + 'T12:00:00');
  return periodReturnFromRows(sortedAsc, (r) => {
    const iso = rowDateToTimeKey(r);
    if (!iso) return false;
    const d = new Date(iso + 'T12:00:00');
    return d.getFullYear() === lastD.getFullYear() && d.getMonth() === lastD.getMonth();
  });
}

function qtdFromRows(sortedAsc) {
  if (!sortedAsc.length) return null;
  const last = sortedAsc[sortedAsc.length - 1];
  const lastIso = rowDateToTimeKey(last);
  if (!lastIso) return null;
  const lastD = new Date(lastIso + 'T12:00:00');
  const q = Math.floor(lastD.getMonth() / 3);
  const qStart = new Date(lastD.getFullYear(), q * 3, 1);
  return periodReturnFromRows(sortedAsc, (r) => {
    const iso = rowDateToTimeKey(r);
    if (!iso) return false;
    const d = new Date(iso + 'T12:00:00');
    return d >= qStart;
  });
}

function pickCompetitors(detailRows, sym, mySector, limit = 6) {
  const u = sym.toUpperCase();
  const rows = Array.isArray(detailRows) ? detailRows : [];
  const same = rows.filter(
    (r) =>
      String(r.Symbol || r.symbol || '')
        .toUpperCase()
        .trim() !== u &&
      mySector &&
      String(r.Sector || r.sector || '').trim() === mySector
  );
  const rest = rows.filter(
    (r) =>
      String(r.Symbol || r.symbol || '')
        .toUpperCase()
        .trim() !== u
  );
  const merged = [...same, ...rest];
  const seen = new Set();
  const out = [];
  for (const r of merged) {
    const s = String(r.Symbol || r.symbol || '')
      .toUpperCase()
      .trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function ohlcRowsFromPayload(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function IconFlagUs({ className }) {
  return (
    <svg className={className} viewBox="0 0 21 14" aria-hidden width="21" height="14">
      <rect width="21" height="14" fill="#b22234" rx="1" />
      <path fill="#fff" d="M0 2h21v2H0V2zm0 4h21v2H0V6zm0 4h21v2H0v-2z" />
      <rect x="0" y="0" width="9" height="8" fill="#3c3b6e" />
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <circle key={`${row}-${col}`} cx={1 + col * 1.6} cy={1 + row * 1.6} r="0.45" fill="#fff" />
        ))
      )}
    </svg>
  );
}

function IconBell({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2z" />
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 5 3 9H3c0-4 3-2 3-9" />
    </svg>
  );
}

function IconPlus({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconPencil({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

/** Document / notes (Figma “My Notes”). */
function IconDocument({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" strokeLinejoin="round" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronRight({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronDown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" />
    </svg>
  );
}

function IconTrendUp({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#00c805" strokeWidth="2" aria-hidden>
      <path d="M4 14l6-6 4 4 6-8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4h6v6" strokeLinecap="round" />
    </svg>
  );
}

function IconTrendDown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#ff3b30" strokeWidth="2" aria-hidden>
      <path d="M4 10l6 6 4-4 6 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 20h6v-6" strokeLinecap="round" />
    </svg>
  );
}

function ChartTypeToolbarDropdown({ chartType, onChartTypeChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const currentLabel = TICKER_CHART_TYPE_OPTIONS.find((o) => o.id === chartType)?.label ?? 'Line';
  return (
    <div className="ticker-chart-toolbar__chart-type-wrap" ref={wrapRef}>
      <button
        type="button"
        className="ticker-chart-toolbar__chart-type-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={'Chart type: ' + currentLabel}
        title="Chart type"
        onClick={() => setOpen((o) => !o)}
      >
        <IconChartTypeDropdown className="ticker-chart-toolbar__chart-type-ico" />
        <span className="ticker-chart-toolbar__chart-type-label">{currentLabel}</span>
        <IconChevronDown className="ticker-chart-toolbar__chev" />
      </button>
      {open ? (
        <ul className="ticker-chart-toolbar__chart-type-menu" role="menu">
          {TICKER_CHART_TYPE_OPTIONS.map((opt) => (
            <li key={opt.id} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={chartType === opt.id}
                className={
                  'ticker-chart-toolbar__chart-type-item' +
                  (chartType === opt.id ? ' ticker-chart-toolbar__chart-type-item--active' : '')
                }
                onClick={() => {
                  onChartTypeChange(opt.id);
                  setOpen(false);
                }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChartToolbarIcons() {
  const c = 'ticker-chart-toolbar__ico';
  return (
    <div className="ticker-chart-toolbar__icons" aria-hidden>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 21l6-6 4 4 8-8M21 7V3h-4" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 20L20 4M4 4v4m0-4h4M20 20v-4m0 4h-4" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="4" width="16" height="16" rx="1" />
        <path d="M4 12h16M12 4v16" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 18h16M4 12h10M4 6h14" />
      </svg>
      <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      </svg>
    </div>
  );
}

function pctClass(n) {
  if (n == null || !Number.isFinite(n)) return '';
  if (n > 0) return 'ticker-num--up';
  if (n < 0) return 'ticker-num--down';
  return '';
}

/** Main chart pixel height by viewport (Lightweight Charts is not fluid vertically). */
function useMediaChartHeight() {
  const [height, setHeight] = useState(320);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 480) setHeight(220);
      else if (w < 768) setHeight(260);
      else if (w < 1024) setHeight(290);
      else setHeight(320);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return height;
}

export default function TickerPage() {
  const location = useLocation();
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const [activeSymbol, setActiveSymbol] = useState(() => sanitizeTickerPageInput(symbolParam) || 'AAPL');
  const sym = activeSymbol;
  const canonicalSym = String(sym || 'AAPL').toLowerCase();

  useEffect(() => {
    const next = sanitizeTickerPageInput(symbolParam) || 'AAPL';
    setActiveSymbol((prev) => (prev === next ? prev : next));
  }, [symbolParam]);

  usePageSeo({
    title: `${String(sym).toUpperCase()} Odin500 Signal, Returns & Market Statistics`,
    description: `Live Odin500 signal, returns, OHLC market data, and strategy comparison for ${String(sym).toUpperCase()}.`,
    canonicalPath: `/ticker/${canonicalSym}`,
    noindex: Boolean(location.search),
    breadcrumbItems: [
      { name: 'Market', path: '/market' },
      { name: 'Ticker', path: '/ticker' },
      { name: String(sym).toUpperCase(), path: `/ticker/${canonicalSym}` }
    ]
  });

  const [authVersion, setAuthVersion] = useState(0);
  const [timeframe, setTimeframe] = useState('1Y');
  const [chartLoading, setChartLoading] = useState(false);
  const [metaBusy, setMetaBusy] = useState(true);
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [symbolRefreshToken, setSymbolRefreshToken] = useState(0);
  const [tickerReturnsDebug, setTickerReturnsDebug] = useState(null);

  const [ohlcRows, setOhlcRows] = useState([]);
  const [returnsSym, setReturnsSym] = useState(null);
  const [returnsSpy, setReturnsSpy] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [relativeIndexKey, setRelativeIndexKey] = useState('sp500');
  const [relativeTickerSymbol, setRelativeTickerSymbol] = useState(sym);
  const [relativeIndexSeriesByKey, setRelativeIndexSeriesByKey] = useState({});
  const [relativeTickerSeriesBySymbol, setRelativeTickerSeriesBySymbol] = useState({});
  const [relativeCompareBusy, setRelativeCompareBusy] = useState(false);
  /** Benchmark symbol for long-range table section; synced from `TickerSection23Section24` group. */
  const [benchForLongTable, setBenchForLongTable] = useState(SECTION_LONG_DEFAULT_BENCHMARK);
  const [longRangeTickerReturns, setLongRangeTickerReturns] = useState(null);
  const [longRangeBenchReturns, setLongRangeBenchReturns] = useState(null);
  const [longRangeBusy, setLongRangeBusy] = useState(false);
  const [tailRows, setTailRows] = useState([]);
  const [newsPage, setNewsPage] = useState(1);
  const { busy: newsBusy, error: newsError, items: liveNewsAll } = useGeneralNewsFeed();
  const liveNews = useMemo(() => liveNewsAll.slice(0, MAX_NEWS_ITEMS), [liveNewsAll]);
  const [appliedCustomRange, setAppliedCustomRange] = useState(null);
  const [draftChartStart, setDraftChartStart] = useState('');
  const [draftChartEnd, setDraftChartEnd] = useState('');
  const [mainChartType, setMainChartType] = useState('line');
  const [ohlcTickerBounds, setOhlcTickerBounds] = useState(/** @type {{ min: string, max: string } | null} */ (null));

  const chartBodyRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartPlotHostRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const mediaChartHeight = useMediaChartHeight();
  const mediaHRef = useRef(mediaChartHeight);
  mediaHRef.current = mediaChartHeight;
  const resizeDragRef = useRef(/** @type {{ active: boolean, startY: number, startH: number } | null} */ (null));

  const [userChartHeight, setUserChartHeight] = useState(() => {
    try {
      const raw = localStorage.getItem(CHART_USER_H_KEY);
      const n = raw != null ? parseInt(raw, 10) : NaN;
      if (Number.isFinite(n) && n >= CHART_H_MIN && n <= CHART_H_MAX) return n;
    } catch {
      /* ignore */
    }
    return null;
  });
  const [chartFs, setChartFs] = useState(false);
  const [fsPlotH, setFsPlotH] = useState(0);

  const chartApiRange = useMemo(() => {
    if (appliedCustomRange?.start && appliedCustomRange?.end) {
      const n = normalizeCustomChartRange(appliedCustomRange.start, appliedCustomRange.end, asOfDate);
      return n || rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
    }
    return rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
  }, [appliedCustomRange, timeframe, asOfDate, ohlcTickerBounds]);

  useEffect(() => {
    if (appliedCustomRange) return;
    const r = rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
    setDraftChartStart(r.start);
    setDraftChartEnd(r.end);
  }, [timeframe, asOfDate, appliedCustomRange, ohlcTickerBounds]);

  useEffect(() => {
    const onAuth = () => setAuthVersion((v) => v + 1);
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  const onSymbolChange = useCallback(
    (next) => {
      const s = sanitizeTickerPageInput(next);
      setSymbolRefreshToken((v) => v + 1);
      setActiveSymbol(s || 'AAPL');
      if (!s) {
        navigate('/ticker');
        return;
      }
      if (s === sym) return;
      navigate('/ticker/' + encodeURIComponent(s));
    },
    [navigate, sym]
  );

  const applyCustomChartRange = useCallback(() => {
    const n = normalizeCustomChartRange(draftChartStart, draftChartEnd, asOfDate);
    if (!n) return;
    setAppliedCustomRange(n);
  }, [draftChartStart, draftChartEnd, asOfDate]);

  const resetCustomChartRange = useCallback(() => {
    setAppliedCustomRange(null);
    const r = rangeForTimeframe(timeframe, asOfDate, ohlcTickerBounds);
    setDraftChartStart(r.start);
    setDraftChartEnd(r.end);
  }, [timeframe, asOfDate, ohlcTickerBounds]);

  const onSectionBenchmarkSymbolChange = useCallback((b) => {
    setBenchForLongTable(String(b || SECTION_LONG_DEFAULT_BENCHMARK).toUpperCase().trim());
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setError('Sign in to load ticker data.');
      setChartLoading(false);
      setMetaBusy(false);
      setOhlcRows([]);
      setReturnsSym(null);
      setReturnsSpy(null);
      setLongRangeTickerReturns(null);
      setLongRangeBenchReturns(null);
      setDetailRows([]);
      setStatsRows([]);
      setStatsRowsSpy([]);
      setTailRows([]);
      setOhlcTickerBounds(null);
      setTickerReturnsDebug(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setMetaBusy(true);
      setError('');
      const returnsDefaultEnd = toDateInput(new Date());
      const symU = String(sym || '').toUpperCase().trim();

      /** 1Y OHLC stats window seeded from calendar “today” so OHLC requests run in parallel with ticker-returns. */
      const seedEnd = returnsDefaultEnd;
      const seedAsOfD = new Date(seedEnd + 'T12:00:00');
      const seedStart365 = new Date(seedAsOfD);
      seedStart365.setFullYear(seedStart365.getFullYear() - 1);
      const seedStartIso = toIso(seedStart365);

      const clearBusyWhenVisible = () => {
        if (!cancelled) setMetaBusy(false);
      };

      const tasks = [];

      const defaultRangeBody = {
        customStartDate: RETURNS_DEFAULT_START,
        customEndDate: returnsDefaultEnd
      };

      const patchSymReturns = (data) => {
        if (cancelled || !data) return;
        setReturnsSym((prev) => mergeTickerReturns(prev, data));
        const asOf = data.asOfDate || seedEnd;
        setAsOfDate(String(asOf).slice(0, 10));
      };
      const patchSpyReturns = (data) => {
        if (cancelled || !data) return;
        setReturnsSpy((prev) => mergeTickerReturns(prev, data));
      };

      tasks.push(
        fetchJsonCached({
          path: '/api/market/ticker-core-returns',
          method: 'POST',
          body: { ticker: symU, ...defaultRangeBody },
          ttlMs: 5 * 60 * 1000
        })
          .then(async (resCore) => {
            if (cancelled) return;
            const h = resCore?.headers || null;
            setTickerReturnsDebug({
              source: h?.['x-ticker-returns-source'] || (resCore?.fromCache ? 'frontend-cache' : 'unknown'),
              cacheHit: h?.['x-cache-hit'] || (resCore?.fromCache ? '1' : '0'),
              computeMs: h?.['x-compute-ms'] || '',
              cacheKey: h?.['x-cache-key'] || '',
              mode: 'core-sym',
              symbol: symU
            });
            patchSymReturns(resCore.data);

            const endFromReturns = String(resCore.data?.asOfDate || seedEnd).slice(0, 10);
            if (endFromReturns !== seedEnd) {
              const asOfD = new Date(endFromReturns + 'T12:00:00');
              const start365 = new Date(asOfD);
              start365.setFullYear(start365.getFullYear() - 1);
              const startIso = toIso(start365);
              try {
                const [statsSymRes, statsSpyRes] = await Promise.all([
                  fetchJsonCached({
                    path:
                      '/api/market/ohlc?symbol=' +
                      encodeURIComponent(sym) +
                      '&start_date=' +
                      encodeURIComponent(startIso) +
                      '&end_date=' +
                      encodeURIComponent(endFromReturns) +
                      '&limit=400',
                    method: 'GET',
                    ttlMs: 10 * 60 * 1000
                  }),
                  fetchJsonCached({
                    path:
                      '/api/market/ohlc?symbol=' +
                      encodeURIComponent(BENCHMARK) +
                      '&start_date=' +
                      encodeURIComponent(startIso) +
                      '&end_date=' +
                      encodeURIComponent(endFromReturns) +
                      '&limit=400',
                    method: 'GET',
                    ttlMs: 10 * 60 * 1000
                  })
                ]);
                if (cancelled) return;
                setStatsRows(sortRowsAsc(ohlcRowsFromPayload(statsSymRes.data)));
                setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
              } catch {
                /* keep seeded stats rows */
              }
            }
            clearBusyWhenVisible();
          })
          .catch((e) => {
            if (!cancelled) {
              setReturnsSym(null);
              setError((prev) => prev || e?.message || 'Failed to load returns');
            }
          })
      );

      tasks.push(
        fetchJsonCached({
          path: '/api/market/ticker-core-returns',
          method: 'POST',
          body: { ticker: BENCHMARK, ...defaultRangeBody },
          ttlMs: 5 * 60 * 1000
        })
          .then((res) => {
            if (cancelled) return;
            patchSpyReturns(res.data);
            clearBusyWhenVisible();
          })
          .catch(() => {
            if (!cancelled) setReturnsSpy(null);
          })
      );

      tasks.push(
        fetchJsonCached({
          path: '/api/market/ticker-annual-returns',
          method: 'POST',
          body: { ticker: symU, ...defaultRangeBody },
          ttlMs: 5 * 60 * 1000
        })
          .then((res) => {
            if (cancelled) return;
            patchSymReturns(res.data);
            clearBusyWhenVisible();
          })
          .catch(() => {
            /* non-fatal: core tables still work */
          })
      );
      tasks.push(
        fetchJsonCached({
          path: '/api/market/ticker-quarterly-returns',
          method: 'POST',
          body: { ticker: symU, ...defaultRangeBody },
          ttlMs: 5 * 60 * 1000
        })
          .then((res) => {
            if (cancelled) return;
            patchSymReturns(res.data);
            clearBusyWhenVisible();
          })
          .catch(() => {})
      );
      tasks.push(
        fetchJsonCached({
          path: '/api/market/ticker-monthly-returns',
          method: 'POST',
          body: { ticker: symU, ...defaultRangeBody },
          ttlMs: 5 * 60 * 1000
        })
          .then((res) => {
            if (cancelled) return;
            patchSymReturns(res.data);
            clearBusyWhenVisible();
          })
          .catch(() => {})
      );

      tasks.push(
        fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: 'sp500', period: 'last-1-year' },
          ttlMs: 30 * 60 * 1000
        })
          .then((detailsRes) => {
            if (cancelled) return;
            const d = detailsRes.data;
            setDetailRows(Array.isArray(d?.data) ? d.data : []);
            clearBusyWhenVisible();
          })
          .catch(() => {
            if (!cancelled) setDetailRows([]);
          })
      );

      tasks.push(
        fetchJsonCached({
          path: '/api/market/ohlc?symbol=' + encodeURIComponent(sym) + '&limit=8',
          method: 'GET',
          ttlMs: 60 * 1000
        })
          .then((tailRes) => {
            if (cancelled) return;
            setTailRows(sortRowsAsc(ohlcRowsFromPayload(tailRes.data)));
            clearBusyWhenVisible();
          })
          .catch(() => {
            if (!cancelled) setTailRows([]);
          })
      );

      tasks.push(
        Promise.all([
          fetchJsonCached({
            path:
              '/api/market/ohlc?symbol=' +
              encodeURIComponent(sym) +
              '&start_date=' +
              encodeURIComponent(seedStartIso) +
              '&end_date=' +
              encodeURIComponent(seedEnd) +
              '&limit=400',
            method: 'GET',
            ttlMs: 10 * 60 * 1000
          }),
          fetchJsonCached({
            path:
              '/api/market/ohlc?symbol=' +
              encodeURIComponent(BENCHMARK) +
              '&start_date=' +
              encodeURIComponent(seedStartIso) +
              '&end_date=' +
              encodeURIComponent(seedEnd) +
              '&limit=400',
            method: 'GET',
            ttlMs: 10 * 60 * 1000
          })
        ])
          .then(([statsSymRes, statsSpyRes]) => {
            if (cancelled) return;
            setStatsRows(sortRowsAsc(ohlcRowsFromPayload(statsSymRes.data)));
            setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
            clearBusyWhenVisible();
          })
          .catch(() => {
            if (!cancelled) {
              setStatsRows([]);
              setStatsRowsSpy([]);
            }
          })
      );

      await Promise.allSettled(tasks);
      if (!cancelled) setMetaBusy(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, authVersion, symbolRefreshToken]);

  /** Second (and final) ticker-returns request on load: long table window for page symbol + active section benchmark. */
  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setLongRangeTickerReturns(null);
      setLongRangeBenchReturns(null);
      setLongRangeBusy(false);
      return () => {
        cancelled = true;
      };
    }
    const symU = String(sym || '').toUpperCase().trim();
    const benchU = String(benchForLongTable || '').toUpperCase().trim();
    if (!symU || !benchU) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setLongRangeBusy(true);
      try {
        const longEnd = yesterdayIsoForLongTable();
        const longBody = {
          customStartDate: TABLE_LONG_START_DATE,
          customEndDate: longEnd
        };
        const [symRes, benchRes] = await Promise.all([
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ticker: symU, ...longBody },
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ticker: benchU, ...longBody },
            ttlMs: 5 * 60 * 1000
          })
        ]);
        if (cancelled) return;
        const h = symRes?.headers || null;
        setTickerReturnsDebug({
          source: h?.['x-ticker-returns-source'] || (symRes?.fromCache ? 'frontend-cache' : 'unknown'),
          cacheHit: h?.['x-cache-hit'] || (symRes?.fromCache ? '1' : '0'),
          computeMs: h?.['x-compute-ms'] || '',
          cacheKey: h?.['x-cache-key'] || '',
          mode: 'long-range-table',
          symbol: symU
        });
        setLongRangeTickerReturns(
          pickTickerReturnsFromPayload(symRes.data, symU) || (symRes.data?.ticker ? symRes.data : null)
        );
        setLongRangeBenchReturns(
          pickTickerReturnsFromPayload(benchRes.data, benchU) || (benchRes.data?.ticker ? benchRes.data : null)
        );
      } catch {
        if (!cancelled) {
          setLongRangeTickerReturns(null);
          setLongRangeBenchReturns(null);
        }
      } finally {
        if (!cancelled) setLongRangeBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, benchForLongTable, authVersion, symbolRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setOhlcTickerBounds(null);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const { data } = await fetchJsonCached({
          path: '/api/market/ohlc-ticker-bounds?symbol=' + encodeURIComponent(sym),
          method: 'GET',
          ttlMs: 60 * 60 * 1000
        });
        if (cancelled) return;
        if (data?.success && data.min_date && data.max_date) {
          setOhlcTickerBounds({ min: String(data.min_date).slice(0, 10), max: String(data.max_date).slice(0, 10) });
        } else {
          setOhlcTickerBounds(null);
        }
      } catch {
        if (!cancelled) setOhlcTickerBounds(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sym, authVersion, symbolRefreshToken]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setChartLoading(false);
      setOhlcRows([]);
      return;
    }

    (async () => {
      setChartLoading(true);
      setOhlcRows([]);
      try {
        const { start, end } = chartApiRange;
        const ohlcRes = await fetchJsonCached({
          path: '/api/market/ohlc-signals-indicator',
          method: 'POST',
          body: { ticker: sym, start_date: start, end_date: end },
          ttlMs: 2 * 60 * 1000
        });
        if (cancelled) return;
        const rows = Array.isArray(ohlcRes.data?.data) ? ohlcRes.data.data : [];
        setOhlcRows(sortRowsAsc(rows));
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load chart');
          setOhlcRows([]);
        }
      } finally {
        if (!cancelled) setChartLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, timeframe, asOfDate, authVersion, chartApiRange.start, chartApiRange.end, symbolRefreshToken]);

  useEffect(() => {
    setNewsPage(1);
  }, [sym]);

  const newsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(liveNews.length / NEWS_PAGE_SIZE)),
    [liveNews.length]
  );
  const newsPageSafe = Math.min(Math.max(1, newsPage), newsTotalPages);
  const newsPageItems = useMemo(() => {
    const start = (newsPageSafe - 1) * NEWS_PAGE_SIZE;
    return liveNews.slice(start, start + NEWS_PAGE_SIZE);
  }, [liveNews, newsPageSafe]);

  const myDetail = useMemo(() => {
    const u = sym.toUpperCase();
    for (const r of detailRows) {
      const s = String(r.Symbol || r.symbol || '')
        .toUpperCase()
        .trim();
      if (s === u) return r;
    }
    return null;
  }, [detailRows, sym]);

  const company =
    String(myDetail?.Security || myDetail?.security || '').trim() || `${sym} — company name unavailable`;
  const sector = String(myDetail?.Sector || myDetail?.sector || '').trim();
  const industry = String(myDetail?.Industry || myDetail?.industry || '').trim();
  const indexLabel = String(myDetail?.Index || myDetail?.index || '').trim() || 'US';
  const relatedTickersSourceLabel = describeTickerIndex(indexLabel);

  const competitors = useMemo(
    () => pickCompetitors(detailRows, sym, sector, 6),
    [detailRows, sym, sector]
  );

  const dynamicSym = returnsSym?.performance?.dynamicPeriods || [];
  const dynamicSpy = returnsSpy?.performance?.dynamicPeriods || [];
  const annualReturnsRaw = returnsSym?.performance?.annualReturns;
  const quarterlyReturnsRaw = returnsSym?.performance?.quarterlyReturns;
  const monthlyReturnsRaw = returnsSym?.performance?.monthlyReturns;
  const tickerSelectOptions = useMemo(() => {
    const base = [sym, BENCHMARK, ...(detailRows || []).map((r) => String(r.symbol || '').toUpperCase().trim())];
    return [...new Set(base.filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [sym, detailRows]);

  const sortedChart = useMemo(() => sortRowsAsc(ohlcRows), [ohlcRows]);

  useEffect(() => {
    const sync = () => {
      const el = chartBodyRef.current;
      const d = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
      setChartFs(!!el && (document.fullscreenElement === el || d.webkitFullscreenElement === el));
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  useLayoutEffect(() => {
    if (!chartFs) {
      setFsPlotH(0);
      return;
    }
    const el = chartPlotHostRef.current;
    if (!el) return;
    const apply = () => {
      const h = Math.round(el.clientHeight);
      setFsPlotH(Math.max(CHART_H_MIN, h));
    };
    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    apply();
    return () => ro.disconnect();
  }, [chartFs, sortedChart.length, mainChartType, chartLoading]);

  const onChartResizePointerDown = useCallback(
    (e) => {
      if (chartFs) return;
      e.preventDefault();
      const startH = userChartHeight ?? mediaChartHeight;
      resizeDragRef.current = { active: true, startY: e.clientY, startH };
      const onMove = (ev) => {
        const drag = resizeDragRef.current;
        if (!drag?.active) return;
        const dy = ev.clientY - drag.startY;
        const next = Math.round(Math.max(CHART_H_MIN, Math.min(CHART_H_MAX, drag.startH + dy)));
        setUserChartHeight(next);
      };
      const onUp = () => {
        if (resizeDragRef.current) resizeDragRef.current.active = false;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        setUserChartHeight((prev) => {
          const v = prev == null ? mediaHRef.current : prev;
          try {
            localStorage.setItem(CHART_USER_H_KEY, String(v));
          } catch {
            /* ignore */
          }
          return prev;
        });
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [chartFs, userChartHeight, mediaChartHeight]
  );

  const onChartResizeDoubleClick = useCallback((e) => {
    e.preventDefault();
    try {
      localStorage.removeItem(CHART_USER_H_KEY);
    } catch {
      /* ignore */
    }
    setUserChartHeight(null);
  }, []);

  const toggleChartFullscreen = useCallback(async () => {
    const el = chartBodyRef.current;
    if (!el) return;
    const d = /** @type {Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element | null }} */ (
      document
    );
    const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement;
    try {
      if (fsEl === el) {
        if (d.exitFullscreen) await d.exitFullscreen();
        else d.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        /** @type {{ webkitRequestFullscreen?: () => void }} */
        (el).webkitRequestFullscreen?.();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const lastRow = sortedChart.length ? sortedChart[sortedChart.length - 1] : null;
  const prevRow = sortedChart.length > 1 ? sortedChart[sortedChart.length - 2] : null;
  const lastClose = lastRow ? pickNum(lastRow, ['Close', 'close']) : null;
  const prevClose = prevRow ? pickNum(prevRow, ['Close', 'close']) : null;
  const dayChg =
    lastClose != null && prevClose != null && prevClose !== 0 ? ((lastClose - prevClose) / prevClose) * 100 : null;
  const dayAbs = lastClose != null && prevClose != null ? lastClose - prevClose : null;
  const lastSignal = lastRow && lastRow.signal != null ? String(lastRow.signal) : 'N';
  const activeBucket = signalBucket(lastSignal);

  const statsSorted = useMemo(() => sortRowsAsc(statsRows), [statsRows]);
  const statsSpySorted = useMemo(() => sortRowsAsc(statsRowsSpy), [statsRowsSpy]);
  const highs = statsSorted.map((r) => pickNum(r, ['High', 'high'])).filter((v) => v != null);
  const lows = statsSorted.map((r) => pickNum(r, ['Low', 'low'])).filter((v) => v != null);
  const vols = statsSorted.map((r) => pickNum(r, ['Volume', 'volume', 'VOLUME'])).filter((v) => v != null);
  const statCloses = statsSorted.map((r) => pickNum(r, ['Close', 'close'])).filter((v) => v != null);

  const hi52 = highs.length ? Math.max(...highs) : null;
  const lo52 = lows.length ? Math.min(...lows) : null;
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
  const vola = annualizedVol(statCloses);

  const lastUpdatedIso = lastRow ? rowDateToTimeKey(lastRow) : asOfDate;
  const lastUpdatedFmt =
    lastUpdatedIso && !Number.isNaN(Date.parse(lastUpdatedIso))
      ? new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'America/New_York',
          timeZoneName: 'short'
        }).format(new Date(lastUpdatedIso + 'T16:00:00'))
      : '—';

  const tailSorted = useMemo(() => sortRowsAsc(tailRows), [tailRows]);
  const tLast = tailSorted.length ? tailSorted[tailSorted.length - 1] : null;
  const tPrev = tailSorted.length > 1 ? tailSorted[tailSorted.length - 2] : null;
  const tLastClose = tLast ? pickNum(tLast, ['Close', 'close']) : null;
  const tPrevClose = tPrev ? pickNum(tPrev, ['Close', 'close']) : null;
  const useTailForHeader = tailSorted.length >= 2 && tLastClose != null && tPrevClose != null;
  const headerClose = useTailForHeader ? tLastClose : lastClose;
  const headerPrev = useTailForHeader ? tPrevClose : prevClose;
  const headerChgPct =
    headerClose != null && headerPrev != null && headerPrev !== 0
      ? ((headerClose - headerPrev) / headerPrev) * 100
      : dayChg;
  const headerChgAbs =
    headerClose != null && headerPrev != null ? headerClose - headerPrev : dayAbs;

  const symMtd = mtdFromRows(statsSorted);
  const spyMtd = mtdFromRows(statsSpySorted);
  const symQtd = qtdFromRows(statsSorted);
  const spyQtd = qtdFromRows(statsSpySorted);

  useEffect(() => {
    setRelativeTickerSymbol(sym);
  }, [sym]);

  useEffect(() => {
    const symKey = String(sym || '').toUpperCase().trim();
    setRelativeTickerSeriesBySymbol((prev) => ({
      ...prev,
      [symKey]: { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd },
      [BENCHMARK]: { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd }
    }));
  }, [sym, dynamicSym, symMtd, symQtd, dynamicSpy, spyMtd, spyQtd]);

  const loadRelativeTickerSeries = useCallback(
    async (tickerInput) => {
      const ticker = String(tickerInput || '').toUpperCase().trim();
      const symU = String(sym || '').toUpperCase().trim();
      if (!ticker || !getAuthToken()) return null;
      if (ticker === symU && returnsSym?.performance) {
        return {
          dynamicPeriods: returnsSym.performance.dynamicPeriods || [],
          mtd: symMtd,
          qtd: symQtd
        };
      }
      const returnsDefaultEnd = toDateInput(new Date());
      const ret = await fetchJsonCached({
        path: '/api/market/ticker-returns',
        method: 'POST',
        body: { ticker, customStartDate: RETURNS_DEFAULT_START, customEndDate: returnsDefaultEnd },
        ttlMs: 15 * 60 * 1000
      });
      const asOf = String(ret?.data?.asOfDate || asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const asOfD = new Date(asOf + 'T12:00:00');
      const start = new Date(asOfD);
      start.setFullYear(start.getFullYear() - 1);
      const startIso = toIso(start);
      const rowsRes = await fetchJsonCached({
        path:
          '/api/market/ohlc?symbol=' +
          encodeURIComponent(ticker) +
          '&start_date=' +
          encodeURIComponent(startIso) +
          '&end_date=' +
          encodeURIComponent(asOf) +
          '&limit=400',
        method: 'GET',
        ttlMs: 10 * 60 * 1000
      });
      const rows = sortRowsAsc(ohlcRowsFromPayload(rowsRes.data));
      return {
        dynamicPeriods: ret?.data?.performance?.dynamicPeriods || [],
        mtd: mtdFromRows(rows),
        qtd: qtdFromRows(rows)
      };
    },
    [asOfDate, sym, returnsSym, symMtd, symQtd]
  );

  const loadRelativeIndexSeries = useCallback(
    async (indexKey) => {
      if (!getAuthToken()) return null;
      const opt = RELATIVE_INDEX_OPTIONS.find((x) => x.key === indexKey) || RELATIVE_INDEX_OPTIONS[0];
      const idx = await fetchJsonCached({
        path: '/api/market/index-returns',
        method: 'POST',
        body: { index: opt.apiIndex },
        ttlMs: 10 * 60 * 1000
      });
      const d = idx?.data || {};
      const asOf = String(d?.asOfDate || asOfDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const asOfD = new Date(asOf + 'T12:00:00');
      const start = new Date(asOfD);
      start.setFullYear(start.getFullYear() - 1);
      const startIso = toIso(start);
      const symForOhlc =
        (d?.officialIndexTicker && String(d.officialIndexTicker).trim()) ||
        (d?.ticker && String(d.ticker).trim()) ||
        '';
      let rows = [];
      if (symForOhlc) {
        const rowsRes = await fetchJsonCached({
          path:
            '/api/market/ohlc?symbol=' +
            encodeURIComponent(symForOhlc) +
            '&start_date=' +
            encodeURIComponent(startIso) +
            '&end_date=' +
            encodeURIComponent(asOf) +
            '&limit=400',
          method: 'GET',
          ttlMs: 10 * 60 * 1000
        });
        rows = sortRowsAsc(ohlcRowsFromPayload(rowsRes.data));
      } else {
        const syntheticRows = sortRowsAsc(
          closeSeriesToChartRows(Array.isArray(d?.syntheticCloseSeries) ? d.syntheticCloseSeries : [])
        );
        rows = syntheticRows.filter((r) => {
          const iso = rowDateToTimeKey(r);
          return iso && iso >= startIso && iso <= asOf;
        });
      }
      return {
        dynamicPeriods: d?.performance?.dynamicPeriods || [],
        mtd: mtdFromRows(rows),
        qtd: qtdFromRows(rows)
      };
    },
    [asOfDate]
  );

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) return () => {};
    const needsIndex = !relativeIndexSeriesByKey[relativeIndexKey];
    const tickerKey = String(relativeTickerSymbol || '').toUpperCase().trim();
    const symKey = String(sym || '').toUpperCase().trim();
    const needsTicker = !!tickerKey && !relativeTickerSeriesBySymbol[tickerKey];
    const deferTickerUntilMainReturns = tickerKey !== '' && tickerKey === symKey && !returnsSym;
    if (!needsIndex && (!needsTicker || deferTickerUntilMainReturns)) return () => {};
    (async () => {
      setRelativeCompareBusy(true);
      try {
        if (needsIndex) {
          const idxSeries = await loadRelativeIndexSeries(relativeIndexKey);
          if (!cancelled && idxSeries) {
            setRelativeIndexSeriesByKey((prev) => ({ ...prev, [relativeIndexKey]: idxSeries }));
          }
        }
        if (needsTicker && !deferTickerUntilMainReturns) {
          const tkSeries = await loadRelativeTickerSeries(tickerKey);
          if (!cancelled && tkSeries) {
            setRelativeTickerSeriesBySymbol((prev) => ({ ...prev, [tickerKey]: tkSeries }));
          }
        }
      } finally {
        if (!cancelled) setRelativeCompareBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    relativeIndexKey,
    relativeTickerSymbol,
    relativeIndexSeriesByKey,
    relativeTickerSeriesBySymbol,
    loadRelativeIndexSeries,
    loadRelativeTickerSeries,
    sym,
    returnsSym
  ]);

  const selectedIndexSeries = relativeIndexSeriesByKey[relativeIndexKey] || { dynamicPeriods: [], mtd: null, qtd: null };
  const selectedTickerKey = String(relativeTickerSymbol || '').toUpperCase().trim();
  const selectedTickerSeries =
    relativeTickerSeriesBySymbol[selectedTickerKey] || { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
  const selectedIndexLabel =
    RELATIVE_INDEX_OPTIONS.find((x) => x.key === relativeIndexKey)?.label || RELATIVE_INDEX_OPTIONS[0].label;

  const section16Rows = useMemo(() => {
    const compact = COMPARE_ROWS.filter((r) => ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD'].includes(r.key));
    return compact.map((row) => {
      const symPct = row.period
        ? pickDynamic(selectedIndexSeries.dynamicPeriods, row.period)
        : row.mtd
          ? selectedIndexSeries.mtd
          : row.qtd
            ? selectedIndexSeries.qtd
            : null;
      const tkPct = row.period
        ? pickDynamic(selectedTickerSeries.dynamicPeriods, row.period)
        : row.mtd
          ? selectedTickerSeries.mtd
          : row.qtd
            ? selectedTickerSeries.qtd
            : null;
      const diff =
        symPct != null && tkPct != null && Number.isFinite(symPct) && Number.isFinite(tkPct)
          ? symPct - tkPct
          : null;
      return { label: row.key, value: diff, symPct, tkPct, diff };
    });
  }, [selectedIndexSeries, selectedTickerSeries]);

  const section17CompareRows = useMemo(() => {
    const compact = COMPARE_ROWS.filter((r) => ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD'].includes(r.key));
    return compact.map((row) => {
      const symPct = row.period
        ? pickDynamic(selectedIndexSeries.dynamicPeriods, row.period)
        : row.mtd
          ? selectedIndexSeries.mtd
          : row.qtd
            ? selectedIndexSeries.qtd
            : null;
      const spyPct = row.period
        ? pickDynamic(selectedTickerSeries.dynamicPeriods, row.period)
        : row.mtd
          ? selectedTickerSeries.mtd
          : row.qtd
            ? selectedTickerSeries.qtd
            : null;
      const diff =
        symPct != null && spyPct != null && Number.isFinite(symPct) && Number.isFinite(spyPct)
          ? symPct - spyPct
          : null;
      return { label: row.key, symPct, spyPct, diff };
    });
  }, [selectedIndexSeries, selectedTickerSeries]);

  const basePixelHeight = userChartHeight ?? mediaChartHeight;
  const plotHeight = chartFs && fsPlotH >= CHART_H_MIN ? fsPlotH : basePixelHeight;

  const chartRangeLabel = chartApiRange.start + ' → ' + chartApiRange.end;
  const chartModeHelp = appliedCustomRange
    ? 'Using your custom start/end (overrides the pill timeframe until you reset).'
    : `Using pill timeframe “${timeframe}”, anchored to as-of ${asOfDate}.`;

  return (
    <div className="ticker-page">
      <div className="ticker-page__search-row">
        <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId="ticker-dash-symbol" />
        <DataInfoTip align="start">
          <p className="ticker-data-tip__p">
            <strong>Ticker selection</strong> drives every request on this page for one symbol.
          </p>
          <p className="ticker-data-tip__p">
            Search uses <code className="ticker-data-tip__code">GET /api/tickers/search</code> (Supabase{' '}
            <code className="ticker-data-tip__code">tickers</code>). Picking a symbol reloads chart, returns, OHLC
            tail, and index metadata for that symbol.
          </p>
        </DataInfoTip>
        {metaBusy || chartLoading ? <span className="ticker-page__loading-pill">Loading…</span> : null}
      </div>

      {error ? (
        <div className="ticker-page__error" role="alert">
          {error}
        </div>
      ) : null}
      {/* {tickerReturnsDebug ? (
        <div className="ticker-page__error" role="status" style={{ marginTop: 8, marginBottom: 8 }}>
          ticker-returns debug: source={tickerReturnsDebug.source || '—'} | cache_hit={tickerReturnsDebug.cacheHit || '—'} | compute_ms=
          {tickerReturnsDebug.computeMs || '—'} | mode={tickerReturnsDebug.mode || '—'} | symbol={tickerReturnsDebug.symbol || '—'}
        </div>
      ) : null} */}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="ticker-page__header-top">
          <div className="ticker-page__header-identity">
            <h1 className="ticker-page__company ticker-page__company--hero">{company}</h1>
            <span className="ticker-page__header-identity-meta">
              <IconFlagUs className="ticker-page__flag" />
              <span className="ticker-page__exchange">{indexLabel || '—'}</span>
            </span>
            <DataInfoTip align="start">
              <p className="ticker-data-tip__p">
                <strong>Header price</strong> prefers the last two sessions from{' '}
                <code className="ticker-data-tip__code">GET /api/market/ohlc?symbol=…&amp;limit=8</code> (daily table:
                Open, High, Low, <strong>Close</strong>, Volume when present).
              </p>
              <p className="ticker-data-tip__p">
                Day change is the latest <strong>Close</strong> minus the previous session <strong>Close</strong>. If
                that tail is missing, the last two rows inside the loaded chart range are used instead.
              </p>
            </DataInfoTip>
          </div>
          <div className="ticker-page__header-actions">
            <button type="button" className="ticker-outline-btn">
              <IconBell className="ticker-outline-btn__ico" /> My Alerts
            </button>
            <button type="button" className="ticker-outline-btn">
              <IconPlus className="ticker-outline-btn__ico" /> In My Watchlists
            </button>
            <button type="button" className="ticker-outline-btn">
              <IconDocument className="ticker-outline-btn__ico" /> My Notes
            </button>
            <button type="button" className="ticker-outline-btn">
              <IconPencil className="ticker-outline-btn__ico" /> Quotebox
            </button>
          </div>
        </div>

        <div className="ticker-page__header-metrics" role="presentation">
          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-price-line">
              <span className="ticker-page__sym">{sym}</span>
              <span className="ticker-page__px ticker-page__px--hero">{formatPx(headerClose)}</span>
              <span className="ticker-page__ccy">USD</span>
            </div>
            <div className="ticker-page__metric-change">
              {headerChgPct != null && Number.isFinite(headerChgPct) ? (
                <span className={'ticker-num ' + pctClass(headerChgPct)}>
                  {headerChgAbs != null && Number.isFinite(headerChgAbs) ? (
                    <>
                      {(headerChgAbs >= 0 ? '+' : '') + formatPx(headerChgAbs)}{' '}
                    </>
                  ) : null}
                  ({formatPct(headerChgPct)})
                </span>
              ) : (
                <span className="ticker-page__metric-change--muted">—</span>
              )}
            </div>
            <p className="ticker-page__metric-label">Last Updated • {lastUpdatedFmt}</p>
          </div>

          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-price-line ticker-page__metric-price-line--sm">
              <span className="ticker-page__metric-ghost">—</span>
              <span className="ticker-page__ccy">USD</span>
            </div>
            <div className="ticker-page__metric-change">
              <span className="ticker-page__metric-change--muted">—</span>
            </div>
            <p className="ticker-page__metric-label">Before Market • Intraday feed not connected</p>
          </div>

          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-value-row">
              <span className="ticker-page__metric-value">Not available from API</span>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>Earnings</strong> dates are not returned by the current ticker-details payload on this page.
                </p>
              </DataInfoTip>
            </div>
            <p className="ticker-page__metric-label">Next Earnings Date</p>
          </div>

          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-value-row">
              <span className="ticker-page__metric-value">{sector || '—'}</span>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>Sector / industry</strong> come from <code className="ticker-data-tip__code">POST /api/market/ticker-details</code> with index{' '}
                  <code className="ticker-data-tip__code">sp500</code> / period <code className="ticker-data-tip__code">last-1-year</code>, merged from the
                  TickerDetails-style BigQuery view plus Supabase company-name backfill when needed.
                </p>
                <p className="ticker-data-tip__p">These are classification fields, not live market quotes.</p>
              </DataInfoTip>
            </div>
            <p className="ticker-page__metric-label">Sector</p>
          </div>

          <div className="ticker-page__header-metric">
            <p className="ticker-page__metric-value ticker-page__metric-value--multiline">{industry || '—'}</p>
            <p className="ticker-page__metric-label">Industry</p>
          </div>

          <div className="ticker-page__header-metric ticker-page__header-metric--mcap">
            <div className="ticker-page__metric-mcap-row">
              <div>
                <p className="ticker-page__metric-value">—</p>
                <p className="ticker-page__metric-label">Market Cap</p>
              </div>
              <button type="button" className="ticker-page__metric-chev" aria-label="More on market cap">
                <IconChevronRight className="ticker-page__metric-chev-ico" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <section className="ticker-card ticker-card--main-chart" aria-labelledby="snapshot-chart-title">
            <div className="ticker-chart-toolbar">
              <ChartToolbarIcons />
              <ChartTypeToolbarDropdown chartType={mainChartType} onChartTypeChange={setMainChartType} />
              <div className="ticker-chart-toolbar__sep" />
              <button type="button" className="ticker-chart-toolbar__pill">
                Indicators <IconChevronDown className="ticker-chart-toolbar__chev" />
              </button>
              <button type="button" className="ticker-chart-toolbar__iconbtn" aria-label="Layout">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="8" height="8" rx="1" />
                  <rect x="13" y="3" width="8" height="8" rx="1" />
                  <rect x="3" y="13" width="8" height="8" rx="1" />
                  <rect x="13" y="13" width="8" height="8" rx="1" />
                </svg>
              </button>
              <button type="button" className="ticker-chart-toolbar__iconbtn" aria-label="Alert">
                <IconBell className="ticker-chart-toolbar__bell" />
              </button>
              <button type="button" className="ticker-chart-toolbar__pill">
                Replay
              </button>
              <span className="ticker-chart-toolbar__grow" />
              <button type="button" className="ticker-chart-toolbar__iconbtn" aria-label="Undo">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M9 14L4 9l5-5M4 9h11a4 4 0 0 1 4 4v1" />
                </svg>
              </button>
              <button type="button" className="ticker-chart-toolbar__iconbtn" aria-label="Redo">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 14l5-5-5-5M20 9H9a4 4 0 0 0-4 4v1" />
                </svg>
              </button>
            </div>

            <div className="ticker-card__head">
              <div className="ticker-card__title-with-tip">
                <button type="button" className="ticker-card__title-btn" id="snapshot-chart-title">
                  Snapshot Chart
                  <IconChevronDown className="ticker-card__title-chev" />
                </button>
                <DataInfoTip align="end">
                  <p className="ticker-data-tip__p">
                    <strong>Chart</strong>: TradingView <strong>Lightweight Charts™</strong> (open-source, Apache-2.0) —
                    main series is <strong>user-selectable</strong> (trend icon in the chart toolbar): <strong>Line</strong> / <strong>Area</strong> (Close),{' '}
                    <strong>Candles</strong>, or <strong>Bars</strong> (OHLC), plus volume histogram. Pan / zoom as usual.
                  </p>
                  <p className="ticker-data-tip__p">
                    <strong>API:</strong> <code className="ticker-data-tip__code">POST /api/market/ohlc-signals-indicator</code>. Line &amp; area plot{' '}
                    <strong>Close</strong>; candles &amp; bars use full OHLC. Crosshair reads the same row. <strong>Volume</strong> when present;{' '}
                    <strong>signal</strong> joined on <strong>Date</strong> on the server.
                  </p>
                  <p className="ticker-data-tip__p">
                    <strong>Window:</strong> {chartRangeLabel}. {chartModeHelp} Long ranges are clipped to {MAX_SIGNAL_RANGE_DAYS} calendar days to satisfy the API
                    guard.
                  </p>
                </DataInfoTip>
              </div>
              <div className="ticker-page__search-row">
                <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId="ticker-chart-symbol" />
                <DataInfoTip align="start">
                  <p className="ticker-data-tip__p">
                    <strong>Ticker selection</strong> drives every request on this page for one symbol.
                  </p>
                  <p className="ticker-data-tip__p">
                    Search uses <code className="ticker-data-tip__code">GET /api/tickers/search</code> (Supabase{' '}
                    <code className="ticker-data-tip__code">tickers</code>). Picking a symbol reloads chart, returns, OHLC
                    tail, and index metadata for that symbol.
                  </p>
                </DataInfoTip>
                {metaBusy || chartLoading ? <span className="ticker-page__loading-pill">Loading…</span> : null}
              </div>
              <div className="ticker-tf-with-tip">
                <div className="ticker-tf-row">
                  {TIMEFRAMES.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      className={
                        'ticker-tf' +
                        (!appliedCustomRange && tf === timeframe ? ' ticker-tf--active' : '')
                      }
                      onClick={() => {
                        setAppliedCustomRange(null);
                        setTimeframe(tf);
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
                <DataInfoTip align="end">
                  <p className="ticker-data-tip__p">
                    <strong>Timeframe pills</strong> only change the chart when you are not using an applied custom date
                    range.
                  </p>
                  <p className="ticker-data-tip__p">
                    Each pill maps to an inclusive <code className="ticker-data-tip__code">[start_date, end_date]</code>{' '}
                    ending on returns <strong>asOfDate</strong>. <strong>1D</strong> = last <strong>3</strong> Mon–Fri sessions;{' '}
                    <strong>5D</strong> = last <strong>5</strong> Mon–Fri sessions (not 3+ weeks of calendar days). Other
                    ranges use calendar rules as before.
                  </p>
                </DataInfoTip>
              </div>
              <div className="ticker-page__custom-range">
                <span className="ticker-page__label ticker-page__label--inline">Start date</span>
                <input
                  type="date"
                  className="ticker-page__date-inp"
                  value={draftChartStart}
                  onChange={(e) => setDraftChartStart(e.target.value)}
                  max={draftChartEnd || asOfDate}
                />
                <span className="ticker-page__label ticker-page__label--inline">End date</span>
                <input
                  type="date"
                  className="ticker-page__date-inp"
                  value={draftChartEnd}
                  onChange={(e) => setDraftChartEnd(e.target.value)}
                  min={draftChartStart}
                  max={asOfDate}
                />
                <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={applyCustomChartRange}>
                  Submit
                </button>
                <button type="button" className="ticker-outline-btn ticker-outline-btn--sm" onClick={resetCustomChartRange}>
                  Use timeframe
                </button>
                <DataInfoTip align="start">
                  <p className="ticker-data-tip__p">
                    <strong>Custom range</strong> sends your dates as <code className="ticker-data-tip__code">start_date</code> and{' '}
                    <code className="ticker-data-tip__code">end_date</code> on the same OHLC+signals endpoint as the chart.
                  </p>
                  <p className="ticker-data-tip__p">
                    End date is clamped to <strong>{asOfDate}</strong> (latest available close from returns). If start
                    &gt; end they are swapped. The span is clipped to the backend maximum ({MAX_SIGNAL_RANGE_DAYS} days).
                  </p>
                  <p className="ticker-data-tip__p">
                    <strong>Submit</strong> locks this window; <strong>Use timeframe</strong> clears the lock and returns to the pill mapping.
                  </p>
                </DataInfoTip>
              </div>
            </div>

            <div ref={chartBodyRef} className="ticker-chart-body">
              <div className="ticker-chart-legend">
                <span className="ticker-chart-legend__sym">{sym}</span>
                <span className="ticker-chart-legend__name">{company}</span>
                <span>{formatPx(headerClose)} USD</span>
                {headerChgPct != null && Number.isFinite(headerChgPct) ? (
                  <span className={'ticker-num ' + pctClass(headerChgPct)}>{formatPct(headerChgPct)}</span>
                ) : null}
                <span className="ticker-chart-legend__sig">Signal: {lastSignal}</span>
              </div>
              <div
                ref={chartPlotHostRef}
                className={'ticker-chart-plot-host' + (chartFs ? ' ticker-chart-plot-host--fs' : '')}
                style={chartFs ? undefined : { height: basePixelHeight }}
              >
                {chartLoading && sortedChart.length === 0 ? (
                  <div
                    className="chart-viz-loading-wrap"
                    style={{
                      minHeight: Math.max(
                        CHART_H_MIN,
                        chartFs && fsPlotH >= CHART_H_MIN ? fsPlotH : basePixelHeight
                      )
                    }}
                  >
                    <TradingChartLoader label="Loading chart…" sublabel={`${sym} · OHLC & signals`} />
                  </div>
                ) : sortedChart.length ? (
                  <TickerLightweightChart rows={sortedChart} height={plotHeight} chartType={mainChartType} />
                ) : (
                  <div className="ticker-sparkline ticker-sparkline--empty">No OHLC rows in this range.</div>
                )}
              </div>
              <div className="ticker-chart-footer-icons">
                <button type="button" className="ticker-chart-footer-icons__btn" aria-label="Settings">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="ticker-chart-footer-icons__btn"
                  onClick={() => toggleChartFullscreen()}
                  aria-pressed={chartFs}
                  aria-label={chartFs ? 'Exit chart fullscreen' : 'Enter chart fullscreen'}
                >
                  {chartFs ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M4 14v6h6M20 14v6h-6M4 10V4h6M20 10V4h-6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6" />
                    </svg>
                  )}
                </button>
              </div>
              {!chartFs ? (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  aria-valuemin={CHART_H_MIN}
                  aria-valuemax={CHART_H_MAX}
                  aria-valuenow={basePixelHeight}
                  className="ticker-chart-resize"
                  title="Drag to resize chart height. Double-click to reset."
                  onPointerDown={onChartResizePointerDown}
                  onDoubleClick={onChartResizeDoubleClick}
                />
              ) : null}
            </div>
          </section>

          <section className="ticker-card ticker-card--news" aria-labelledby="ticker-news-h">
            <div className="ticker-card__h-with-tip">
              <h2 className="ticker-card__h ticker-card__h--flex" id="ticker-news-h">
                News
              </h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>News</strong> below comes from Finnhub general trading category via REST API.
                </p>
                <p className="ticker-data-tip__p">This list is market-wide and refreshes every 30 seconds.</p>
              </DataInfoTip>
            </div>
            {newsBusy ? <p className="ticker-page__news-sample-note">Loading general trading news…</p> : null}
            {!newsBusy && newsError ? <p className="ticker-page__news-sample-note">{newsError}</p> : null}
            {!newsBusy && !newsError && !liveNews.length ? (
              <p className="ticker-page__news-sample-note">No general trading headlines yet.</p>
            ) : null}
            <ul className="ticker-news-list">
              {newsPageItems.map((n) => (
                <li key={n.id} className="ticker-news-list__li">
                  <a
                    className="ticker-news-list__a"
                    href={n.url || '#ticker-news-h'}
                    onClick={(e) => {
                      if (!n.url) e.preventDefault();
                    }}
                    target={n.url ? '_blank' : undefined}
                    rel={n.url ? 'noopener noreferrer' : undefined}
                  >
                    {n.title}
                  </a>
                  <span className="ticker-news-list__meta">
                    {n.source}
                    <br />
                    {n.time}
                  </span>
                </li>
              ))}
            </ul>
            {liveNews.length > NEWS_PAGE_SIZE ? (
              <div className="ticker-news-pagination" aria-label="News pagination">
                <button
                  type="button"
                  className="ticker-outline-btn"
                  disabled={newsPageSafe <= 1}
                  onClick={() => setNewsPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="ticker-news-pagination__label">
                  Page {newsPageSafe} of {newsTotalPages}
                </span>
                <button
                  type="button"
                  className="ticker-outline-btn"
                  disabled={newsPageSafe >= newsTotalPages}
                  onClick={() => setNewsPage((p) => Math.min(newsTotalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            ) : null}
          </section>

          <TickerAnnualReturnsFigma
            symbol={sym}
            annualReturns={annualReturnsRaw}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_ANNUAL_FIGMA}
            resizeDefaultHeight={260}
          />
          <TickerChartResizeScope storageKey={RESIZE_KEY_ANNUAL_POSNEG} defaultHeight={260}>
            <TickerAnnualReturnsPosNeg symbol={sym} annualReturns={annualReturnsRaw} asOfDate={asOfDate} />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_QUARTERLY} defaultHeight={288}>
            <TickerQuarterlyReturnsChart symbol={sym} quarterlyReturns={quarterlyReturnsRaw} asOfDate={asOfDate} />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_MONTHLY} defaultHeight={278}>
            <TickerMonthlyReturnsChart symbol={sym} monthlyReturns={monthlyReturnsRaw} asOfDate={asOfDate} />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_MONTHLY_ADV} defaultHeight={300}>
            <TickerMonthlyReturnsWaterfallDonut
              key={sym}
              symbol={sym}
              monthlyReturns={monthlyReturnsRaw}
              asOfDate={asOfDate}
            />
          </TickerChartResizeScope>
          <div className="ticker-subh-with-tip" style={{ marginTop: 6, marginBottom: 10 }}>
            <h3 className="ticker-subh ticker-subh--flex">Relative Strength selector</h3>
            <DataInfoTip align="start">
              <p className="ticker-data-tip__p">
                Choose one index and one ticker; relative strength is shown as <strong>index return − ticker return</strong>.
              </p>
            </DataInfoTip>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <select
              className="ticker-page__date-inp"
              value={relativeIndexKey}
              onChange={(e) => setRelativeIndexKey(e.target.value)}
              style={{ minWidth: 220 }}
            >
              {RELATIVE_INDEX_OPTIONS.map((opt) => (
                <option key={`rs-index-${opt.key}`} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="ticker-page__date-inp"
              value={relativeTickerSymbol}
              onChange={(e) => setRelativeTickerSymbol(e.target.value)}
              style={{ minWidth: 220 }}
            >
              {tickerSelectOptions.map((opt) => (
                <option key={`rs-ticker-${opt}`} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            {relativeCompareBusy ? <span className="ticker-page__loading-pill">Loading relative strength…</span> : null}
          </div>
          <TickerSection16Section17
            rows={section16Rows}
            compareRows={section17CompareRows}
            relativeStrengthTitle={`Relative Strength vs ${selectedTickerKey || relativeTickerSymbol}`}
            relativeStrengthHeader={`Relative Strength (${selectedIndexLabel} - ${selectedTickerKey || relativeTickerSymbol})`}
          />
          <TickerSection23Section24
            pageSymbol={sym}
            prefetchedLongTickerReturns={longRangeTickerReturns}
            prefetchedLongBenchReturns={longRangeBenchReturns}
            prefetchedLongBenchSymbol={benchForLongTable}
            prefetchedLongBusy={longRangeBusy}
            onSectionBenchmarkSymbolChange={onSectionBenchmarkSymbolChange}
            initialSp500Rows={detailRows}
          />
        </div>

        <aside className="ticker-page__aside">
          <section className="ticker-card ticker-card--signal" aria-labelledby="odin-signal-h">
            <div className="ticker-signal-head">
              <span className="ticker-signal-logo" aria-hidden />
              <h2 className="ticker-card__h ticker-card__h--inline" id="odin-signal-h">
                Odin Signal
              </h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>Highlighted ladder step</strong> is derived from the <strong>last row</strong> of the chart
                  payload (same request as the sparkline).
                </p>
                <p className="ticker-data-tip__p">
                  Field: <code className="ticker-data-tip__code">signal</code> on each day, normalized server-side and
                  grouped visually into L1–L3, S1–S3, or N (e.g. L11 maps into the L1 bucket).
                </p>
                <p className="ticker-data-tip__p">As-of follows the last chart date shown below the title.</p>
              </DataInfoTip>
            </div>
            <p className="ticker-signal-asof">As of {lastUpdatedFmt}</p>
            <div className="ticker-signal-lanes" role="list">
              {[
                { k: 'L1', tone: 'green-dark' },
                { k: 'L2', tone: 'green-dark' },
                { k: 'L3', tone: 'green-bright' },
                { k: 'S1', tone: 'orange' },
                { k: 'S2', tone: 'orange-mid' },
                { k: 'S3', tone: 'amber' },
                { k: 'N', tone: 'gray' }
              ].map((s) => (
                <div
                  key={s.k}
                  className={
                    'ticker-signal-cell ticker-signal-cell--' +
                    s.tone +
                    (activeBucket === s.k ? ' ticker-signal-cell--active' : '')
                  }
                  role="listitem"
                >
                  {s.k}
                </div>
              ))}
            </div>
            <div className="ticker-signal-foot">
              <IconTrendUp className="ticker-signal-foot__ico" />
              <IconTrendDown className="ticker-signal-foot__ico" />
            </div>
          </section>

          <section className="ticker-card" aria-labelledby="key-data-h">
            <div className="ticker-card__h-with-tip">
              <h2 className="ticker-card__h ticker-card__h--flex" id="key-data-h">
                Key data &amp; performance
              </h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>52-week range</strong> uses <strong>High</strong> / <strong>Low</strong> across ~1 year of
                  daily rows from <code className="ticker-data-tip__code">GET /api/market/ohlc</code> ending on{' '}
                  <strong>{asOfDate}</strong>.
                </p>
                <p className="ticker-data-tip__p">
                  <strong>Avg volume</strong> averages the <strong>Volume</strong> column over those same rows.{' '}
                  <strong>Volatility</strong> is an annualized estimate from daily <strong>Close</strong> log-returns in
                  that window.
                </p>
                <p className="ticker-data-tip__p">
                  <strong>Related tickers</strong> are other symbols from the same ticker-details response (same sector
                  first), not a live correlation API.
                </p>
              </DataInfoTip>
            </div>
            <div className="ticker-kd-grid">
              <dl className="ticker-kd-dl">
                <div className="ticker-kd-row">
                  <dt>Dividend yield</dt>
                  <dd>—</dd>
                </div>
                <div className="ticker-kd-row">
                  <dt>52-week range</dt>
                  <dd>
                    {hi52 != null && lo52 != null ? `${formatPx(lo52)} – ${formatPx(hi52)}` : '—'}
                  </dd>
                </div>
                <div className="ticker-kd-row">
                  <dt>Beta</dt>
                  <dd>—</dd>
                </div>
                <div className="ticker-kd-row">
                  <dt>Volatility (ann.)</dt>
                  <dd>{vola != null ? `${vola}%` : '—'}</dd>
                </div>
              </dl>
              <dl className="ticker-kd-dl">
                <div className="ticker-kd-row">
                  <dt>Avg volume (1y)</dt>
                  <dd>{formatVolLong(avgVol)}</dd>
                </div>
                <div className="ticker-kd-row">
                  <dt>Market cap</dt>
                  <dd>—</dd>
                </div>
                <div className="ticker-kd-row">
                  <dt>P/E (TTM)</dt>
                  <dd>—</dd>
                </div>
                <div className="ticker-kd-row">
                  <dt>EPS (TTM)</dt>
                  <dd>—</dd>
                </div>
              </dl>
            </div>
            <p className="ticker-page__label ticker-kd-comp-label">
              <span>More from {relatedTickersSourceLabel}</span>
              <span className="ticker-kd-comp-label__links">
                {RELATED_INDEX_LINKS.map((idx) => (
                  <Link key={idx.slug} to={`/indices/${idx.slug}`} className="ticker-kd-comp__a">
                    {idx.label}
                  </Link>
                ))}
              </span>
            </p>
            <p className="ticker-kd-comp">
              {competitors.length ? (
                competitors.map((t) => (
                  <Link key={t} to={`/ticker/${encodeURIComponent(t)}`} className="ticker-kd-comp__a">
                    {t}
                  </Link>
                ))
              ) : (
                <span className="ticker-page__muted">—</span>
              )}
            </p>

            <div className="ticker-subh-with-tip">
              <h3 className="ticker-subh ticker-subh--flex">Performance returns</h3>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  Rows use <code className="ticker-data-tip__code">POST /api/market/ticker-returns</code> →{' '}
                  <code className="ticker-data-tip__code">performance.dynamicPeriods</code>.
                </p>
                <p className="ticker-data-tip__p">
                  Each cell is <strong>totalReturn</strong> (percent price change from the period’s first applicable
                  close to the last close the server found inside the window). Benchmark row repeats the same logic for{' '}
                  <strong>{BENCHMARK}</strong>.
                </p>
              </DataInfoTip>
            </div>
            <div className="ticker-perf-wrap">
              <table className="ticker-perf">
                <thead>
                  <tr>
                    <th />
                    {PERF_COLS.map((c) => (
                      <th key={c.label}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Total return</th>
                    {PERF_COLS.map((c) => {
                      const v = pickDynamic(dynamicSym, c.period);
                      return (
                        <td key={c.label} className={pctClass(v)}>
                          {formatPct(v)}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <th scope="row">Benchmark ({BENCHMARK})</th>
                    {PERF_COLS.map((c) => {
                      const v = pickDynamic(dynamicSpy, c.period);
                      return (
                        <td key={c.label + '-spy'} className={pctClass(v)}>
                          {formatPct(v)}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="ticker-subh-with-tip">
              <h3 className="ticker-subh ticker-subh--flex">
                vs {selectedTickerKey || relativeTickerSymbol} (total return %, then difference)
              </h3>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  For rolling windows (1D, 5D, 1M, …) values come from the same <strong>dynamicPeriods</strong> arrays
                  as the performance table, keyed by period label (e.g. “Last Month”, “Last 1 year”).
                </p>
                <p className="ticker-data-tip__p">
                  <strong>MTD / QTD</strong> rows are computed in the browser from the ~1y daily OHLC samples: first
                  close on/after month or quarter start vs latest <strong>Close</strong> for {selectedIndexLabel} and for{' '}
                  {selectedTickerKey || relativeTickerSymbol}{' '}
                  separately.
                </p>
                <p className="ticker-data-tip__p">
                  <strong>Diff</strong> = symbol total return minus benchmark total return for that row.
                </p>
              </DataInfoTip>
            </div>
            <div className="ticker-compare">
              <div className="ticker-compare__head">
                <span />
                <span>{selectedIndexLabel}</span>
                <span>{selectedTickerKey || relativeTickerSymbol}</span>
                <span>Diff</span>
              </div>
              {COMPARE_ROWS.map((row) => {
                let symPct = row.period
                  ? pickDynamic(selectedIndexSeries.dynamicPeriods, row.period)
                  : row.mtd
                    ? selectedIndexSeries.mtd
                    : row.qtd
                      ? selectedIndexSeries.qtd
                      : null;
                let spyPct = row.period
                  ? pickDynamic(selectedTickerSeries.dynamicPeriods, row.period)
                  : row.mtd
                    ? selectedTickerSeries.mtd
                    : row.qtd
                      ? selectedTickerSeries.qtd
                      : null;
                const diff =
                  symPct != null && spyPct != null && Number.isFinite(symPct) && Number.isFinite(spyPct)
                    ? symPct - spyPct
                    : null;
                return (
                  <div key={row.key} className="ticker-compare__row">
                    <span className="ticker-compare__tf">{row.key}</span>
                    <span className={'ticker-compare__cell ' + pctClass(symPct)}>{formatPct(symPct)}</span>
                    <span className={'ticker-compare__cell ' + pctClass(spyPct)}>{formatPct(spyPct)}</span>
                    <span className={'ticker-compare__cell ' + pctClass(diff)}>{formatPct(diff)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
