import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DataInfoTip } from '../components/DataInfoTip.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerMonthlyReturnsWaterfallDonut } from '../components/TickerMonthlyReturnsWaterfallDonut.jsx';
import { TickerQuarterlyReturnsChart } from '../components/TickerQuarterlyReturnsChart.jsx';
import { TickerSection16Section17 } from '../components/TickerSection16Section17.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import TradingChartLoader from '../components/TradingChartLoader.jsx';
import {
  IconChartTypeDropdown,
  TICKER_CHART_TYPE_OPTIONS,
  TickerLightweightChart
} from '../components/TickerLightweightChart.jsx';
import { useGeneralNewsFeed } from '../hooks/useGeneralNewsFeed.js';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { usePageSeo } from '../seo/usePageSeo.js';

const TIMEFRAMES = ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y', '20Y', 'ALL'];
const MAX_SIGNAL_RANGE_DAYS = 40000;
const BENCHMARK = 'SPX';

const CHART_USER_H_KEY = 'odin_index_chart_h';
const CHART_H_MIN = 200;
const CHART_H_MAX = 1400;

const RESIZE_KEY_ANNUAL_FIGMA = 'odin_index_resize_annual_figma';
const RESIZE_KEY_ANNUAL_POSNEG = 'odin_index_resize_annual_posneg';
const RESIZE_KEY_QUARTERLY = 'odin_index_resize_quarterly';
const RESIZE_KEY_MONTHLY = 'odin_index_resize_monthly';
const RESIZE_KEY_MONTHLY_ADV = 'odin_index_resize_monthly_waterfall';

const MAX_NEWS_ITEMS = 120;
const NEWS_PAGE_SIZE = 5;
const INDEX_TICKERS_PAGE_SIZE = 50;

const PERF_COLS = [
  { label: '1M', period: 'Last Month' },
  { label: '3M', period: 'Last 3 months' },
  { label: 'YTD', period: 'Year to Date (YTD)' },
  { label: '1Y', period: 'Last 1 year' }
];

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

/** Route slug → backend `index` body + UI label */
export const INDEX_ROUTE_CHOICES = [
  { slug: 'sp500', apiIndex: 'sp500', label: 'S&P 500' },
  { slug: 'dow-jones', apiIndex: 'Dow Jones', label: 'Dow Jones' },
  { slug: 'nasdaq-100', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100' }
];
const RELATIVE_STRENGTH_OPTIONS = [
  
  ...INDEX_ROUTE_CHOICES.map((opt) => ({
    key: `IDX:${opt.slug}`,
    label: opt.label,
    kind: 'index',
    apiIndex: opt.apiIndex
  }))
];

function sanitizeIndexSlug(raw) {
  let s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
  if (!s) return '';
  const aliases = {
    dowjones: 'dow-jones',
    djia: 'dow-jones',
    nasdaq100: 'nasdaq-100',
    nasdaq: 'nasdaq-100',
    ixic: 'nasdaq-composite',
    comp: 'nasdaq-composite'
  };
  if (aliases[s]) return aliases[s];
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

function clampStartToMaxDays(start, end, maxInclusiveDays) {
  const maxDiffMs = (maxInclusiveDays - 1) * 86400000;
  const diff = end.getTime() - start.getTime();
  if (diff <= maxDiffMs) return start;
  return new Date(end.getTime() - maxDiffMs);
}

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
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
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

function ohlcRowsFromPayload(payload) {
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

/** Map index-returns `syntheticCloseSeries` to OHLC-shaped rows for Lightweight Charts. */
function closeSeriesToChartRows(series) {
  if (!Array.isArray(series)) return [];
  return series.map((pt) => {
    const d = String(pt.date || '').slice(0, 10);
    const c = Number(pt.close);
    const v = Number.isFinite(c) ? c : null;
    return {
      Date: d,
      Open: v,
      High: v,
      Low: v,
      Close: v,
      Volume: 0,
      signal: 'N'
    };
  });
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

export default function IndexPage() {
  const location = useLocation();
  const { indexSlug: indexSlugParam } = useParams();
  const navigate = useNavigate();
  const [activeSlug, setActiveSlug] = useState(() => sanitizeIndexSlug(indexSlugParam) || 'sp500');
  const slug = activeSlug;
  useEffect(() => {
    const next = sanitizeIndexSlug(indexSlugParam) || 'sp500';
    setActiveSlug((prev) => (prev === next ? prev : next));
  }, [indexSlugParam]);
  const activeMeta = useMemo(
    () => INDEX_ROUTE_CHOICES.find((x) => x.slug === slug) || INDEX_ROUTE_CHOICES[0],
    [slug]
  );

  usePageSeo({
    title: `${activeMeta.label} Signals & Heatmap | Odin500`,
    description: `Daily Odin500 signal distribution, heatmap views, and constituent analytics for ${activeMeta.label}.`,
    canonicalPath: `/indices/${slug}`,
    noindex: Boolean(location.search),
    breadcrumbItems: [
      { name: 'Market', path: '/market' },
      { name: 'Indices', path: '/indices/sp500' },
      { name: activeMeta.label, path: `/indices/${slug}` }
    ]
  });

  const [authVersion, setAuthVersion] = useState(0);
  const [timeframe, setTimeframe] = useState('1Y');
  const [metaBusy, setMetaBusy] = useState(true);
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [indexPayload, setIndexPayload] = useState(null);
  const [fullCloseSeries, setFullCloseSeries] = useState([]);
  const [returnsSpy, setReturnsSpy] = useState(null);
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [relativeSeriesByKey, setRelativeSeriesByKey] = useState({});
  const [relativeBusy, setRelativeBusy] = useState(false);
  const [relativeLeftKey, setRelativeLeftKey] = useState(`IDX:${slug}`);
  const [relativeRightKey, setRelativeRightKey] = useState('SPX');
  const [indexTickersRows, setIndexTickersRows] = useState([]);
  const [indexTickersBusy, setIndexTickersBusy] = useState(false);
  const [indexTickersPage, setIndexTickersPage] = useState(1);
  const [tailRows, setTailRows] = useState([]);
  const [ohlcTickerBounds, setOhlcTickerBounds] = useState(/** @type {{ min: string, max: string } | null} */ (null));

  const [newsPage, setNewsPage] = useState(1);
  const { busy: newsBusy, error: newsError, items: liveNewsAll } = useGeneralNewsFeed();
  const liveNews = useMemo(() => liveNewsAll.slice(0, MAX_NEWS_ITEMS), [liveNewsAll]);
  const [appliedCustomRange, setAppliedCustomRange] = useState(null);
  const [draftChartStart, setDraftChartStart] = useState('');
  const [draftChartEnd, setDraftChartEnd] = useState('');
  const [mainChartType, setMainChartType] = useState('line');

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

  const ohlcSymbol = useMemo(() => {
    if (!indexPayload) return null;
    const o = indexPayload.officialIndexTicker;
    const t = indexPayload.ticker;
    if (o && String(o).trim()) return String(o).trim().toUpperCase();
    if (t && String(t).trim()) return String(t).trim().toUpperCase();
    return null;
  }, [indexPayload]);

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

  const onIndexSlugChange = useCallback(
    (nextSlug) => {
      const s = sanitizeIndexSlug(nextSlug);
      setActiveSlug(s || 'sp500');
      if (!s) navigate('/indices');
      else navigate('/indices/' + encodeURIComponent(s));
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
      setError('Sign in to load index data.');
      setMetaBusy(false);
      setIndexPayload(null);
      setFullCloseSeries([]);
      setReturnsSpy(null);
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
        const idxRes = await fetchJsonCached({
          path: '/api/market/index-returns',
          method: 'POST',
          body: { index: activeMeta.apiIndex },
          ttlMs: 10 * 60 * 1000
        });
        if (cancelled) return;
        const d = idxRes.data;
        setIndexPayload(d && typeof d === 'object' ? d : null);
        const asOf = d?.asOfDate || new Date().toISOString().slice(0, 10);
        setAsOfDate(asOf);
        const series = Array.isArray(d?.syntheticCloseSeries) ? d.syntheticCloseSeries : [];
        setFullCloseSeries(series);

        const asOfD = new Date(String(asOf).slice(0, 10) + 'T12:00:00');
        const start365 = new Date(asOfD);
        start365.setFullYear(start365.getFullYear() - 1);
        const startIso = toIso(start365);
        const endIso = String(asOf).slice(0, 10);

        const symForOhlc =
          (d?.officialIndexTicker && String(d.officialIndexTicker).trim()) ||
          (d?.ticker && String(d.ticker).trim()) ||
          '';

        const retSpy = await fetchJsonCached({
          path: '/api/market/ticker-returns',
          method: 'POST',
          body: { ticker: BENCHMARK },
          ttlMs: 15 * 60 * 1000
        });
        if (cancelled) return;
        setReturnsSpy(retSpy.data);

        if (symForOhlc) {
          const u = encodeURIComponent(symForOhlc);
          const [tailRes, statsSymRes, statsSpyRes] = await Promise.all([
            fetchJsonCached({
              path: '/api/market/ohlc?symbol=' + u + '&limit=8',
              method: 'GET',
              ttlMs: 60 * 1000
            }),
            fetchJsonCached({
              path:
                '/api/market/ohlc?symbol=' +
                u +
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
          setTailRows(sortRowsAsc(ohlcRowsFromPayload(tailRes.data)));
          setStatsRows(sortRowsAsc(ohlcRowsFromPayload(statsSymRes.data)));
          setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
        } else {
          const baseRows = sortRowsAsc(closeSeriesToChartRows(series));
          const tail = baseRows.slice(-8);
          setTailRows(tail);
          const stats = baseRows.filter((r) => {
            const iso = rowDateToTimeKey(r);
            return iso && iso >= startIso && iso <= endIso;
          });
          setStatsRows(stats.length ? stats : baseRows.slice(-252));

          const statsSpyRes = await fetchJsonCached({
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
          });
          if (cancelled) return;
          setStatsRowsSpy(sortRowsAsc(ohlcRowsFromPayload(statsSpyRes.data)));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load index');
          setIndexPayload(null);
          setFullCloseSeries([]);
          setReturnsSpy(null);
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
  }, [activeMeta.apiIndex, authVersion]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setOhlcTickerBounds(null);
      return () => {
        cancelled = true;
      };
    }
    const sym = ohlcSymbol;
    if (!sym) {
      const sorted = sortRowsAsc(closeSeriesToChartRows(fullCloseSeries));
      if (sorted.length) {
        const min = rowDateToTimeKey(sorted[0]);
        const max = rowDateToTimeKey(sorted[sorted.length - 1]);
        setOhlcTickerBounds(min && max ? { min, max } : null);
      } else {
        setOhlcTickerBounds(null);
      }
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
  }, [ohlcSymbol, fullCloseSeries, authVersion]);

  useEffect(() => {
    setNewsPage(1);
  }, [slug]);

  const allChartRows = useMemo(() => sortRowsAsc(closeSeriesToChartRows(fullCloseSeries)), [fullCloseSeries]);

  const sortedChart = useMemo(() => {
    const { start, end } = chartApiRange;
    return allChartRows.filter((r) => {
      const t = rowDateToTimeKey(r);
      return t && t >= start && t <= end;
    });
  }, [allChartRows, chartApiRange.start, chartApiRange.end]);

  const returnsSym = useMemo(() => {
    if (!indexPayload?.performance) return null;
    const tk =
      (indexPayload.officialIndexTicker && String(indexPayload.officialIndexTicker).trim()) ||
      (indexPayload.ticker && String(indexPayload.ticker).trim()) ||
      activeMeta.label;
    return {
      success: true,
      ticker: String(tk).toUpperCase(),
      asOfDate: indexPayload.asOfDate,
      performance: indexPayload.performance
    };
  }, [indexPayload, activeMeta.label]);

  const displaySym = returnsSym?.ticker || activeMeta.label;

  const newsTotalPages = useMemo(
    () => Math.max(1, Math.ceil(liveNews.length / NEWS_PAGE_SIZE)),
    [liveNews.length]
  );
  const newsPageSafe = Math.min(Math.max(1, newsPage), newsTotalPages);
  const newsPageItems = useMemo(() => {
    const start = (newsPageSafe - 1) * NEWS_PAGE_SIZE;
    return liveNews.slice(start, start + NEWS_PAGE_SIZE);
  }, [liveNews, newsPageSafe]);

  const relatedIndexLinks = useMemo(
    () => INDEX_ROUTE_CHOICES.filter((x) => x.slug !== slug),
    [slug]
  );

  useEffect(() => {
    setRelativeLeftKey(`IDX:${slug}`);
    setRelativeRightKey('SPX');
    setIndexTickersPage(1);
  }, [slug]);

  const dynamicSym = returnsSym?.performance?.dynamicPeriods || [];
  const dynamicSpy = returnsSpy?.performance?.dynamicPeriods || [];
  const annualReturnsRaw = returnsSym?.performance?.annualReturns;
  const quarterlyReturnsRaw = returnsSym?.performance?.quarterlyReturns;
  const monthlyReturnsRaw = returnsSym?.performance?.monthlyReturns;

  const loadRelativeSeries = useCallback(
    async (option) => {
      if (!option || !getAuthToken()) return null;
      if (option.kind === 'ticker') {
        const ret = await fetchJsonCached({
          path: '/api/market/ticker-returns',
          method: 'POST',
          body: { ticker: option.ticker },
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
            encodeURIComponent(option.ticker) +
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
      }

      const idx = await fetchJsonCached({
        path: '/api/market/index-returns',
        method: 'POST',
        body: { index: option.apiIndex },
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
        const seriesRows = sortRowsAsc(closeSeriesToChartRows(Array.isArray(d?.syntheticCloseSeries) ? d.syntheticCloseSeries : []));
        rows = seriesRows.filter((r) => {
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
    const sync = () => {
      const el = chartBodyRef.current;
      const doc = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
      setChartFs(!!el && (document.fullscreenElement === el || doc.webkitFullscreenElement === el));
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
  }, [chartFs, sortedChart.length, mainChartType]);

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
    const doc = /** @type {Document & { webkitExitFullscreen?: () => Promise<void> | void; webkitFullscreenElement?: Element | null }} */ (
      document
    );
    const fsEl = doc.fullscreenElement ?? doc.webkitFullscreenElement;
    try {
      if (fsEl === el) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else doc.webkitExitFullscreen?.();
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
    const currentKey = `IDX:${slug}`;
    setRelativeSeriesByKey((prev) => ({
      ...prev,
      [currentKey]: { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd },
      SPX: { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd }
    }));
  }, [slug, dynamicSym, symMtd, symQtd, dynamicSpy, spyMtd, spyQtd]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) return () => {};
    const keys = [relativeLeftKey, relativeRightKey].filter(Boolean);
    const missing = keys.filter((k) => !relativeSeriesByKey[k]);
    if (!missing.length) return () => {};
    (async () => {
      setRelativeBusy(true);
      try {
        for (const key of missing) {
          const option = RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === key);
          const payload = await loadRelativeSeries(option);
          if (cancelled || !payload) continue;
          setRelativeSeriesByKey((prev) => ({ ...prev, [key]: payload }));
        }
      } finally {
        if (!cancelled) setRelativeBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [relativeLeftKey, relativeRightKey, relativeSeriesByKey, loadRelativeSeries]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setIndexTickersRows([]);
      setIndexTickersBusy(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setIndexTickersBusy(true);
      try {
        const { data } = await fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: activeMeta.apiIndex, period: 'last-date' },
          ttlMs: 5 * 60 * 1000
        });
        if (cancelled) return;
        const rows = Array.isArray(data?.data) ? data.data : [];
        const mapped = rows
          .map((r) => ({
            symbol: String(r.symbol || '').toUpperCase().trim(),
            close: Number(r.price),
            ret1d: Number(r.totalReturnPercentage)
          }))
          .filter((r) => r.symbol);
        setIndexTickersRows(mapped);
      } catch {
        if (!cancelled) setIndexTickersRows([]);
      } finally {
        if (!cancelled) setIndexTickersBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeMeta.apiIndex, authVersion]);

  const relativeLeftSeries =
    relativeSeriesByKey[relativeLeftKey] || { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
  const relativeRightSeries =
    relativeSeriesByKey[relativeRightKey] || { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd };
  const relativeLeftLabel =
    RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === relativeLeftKey)?.label || displaySym;
  const relativeRightLabel =
    RELATIVE_STRENGTH_OPTIONS.find((o) => o.key === relativeRightKey)?.label || BENCHMARK;
  const indexTickersTotalPages = Math.max(1, Math.ceil(indexTickersRows.length / INDEX_TICKERS_PAGE_SIZE));
  const indexTickersPageSafe = Math.min(Math.max(1, indexTickersPage), indexTickersTotalPages);
  const indexTickersPageRows = useMemo(() => {
    const start = (indexTickersPageSafe - 1) * INDEX_TICKERS_PAGE_SIZE;
    return indexTickersRows.slice(start, start + INDEX_TICKERS_PAGE_SIZE);
  }, [indexTickersRows, indexTickersPageSafe]);
  const indexTickersPageButtons = useMemo(() => {
    if (indexTickersTotalPages <= 1) return [1];
    if (indexTickersTotalPages <= 4) return Array.from({ length: indexTickersTotalPages }, (_, i) => i + 1);
    let start = Math.max(1, indexTickersPageSafe - 1);
    if (start + 3 > indexTickersTotalPages) start = indexTickersTotalPages - 3;
    return [start, start + 1, start + 2, start + 3];
  }, [indexTickersPageSafe, indexTickersTotalPages]);

  const section16Rows = useMemo(() => {
    const compact = COMPARE_ROWS.filter((r) => ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD'].includes(r.key));
    return compact.map((row) => {
      const symPct = row.period
        ? pickDynamic(relativeLeftSeries.dynamicPeriods, row.period)
        : row.mtd
          ? relativeLeftSeries.mtd
          : row.qtd
            ? relativeLeftSeries.qtd
            : null;
      const basePct = row.period
        ? pickDynamic(relativeRightSeries.dynamicPeriods, row.period)
        : row.mtd
          ? relativeRightSeries.mtd
          : row.qtd
            ? relativeRightSeries.qtd
            : null;
      const diff =
        symPct != null && basePct != null && Number.isFinite(symPct) && Number.isFinite(basePct)
          ? symPct - basePct
          : null;
      return { label: row.key, value: diff, symPct, basePct, diff };
    });
  }, [relativeLeftSeries, relativeRightSeries]);

  const section17CompareRows = useMemo(() => {
    const compact = COMPARE_ROWS.filter((r) => ['1D', '5D', 'MTD', '1M', 'QTD', '3M', '6M', 'YTD'].includes(r.key));
    return compact.map((row) => {
      const symPct = row.period
        ? pickDynamic(dynamicSym, row.period)
        : row.mtd
          ? symMtd
          : row.qtd
            ? symQtd
            : null;
      const spyPct = row.period
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
      return { label: row.key, symPct, spyPct, diff };
    });
  }, [dynamicSym, dynamicSpy, symMtd, spyMtd, symQtd, spyQtd]);

  const basePixelHeight = userChartHeight ?? mediaChartHeight;
  const plotHeight = chartFs && fsPlotH >= CHART_H_MIN ? fsPlotH : basePixelHeight;

  const chartRangeLabel = chartApiRange.start + ' → ' + chartApiRange.end;
  const chartModeHelp = appliedCustomRange
    ? 'Using your custom start/end (overrides the pill timeframe until you reset).'
    : `Using pill timeframe “${timeframe}”, anchored to as-of ${asOfDate}.`;

  const seriesModeLabel = indexPayload?.seriesMode || '—';
  const apiIndexLabel = activeMeta.apiIndex;

  return (
    <div className="ticker-page">
      <div className="ticker-page__search-row">
        <label className="ticker-page__label" htmlFor="index-dash-select" style={{ marginRight: 8 }}>
          Index
        </label>
        <select
          id="index-dash-select"
          className="ticker-page__date-inp"
          style={{ minWidth: 220, maxWidth: '100%' }}
          value={slug}
          onChange={(e) => onIndexSlugChange(e.target.value)}
        >
          {INDEX_ROUTE_CHOICES.map((opt) => (
            <option key={opt.slug} value={opt.slug}>
              {opt.label}
            </option>
          ))}
        </select>
        <DataInfoTip align="start">
          <p className="ticker-data-tip__p">
            <strong>Index dashboard</strong> loads returns and the main chart from{' '}
            <code className="ticker-data-tip__code">POST /api/market/index-returns</code> with body{' '}
            <code className="ticker-data-tip__code">index</code> set to this route’s universe (e.g.{' '}
            <code className="ticker-data-tip__code">sp500</code>, <code className="ticker-data-tip__code">Dow Jones</code>
            ).
          </p>
          <p className="ticker-data-tip__p">
            Official benchmarks use table tickers like <strong>SPX</strong>, <strong>DJI</strong>, <strong>IXIC</strong> when the API reports{' '}
            <code className="ticker-data-tip__code">seriesMode: official-index-ticker</code>. Synthetic universes use the weighted constituent
            path.
          </p>
        </DataInfoTip>
        {metaBusy ? <span className="ticker-page__loading-pill">Loading…</span> : null}
      </div>

      {error ? (
        <div className="ticker-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="ticker-page__header-top">
          <div className="ticker-page__header-identity">
            <h1 className="ticker-page__company ticker-page__company--hero">{activeMeta.label}</h1>
            <span className="ticker-page__header-identity-meta">
              <IconFlagUs className="ticker-page__flag" />
              <span className="ticker-page__exchange">{displaySym}</span>
            </span>
            <DataInfoTip align="start">
              <p className="ticker-data-tip__p">
                <strong>Header price</strong> uses the last two sessions from{' '}
                <code className="ticker-data-tip__code">GET /api/market/ohlc</code> when an official index ticker exists; otherwise the last two
                points from the index-returns close series.
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
              <span className="ticker-page__sym">{displaySym}</span>
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
              <span className="ticker-page__metric-value">{seriesModeLabel}</span>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>seriesMode</strong> from index-returns: official single-ticker path vs synthetic constituents.
                </p>
              </DataInfoTip>
            </div>
            <p className="ticker-page__metric-label">Data mode</p>
          </div>

          <div className="ticker-page__header-metric">
            <div className="ticker-page__metric-value-row">
              <span className="ticker-page__metric-value">{apiIndexLabel}</span>
            </div>
            <p className="ticker-page__metric-label">API index</p>
          </div>

          <div className="ticker-page__header-metric">
            <p className="ticker-page__metric-value ticker-page__metric-value--multiline">—</p>
            <p className="ticker-page__metric-label">Sector / industry</p>
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
          <section className="ticker-card ticker-card--main-chart" aria-labelledby="index-snapshot-chart-title">
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
            </div>

            <div className="ticker-card__head">
              <div className="ticker-card__title-with-tip">
                <button type="button" className="ticker-card__title-btn" id="index-snapshot-chart-title">
                  Snapshot Chart
                  <IconChevronDown className="ticker-card__title-chev" />
                </button>
                <DataInfoTip align="end">
                  <p className="ticker-data-tip__p">
                    <strong>Chart</strong>: from <code className="ticker-data-tip__code">index-returns.syntheticCloseSeries</code> (close level),
                    filtered client-side to the selected window. No separate OHLC+signals call for indices.
                  </p>
                  <p className="ticker-data-tip__p">
                    <strong>Window:</strong> {chartRangeLabel}. {chartModeHelp}
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
                        'ticker-tf' + (!appliedCustomRange && tf === timeframe ? ' ticker-tf--active' : '')
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
                  <p className="ticker-data-tip__p">Timeframe pills map to calendar ranges ending on index-returns as-of date.</p>
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
              </div>
            </div>

            <div ref={chartBodyRef} className="ticker-chart-body">
              <div className="ticker-chart-legend">
                <span className="ticker-chart-legend__sym">{displaySym}</span>
                <span className="ticker-chart-legend__name">{activeMeta.label}</span>
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
                {metaBusy && sortedChart.length === 0 ? (
                  <div
                    className="chart-viz-loading-wrap"
                    style={{
                      minHeight: Math.max(
                        CHART_H_MIN,
                        chartFs && fsPlotH >= CHART_H_MIN ? fsPlotH : basePixelHeight
                      )
                    }}
                  >
                    <TradingChartLoader
                      label="Loading chart…"
                      sublabel={`${displaySym} · ${activeMeta.label}`}
                    />
                  </div>
                ) : sortedChart.length ? (
                  <TickerLightweightChart rows={sortedChart} height={plotHeight} chartType={mainChartType} />
                ) : (
                  <div className="ticker-sparkline ticker-sparkline--empty">No rows in this range.</div>
                )}
              </div>
              <div className="ticker-chart-footer-icons">
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

          <section className="ticker-card ticker-card--news" aria-labelledby="index-news-h">
            <div className="ticker-card__h-with-tip">
              <h2 className="ticker-card__h ticker-card__h--flex" id="index-news-h">
                News
              </h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">General trading headlines (same feed as ticker page).</p>
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
                    href={n.url || '#index-news-h'}
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
            symbol={displaySym}
            annualReturns={annualReturnsRaw}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_ANNUAL_FIGMA}
            resizeDefaultHeight={260}
          />
          <TickerChartResizeScope storageKey={RESIZE_KEY_ANNUAL_POSNEG} defaultHeight={260}>
            <TickerAnnualReturnsPosNeg symbol={displaySym} annualReturns={annualReturnsRaw} asOfDate={asOfDate} />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_QUARTERLY} defaultHeight={288}>
            <TickerQuarterlyReturnsChart symbol={displaySym} quarterlyReturns={quarterlyReturnsRaw} asOfDate={asOfDate} />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_MONTHLY} defaultHeight={278}>
            <TickerMonthlyReturnsChart symbol={displaySym} monthlyReturns={monthlyReturnsRaw} asOfDate={asOfDate} />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_MONTHLY_ADV} defaultHeight={300}>
            <TickerMonthlyReturnsWaterfallDonut
              key={slug}
              symbol={displaySym}
              monthlyReturns={monthlyReturnsRaw}
              asOfDate={asOfDate}
            />
          </TickerChartResizeScope>
          <div className="ticker-subh-with-tip" style={{ marginTop: 6, marginBottom: 10 }}>
            <h3 className="ticker-subh ticker-subh--flex">Relative Strength selector</h3>
            <DataInfoTip align="start">
              <p className="ticker-data-tip__p">Choose two indices; table and bars show return% difference (left minus right).</p>
            </DataInfoTip>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            <select
              className="ticker-page__date-inp"
              value={relativeLeftKey}
              onChange={(e) => setRelativeLeftKey(e.target.value)}
              style={{ minWidth: 220 }}
            >
              {RELATIVE_STRENGTH_OPTIONS.map((opt) => (
                <option key={`left-${opt.key}`} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              className="ticker-page__date-inp"
              value={relativeRightKey}
              onChange={(e) => setRelativeRightKey(e.target.value)}
              style={{ minWidth: 220 }}
            >
              {RELATIVE_STRENGTH_OPTIONS.map((opt) => (
                <option key={`right-${opt.key}`} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
            {relativeBusy ? <span className="ticker-page__loading-pill">Loading relative strength…</span> : null}
          </div>
          <TickerSection16Section17
            rows={section16Rows}
            compareRows={section17CompareRows}
            relativeStrengthTitle={`Relative Strength vs ${relativeRightLabel}`}
            relativeStrengthHeader={`Relative Strength (${relativeLeftLabel} - ${relativeRightLabel})`}
          />
        </div>

        <aside className="ticker-page__aside">
          <section className="ticker-card ticker-card--signal" aria-labelledby="index-odin-signal-h">
            <div className="ticker-signal-head">
              <span className="ticker-signal-logo" aria-hidden />
              <h2 className="ticker-card__h ticker-card__h--inline" id="index-odin-signal-h">
                Odin Signal
              </h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">Index chart rows carry placeholder signal <strong>N</strong> (no signals feed on this page).</p>
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

          <section className="ticker-card" aria-labelledby="index-key-data-h">
            <div className="ticker-card__h-with-tip">
              <h2 className="ticker-card__h ticker-card__h--flex" id="index-key-data-h">
                Key data &amp; performance
              </h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  <strong>52-week range</strong> from ~1y daily OHLC when an official index ticker exists; otherwise from the index close series in
                  that window.
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
                  <dd>{hi52 != null && lo52 != null ? `${formatPx(lo52)} – ${formatPx(hi52)}` : '—'}</dd>
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
                  <dd>{ohlcSymbol ? formatVolLong(avgVol) : '—'}</dd>
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
            <p className="ticker-page__label ticker-kd-comp-label">Other indices</p>
            <p className="ticker-kd-comp">
              {relatedIndexLinks.length ? (
                relatedIndexLinks.map((x) => (
                  <Link key={x.slug} to={`/indices/${encodeURIComponent(x.slug)}`} className="ticker-kd-comp__a">
                    {x.label}
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
                  From <code className="ticker-data-tip__code">POST /api/market/index-returns</code> →{' '}
                  <code className="ticker-data-tip__code">performance.dynamicPeriods</code>. Benchmark uses{' '}
                  <code className="ticker-data-tip__code">POST /api/market/ticker-returns</code> for {BENCHMARK}.
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
                  <strong>MTD / QTD</strong> use the same ~1y OHLC samples as the ticker page when an official index OHLC symbol exists; otherwise MTD/QTD for the index may be limited.
                </p>
              </DataInfoTip>
            </div>
            <div className="ticker-compare">
              <div className="ticker-compare__head">
                <span />
                <span>{displaySym}</span>
                <span>{BENCHMARK}</span>
                <span>Diff</span>
              </div>
              {COMPARE_ROWS.map((row) => {
                const symPct = row.period
                  ? pickDynamic(dynamicSym, row.period)
                  : row.mtd
                    ? symMtd
                    : row.qtd
                      ? symQtd
                      : null;
                const spyPct = row.period
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

            <div className="ticker-subh-with-tip" style={{ marginTop: 14 }}>
              <h3 className="ticker-subh ticker-subh--flex">{activeMeta.label} Constituents</h3>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">
                  Source: <code className="ticker-data-tip__code">POST /api/market/ticker-details</code> with period{' '}
                  <code className="ticker-data-tip__code">last-date</code>. Return % is 1D.
                </p>
              </DataInfoTip>
            </div>
            <div className="index-constituents-card">
              <div className="index-constituents-table-wrap">
                <table className="index-constituents-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Close</th>
                      <th>Return %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexTickersPageRows.map((row) => (
                      <tr key={row.symbol}>
                        <td>
                          <button
                            type="button"
                            className="index-constituents-link"
                            onClick={() => navigate(`/ticker/${encodeURIComponent(row.symbol)}?ticker=${encodeURIComponent(row.symbol)}`)}
                          >
                            {row.symbol}
                          </button>
                        </td>
                        <td>{formatPx(row.close)}</td>
                        <td className={pctClass(row.ret1d)}>{formatPct(row.ret1d)}</td>
                      </tr>
                    ))}
                    {!indexTickersBusy && !indexTickersPageRows.length ? (
                      <tr>
                        <td colSpan={3} className="index-constituents-empty">No constituents found.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
                {indexTickersBusy ? <p className="ticker-page__news-sample-note">Loading constituents…</p> : null}
              </div>
              <div className="index-constituents-pagination" aria-label="Constituents pagination">
                <button
                  type="button"
                  className="index-constituents-page-btn index-constituents-page-btn--nav"
                  disabled={indexTickersPageSafe <= 1}
                  onClick={() => setIndexTickersPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous page"
                >
                  ‹
                </button>
                {indexTickersPageButtons.map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={
                      'index-constituents-page-btn' +
                      (p === indexTickersPageSafe ? ' index-constituents-page-btn--active' : '')
                    }
                    onClick={() => setIndexTickersPage(p)}
                    aria-current={p === indexTickersPageSafe ? 'page' : undefined}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="index-constituents-page-btn index-constituents-page-btn--nav"
                  disabled={indexTickersPageSafe >= indexTickersTotalPages}
                  onClick={() => setIndexTickersPage((p) => Math.min(indexTickersTotalPages, p + 1))}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
