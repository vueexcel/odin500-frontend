import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DataInfoTip } from '../components/DataInfoTip.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerMonthlyReturnsWaterfallDonut } from '../components/TickerMonthlyReturnsWaterfallDonut.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { AnnualReturnBarChart } from '../components/AnnualReturnBarChart.jsx';
import { ExcessReturnLineChart } from '../components/ExcessReturnLineChart.jsx';
import { PeriodicReturnBarChart } from '../components/PeriodicReturnBarChart.jsx';
import {fetchJsonCached, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { isoYearWeekFromIsoDate } from '../utils/isoWeek.js';
import { pickRelatedByCategory, RELATED_INDEX_LINKS } from '../utils/relatedTickers.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { alignComparisonRows, filterRowsByDateRange, filterRowsByYearRange, normalizePeriodReturnsRows } from '../utils/statisticsComparisonSeries.js';

const RESIZE_KEY_M_FIGMA = 'odin_ticker_monthly_resize_figma';
const RESIZE_KEY_M_POSNEG = 'odin_ticker_monthly_resize_posneg';
const RESIZE_KEY_M_MAIN = 'odin_ticker_monthly_resize_main';
const RESIZE_KEY_M_WF = 'odin_ticker_monthly_resize_waterfall';
const RETURNS_DEFAULT_START = '1980-01-01';
const DEFAULT_MONTHLY_START_YEAR = 2021;
const DEFAULT_MONTHLY_END_YEAR = 2026;
const DEFAULT_WEEKLY_START_YEAR = Math.max(1980, new Date().getFullYear() - 1);
const DEFAULT_WEEKLY_END_YEAR = Math.max(2026, new Date().getFullYear());
const BENCHMARK = 'SPY';
const BENCHMARK_OPTIONS = ['SPY', 'QQQ', 'DIA'].map((v) => ({ id: v, label: v }));
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
const TABLE_PAGE_SIZE = 30;
const PAGER_SIBLING_COUNT = 1;
const TABLE_RANGE_YEARS = { '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10, '15Y': 15, '20Y': 20 };
const DEFAULT_TABLE_RANGE_PRESET = '3Y';
const TABLE_RANGE_DROPDOWN_OPTIONS = [
  { id: '1Y', label: '1Y' },
  { id: '3Y', label: '3Y' },
  { id: '5Y', label: '5Y' },
  { id: '10Y', label: '10Y' },
  { id: '15Y', label: '15Y' },
  { id: '20Y', label: '20Y' },
];

function minMaxDailyPeriod(rows) {
  let min = '';
  let max = '';
  if (!Array.isArray(rows)) return { min, max };
  for (const r of rows) {
    const p = String(r?.period ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p)) continue;
    if (!min || p < min) min = p;
    if (!max || p > max) max = p;
  }
  return { min, max };
}

function defaultDailyFetchRange(endIso) {
  const end = String(endIso || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const d = new Date(end + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return { start: '', end: '' };
  d.setMonth(d.getMonth() - 1);
  return { start: d.toISOString().slice(0, 10), end };
}

function normalizeDailyPair(prev, field, rawValue) {
  const v = String(rawValue ?? '').slice(0, 10);
  let start = field === 'start' ? v : String(prev.start ?? '').slice(0, 10);
  let end = field === 'end' ? v : String(prev.end ?? '').slice(0, 10);
  if (start && end && start > end) {
    const t = start;
    start = end;
    end = t;
  }
  return { start, end };
}

const DAILY_CHART_DATE_INPUT_CLASS =
  'h-7 w-[100px] shrink-0 rounded-md border border-slate-400/45  px-1 py-0 text-[11px] leading-7 text-slate-900 shadow-sm outline-none focus:border-sky-500/80 dark:border-white/12  dark:text-slate-100 dark:focus:border-sky-400/60';

/** Compact start/end dates for daily charts (same row as toolbar buttons; applies on change). */
function DailyChartDateRangeToolbar({ draft, loadedRange, onChangeStart, onChangeEnd }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1 self-center mr-2" aria-label="Daily returns date range">
      <label className="inline-flex items-center gap-1.5">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          Start
        </span>
        <input
          type="date"
          className={DAILY_CHART_DATE_INPUT_CLASS}
          value={draft.start}
          max={draft.end || loadedRange.max || undefined}
          onChange={onChangeStart}
        />
      </label>
      <label className="inline-flex items-center gap-1.5">
        <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
          End
        </span>
        <input
          type="date"
          className={DAILY_CHART_DATE_INPUT_CLASS}
          value={draft.end}
          min={draft.start || loadedRange.min || undefined}
          max={loadedRange.max || undefined}
          onChange={onChangeEnd}
        />
      </label>
    </div>
  );
}

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}
function formatPct(v) { return fmtPct(v); }
function pctTone(v) {
  if (v == null || !Number.isFinite(Number(v))) return 'statistic-data__ret statistic-data__ret--flat';
  if (Number(v) > 0) return 'statistic-data__ret statistic-data__ret--up';
  if (Number(v) < 0) return 'statistic-data__ret statistic-data__ret--down';
  return 'statistic-data__ret statistic-data__ret--flat';
}
function pctClass(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  if (Number(n) > 0) return 'ticker-num--up';
  if (Number(n) < 0) return 'ticker-num--down';
  return '';
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
function sortRowsAsc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = rowDateToTimeKey(a);
    const tb = rowDateToTimeKey(b);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}
function parseYear(period) {
  const m = String(period || '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function monthPeriodOrderKey(row) {
  const end = row?.endDate && String(row.endDate).slice(0, 10);
  if (end && !Number.isNaN(Date.parse(end))) return Date.parse(end);
  const start = row?.startDate && String(row.startDate).slice(0, 10);
  if (start && !Number.isNaN(Date.parse(start))) return Date.parse(start);
  const y = row?.year;
  if (Number.isFinite(y)) return y * 100;
  return 0;
}
function signalBucket(sig) {
  const s = String(sig || 'N').trim().toUpperCase();
  if (!s || s === 'N' || s === 'NULL') return 'N';
  if (/^L1/.test(s)) return 'L1';
  if (/^L2/.test(s)) return 'L2';
  if (s.startsWith('L')) return 'L3';
  if (/^S1/.test(s)) return 'S1';
  if (/^S2/.test(s)) return 'S2';
  if (s.startsWith('S')) return 'S3';
  return 'N';
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
  for (let i = 1; i < closes.length; i += 1) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) lr.push(Math.log(b / a));
  }
  if (lr.length < 2) return null;
  const mean = lr.reduce((s, x) => s + x, 0) / lr.length;
  const varSample = lr.reduce((s, x) => s + (x - mean) ** 2, 0) / (lr.length - 1);
  return Math.round(Math.sqrt(varSample) * Math.sqrt(252) * 100 * 10) / 10;
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
  const lastIso = rowDateToTimeKey(sortedAsc[sortedAsc.length - 1]);
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
  const lastIso = rowDateToTimeKey(sortedAsc[sortedAsc.length - 1]);
  if (!lastIso) return null;
  const lastD = new Date(lastIso + 'T12:00:00');
  const q = Math.floor(lastD.getMonth() / 3);
  const qStart = new Date(lastD.getFullYear(), q * 3, 1);
  return periodReturnFromRows(sortedAsc, (r) => {
    const iso = rowDateToTimeKey(r);
    return iso ? new Date(iso + 'T12:00:00') >= qStart : false;
  });
}
function IconTrendUp({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
<path d="M18.3332 5.83301L11.776 12.3902C11.446 12.7202 11.281 12.8852 11.0907 12.947C10.9233 13.0014 10.743 13.0014 10.5757 12.947C10.3854 12.8852 10.2204 12.7202 9.89036 12.3902L7.60931 10.1091C7.2793 9.77914 7.11429 9.61413 6.92402 9.55231C6.75665 9.49792 6.57636 9.49792 6.40899 9.55231C6.21872 9.61413 6.05371 9.77914 5.72369 10.1092L1.6665 14.1663M18.3332 11.6663V5.83301H12.4998" stroke="#38C35B" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}
function IconTrendDown({ className }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
<path d="M18.3332 14.1663L11.776 7.60915C11.446 7.27914 11.281 7.11413 11.0907 7.05231C10.9233 6.99792 10.743 6.99792 10.5757 7.05231C10.3854 7.11413 10.2204 7.27914 9.89036 7.60915L7.60931 9.8902C7.2793 10.2202 7.11429 10.3852 6.92402 10.447C6.75665 10.5014 6.57636 10.5014 6.40899 10.447C6.21872 10.3852 6.05371 10.2202 5.72369 9.8902L1.6665 5.83301M18.3332 8.33301V14.1663H12.4998" stroke="#FA4C60" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}

function buildPaginationItems(totalPages, currentPage, siblingCount = PAGER_SIBLING_COUNT) {
  if (totalPages <= 1) return [1];
  const totalNumbers = siblingCount * 2 + 5;
  if (totalPages <= totalNumbers) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);
  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;
  if (!showLeftDots && showRightDots) {
    const leftRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => i + 1);
    return [...leftRange, 'dots-right', totalPages];
  }
  if (showLeftDots && !showRightDots) {
    const rightRangeStart = totalPages - (2 + siblingCount * 2);
    const rightRange = Array.from({ length: 3 + siblingCount * 2 }, (_, i) => rightRangeStart + i);
    return [1, 'dots-left', ...rightRange];
  }
  const middle = [];
  for (let p = leftSibling; p <= rightSibling; p += 1) middle.push(p);
  return [1, 'dots-left', ...middle, 'dots-right', totalPages];
}

function IconChevronLeft({ double = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {double ? (
        <>
          <path d="M8.8 3.2L5 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.8 3.2L2 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M8.7 3.2L4.9 7l3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function IconChevronRight({ double = false }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      {double ? (
        <>
          <path d="M5.2 3.2L9 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8.2 3.2L12 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <path d="M5.3 3.2L9.1 7l-3.8 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function FigmaPagination({ page, totalPages, onPageChange }) {
  const items = useMemo(() => buildPaginationItems(totalPages, page), [totalPages, page]);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="statistic-data__pager-figma" role="navigation" aria-label="Table pagination">
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="First page" onClick={() => onPageChange(1)} disabled={!canPrev}>
        <IconChevronLeft double />
      </button>
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="Previous page" onClick={() => onPageChange(page - 1)} disabled={!canPrev}>
        <IconChevronLeft />
      </button>
      {items.map((it, idx) =>
        typeof it === 'number' ? (
          <button
            key={`p-${it}`}
            type="button"
            className={'statistic-data__pg-btn' + (it === page ? ' statistic-data__pg-btn--active' : '')}
            aria-label={`Page ${it}`}
            aria-current={it === page ? 'page' : undefined}
            onClick={() => onPageChange(it)}
          >
            {it}
          </button>
        ) : (
          <span key={`${it}-${idx}`} className="statistic-data__pg-dots" aria-hidden>
            ...
          </span>
        )
      )}
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="Next page" onClick={() => onPageChange(page + 1)} disabled={!canNext}>
        <IconChevronRight />
      </button>
      <button type="button" className="statistic-data__pg-btn statistic-data__pg-btn--icon" aria-label="Last page" onClick={() => onPageChange(totalPages)} disabled={!canNext}>
        <IconChevronRight double />
      </button>
    </div>
  );
}

export default function TickerMonthlyPage({ periodMode = 'monthly' }) {
  const isWeekly = periodMode === 'weekly';
  const isDaily = periodMode === 'daily';
  const modeLabel = isWeekly ? 'Weekly' : isDaily ? 'Daily' : 'Monthly';
  const modeSlug = isWeekly ? 'weekly' : isDaily ? 'daily' : 'monthly';
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const [sym, setSym] = useState(() => sanitizeTickerPageInput(symbolParam) || 'AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [benchmarkIndex, setBenchmarkIndex] = useState(BENCHMARK);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthlyReturnsRaw, setMonthlyReturnsRaw] = useState([]);
  const [benchmarkReturnsRaw, setBenchmarkReturnsRaw] = useState([]);
  const [dynamicSym, setDynamicSym] = useState([]);
  const [dynamicSpy, setDynamicSpy] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [chartStartYear, setChartStartYear] = useState(String(DEFAULT_MONTHLY_START_YEAR));
  const [chartEndYear, setChartEndYear] = useState(String(DEFAULT_MONTHLY_END_YEAR));
  const [weeklyStartYear, setWeeklyStartYear] = useState(String(DEFAULT_WEEKLY_START_YEAR));
  const [weeklyEndYear, setWeeklyEndYear] = useState(String(DEFAULT_WEEKLY_END_YEAR));
  const [tableRange, setTableRange] = useState(DEFAULT_TABLE_RANGE_PRESET);
  const [tableSort, setTableSort] = useState({ column: 'period', direction: 'desc' });
  const [tablePage, setTablePage] = useState(1);
  const [dailyFilter, setDailyFilter] = useState(() => ({ start: '', end: '' }));
  const [dailyFilterDraft, setDailyFilterDraft] = useState(() => ({ start: '', end: '' }));
  const [dailyFetchRange, setDailyFetchRange] = useState(() =>
    defaultDailyFetchRange(new Date().toISOString().slice(0, 10))
  );
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');

  useEffect(() => {
    const next = sanitizeTickerPageInput(symbolParam) || 'AAPL';
    setSym((prev) => (prev === next ? prev : next));
  }, [symbolParam]);

  usePageSeo({
    title: `${String(sym).toUpperCase()} ${modeLabel} Returns | Odin500`,
    description: `${modeLabel} return charts and table for ${String(sym).toUpperCase()} on Odin500.`,
    canonicalPath: `/statistic/ticker-${modeSlug}/${String(sym || 'aapl').toLowerCase()}`
  });

  const onSymbolChange = useCallback((next) => {
    const s = sanitizeTickerPageInput(next) || 'AAPL';
    setSym(s);
    navigate(`/statistic/ticker-${modeSlug}/` + encodeURIComponent(s));
  }, [navigate, modeSlug]);

  useEffect(() => {
    let cancelled = false;
    if (!canFetchProtectedApi()) {
      setError('Sign in to load ticker data.');
      setMonthlyReturnsRaw([]);
      return () => { cancelled = true; };
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const end = new Date().toISOString().slice(0, 10);
        const tickerU = String(sym || '').toUpperCase().trim();
        const body = { ticker: tickerU, customStartDate: RETURNS_DEFAULT_START, customEndDate: end };
        const fallbackDaily = defaultDailyFetchRange(end);
        const dailyStart = dailyFetchRange.start || fallbackDaily.start;
        const dailyEnd = dailyFetchRange.end || fallbackDaily.end;
        const oneYearStart = new Date(end + 'T12:00:00');
        oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
        const oneYearStartIso = oneYearStart.toISOString().slice(0, 10);
        const primaryReq = isWeekly
          ? fetchJsonCached({
            path: '/api/market/weekly-ohlc',
            method: 'POST',
            body: { ticker: tickerU, start_date: RETURNS_DEFAULT_START, end_date: end },
            ttlMs: 5 * 60 * 1000
          })
          : isDaily
            ? fetchJsonCached({
              path: `/api/market/ohlc?symbol=${encodeURIComponent(tickerU)}&start_date=${encodeURIComponent(dailyStart)}&end_date=${encodeURIComponent(dailyEnd)}&limit=400`,
              method: 'GET',
              ttlMs: 5 * 60 * 1000
            })
          : fetchJsonCached({ path: '/api/market/ticker-monthly-returns', method: 'POST', body, ttlMs: 5 * 60 * 1000 });
        const benchmarkReq = isWeekly
          ? fetchJsonCached({
            path: '/api/market/weekly-ohlc',
            method: 'POST',
            body: { ticker: benchmarkIndex, start_date: RETURNS_DEFAULT_START, end_date: end },
            ttlMs: 5 * 60 * 1000
          })
          : isDaily
            ? fetchJsonCached({
              path: `/api/market/ohlc?symbol=${encodeURIComponent(benchmarkIndex)}&start_date=${encodeURIComponent(dailyStart)}&end_date=${encodeURIComponent(dailyEnd)}&limit=400`,
              method: 'GET',
              ttlMs: 5 * 60 * 1000
            })
            : fetchJsonCached({
              path: '/api/market/ticker-monthly-returns',
              method: 'POST',
              body: { ...body, ticker: benchmarkIndex },
              ttlMs: 5 * 60 * 1000
            });
        const [mRes, mBenchRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes, detailsRes] = await Promise.all([
          primaryReq,
          benchmarkReq,
          fetchJsonCached({ path: '/api/market/ticker-core-returns', method: 'POST', body, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-core-returns', method: 'POST', body: { ...body, ticker: benchmarkIndex }, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: `/api/market/ohlc?symbol=${encodeURIComponent(tickerU)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`, method: 'GET', ttlMs: 10 * 60 * 1000 }),
          fetchJsonCached({ path: `/api/market/ohlc?symbol=${encodeURIComponent(benchmarkIndex)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`, method: 'GET', ttlMs: 10 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-details', method: 'POST', body: { index: 'sp500', period: 'last-1-year' }, ttlMs: 30 * 60 * 1000 })
        ]);
        if (cancelled) return;
        const perf = mRes?.data?.performance || {};
        const coreSymPerf = coreSymRes?.data?.performance || {};
        const coreSpyPerf = coreSpyRes?.data?.performance || {};
        if (isWeekly) {
          const mapWeeklyPayload = (payload) => {
            const weekly = Array.isArray(payload?.data?.weeklyOHLC) ? payload.data.weeklyOHLC : [];
            return weekly
            .map((r) => {
              const open = Number(r?.Open ?? r?.open);
              const close = Number(r?.Close ?? r?.close);
              let yearNum = Number(r?.year);
              let weekNum = Number(r?.week);
              const endDateRaw = String(r?.end_date ?? r?.Date ?? r?.date ?? '');
              const startDateRaw = String(r?.start_date ?? '');
              const weekStartRaw = String(r?.week_start ?? '');
              const startDate = startDateRaw.slice(0, 10);
              const endDate = endDateRaw.slice(0, 10);
              const weekStart = weekStartRaw.slice(0, 10);
              const period =
                endDate ||
                startDate ||
                weekStart ||
                (Number.isFinite(yearNum) && Number.isFinite(weekNum) && weekNum >= 1 && weekNum <= 53
                  ? `${yearNum}-W${String(weekNum).padStart(2, '0')}`
                  : '');
              const fallbackIw = endDate ? isoYearWeekFromIsoDate(endDate) : null;
              if (
                (!Number.isFinite(yearNum) || !Number.isFinite(weekNum)) &&
                fallbackIw
              ) {
                yearNum = fallbackIw.year;
                weekNum = fallbackIw.week;
              }
              if (!period || !Number.isFinite(open) || !Number.isFinite(close) || open === 0) return null;
              return {
                period,
                startDate: startDate || endDate,
                endDate: endDate || startDate,
                startPrice: open,
                endPrice: close,
                totalReturn: ((close - open) / open) * 100,
                isoYear: Number.isFinite(yearNum) ? yearNum : null,
                isoWeek: Number.isFinite(weekNum) ? weekNum : null
              };
            })
            .filter(Boolean);
          };
          setMonthlyReturnsRaw(mapWeeklyPayload(mRes));
          setBenchmarkReturnsRaw(mapWeeklyPayload(mBenchRes));
        } else if (isDaily) {
          const mapDailyPayload = (payload) => {
            const rawRows = Array.isArray(payload?.data?.data) ? payload.data.data : Array.isArray(payload?.data) ? payload.data : [];
            const sorted = sortRowsAsc(rawRows);
            const mapped = [];
            for (let i = 1; i < sorted.length; i += 1) {
              const prev = pickNum(sorted[i - 1], ['Close', 'close']);
              const next = pickNum(sorted[i], ['Close', 'close']);
              const iso = rowDateToTimeKey(sorted[i]);
              if (!iso || prev == null || next == null || prev === 0) continue;
              mapped.push({
                period: iso,
                startDate: rowDateToTimeKey(sorted[i - 1]) || '',
                endDate: iso,
                startPrice: prev,
                endPrice: next,
                totalReturn: ((next - prev) / prev) * 100
              });
            }
            return mapped;
          };
          const rawRows = Array.isArray(mRes?.data?.data) ? mRes.data.data : Array.isArray(mRes?.data) ? mRes.data : [];
          console.info('[DailyReturns] API response rows', {
            symbol: tickerU,
            startDate: dailyStart,
            endDate: dailyEnd,
            rawRows: rawRows.length
          });
          const mapped = mapDailyPayload(mRes);
          console.info('[DailyReturns] Mapped return rows', {
            symbol: tickerU,
            mappedRows: mapped.length
          });
          setMonthlyReturnsRaw(mapped);
          setBenchmarkReturnsRaw(mapDailyPayload(mBenchRes));
        } else {
          setMonthlyReturnsRaw(Array.isArray(perf.monthlyReturns) ? perf.monthlyReturns : []);
          const perfBench = mBenchRes?.data?.performance || {};
          setBenchmarkReturnsRaw(Array.isArray(perfBench.monthlyReturns) ? perfBench.monthlyReturns : []);
        }
        setDynamicSym(Array.isArray(coreSymPerf.dynamicPeriods) ? coreSymPerf.dynamicPeriods : []);
        setDynamicSpy(Array.isArray(coreSpyPerf.dynamicPeriods) ? coreSpyPerf.dynamicPeriods : []);
        const symRows = Array.isArray(ohlcSymRes?.data?.data) ? ohlcSymRes.data.data : Array.isArray(ohlcSymRes?.data) ? ohlcSymRes.data : [];
        const spyRows = Array.isArray(ohlcSpyRes?.data?.data) ? ohlcSpyRes.data.data : Array.isArray(ohlcSpyRes?.data) ? ohlcSpyRes.data : [];
        setStatsRows(sortRowsAsc(symRows));
        setStatsRowsSpy(sortRowsAsc(spyRows));
        setDetailRows(Array.isArray(detailsRes?.data?.data) ? detailsRes.data.data : []);
        setAsOfDate(String(mRes?.data?.asOfDate || end).slice(0, 10));
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || `Failed to load ${modeSlug} returns`);
          setMonthlyReturnsRaw([]);
          setBenchmarkReturnsRaw([]);
          setDynamicSym([]);
          setDynamicSpy([]);
          setStatsRows([]);
          setStatsRowsSpy([]);
          setDetailRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sym, isWeekly, isDaily, modeSlug, dailyFetchRange.start, dailyFetchRange.end, benchmarkIndex]);

  const dailyReturnsForUi = useMemo(() => {
    if (!isDaily) return null;
    return filterReturnsRows(monthlyReturnsRaw, dailyFilter.start, dailyFilter.end);
  }, [isDaily, monthlyReturnsRaw, dailyFilter.start, dailyFilter.end]);

  const dailyLoadedRange = useMemo(
    () => (isDaily ? minMaxDailyPeriod(monthlyReturnsRaw) : { min: '', max: '' }),
    [isDaily, monthlyReturnsRaw]
  );

  const dailyShownRange = useMemo(
    () => (isDaily ? minMaxDailyPeriod(dailyReturnsForUi || []) : { min: '', max: '' }),
    [isDaily, dailyReturnsForUi]
  );

  const onDailyToolbarDateChange = useCallback(
    (field, rawValue) => {
      setDailyFilterDraft((prev) => {
        const norm = normalizeDailyPair(prev, field, rawValue);
        setDailyFilter(norm);
        if (isDaily) {
          const fallback = defaultDailyFetchRange(new Date().toISOString().slice(0, 10));
          setDailyFetchRange({
            start: norm.start || fallback.start,
            end: norm.end || fallback.end
          });
        }
        return norm;
      });
    },
    [isDaily]
  );

  useEffect(() => {
    const fallback = defaultDailyFetchRange(new Date().toISOString().slice(0, 10));
    setDailyFilter({ start: '', end: '' });
    setDailyFilterDraft({ start: '', end: '' });
    setDailyFetchRange(fallback);
  }, [sym]);

  const monthYearOptions = useMemo(() => {
    const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
    const years = Array.from(
      new Set(
        rows
          .map((r) => parseYear(r?.period))
          .filter((y) => Number.isFinite(y))
      )
    ).sort((a, b) => a - b);
    return years.length ? years : Array.from({ length: 2026 - 1980 + 1 }, (_, i) => 1980 + i);
  }, [monthlyReturnsRaw]);
  const weekYearOptions = useMemo(() => {
    if (!isWeekly) return [];
    const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
    const fromData = Array.from(
      new Set(rows.map((r) => parseYear(r?.period)).filter((y) => Number.isFinite(y)))
    );
    const maxCal = Math.max(2026, new Date().getFullYear());
    const hi = Math.max(maxCal, ...(fromData.length ? fromData : [maxCal]));
    const lo = 1980;
    return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  }, [isWeekly, monthlyReturnsRaw]);
  const monthYearDropdownOptions = useMemo(
    () =>
      [...monthYearOptions]
        .sort((a, b) => b - a)
        .map((y) => ({ id: String(y), label: String(y) })),
    [monthYearOptions]
  );
  const weekYearDropdownOptions = useMemo(
    () =>
      [...weekYearOptions]
        .sort((a, b) => b - a)
        .map((y) => ({ id: String(y), label: String(y) })),
    [weekYearOptions]
  );

  /** Avoid resetting user-defined weekly start/end when only raw rows refresh; reset when span or symbol changes. */
  const weekYearSpanKey = useMemo(() => {
    if (!isWeekly || !weekYearOptions.length) return '';
    const lo = weekYearOptions[0];
    const hi = weekYearOptions[weekYearOptions.length - 1];
    return `${lo}:${hi}`;
  }, [isWeekly, weekYearOptions]);

  useEffect(() => {
    if (isDaily || isWeekly || !monthYearOptions.length) return;
    const hasDefaultStart = monthYearOptions.includes(DEFAULT_MONTHLY_START_YEAR);
    const hasDefaultEnd = monthYearOptions.includes(DEFAULT_MONTHLY_END_YEAR);
    const nextStart = hasDefaultStart ? DEFAULT_MONTHLY_START_YEAR : monthYearOptions[0];
    const nextEnd = hasDefaultEnd ? DEFAULT_MONTHLY_END_YEAR : monthYearOptions[monthYearOptions.length - 1];
    setChartStartYear((prev) => (monthYearOptions.includes(Number(prev)) ? prev : String(nextStart)));
    setChartEndYear((prev) => (monthYearOptions.includes(Number(prev)) ? prev : String(nextEnd)));
  }, [isDaily, isWeekly, monthYearOptions]);
  useEffect(() => {
    if (!isWeekly || !weekYearOptions.length) return;
    const hi = weekYearOptions[weekYearOptions.length - 1];
    const lo = Math.max(weekYearOptions[0], hi - 1);
    const nextStart = weekYearOptions.includes(lo) ? lo : weekYearOptions[0];
    const nextEnd = weekYearOptions.includes(hi) ? hi : weekYearOptions[weekYearOptions.length - 1];
    setWeeklyStartYear(String(nextStart));
    setWeeklyEndYear(String(nextEnd));
  }, [isWeekly, sym, weekYearSpanKey]);

  const monthlyChartRows = useMemo(() => {
    if (isDaily) return dailyReturnsForUi || [];
    if (isWeekly) {
      const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
      const startY = Number(weeklyStartYear);
      const endY = Number(weeklyEndYear);
      if (!Number.isFinite(startY) || !Number.isFinite(endY)) return rows;
      const lo = Math.min(startY, endY);
      const hi = Math.max(startY, endY);
      return rows.filter((r) => {
        const y = parseYear(r?.period);
        return Number.isFinite(y) && y >= lo && y <= hi;
      });
    }
    const rows = Array.isArray(monthlyReturnsRaw) ? monthlyReturnsRaw : [];
    const startY = Number(chartStartYear);
    const endY = Number(chartEndYear);
    if (!Number.isFinite(startY) || !Number.isFinite(endY)) return rows;
    const lo = Math.min(startY, endY);
    const hi = Math.max(startY, endY);
    return rows.filter((r) => {
      const y = parseYear(r?.period);
      return Number.isFinite(y) && y >= lo && y <= hi;
    });
  }, [
    chartEndYear,
    chartStartYear,
    dailyReturnsForUi,
    isDaily,
    isWeekly,
    monthlyReturnsRaw,
    weeklyEndYear,
    weeklyStartYear
  ]);
  const benchmarkChartRows = useMemo(() => {
    if (isDaily) return filterReturnsRows(benchmarkReturnsRaw, dailyFilter.start, dailyFilter.end);
    if (isWeekly) {
      const rows = Array.isArray(benchmarkReturnsRaw) ? benchmarkReturnsRaw : [];
      return filterRowsByYearRange(
        normalizePeriodReturnsRows(rows, 'weekly'),
        weeklyStartYear,
        weeklyEndYear
      ).map((r) => ({ period: r.period, startDate: r.startDate, endDate: r.endDate, totalReturn: r.returnPct }));
    }
    const rows = Array.isArray(benchmarkReturnsRaw) ? benchmarkReturnsRaw : [];
    return filterRowsByYearRange(
      normalizePeriodReturnsRows(rows, 'monthly'),
      chartStartYear,
      chartEndYear
    ).map((r) => ({ period: r.period, startDate: r.startDate, endDate: r.endDate, totalReturn: r.returnPct }));
  }, [
    benchmarkReturnsRaw,
    chartEndYear,
    chartStartYear,
    dailyFilter.end,
    dailyFilter.start,
    isDaily,
    isWeekly,
    weeklyEndYear,
    weeklyStartYear
  ]);
  const comparisonRows = useMemo(() => {
    const modeForUtil = isDaily ? 'daily' : isWeekly ? 'weekly' : 'monthly';
    const tRows = normalizePeriodReturnsRows(monthlyChartRows, modeForUtil);
    const bRows = normalizePeriodReturnsRows(benchmarkChartRows, modeForUtil);
    let out = alignComparisonRows(tRows, bRows);
    if (isWeekly) out = filterRowsByYearRange(out, weeklyStartYear, weeklyEndYear);
    if (isDaily) out = filterRowsByDateRange(out, dailyFilter.start, dailyFilter.end);
    return out;
  }, [benchmarkChartRows, dailyFilter.end, dailyFilter.start, isDaily, isWeekly, monthlyChartRows, weeklyEndYear, weeklyStartYear]);

  const monthlyChartRangeControls = !isDaily && !isWeekly ? (
    <div className="ticker-page__custom-range" aria-label="Monthly chart year range">
      <span className="ticker-page__label ticker-page__label--inline">Start</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={chartStartYear}
        options={monthYearDropdownOptions}
        onChange={setChartStartYear}
        title="Start year"
        ariaLabelPrefix="Start year"
        labelFallback={chartStartYear}
      />
      <span className="ticker-page__label ticker-page__label--inline">End</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={chartEndYear}
        options={monthYearDropdownOptions}
        onChange={setChartEndYear}
        title="End year"
        ariaLabelPrefix="End year"
        labelFallback={chartEndYear}
      />
    </div>
  ) : null;
  const weeklyChartRangeControls = isWeekly ? (
    <div className="ticker-page__custom-range" aria-label="Weekly chart year range">
      <span className="ticker-page__label ticker-page__label--inline">Start</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={weeklyStartYear}
        options={weekYearDropdownOptions}
        onChange={setWeeklyStartYear}
        title="Weekly start year"
        ariaLabelPrefix="Start year"
        labelFallback={weeklyStartYear}
      />
      <span className="ticker-page__label ticker-page__label--inline">End</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={weeklyEndYear}
        options={weekYearDropdownOptions}
        onChange={setWeeklyEndYear}
        title="Weekly end year"
        ariaLabelPrefix="End year"
        labelFallback={weeklyEndYear}
      />
    </div>
  ) : null;
  const mkDailyDateToolbar = useCallback(
    () => (
      <DailyChartDateRangeToolbar
        draft={dailyFilterDraft}
        loadedRange={dailyLoadedRange}
        onChangeStart={(e) => onDailyToolbarDateChange('start', e.target.value)}
        onChangeEnd={(e) => onDailyToolbarDateChange('end', e.target.value)}
      />
    ),
    [dailyFilterDraft, dailyLoadedRange, onDailyToolbarDateChange]
  );
  const tableRowsFiltered = useMemo(() => {
    const source = isDaily ? dailyReturnsForUi || [] : monthlyReturnsRaw;
    const rows = (Array.isArray(source) ? source : [])
      .map((r) => ({
        period: r?.period,
        startDate: r?.startDate,
        endDate: r?.endDate,
        startClose: r?.startPrice,
        endClose: r?.endPrice,
        returnPct: r?.totalReturn,
        year: (() => {
          let y = parseYear(r?.period);
          if (!Number.isFinite(y)) y = Number(String(r?.startDate || '').slice(0, 4));
          if (!Number.isFinite(y)) y = Number(String(r?.endDate || '').slice(0, 4));
          return Number.isFinite(y) ? y : null;
        })()
      }))
      .filter((r) => r.period);
    if (isDaily) return rows;
    if (isWeekly) {
      const startY = Number(weeklyStartYear);
      const endY = Number(weeklyEndYear);
      if (!Number.isFinite(startY) || !Number.isFinite(endY)) return rows;
      const lo = Math.min(startY, endY);
      const hi = Math.max(startY, endY);
      return rows.filter((r) => Number.isFinite(r.year) && r.year >= lo && r.year <= hi);
    }
    const ys = rows.map((r) => r.year).filter(Number.isFinite);
    if (!ys.length) return [];
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const hi = maxY;
    let lo;
    if (tableRange === 'MAX') {
      lo = minY;
    } else {
      const span = TABLE_RANGE_YEARS[tableRange];
      if (!Number.isFinite(span)) return [];
      lo = hi - (span - 1);
      if (lo < minY) lo = minY;
    }
    return rows.filter((r) => Number.isFinite(r.year) && r.year >= lo && r.year <= hi);
  }, [
    monthlyReturnsRaw,
    tableRange,
    isDaily,
    dailyReturnsForUi,
    isWeekly,
    weeklyEndYear,
    weeklyStartYear
  ]);

  const tableRowsSorted = useMemo(() => {
    const rows = [...tableRowsFiltered];
    const { column, direction } = tableSort;
    const dir = direction === 'asc' ? 1 : -1;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    rows.sort((a, b) => {
      let cmp = 0;
      switch (column) {
        case 'period':
          cmp = monthPeriodOrderKey(a) - monthPeriodOrderKey(b);
          break;
        case 'startDate':
          cmp = String(a.startDate || '').localeCompare(String(b.startDate || ''));
          break;
        case 'endDate':
          cmp = String(a.endDate || '').localeCompare(String(b.endDate || ''));
          break;
        case 'startPrice':
          cmp = (num(a.startClose) ?? -Infinity) - (num(b.startClose) ?? -Infinity);
          break;
        case 'endPrice':
          cmp = (num(a.endClose) ?? -Infinity) - (num(b.endClose) ?? -Infinity);
          break;
        case 'return':
          cmp = (num(a.returnPct) ?? -Infinity) - (num(b.returnPct) ?? -Infinity);
          break;
        default:
          cmp = 0;
      }
      return dir * cmp;
    });
    return rows;
  }, [tableRowsFiltered, tableSort]);

  const tableTotalPages = useMemo(() => Math.max(1, Math.ceil(tableRowsSorted.length / TABLE_PAGE_SIZE)), [tableRowsSorted.length]);
  const tablePageSafe = useMemo(() => Math.min(Math.max(1, tablePage), tableTotalPages), [tablePage, tableTotalPages]);
  const tablePageRows = useMemo(() => {
    const start = (tablePageSafe - 1) * TABLE_PAGE_SIZE;
    return tableRowsSorted.slice(start, start + TABLE_PAGE_SIZE);
  }, [tableRowsSorted, tablePageSafe]);

  const onTableSortClick = useCallback((column) => {
    setTableSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'desc' };
    });
  }, []);

  useEffect(() => {
    setTablePage(1);
  }, [sym, tableRange, dailyFilter.start, dailyFilter.end, isDaily, isWeekly, weeklyStartYear, weeklyEndYear, tableSort.column, tableSort.direction]);
  useEffect(() => { setTablePage((p) => Math.min(Math.max(1, p), tableTotalPages)); }, [tableTotalPages]);

  const symU = String(sym || '').toUpperCase();
  const myDetail = useMemo(() => detailRows.find((r) => String(r.Symbol || r.symbol || '').toUpperCase().trim() === symU) || null, [detailRows, symU]);
  const sector = String(myDetail?.Sector || myDetail?.sector || '').trim();
  const competitors = useMemo(
    () =>
      pickRelatedByCategory(
        detailRows,
        symU,
        sector,
        String(
          myDetail?.SubIndustry ||
            myDetail?.subIndustry ||
            myDetail?.subindustry ||
            myDetail?.Industry ||
            myDetail?.industry ||
            ''
        ).trim(),
        6
      ),
    [detailRows, symU, sector, myDetail]
  );
  const highs = statsRows.map((r) => pickNum(r, ['High', 'high'])).filter((v) => v != null);
  const lows = statsRows.map((r) => pickNum(r, ['Low', 'low'])).filter((v) => v != null);
  const vols = statsRows.map((r) => pickNum(r, ['Volume', 'volume', 'VOLUME'])).filter((v) => v != null);
  const closes = statsRows.map((r) => pickNum(r, ['Close', 'close'])).filter((v) => v != null);
  const hi52 = highs.length ? Math.max(...highs) : null;
  const lo52 = lows.length ? Math.min(...lows) : null;
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
  const vola = annualizedVol(closes);
  const lastRow = statsRows.length ? statsRows[statsRows.length - 1] : null;
  const lastSignal = lastRow && lastRow.signal != null ? String(lastRow.signal) : 'N';
  const activeBucket = signalBucket(lastSignal);
  const lastUpdatedIso = lastRow ? rowDateToTimeKey(lastRow) : asOfDate;
  const lastUpdatedFmt =
    lastUpdatedIso && !Number.isNaN(Date.parse(lastUpdatedIso))
      ? new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York', timeZoneName: 'short' }).format(new Date(lastUpdatedIso + 'T16:00:00'))
      : '—';
  const symMtd = mtdFromRows(statsRows);
  const symQtd = qtdFromRows(statsRows);
  const spyMtd = mtdFromRows(statsRowsSpy);
  const spyQtd = qtdFromRows(statsRowsSpy);
  const selectedIndexSeries = { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
  const selectedTickerSeries = { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd };

  const monthlyReturnsTableHeadActions = useMemo(
    () =>
      isDaily ? (
        <>
          <label className="statistic-data__range">
            <span>Start</span>
            <input
              type="date"
              className={DAILY_CHART_DATE_INPUT_CLASS}
              value={dailyFilterDraft.start}
              max={dailyFilterDraft.end || dailyLoadedRange.max || undefined}
              onChange={(e) => onDailyToolbarDateChange('start', e.target.value)}
            />
          </label>
          <label className="statistic-data__range">
            <span>End</span>
            <input
              type="date"
              className={DAILY_CHART_DATE_INPUT_CLASS}
              value={dailyFilterDraft.end}
              min={dailyFilterDraft.start || dailyLoadedRange.min || undefined}
              max={dailyLoadedRange.max || undefined}
              onChange={(e) => onDailyToolbarDateChange('end', e.target.value)}
            />
          </label>
        </>
      ) : isWeekly ? (
        <>
          <label className="statistic-data__range">
            <span>Start</span>
            <ThemedDropdown
              size="sm"
              style={{ minWidth: 86 }}
              value={weeklyStartYear}
              options={weekYearDropdownOptions}
              onChange={setWeeklyStartYear}
              title="Table start year"
              ariaLabelPrefix="Start"
              labelFallback={weeklyStartYear}
            />
          </label>
          <label className="statistic-data__range">
            <span>End</span>
            <ThemedDropdown
              size="sm"
              style={{ minWidth: 86 }}
              value={weeklyEndYear}
              options={weekYearDropdownOptions}
              onChange={setWeeklyEndYear}
              title="Table end year"
              ariaLabelPrefix="End"
              labelFallback={weeklyEndYear}
            />
          </label>
        </>
      ) : (
        <label className="statistic-data__range">
          <span>Range</span>
          <ThemedDropdown
            size="sm"
            style={{ minWidth: 86 }}
            value={tableRange}
            options={TABLE_RANGE_DROPDOWN_OPTIONS}
            onChange={setTableRange}
            title="Table range"
            ariaLabelPrefix="Range"
            labelFallback={TABLE_RANGE_DROPDOWN_OPTIONS.find((o) => o.id === tableRange)?.label ?? tableRange}
          />
        </label>
      ),
    [
      isDaily,
      isWeekly,
      dailyFilterDraft,
      dailyLoadedRange,
      onDailyToolbarDateChange,
      weeklyStartYear,
      weeklyEndYear,
      weekYearDropdownOptions,
      tableRange
    ]
  );

  return (
    <div className="ticker-page">
      {error ? <div className="ticker-page__error" role="alert">{error}</div> : null}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="flex flex-wrap items-center justify-start gap-[10px]">
          <div className="inline-flex min-w-0 flex-wrap items-center gap-[10px] [&_.ticker-symbol-search]:min-w-[220px] [&_.ticker-symbol-search]:max-w-[420px]">
            <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId={`ticker-${modeSlug}-symbol`} />
            {loading ? (<span className="ticker-page__loading-pill">Loading quarterly data…</span>) : null}
          </div>
          <div className="min-w-0">
            <h1 className="ticker-page__company ticker-page__company--hero">{symU} {modeLabel} Statistics</h1>
          </div>
        </div>
      </header>

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <TickerAnnualReturnsFigma
            symbol={symU}
            annualReturns={monthlyChartRows}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_M_FIGMA}
            resizeDefaultHeight={260}
            periodMode={modeSlug}
            suppressChartDateFilter={isDaily}
            toolbarControls={isDaily ? mkDailyDateToolbar() : isWeekly ? weeklyChartRangeControls : monthlyChartRangeControls}
            loading={loading}
          />
          <TickerChartResizeScope storageKey={RESIZE_KEY_M_POSNEG} defaultHeight={260}>
            <TickerAnnualReturnsPosNeg
              symbol={symU}
              annualReturns={monthlyChartRows}
              asOfDate={asOfDate}
              periodMode={modeSlug}
              suppressChartDateFilter={isDaily || isWeekly}
              loading={loading}
            />
          </TickerChartResizeScope>
          {!isDaily ? (
          <TickerMonthlyReturnsChart
            symbol={symU}
            monthlyReturns={monthlyChartRows}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_M_MAIN}
            resizeDefaultHeight={288}
            periodMode={modeSlug}
            suppressChartDateFilter={isDaily}
            hideChartDateApplyRow={isWeekly}
            useThemedYearDropdown={isWeekly}
            chartToolbarExtras={isDaily ? mkDailyDateToolbar() : null}
            loading={loading}
          />
          ) : null}
          {!isWeekly && !isDaily ? (
            <TickerChartResizeScope storageKey={RESIZE_KEY_M_WF} defaultHeight={300}>
              <TickerMonthlyReturnsWaterfallDonut
                symbol={symU}
                monthlyReturns={monthlyChartRows}
                asOfDate={asOfDate}
                periodMode={modeSlug}
                loading={loading}
              />
            </TickerChartResizeScope>
          ) : null}

          <section className="statistic-data__card">
            <div className="statistic-data__table-head">
              <div className="statistic-data__title-stack">
                <h2 className="statistic-data__table-title">{modeLabel} Returns</h2>
                {isDaily && (dailyLoadedRange.min || dailyLoadedRange.max) ? (
                  <p className="statistic-data__coverage ticker-page__muted">
                    <span className="statistic-data__coverage-label">Loaded data:</span>{' '}
                    {dailyLoadedRange.min || '—'} → {dailyLoadedRange.max || '—'}
                    {(dailyShownRange.min || dailyShownRange.max) &&
                    (dailyShownRange.min !== dailyLoadedRange.min || dailyShownRange.max !== dailyLoadedRange.max ||
                      dailyFilter.start ||
                      dailyFilter.end) ? (
                      <>
                        {' · '}
                        <span className="statistic-data__coverage-label">Showing:</span>{' '}
                        {dailyShownRange.min || '—'} → {dailyShownRange.max || '—'}
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>
              <div className="statistic-data__head-actions">{monthlyReturnsTableHeadActions}</div>
            </div>
            <div className="statistic-data__table-wrap">
              <table className="statistic-data__table">
                <thead>
                  <tr>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('period')}
                        aria-sort={
                          tableSort.column === 'period'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Period
                        {tableSort.column === 'period' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('startPrice')}
                        aria-sort={
                          tableSort.column === 'startPrice'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Start Price
                        {tableSort.column === 'startPrice' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('endPrice')}
                        aria-sort={
                          tableSort.column === 'endPrice'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        End Price
                        {tableSort.column === 'endPrice' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onTableSortClick('return')}
                        aria-sort={
                          tableSort.column === 'return'
                            ? tableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Return
                        {tableSort.column === 'return' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {tableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tablePageRows.length ? (
                    tablePageRows.map((row) => (
                      <tr key={`monthly-table-${row.period}`}>
                        <td>{row.period}</td>
                        <td>{Number.isFinite(Number(row.startClose)) ? Number(row.startClose).toFixed(2) : '—'}</td>
                        <td>{Number.isFinite(Number(row.endClose)) ? Number(row.endClose).toFixed(2) : '—'}</td>
                        <td className={pctTone(row.returnPct)}>{fmtPct(row.returnPct)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="statistic-data__empty">
                        No {modeSlug} rows yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {tableTotalPages > 1 ? (
              <div className="statistic-data__pager">
                <FigmaPagination page={tablePageSafe} totalPages={tableTotalPages} onPageChange={setTablePage} />
                <span className="statistic-data__pager-meta">Page {tablePageSafe} of {tableTotalPages} ({tableRowsSorted.length} rows)</span>
              </div>
            ) : null}
          </section>
        </div>

        <aside className="ticker-page__aside ticker-page__aside-stack">
          {/* <section className="ticker-card ticker-card--signal" aria-labelledby="odin-signal-h-m">
            <div className="ticker-signal-head">
              <span className="ticker-signal-logo" aria-hidden />
              <h2 className="ticker-card__h ticker-card__h--inline" id="odin-signal-h-m">Odin Signal</h2>
            </div>
            <p className="ticker-signal-asof">As of {lastUpdatedFmt}</p>
            <div className="ticker-signal-lanes" role="list">
              {[{ k: 'L1', tone: 'green-dark' }, { k: 'L2', tone: 'green-dark' }, { k: 'L3', tone: 'green-bright' }, { k: 'S1', tone: 'orange' }, { k: 'S2', tone: 'orange-mid' }, { k: 'S3', tone: 'amber' }, { k: 'N', tone: 'gray' }].map((s) => (
                <div key={s.k} className={'ticker-signal-cell ticker-signal-cell--' + s.tone + (activeBucket === s.k ? ' ticker-signal-cell--active' : '')} role="listitem">{s.k}</div>
              ))}
            </div>
            <div className="ticker-signal-foot"><IconTrendUp className="ticker-signal-foot__ico" /><IconTrendDown className="ticker-signal-foot__ico" /></div>
          </section> */}

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="key-data-h-m">
            <header className="mkt-mini-card__head">
              <h2 className="mkt-mini-card__k" id="key-data-h-m">
                Key data &amp; performance
              </h2>
              <span className="mkt-mini-card__head-actions">
                <DataInfoTip align="start">
                  <p className="ticker-data-tip__p">52w range, avg volume, and volatility come from last ~1y OHLC rows.</p>
                </DataInfoTip>
              </span>
            </header>
            <div className="ticker-aside-mini__body">
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
                <span>RELATED INDICES</span>
                <span className="ticker-kd-comp-label__links">
                  {RELATED_INDEX_LINKS.map((idx) => (
                    <Link key={idx.slug} to={`/indices/${idx.slug}`} className="ticker-kd-comp__a">
                      {idx.label}
                    </Link>
                  ))}
                </span>
              </p>
              <p className="ticker-page__label ticker-kd-comp-label">
                <span>RELATED TICKERS</span>
                <span className="ticker-kd-comp-label__links">
                  {competitors.length ? (
                    competitors.map((t) => (
                      <Link key={t} to={`/ticker/${encodeURIComponent(t)}`} className="ticker-kd-comp__a">
                        {t}
                      </Link>
                    ))
                  ) : (
                    <span className="ticker-page__muted">—</span>
                  )}
                </span>
              </p>
            </div>
          </section>

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="ticker-monthly-rel-perf-h">
            <header className="mkt-mini-card__head">
              <span className="mkt-mini-card__k" id="ticker-monthly-rel-perf-h">
                Relative performance
                <span className="mkt-mini-card__tf">%</span>
              </span>
            </header>
            <div className="ticker-aside-mini__body">
              <div className="ticker-compare">
                <div className="ticker-compare__head">
                  <span />
                  <span>{symU}</span>
                  <span>{benchmarkIndex}</span>
                  <span>Diff</span>
                </div>
                {COMPARE_ROWS.map((row) => {
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
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

