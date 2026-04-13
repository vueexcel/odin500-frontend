import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DataInfoTip } from '../components/DataInfoTip.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerMonthlyReturnsWaterfallDonut } from '../components/TickerMonthlyReturnsWaterfallDonut.jsx';
import { TickerQuarterlyReturnsChart } from '../components/TickerQuarterlyReturnsChart.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import {
  IconChartTypeDropdown,
  TICKER_CHART_TYPE_OPTIONS,
  TickerLightweightChart
} from '../components/TickerLightweightChart.jsx';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';

const TIMEFRAMES = ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', '20Y', 'ALL'];
/** Must stay ≤ backend `OHLC_SIGNALS_MAX_RANGE_DAYS` (default 40000). */
const MAX_SIGNAL_RANGE_DAYS = 40000;
const BENCHMARK = 'SPY';

/** Placeholder headlines until a news API is wired. */
function dummyTickerNews(symbol) {
  const s = String(symbol || 'Ticker')
    .trim()
    .toUpperCase() || 'TICKER';
  return [
    {
      id: 'dn1',
      title: `${s} sees brisk turnover as large-cap tech tracks a broad index rebound`,
      source: 'Market Wire (demo)',
      time: '35m ago'
    },
    {
      id: 'dn2',
      title: `Analyst note: ${s} margin outlook debated ahead of the next earnings season`,
      source: 'Desk research (demo)',
      time: '2h ago'
    },
    {
      id: 'dn3',
      title: `${s} mentioned in sector rotation commentary — flows described as “mixed but constructive”`,
      source: 'Macro Brief (demo)',
      time: '5h ago'
    },
    {
      id: 'dn4',
      title: `Institutional holders trim a slice of ${s}, filings show; price action still range-bound`,
      source: '13F watch (demo)',
      time: 'Yesterday'
    },
    {
      id: 'dn5',
      title: `${s} liquidity stays orderly; implied vol off recent highs`,
      source: 'Flow desk (demo)',
      time: 'Yesterday'
    }
  ];
}

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

export default function TickerPage() {
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const sym = sanitizeTickerPageInput(symbolParam) || 'AAPL';

  const [authVersion, setAuthVersion] = useState(0);
  const [timeframe, setTimeframe] = useState('1Y');
  const [chartLoading, setChartLoading] = useState(false);
  const [metaBusy, setMetaBusy] = useState(true);
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [ohlcRows, setOhlcRows] = useState([]);
  const [returnsSym, setReturnsSym] = useState(null);
  const [returnsSpy, setReturnsSpy] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [tailRows, setTailRows] = useState([]);
  const [appliedCustomRange, setAppliedCustomRange] = useState(null);
  const [draftChartStart, setDraftChartStart] = useState('');
  const [draftChartEnd, setDraftChartEnd] = useState('');
  const [mainChartType, setMainChartType] = useState('line');
  const [ohlcTickerBounds, setOhlcTickerBounds] = useState(/** @type {{ min: string, max: string } | null} */ (null));

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
      if (!s) navigate('/ticker');
      else navigate('/ticker/' + encodeURIComponent(s));
    },
    [navigate]
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

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setError('Sign in to load ticker data.');
      setChartLoading(false);
      setMetaBusy(false);
      setOhlcRows([]);
      setReturnsSym(null);
      setReturnsSpy(null);
      setDetailRows([]);
      setStatsRows([]);
      setStatsRowsSpy([]);
      setTailRows([]);
      setOhlcTickerBounds(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setMetaBusy(true);
      setError('');
      try {
        const retSym = await fetchJsonCached({
          path: '/api/market/ticker-returns',
          method: 'POST',
          body: { ticker: sym },
          ttlMs: 5 * 60 * 1000
        });
        if (cancelled) return;
        const asOf = retSym.data?.asOfDate || new Date().toISOString().slice(0, 10);
        setAsOfDate(asOf);
        setReturnsSym(retSym.data);

        const asOfD = new Date(String(asOf).slice(0, 10) + 'T12:00:00');
        const start365 = new Date(asOfD);
        start365.setFullYear(start365.getFullYear() - 1);
        const startIso = toIso(start365);
        const endIso = String(asOf).slice(0, 10);

        const [retSpy, detailsRes, tailRes, statsSymRes, statsSpyRes] = await Promise.all([
          fetchJsonCached({
            path: '/api/market/ticker-returns',
            method: 'POST',
            body: { ticker: BENCHMARK },
            ttlMs: 15 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-details',
            method: 'POST',
            body: { index: 'sp500', period: 'last-1-year' },
            ttlMs: 30 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ohlc?symbol=' + encodeURIComponent(sym) + '&limit=8',
            method: 'GET',
            ttlMs: 60 * 1000
          }),
          fetchJsonCached({
            path:
              '/api/market/ohlc?symbol=' +
              encodeURIComponent(sym) +
              '&start_date=' +
              encodeURIComponent(startIso) +
              '&end_date=' +
              encodeURIComponent(endIso) +
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
              encodeURIComponent(endIso) +
              '&limit=400',
            method: 'GET',
            ttlMs: 10 * 60 * 1000
          })
        ]);

        if (cancelled) return;
        setReturnsSpy(retSpy.data);
        const d = detailsRes.data;
        setDetailRows(Array.isArray(d?.data) ? d.data : []);

        setTailRows(sortRowsAsc(ohlcRowsFromPayload(tailRes.data)));
        setStatsRows(sortRowsAsc(ohlcRowsFromPayload(statsSymRes.data)));
        setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load ticker');
          setReturnsSym(null);
          setReturnsSpy(null);
          setDetailRows([]);
          setStatsRows([]);
          setStatsRowsSpy([]);
          setTailRows([]);
        }
      } finally {
        if (!cancelled) setMetaBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sym, authVersion]);

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
  }, [sym, authVersion]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) return;
    if (!returnsSym || String(returnsSym.ticker || '').toUpperCase() !== sym.toUpperCase()) return;

    (async () => {
      setChartLoading(true);
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
  }, [sym, timeframe, asOfDate, authVersion, returnsSym, chartApiRange.start, chartApiRange.end]);

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

  const competitors = useMemo(
    () => pickCompetitors(detailRows, sym, sector, 6),
    [detailRows, sym, sector]
  );

  const dynamicSym = returnsSym?.performance?.dynamicPeriods || [];
  const dynamicSpy = returnsSpy?.performance?.dynamicPeriods || [];
  const annualReturnsRaw = returnsSym?.performance?.annualReturns;
  const quarterlyReturnsRaw = returnsSym?.performance?.quarterlyReturns;
  const monthlyReturnsRaw = returnsSym?.performance?.monthlyReturns;

  const sortedChart = useMemo(() => sortRowsAsc(ohlcRows), [ohlcRows]);

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

            <div className="ticker-chart-body">
              <div className="ticker-chart-legend">
                <span className="ticker-chart-legend__sym">{sym}</span>
                <span className="ticker-chart-legend__name">{company}</span>
                <span>{formatPx(headerClose)} USD</span>
                {headerChgPct != null && Number.isFinite(headerChgPct) ? (
                  <span className={'ticker-num ' + pctClass(headerChgPct)}>{formatPct(headerChgPct)}</span>
                ) : null}
                <span className="ticker-chart-legend__sig">Signal: {lastSignal}</span>
              </div>
              {chartLoading && sortedChart.length === 0 ? (
                <div className="ticker-chart-skeleton">Loading chart…</div>
              ) : sortedChart.length ? (
                <TickerLightweightChart rows={sortedChart} height={320} chartType={mainChartType} />
              ) : (
                <div className="ticker-sparkline ticker-sparkline--empty">No OHLC rows in this range.</div>
              )}
              <div className="ticker-chart-footer-icons">
                <button type="button" className="ticker-chart-footer-icons__btn" aria-label="Settings">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                  </svg>
                </button>
                <button type="button" className="ticker-chart-footer-icons__btn" aria-label="Expand">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 3H3v6M15 3h6v6M3 15v6h6M21 15v6h-6" />
                  </svg>
                </button>
              </div>
            </div>
          </section>

          <section className="ticker-card ticker-card--news" aria-labelledby="ticker-news-h">
            <div className="ticker-card__h-with-tip">
              <h2 className="ticker-card__h ticker-card__h--flex" id="ticker-news-h">
                News
              </h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>News</strong> below is <strong>sample copy only</strong> for layout. A real feed would use a
                  separate headlines API from OHLC.
                </p>
                <p className="ticker-data-tip__p">Market blocks above use live endpoints; this list is not live news.</p>
              </DataInfoTip>
            </div>
            <p className="ticker-page__news-sample-note">Sample headlines — not from a live wire.</p>
            <ul className="ticker-news-list">
              {dummyTickerNews(sym).map((n) => (
                <li key={n.id} className="ticker-news-list__li">
                  <a
                    className="ticker-news-list__a"
                    href="#ticker-news-h"
                    onClick={(e) => e.preventDefault()}
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
          </section>

          <TickerAnnualReturnsFigma symbol={sym} annualReturns={annualReturnsRaw} asOfDate={asOfDate} />
          <TickerAnnualReturnsPosNeg symbol={sym} annualReturns={annualReturnsRaw} asOfDate={asOfDate} />
          <TickerQuarterlyReturnsChart symbol={sym} quarterlyReturns={quarterlyReturnsRaw} asOfDate={asOfDate} />
          <TickerMonthlyReturnsChart symbol={sym} monthlyReturns={monthlyReturnsRaw} asOfDate={asOfDate} />
          <TickerMonthlyReturnsWaterfallDonut
            symbol={sym}
            monthlyReturns={monthlyReturnsRaw}
            annualReturns={annualReturnsRaw}
            asOfDate={asOfDate}
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
            <p className="ticker-page__label ticker-kd-comp-label">Related tickers (same index list)</p>
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
                vs {BENCHMARK} (total return %, then difference)
              </h3>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  For rolling windows (1D, 5D, 1M, …) values come from the same <strong>dynamicPeriods</strong> arrays
                  as the performance table, keyed by period label (e.g. “Last Month”, “Last 1 year”).
                </p>
                <p className="ticker-data-tip__p">
                  <strong>MTD / QTD</strong> rows are computed in the browser from the ~1y daily OHLC samples: first
                  close on/after month or quarter start vs latest <strong>Close</strong> for {sym} and for {BENCHMARK}{' '}
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
                <span>{sym}</span>
                <span>{BENCHMARK}</span>
                <span>Diff</span>
              </div>
              {COMPARE_ROWS.map((row) => {
                let symPct = row.period
                  ? pickDynamic(dynamicSym, row.period)
                  : row.mtd
                    ? symMtd
                    : row.qtd
                      ? symQtd
                      : null;
                let spyPct = row.period
                  ? pickDynamic(dynamicSpy, row.period)
                  : row.mtd
                    ? spyMtd
                    : row.qtd
                      ? spyQtd
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
