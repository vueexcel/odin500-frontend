import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DataInfoTip } from '../components/DataInfoTip.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import { AnnualReturnBarChart } from '../components/AnnualReturnBarChart.jsx';
import { ExcessReturnLineChart } from '../components/ExcessReturnLineChart.jsx';
import { PeriodicReturnBarChart } from '../components/PeriodicReturnBarChart.jsx';
import {fetchJsonCached, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { pickRelatedByCategory, RELATED_INDEX_LINKS } from '../utils/relatedTickers.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { alignComparisonRows, filterRowsByYearRange, normalizePeriodReturnsRows } from '../utils/statisticsComparisonSeries.js';

const RESIZE_KEY_ANNUAL_FIGMA = 'odin_ticker_annual_only_resize_annual_figma';
const RESIZE_KEY_ANNUAL_POSNEG = 'odin_ticker_annual_only_resize_annual_posneg';
const RETURNS_DEFAULT_START = '2017-01-01';
const RETURNS_DEFAULT_END = '2026-12-31';
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
const TABLE_RANGE_YEARS = { '1Y': 1, '3Y': 3, '5Y': 5, '10Y': 10, '15Y': 15, '20Y': 20 };
const DEFAULT_TABLE_RANGE_PRESET = '5Y';
const TABLE_RANGE_DROPDOWN_OPTIONS = [
  { id: '1Y', label: '1Y' },
  { id: '3Y', label: '3Y' },
  { id: '5Y', label: '5Y' },
  { id: '10Y', label: '10Y' },
  { id: '15Y', label: '15Y' },
  { id: '20Y', label: '20Y' },
];
const TABLE_PAGE_SIZE = 30;
const PAGER_SIBLING_COUNT = 1;

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function formatPct(v) {
  return fmtPct(v);
}

function pctTone(v) {
  if (v == null || !Number.isFinite(Number(v))) return 'statistic-data__ret statistic-data__ret--flat';
  if (Number(v) > 0) return 'statistic-data__ret statistic-data__ret--up';
  if (Number(v) < 0) return 'statistic-data__ret statistic-data__ret--down';
  return 'statistic-data__ret statistic-data__ret--flat';
}

function parseYear(period) {
  const m = String(period || '').match(/(\d{4})/);
  return m ? Number(m[1]) : null;
}

function annualPeriodOrderKey(row) {
  const end = row?.endDate && String(row.endDate).slice(0, 10);
  if (end && !Number.isNaN(Date.parse(end))) return Date.parse(end);
  const y = row?.year;
  if (Number.isFinite(y)) return y * 100;
  return 0;
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

function pctClass(n) {
  if (n == null || !Number.isFinite(Number(n))) return '';
  if (Number(n) > 0) return 'ticker-num--up';
  if (Number(n) < 0) return 'ticker-num--down';
  return '';
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
    return new Date(iso + 'T12:00:00') >= qStart;
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
  if (totalPages <= totalNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
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

export default function TickerAnnualPage() {
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const todayIso = new Date().toISOString().slice(0, 10);
  const [sym, setSym] = useState(() => sanitizeTickerPageInput(symbolParam) || 'AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [asOfDate, setAsOfDate] = useState(() => todayIso);
  const [draftStartDate, setDraftStartDate] = useState(RETURNS_DEFAULT_START);
  const [draftEndDate, setDraftEndDate] = useState(RETURNS_DEFAULT_END);
  const [benchmarkIndex, setBenchmarkIndex] = useState(BENCHMARK);
  const [appliedRange, setAppliedRange] = useState(() => ({
    start: RETURNS_DEFAULT_START,
    end: RETURNS_DEFAULT_END
  }));
  const [annualReturnsRaw, setAnnualReturnsRaw] = useState([]);
  const [annualReturnsBenchRaw, setAnnualReturnsBenchRaw] = useState([]);
  const [dynamicSym, setDynamicSym] = useState([]);
  const [dynamicSpy, setDynamicSpy] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [annualRange, setAnnualRange] = useState(DEFAULT_TABLE_RANGE_PRESET);
  const [annualTableSort, setAnnualTableSort] = useState({ column: 'period', direction: 'desc' });
  const [annualTablePage, setAnnualTablePage] = useState(1);
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');

  useEffect(() => {
    const next = sanitizeTickerPageInput(symbolParam) || 'AAPL';
    setSym((prev) => (prev === next ? prev : next));
  }, [symbolParam]);

  usePageSeo({
    title: `${String(sym).toUpperCase()} Annual Returns | Odin500`,
    description: `Annual return charts for ${String(sym).toUpperCase()} on Odin500.`,
    canonicalPath: `/statistic/ticker-annual/${String(sym || 'aapl').toLowerCase()}`
  });

  const onSymbolChange = useCallback(
    (next) => {
      const s = sanitizeTickerPageInput(next) || 'AAPL';
      setSym(s);
      navigate('/statistic/ticker-annual/' + encodeURIComponent(s));
    },
    [navigate]
  );

  const applyYearRange = useCallback((startYearRaw, endYearRaw) => {
    const startYear = String(startYearRaw || '').slice(0, 4) || String(RETURNS_DEFAULT_START).slice(0, 4);
    const endYear = String(endYearRaw || '').slice(0, 4) || String(RETURNS_DEFAULT_END).slice(0, 4);
    let start = `${startYear}-01-01`;
    let end = `${endYear}-12-31`;
    if (start > end) {
      const t = start;
      start = end;
      end = t;
    }
    setDraftStartDate(start);
    setDraftEndDate(end);
    setAppliedRange({ start, end });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!canFetchProtectedApi()) {
      setError('Sign in to load ticker data.');
      setAnnualReturnsRaw([]);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      setLoading(true);
      setError('');
      try {
        const end = appliedRange.end || todayIso;
        const body = {
          ticker: String(sym || '').toUpperCase().trim(),
          customStartDate: appliedRange.start || RETURNS_DEFAULT_START,
          customEndDate: end
        };
        const oneYearStart = new Date(end + 'T12:00:00');
        oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
        const oneYearStartIso = oneYearStart.toISOString().slice(0, 10);
        const tickerU = String(sym || '').toUpperCase().trim();
        const [annualRes, annualBenchRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes] = await Promise.all([
          fetchJsonCached({
            path: '/api/market/ticker-annual-returns',
            method: 'POST',
            body,
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-annual-returns',
            method: 'POST',
            body: { ...body, ticker: benchmarkIndex },
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body,
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ...body, ticker: benchmarkIndex },
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path:
              '/api/market/ohlc?symbol=' +
              encodeURIComponent(tickerU) +
              '&start_date=' +
              encodeURIComponent(oneYearStartIso) +
              '&end_date=' +
              encodeURIComponent(end) +
              '&limit=400',
            method: 'GET',
            ttlMs: 10 * 60 * 1000
          }),
          fetchJsonCached({
            path:
              '/api/market/ohlc?symbol=' +
              encodeURIComponent(benchmarkIndex) +
              '&start_date=' +
              encodeURIComponent(oneYearStartIso) +
              '&end_date=' +
              encodeURIComponent(end) +
              '&limit=400',
            method: 'GET',
            ttlMs: 10 * 60 * 1000
          })
        ]);
        if (cancelled) return;
        const annualPerf = annualRes?.data?.performance || {};
        const annualBenchPerf = annualBenchRes?.data?.performance || {};
        const coreSymPerf = coreSymRes?.data?.performance || {};
        const coreSpyPerf = coreSpyRes?.data?.performance || {};
        setAnnualReturnsRaw(Array.isArray(annualPerf.annualReturns) ? annualPerf.annualReturns : []);
        setAnnualReturnsBenchRaw(Array.isArray(annualBenchPerf.annualReturns) ? annualBenchPerf.annualReturns : []);
        setDynamicSym(Array.isArray(coreSymPerf.dynamicPeriods) ? coreSymPerf.dynamicPeriods : []);
        setDynamicSpy(Array.isArray(coreSpyPerf.dynamicPeriods) ? coreSpyPerf.dynamicPeriods : []);
        const symRows = Array.isArray(ohlcSymRes?.data?.data)
          ? ohlcSymRes.data.data
          : Array.isArray(ohlcSymRes?.data)
            ? ohlcSymRes.data
            : [];
        const spyRows = Array.isArray(ohlcSpyRes?.data?.data)
          ? ohlcSpyRes.data.data
          : Array.isArray(ohlcSpyRes?.data)
            ? ohlcSpyRes.data
            : [];
        setStatsRows(sortRowsAsc(symRows));
        setStatsRowsSpy(sortRowsAsc(spyRows));
        setAsOfDate(
          String(
            annualRes?.data?.asOfDate ||
              new Date().toISOString().slice(0, 10)
          ).slice(0, 10)
        );
        setLoading(false);
        fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: 'sp500', period: 'last-1-year' },
          ttlMs: 30 * 60 * 1000
        })
          .then((detailsRes) => {
            if (cancelled) return;
            setDetailRows(Array.isArray(detailsRes?.data?.data) ? detailsRes.data.data : []);
          })
          .catch(() => {
            if (!cancelled) setDetailRows([]);
          });
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load annual returns');
          setAnnualReturnsRaw([]);
          setAnnualReturnsBenchRaw([]);
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

    return () => {
      cancelled = true;
    };
  }, [sym, appliedRange.end, appliedRange.start, todayIso, benchmarkIndex]);

  const titleSymbol = useMemo(() => String(sym || '').toUpperCase(), [sym]);
  const myDetail = useMemo(() => {
    const u = titleSymbol;
    for (const r of detailRows) {
      const s = String(r.Symbol || r.symbol || '').toUpperCase().trim();
      if (s === u) return r;
    }
    return null;
  }, [detailRows, titleSymbol]);
  const sector = String(myDetail?.Sector || myDetail?.sector || '').trim();
  const competitors = useMemo(
    () =>
      pickRelatedByCategory(
        detailRows,
        titleSymbol,
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
    [detailRows, titleSymbol, sector, myDetail]
  );
  const highs = statsRows.map((r) => pickNum(r, ['High', 'high'])).filter((v) => v != null);
  const lows = statsRows.map((r) => pickNum(r, ['Low', 'low'])).filter((v) => v != null);
  const vols = statsRows.map((r) => pickNum(r, ['Volume', 'volume', 'VOLUME'])).filter((v) => v != null);
  const statCloses = statsRows.map((r) => pickNum(r, ['Close', 'close'])).filter((v) => v != null);
  const hi52 = highs.length ? Math.max(...highs) : null;
  const lo52 = lows.length ? Math.min(...lows) : null;
  const avgVol = vols.length ? vols.reduce((a, b) => a + b, 0) / vols.length : null;
  const vola = annualizedVol(statCloses);
  const lastRow = statsRows.length ? statsRows[statsRows.length - 1] : null;
  const lastSignal = lastRow && lastRow.signal != null ? String(lastRow.signal) : 'N';
  const activeBucket = signalBucket(lastSignal);
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
  const symMtd = mtdFromRows(statsRows);
  const symQtd = qtdFromRows(statsRows);
  const spyMtd = mtdFromRows(statsRowsSpy);
  const spyQtd = qtdFromRows(statsRowsSpy);
  const selectedIndexLabel = titleSymbol;
  const selectedTickerKey = benchmarkIndex;
  const selectedIndexSeries = { dynamicPeriods: dynamicSym, mtd: symMtd, qtd: symQtd };
  const selectedTickerSeries = { dynamicPeriods: dynamicSpy, mtd: spyMtd, qtd: spyQtd };
  const annualReturnsFiltered = useMemo(() => {
    const source = Array.isArray(annualReturnsRaw) ? annualReturnsRaw : [];
    const startY = Number(String(appliedRange.start || '').slice(0, 4));
    const endY = Number(String(appliedRange.end || '').slice(0, 4));
    if (!Number.isFinite(startY) || !Number.isFinite(endY)) return source;
    return source.filter((r) => {
      let y = parseYear(r?.period);
      if (!Number.isFinite(y)) y = Number(String(r?.startDate || '').slice(0, 4));
      if (!Number.isFinite(y)) y = Number(String(r?.endDate || '').slice(0, 4));
      return Number.isFinite(y) && y >= startY && y <= endY;
    });
  }, [annualReturnsRaw, appliedRange.end, appliedRange.start]);
  const annualComparisonRows = useMemo(() => {
    const tickerRows = normalizePeriodReturnsRows(annualReturnsRaw, 'annual');
    const benchRows = normalizePeriodReturnsRows(annualReturnsBenchRaw, 'annual');
    const aligned = alignComparisonRows(tickerRows, benchRows);
    return filterRowsByYearRange(aligned, String(appliedRange.start || '').slice(0, 4), String(appliedRange.end || '').slice(0, 4));
  }, [annualReturnsRaw, annualReturnsBenchRaw, appliedRange.start, appliedRange.end]);
  const annualYearDropdownOptions = useMemo(() => {
    const years = Array.from(
      new Set(
        (Array.isArray(annualReturnsRaw) ? annualReturnsRaw : [])
          .map((r) => {
            let y = parseYear(r?.period);
            if (!Number.isFinite(y)) y = Number(String(r?.startDate || '').slice(0, 4));
            if (!Number.isFinite(y)) y = Number(String(r?.endDate || '').slice(0, 4));
            return Number.isFinite(y) ? y : null;
          })
          .filter(Number.isFinite)
      )
    ).sort((a, b) => b - a);
    if (!years.length) {
      const nowY = new Date().getFullYear();
      return Array.from({ length: nowY - 1980 + 1 }, (_, i) => String(nowY - i)).map((y) => ({ id: y, label: y }));
    }
    return years.map((y) => String(y)).map((y) => ({ id: y, label: y }));
  }, [annualReturnsRaw]);
  const annualChartRangeControls = (
    <div className="ticker-page__custom-range" aria-label="Annual chart year range" style={{ marginLeft: 'auto' }}>
      <span className="ticker-page__label ticker-page__label--inline">Start</span>
      <ThemedDropdown
        className="ticker-annual__year-dd"
        size="sm"
        style={{ minWidth: 96 }}
        value={String(draftStartDate || '').slice(0, 4)}
        options={annualYearDropdownOptions}
        onChange={(year) => applyYearRange(year, String(draftEndDate || '').slice(0, 4))}
        title="Start year"
        ariaLabelPrefix="Start year"
        labelFallback={String(draftStartDate || '').slice(0, 4)}
      />
      <span className="ticker-page__label ticker-page__label--inline">End</span>
      <ThemedDropdown
        className="ticker-annual__year-dd"
        size="sm"
        style={{ minWidth: 96 }}
        value={String(draftEndDate || '').slice(0, 4)}
        options={annualYearDropdownOptions}
        onChange={(year) => applyYearRange(String(draftStartDate || '').slice(0, 4), year)}
        title="End year"
        ariaLabelPrefix="End year"
        labelFallback={String(draftEndDate || '').slice(0, 4)}
      />
    </div>
  );
  const annualTableRowsBase = useMemo(() => {
    const source = Array.isArray(annualReturnsRaw) ? annualReturnsRaw : [];
    return source
      .map((r) => ({
        period: r?.period,
        startDate: r?.startDate,
        endDate: r?.endDate,
        returnPct: r?.totalReturn,
        startClose: r?.startPrice,
        endClose: r?.endPrice,
        year: (() => {
          let y = parseYear(r?.period);
          if (!Number.isFinite(y)) y = Number(String(r?.startDate || '').slice(0, 4));
          if (!Number.isFinite(y)) y = Number(String(r?.endDate || '').slice(0, 4));
          return Number.isFinite(y) ? y : null;
        })()
      }))
      .filter((r) => r.period);
  }, [annualReturnsRaw]);

  const annualTableYearBounds = useMemo(() => {
    const ys = annualTableRowsBase.map((r) => r.year).filter(Number.isFinite);
    if (!ys.length) return { min: null, max: null };
    return { min: Math.min(...ys), max: Math.max(...ys) };
  }, [annualTableRowsBase]);

  const annualTableRows = useMemo(() => {
    const { min, max } = annualTableYearBounds;
    if (min == null || max == null) return [];
    const hi = max;
    let lo;
    if (annualRange === 'MAX') {
      lo = min;
    } else {
      const span = TABLE_RANGE_YEARS[annualRange];
      if (!Number.isFinite(span)) return [];
      lo = hi - (span - 1);
      if (lo < min) lo = min;
    }
    return annualTableRowsBase.filter((r) => Number.isFinite(r.year) && r.year >= lo && r.year <= hi);
  }, [annualTableRowsBase, annualTableYearBounds, annualRange]);

  const annualTableRowsSorted = useMemo(() => {
    const rows = [...annualTableRows];
    const { column, direction } = annualTableSort;
    const dir = direction === 'asc' ? 1 : -1;
    const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    rows.sort((a, b) => {
      let cmp = 0;
      switch (column) {
        case 'period':
          cmp = annualPeriodOrderKey(a) - annualPeriodOrderKey(b);
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
  }, [annualTableRows, annualTableSort]);

  const annualTableTotalPages = useMemo(
    () => Math.max(1, Math.ceil(annualTableRowsSorted.length / TABLE_PAGE_SIZE)),
    [annualTableRowsSorted.length]
  );
  const annualTablePageSafe = useMemo(
    () => Math.min(Math.max(1, annualTablePage), annualTableTotalPages),
    [annualTablePage, annualTableTotalPages]
  );
  const annualTablePageRows = useMemo(() => {
    const startIdx = (annualTablePageSafe - 1) * TABLE_PAGE_SIZE;
    return annualTableRowsSorted.slice(startIdx, startIdx + TABLE_PAGE_SIZE);
  }, [annualTableRowsSorted, annualTablePageSafe]);

  const onAnnualTableSortClick = useCallback((column) => {
    setAnnualTableSort((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: 'desc' };
    });
  }, []);

  useEffect(() => {
    setAnnualTablePage(1);
  }, [sym, annualRange, annualTableSort.column, annualTableSort.direction]);

  useEffect(() => {
    setAnnualTablePage((prev) => Math.min(Math.max(1, prev), annualTableTotalPages));
  }, [annualTableTotalPages]);

  const annualReturnsTableRangeControl = (
    <label className="statistic-data__range">
      <span>Range</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 86 }}
        value={annualRange}
        options={TABLE_RANGE_DROPDOWN_OPTIONS}
        onChange={setAnnualRange}
        title="Table range"
        ariaLabelPrefix="Range"
        labelFallback={TABLE_RANGE_DROPDOWN_OPTIONS.find((o) => o.id === annualRange)?.label ?? annualRange}
      />
    </label>
  );

  return (
    <div className="ticker-page">
      {error ? (
        <div className="ticker-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="flex flex-wrap items-center justify-start gap-[10px]">
          <div className="ticker-page__header-controls ticker-page__header-controls--annual !ml-0 inline-flex flex-wrap items-center gap-[10px]">
            <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId="ticker-annual-symbol" />
            {loading ? (<span className="ticker-page__loading-pill">Loading quarterly data…</span>) : null}
          </div>
          <div className="ticker-page__header-identity min-w-0">
            <h1 className="ticker-page__company ticker-page__company--hero">
              {titleSymbol} Annual Statistics
            </h1>
          </div>
        </div>
      </header>

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <TickerAnnualReturnsFigma
            symbol={titleSymbol}
            annualReturns={annualReturnsFiltered}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_ANNUAL_FIGMA}
            resizeDefaultHeight={260}
            toolbarControls={annualChartRangeControls}
            loading={loading}
          />
          <TickerChartResizeScope storageKey={RESIZE_KEY_ANNUAL_POSNEG} defaultHeight={260}>
            <TickerAnnualReturnsPosNeg
              symbol={titleSymbol}
              annualReturns={annualReturnsFiltered}
              asOfDate={asOfDate}
              suppressChartDateFilter
              loading={loading}
            />
          </TickerChartResizeScope>
          

          <section className="statistic-data__card">
            <div className="statistic-data__table-head">
              <h2 className="statistic-data__table-title">Annual Returns</h2>
              <div className="statistic-data__head-actions">{annualReturnsTableRangeControl}</div>
            </div>
            <div className="statistic-data__table-wrap">
              <table className="statistic-data__table">
                <thead>
                  <tr>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onAnnualTableSortClick('period')}
                        aria-sort={
                          annualTableSort.column === 'period'
                            ? annualTableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Period
                        {annualTableSort.column === 'period' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {annualTableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onAnnualTableSortClick('startPrice')}
                        aria-sort={
                          annualTableSort.column === 'startPrice'
                            ? annualTableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Start Price
                        {annualTableSort.column === 'startPrice' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {annualTableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onAnnualTableSortClick('endPrice')}
                        aria-sort={
                          annualTableSort.column === 'endPrice'
                            ? annualTableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        End Price
                        {annualTableSort.column === 'endPrice' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {annualTableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                    <th scope="col">
                      <button
                        type="button"
                        className="statistic-data__th-sort"
                        onClick={() => onAnnualTableSortClick('return')}
                        aria-sort={
                          annualTableSort.column === 'return'
                            ? annualTableSort.direction === 'asc'
                              ? 'ascending'
                              : 'descending'
                            : 'none'
                        }
                      >
                        Return
                        {annualTableSort.column === 'return' ? (
                          <span className="statistic-data__th-sort-indicator" aria-hidden>
                            {annualTableSort.direction === 'desc' ? ' ▼' : ' ▲'}
                          </span>
                        ) : null}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {annualTablePageRows.length ? (
                    annualTablePageRows.map((row) => (
                      <tr key={`annual-table-${row.period}`}>
                        <td>{row.period}</td>
                        <td>{Number.isFinite(Number(row.startClose)) ? Number(row.startClose).toFixed(2) : '—'}</td>
                        <td>{Number.isFinite(Number(row.endClose)) ? Number(row.endClose).toFixed(2) : '—'}</td>
                        <td className={pctTone(row.returnPct)}>{fmtPct(row.returnPct)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="statistic-data__empty">
                        No annual rows yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {annualTableTotalPages > 1 ? (
              <div className="statistic-data__pager">
                <FigmaPagination page={annualTablePageSafe} totalPages={annualTableTotalPages} onPageChange={setAnnualTablePage} />
                <span className="statistic-data__pager-meta">
                  Page {annualTablePageSafe} of {annualTableTotalPages} ({annualTableRowsSorted.length} rows)
                </span>
              </div>
            ) : null}
          </section>
        </div>
        <aside className="ticker-page__aside ticker-page__aside-stack">
          {/* <section className="ticker-card ticker-card--signal" aria-labelledby="odin-signal-h">
            <div className="ticker-signal-head">
              <span className="ticker-signal-logo" aria-hidden />
              <h2 className="ticker-card__h ticker-card__h--inline" id="odin-signal-h">
                Odin Signal
              </h2>
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
                  className={'ticker-signal-cell ticker-signal-cell--' + s.tone + (activeBucket === s.k ? ' ticker-signal-cell--active' : '')}
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
          </section> */}

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="key-data-h">
            <header className="mkt-mini-card__head">
              <h2 className="mkt-mini-card__k" id="key-data-h">
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
                <span>INDICES</span>
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

          <section className="mkt-mini-card ticker-aside-mini" aria-labelledby="ticker-annual-rel-perf-h">
            <header className="mkt-mini-card__head">
              <span className="mkt-mini-card__k" id="ticker-annual-rel-perf-h">
                Relative performance (%)
              </span>
            </header>
            <div className="ticker-aside-mini__body">
              <div className="ticker-compare">
                <div className="ticker-compare__head">
                  <span />
                  <span>{selectedIndexLabel}</span>
                  <span>{selectedTickerKey}</span>
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

