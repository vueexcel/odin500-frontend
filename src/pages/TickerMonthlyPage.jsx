import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DataInfoTip } from '../components/DataInfoTip.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerMonthlyReturnsChart } from '../components/TickerMonthlyReturnsChart.jsx';
import { TickerMonthlyReturnsWaterfallDonut } from '../components/TickerMonthlyReturnsWaterfallDonut.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';
import { filterReturnsRows } from '../utils/returnsDateRange.js';

const RESIZE_KEY_M_FIGMA = 'odin_ticker_monthly_resize_figma';
const RESIZE_KEY_M_POSNEG = 'odin_ticker_monthly_resize_posneg';
const RESIZE_KEY_M_MAIN = 'odin_ticker_monthly_resize_main';
const RESIZE_KEY_M_WF = 'odin_ticker_monthly_resize_waterfall';
const RETURNS_DEFAULT_START = '1980-01-01';
const BENCHMARK = 'SPY';
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
const RELATED_INDEX_LINKS = [
  { slug: 'dow-jones', label: 'Dow Jones' },
  { slug: 'sp500', label: 'S&P 500' },
  { slug: 'nasdaq-100', label: 'Nasdaq' }
];
const TABLE_PAGE_SIZE = 30;
const PAGER_SIBLING_COUNT = 1;
const TABLE_RANGE_OPTIONS = [
  { value: '1', label: '1Y' },
  { value: '3', label: '3Y' },
  { value: '5', label: '5Y' },
  { value: '10', label: '10Y' },
  { value: 'max', label: 'Max' }
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

function isoWeekPeriod(isoLike) {
  const iso = String(isoLike || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(iso + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return null;
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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
  const m = String(period || '').match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
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
function pickCompetitors(detailRows, sym, mySector, limit = 6) {
  const u = String(sym || '').toUpperCase();
  const rows = Array.isArray(detailRows) ? detailRows : [];
  const same = rows.filter((r) => String(r.Symbol || r.symbol || '').toUpperCase().trim() !== u && mySector && String(r.Sector || r.sector || '').trim() === mySector);
  const rest = rows.filter((r) => String(r.Symbol || r.symbol || '').toUpperCase().trim() !== u);
  const merged = [...same, ...rest];
  const out = [];
  const seen = new Set();
  for (const r of merged) {
    const s = String(r.Symbol || r.symbol || '').toUpperCase().trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}
function describeTickerIndex(rawIndex) {
  const s = String(rawIndex || '').trim();
  if (!s) return 'Other';
  const lower = s.toLowerCase();
  if (lower.includes('s&p') || lower.includes('sp500') || lower.includes('snp') || lower.includes('sp 500')) return 'S&P 500';
  if (lower.includes('dow')) return 'Dow Jones';
  if (lower.includes('nasdaq')) return 'Nasdaq';
  return s;
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
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthlyReturnsRaw, setMonthlyReturnsRaw] = useState([]);
  const [dynamicSym, setDynamicSym] = useState([]);
  const [dynamicSpy, setDynamicSpy] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [tableRange, setTableRange] = useState('max');
  const [tablePage, setTablePage] = useState(1);
  const [dailyFilter, setDailyFilter] = useState(() => ({ start: '', end: '' }));
  const [dailyFilterDraft, setDailyFilterDraft] = useState(() => ({ start: '', end: '' }));
  const [dailyFetchRange, setDailyFetchRange] = useState(() =>
    defaultDailyFetchRange(new Date().toISOString().slice(0, 10))
  );

  useEffect(() => {
    const next = sanitizeTickerPageInput(symbolParam) || 'AAPL';
    setSym((prev) => (prev === next ? prev : next));
  }, [symbolParam]);

  usePageSeo({
    title: `${String(sym).toUpperCase()} ${modeLabel} Returns | Odin500`,
    description: `${modeLabel} return charts and table for ${String(sym).toUpperCase()} on Odin500.`,
    canonicalPath: `/ticker-${modeSlug}/${String(sym || 'aapl').toLowerCase()}`
  });

  const onSymbolChange = useCallback((next) => {
    const s = sanitizeTickerPageInput(next) || 'AAPL';
    setSym(s);
    navigate(`/ticker-${modeSlug}/` + encodeURIComponent(s));
  }, [navigate, modeSlug]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
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
        const [mRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes, detailsRes] = await Promise.all([
          primaryReq,
          fetchJsonCached({ path: '/api/market/ticker-core-returns', method: 'POST', body, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-core-returns', method: 'POST', body: { ...body, ticker: BENCHMARK }, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: `/api/market/ohlc?symbol=${encodeURIComponent(tickerU)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`, method: 'GET', ttlMs: 10 * 60 * 1000 }),
          fetchJsonCached({ path: `/api/market/ohlc?symbol=${encodeURIComponent(BENCHMARK)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`, method: 'GET', ttlMs: 10 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-details', method: 'POST', body: { index: 'sp500', period: 'last-1-year' }, ttlMs: 30 * 60 * 1000 })
        ]);
        if (cancelled) return;
        const perf = mRes?.data?.performance || {};
        const coreSymPerf = coreSymRes?.data?.performance || {};
        const coreSpyPerf = coreSpyRes?.data?.performance || {};
        if (isWeekly) {
          const weekly = Array.isArray(mRes?.data?.weeklyOHLC) ? mRes.data.weeklyOHLC : [];
          const mapped = weekly
            .map((r) => {
              const open = Number(r?.Open ?? r?.open);
              const close = Number(r?.Close ?? r?.close);
              const yearNum = Number(r?.year);
              const weekNum = Number(r?.week);
              const periodFromParts =
                Number.isFinite(yearNum) && Number.isFinite(weekNum) && weekNum >= 1 && weekNum <= 53
                  ? `${yearNum}-W${String(weekNum).padStart(2, '0')}`
                  : '';
              const endDateRaw = String(r?.end_date ?? r?.Date ?? r?.date ?? '');
              const startDateRaw = String(r?.start_date ?? '');
              const startDate = startDateRaw.slice(0, 10);
              const endDate = endDateRaw.slice(0, 10);
              const period = periodFromParts || isoWeekPeriod(endDate) || isoWeekPeriod(startDate);
              if (!period || !Number.isFinite(open) || !Number.isFinite(close) || open === 0) return null;
              return {
                period,
                startDate: startDate || endDate,
                endDate,
                startPrice: open,
                endPrice: close,
                totalReturn: ((close - open) / open) * 100
              };
            })
            .filter(Boolean);
          setMonthlyReturnsRaw(mapped);
        } else if (isDaily) {
          const rawRows = Array.isArray(mRes?.data?.data) ? mRes.data.data : Array.isArray(mRes?.data) ? mRes.data : [];
          console.info('[DailyReturns] API response rows', {
            symbol: tickerU,
            startDate: dailyStart,
            endDate: dailyEnd,
            rawRows: rawRows.length
          });
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
          console.info('[DailyReturns] Mapped return rows', {
            symbol: tickerU,
            mappedRows: mapped.length
          });
          setMonthlyReturnsRaw(mapped);
        } else {
          setMonthlyReturnsRaw(Array.isArray(perf.monthlyReturns) ? perf.monthlyReturns : []);
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
  }, [sym, isWeekly, isDaily, modeSlug, dailyFetchRange.start, dailyFetchRange.end]);

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

  const applyDailyFilter = useCallback(() => {
    const rawStart = String(dailyFilterDraft.start || '').slice(0, 10);
    const rawEnd = String(dailyFilterDraft.end || '').slice(0, 10);
    let start = rawStart;
    let end = rawEnd;
    if (start && end && start > end) {
      const t = start;
      start = end;
      end = t;
    }
    setDailyFilter({ start, end });
    setDailyFilterDraft({ start, end });
    if (isDaily) {
      const fallback = defaultDailyFetchRange(new Date().toISOString().slice(0, 10));
      const fetchStart = start || fallback.start;
      const fetchEnd = end || fallback.end;
      console.info('[DailyReturns] Submit clicked', {
        symbol: sym,
        selectedStart: start || null,
        selectedEnd: end || null,
        fetchStart,
        fetchEnd
      });
      setDailyFetchRange({ start: fetchStart, end: fetchEnd });
    }
  }, [dailyFilterDraft.start, dailyFilterDraft.end, isDaily, sym]);

  useEffect(() => {
    const fallback = defaultDailyFetchRange(new Date().toISOString().slice(0, 10));
    setDailyFilter({ start: '', end: '' });
    setDailyFilterDraft({ start: '', end: '' });
    setDailyFetchRange(fallback);
  }, [sym]);

  const tableRows = useMemo(() => {
    const source = isDaily ? (dailyReturnsForUi || []) : monthlyReturnsRaw;
    const rows = (Array.isArray(source) ? source : []).map((r) => ({
      period: r?.period,
      startDate: r?.startDate,
      endDate: r?.endDate,
      startClose: r?.startPrice,
      endClose: r?.endPrice,
      returnPct: r?.totalReturn,
      year: parseYear(r?.period)
    })).filter((r) => r.period);
    if (isDaily) return rows;
    if (tableRange === 'max') return rows;
    const years = Number(tableRange);
    if (!Number.isFinite(years) || years <= 0) return rows;
    const cutoff = new Date().getFullYear() - years + 1;
    return rows.filter((r) => Number.isFinite(r.year) && r.year >= cutoff);
  }, [monthlyReturnsRaw, tableRange, isDaily, dailyReturnsForUi]);
  const tableTotalPages = useMemo(() => Math.max(1, Math.ceil(tableRows.length / TABLE_PAGE_SIZE)), [tableRows.length]);
  const tablePageSafe = useMemo(() => Math.min(Math.max(1, tablePage), tableTotalPages), [tablePage, tableTotalPages]);
  const tablePageRows = useMemo(() => {
    const start = (tablePageSafe - 1) * TABLE_PAGE_SIZE;
    return tableRows.slice(start, start + TABLE_PAGE_SIZE);
  }, [tableRows, tablePageSafe]);
  useEffect(() => { setTablePage(1); }, [sym, tableRange, dailyFilter.start, dailyFilter.end, isDaily]);
  useEffect(() => { setTablePage((p) => Math.min(Math.max(1, p), tableTotalPages)); }, [tableTotalPages]);

  const symU = String(sym || '').toUpperCase();
  const myDetail = useMemo(() => detailRows.find((r) => String(r.Symbol || r.symbol || '').toUpperCase().trim() === symU) || null, [detailRows, symU]);
  const sector = String(myDetail?.Sector || myDetail?.sector || '').trim();
  const indexLabel = String(myDetail?.Index || myDetail?.index || '').trim() || 'US';
  const relatedTickersSourceLabel = describeTickerIndex(indexLabel);
  const competitors = useMemo(() => pickCompetitors(detailRows, symU, sector, 6), [detailRows, symU, sector]);
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

  return (
    <div className="ticker-page">
      <div className="ticker-page__search-row">
        <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId={`ticker-${modeSlug}-symbol`} />
        <span className="ticker-page__loading-pill">{loading ? `Loading ${modeSlug} data...` : `As of ${asOfDate}`}</span>
      </div>
      {error ? <div className="ticker-page__error" role="alert">{error}</div> : null}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="ticker-page__header-top">
          <div className="ticker-page__header-identity">
            <h1 className="ticker-page__company ticker-page__company--hero">{symU} {modeLabel} Returns</h1>
          </div>
        </div>
      </header>

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <TickerAnnualReturnsFigma
            symbol={symU}
            annualReturns={isDaily ? dailyReturnsForUi || [] : monthlyReturnsRaw}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_M_FIGMA}
            resizeDefaultHeight={260}
            periodMode={modeSlug}
            suppressChartDateFilter={isDaily}
          />
          <TickerChartResizeScope storageKey={RESIZE_KEY_M_POSNEG} defaultHeight={260}>
            <TickerAnnualReturnsPosNeg
              symbol={symU}
              annualReturns={isDaily ? dailyReturnsForUi || [] : monthlyReturnsRaw}
              asOfDate={asOfDate}
              periodMode={modeSlug}
              suppressChartDateFilter={isDaily}
            />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_M_MAIN} defaultHeight={288}>
            <TickerMonthlyReturnsChart
              symbol={symU}
              monthlyReturns={isDaily ? dailyReturnsForUi || [] : monthlyReturnsRaw}
              asOfDate={asOfDate}
              periodMode={modeSlug}
              suppressChartDateFilter={isDaily}
            />
          </TickerChartResizeScope>
          {!isWeekly && !isDaily ? (
            <TickerChartResizeScope storageKey={RESIZE_KEY_M_WF} defaultHeight={300}>
              <TickerMonthlyReturnsWaterfallDonut symbol={symU} monthlyReturns={monthlyReturnsRaw} asOfDate={asOfDate} periodMode={modeSlug} />
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
              <div className="statistic-data__head-actions">
                {isDaily ? (
                  <>
                    <label className="statistic-data__range">
                      <span>Start</span>
                      <input
                        type="date"
                        value={dailyFilterDraft.start}
                        max={dailyFilterDraft.end || dailyLoadedRange.max || undefined}
                        onChange={(e) => setDailyFilterDraft((p) => ({ ...p, start: e.target.value }))}
                      />
                    </label>
                    <label className="statistic-data__range">
                      <span>End</span>
                      <input
                        type="date"
                        value={dailyFilterDraft.end}
                        min={dailyFilterDraft.start || dailyLoadedRange.min || undefined}
                        max={dailyLoadedRange.max || undefined}
                        onChange={(e) => setDailyFilterDraft((p) => ({ ...p, end: e.target.value }))}
                      />
                    </label>
                    <button type="button" className="statistic-data__pg-btn" onClick={applyDailyFilter}>
                      Submit
                    </button>
                    <button
                      type="button"
                      className="statistic-data__pg-btn"
                      onClick={() => {
                        const fallback = defaultDailyFetchRange(new Date().toISOString().slice(0, 10));
                        console.info('[DailyReturns] Clear clicked', { symbol: sym, fallback });
                        setDailyFilter({ start: '', end: '' });
                        setDailyFilterDraft({ start: '', end: '' });
                        setDailyFetchRange(fallback);
                      }}
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <label className="statistic-data__range">
                    <span>Range</span>
                    <select value={tableRange} onChange={(e) => setTableRange(e.target.value)}>
                      {TABLE_RANGE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  </label>
                )}
              </div>
            </div>
            <div className="statistic-data__table-wrap">
              <table className="statistic-data__table">
                <thead>
                  <tr><th>Period</th><th>Start</th><th>End</th><th>Start Close</th><th>End Close</th><th>Return</th></tr>
                </thead>
                <tbody>
                  {tablePageRows.length ? tablePageRows.map((row) => (
                    <tr key={`monthly-table-${row.period}`}>
                      <td>{row.period}</td>
                      <td>{row.startDate || '—'}</td>
                      <td>{row.endDate || '—'}</td>
                      <td>{Number.isFinite(Number(row.startClose)) ? Number(row.startClose).toFixed(2) : '—'}</td>
                      <td>{Number.isFinite(Number(row.endClose)) ? Number(row.endClose).toFixed(2) : '—'}</td>
                      <td className={pctTone(row.returnPct)}>{fmtPct(row.returnPct)}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="statistic-data__empty">No {modeSlug} rows yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="statistic-data__pager">
              <FigmaPagination page={tablePageSafe} totalPages={tableTotalPages} onPageChange={setTablePage} />
              <span className="statistic-data__pager-meta">Page {tablePageSafe} of {tableTotalPages} ({tableRows.length} rows)</span>
            </div>
          </section>
        </div>

        <aside className="ticker-page__aside">
          <section className="ticker-card ticker-card--signal" aria-labelledby="odin-signal-h-m">
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
          </section>

          <section className="ticker-card" aria-labelledby="key-data-h-m">
            <div className="ticker-card__h-with-tip">
              <h2 className="ticker-card__h ticker-card__h--flex" id="key-data-h-m">Key data &amp; performance</h2>
              <DataInfoTip align="start"><p className="ticker-data-tip__p">52w range, avg volume, and volatility come from last ~1y OHLC rows.</p></DataInfoTip>
            </div>
            <div className="ticker-kd-grid">
              <dl className="ticker-kd-dl">
                <div className="ticker-kd-row"><dt>Dividend yield</dt><dd>—</dd></div>
                <div className="ticker-kd-row"><dt>52-week range</dt><dd>{hi52 != null && lo52 != null ? `${formatPx(lo52)} – ${formatPx(hi52)}` : '—'}</dd></div>
                <div className="ticker-kd-row"><dt>Beta</dt><dd>—</dd></div>
                <div className="ticker-kd-row"><dt>Volatility (ann.)</dt><dd>{vola != null ? `${vola}%` : '—'}</dd></div>
              </dl>
              <dl className="ticker-kd-dl">
                <div className="ticker-kd-row"><dt>Avg volume (1y)</dt><dd>{formatVolLong(avgVol)}</dd></div>
                <div className="ticker-kd-row"><dt>Market cap</dt><dd>—</dd></div>
                <div className="ticker-kd-row"><dt>P/E (TTM)</dt><dd>—</dd></div>
                <div className="ticker-kd-row"><dt>EPS (TTM)</dt><dd>—</dd></div>
              </dl>
            </div>
            <p className="ticker-page__label ticker-kd-comp-label">
              <span>RELATED TICKERS</span>
              <span className="ticker-kd-comp-label__links">{RELATED_INDEX_LINKS.map((idx) => <Link key={idx.slug} to={`/indices/${idx.slug}`} className="ticker-kd-comp__a">{idx.label}</Link>)}</span>
            </p>
            <p className="ticker-kd-comp">
              {competitors.length ? competitors.map((t) => <Link key={t} to={`/ticker/${encodeURIComponent(t)}`} className="ticker-kd-comp__a">{t}</Link>) : <span className="ticker-page__muted">—</span>}
            </p>
            <div className="ticker-subh-with-tip"><h3 className="ticker-subh ticker-subh--flex">Performance returns</h3></div>
            <div className="ticker-perf-wrap">
              <table className="ticker-perf">
                <thead><tr><th />{PERF_COLS.map((c) => <th key={c.label}>{c.label}</th>)}</tr></thead>
                <tbody>
                  <tr><th scope="row">Total return</th>{PERF_COLS.map((c) => { const v = pickDynamic(dynamicSym, c.period); return <td key={c.label} className={pctClass(v)}>{formatPct(v)}</td>; })}</tr>
                  <tr><th scope="row">Benchmark ({BENCHMARK})</th>{PERF_COLS.map((c) => { const v = pickDynamic(dynamicSpy, c.period); return <td key={c.label + '-spy'} className={pctClass(v)}>{formatPct(v)}</td>; })}</tr>
                </tbody>
              </table>
            </div>
            <div className="ticker-subh-with-tip"><h3 className="ticker-subh ticker-subh--flex">vs {BENCHMARK} (total return %, then difference)</h3></div>
            <div className="ticker-compare">
              <div className="ticker-compare__head"><span /><span>{symU}</span><span>{BENCHMARK}</span><span>Diff</span></div>
              {COMPARE_ROWS.map((row) => {
                const symPct = row.period ? pickDynamic(selectedIndexSeries.dynamicPeriods, row.period) : row.mtd ? selectedIndexSeries.mtd : row.qtd ? selectedIndexSeries.qtd : null;
                const spyPct = row.period ? pickDynamic(selectedTickerSeries.dynamicPeriods, row.period) : row.mtd ? selectedTickerSeries.mtd : row.qtd ? selectedTickerSeries.qtd : null;
                const diff = symPct != null && spyPct != null && Number.isFinite(symPct) && Number.isFinite(spyPct) ? symPct - spyPct : null;
                return <div key={row.key} className="ticker-compare__row"><span className="ticker-compare__tf">{row.key}</span><span className={'ticker-compare__cell ' + pctClass(symPct)}>{formatPct(symPct)}</span><span className={'ticker-compare__cell ' + pctClass(spyPct)}>{formatPct(spyPct)}</span><span className={'ticker-compare__cell ' + pctClass(diff)}>{formatPct(diff)}</span></div>;
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

