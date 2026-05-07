import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DataInfoTip } from '../components/DataInfoTip.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { TickerAnnualReturnsFigma } from '../components/TickerAnnualReturnsFigma.jsx';
import { TickerAnnualReturnsPosNeg } from '../components/TickerAnnualReturnsPosNeg.jsx';
import { TickerQuarterlyReturnsChart } from '../components/TickerQuarterlyReturnsChart.jsx';
import { TickerChartResizeScope } from '../components/TickerChartResizeScope.jsx';
import { AnnualReturnBarChart } from '../components/AnnualReturnBarChart.jsx';
import { ExcessReturnLineChart } from '../components/ExcessReturnLineChart.jsx';
import { PeriodicReturnBarChart } from '../components/PeriodicReturnBarChart.jsx';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { pickRelatedByCategory, RELATED_INDEX_LINKS } from '../utils/relatedTickers.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { alignComparisonRows, filterRowsByYearRange, normalizePeriodReturnsRows } from '../utils/statisticsComparisonSeries.js';

const RESIZE_KEY_QTR_FIGMA = 'odin_ticker_quarterly_resize_figma';
const RESIZE_KEY_QTR_POSNEG = 'odin_ticker_quarterly_resize_posneg';
const RESIZE_KEY_QTR_MAIN = 'odin_ticker_quarterly_resize_main';
const RETURNS_DEFAULT_START = '1980-01-01';
const DEFAULT_START_YEAR = 2018;
const DEFAULT_END_YEAR = 2026;
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

function fmtPct(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
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

function formatPct(v) {
  return fmtPct(v);
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

export default function TickerQuarterlyPage() {
  const { symbol: symbolParam } = useParams();
  const navigate = useNavigate();
  const [sym, setSym] = useState(() => sanitizeTickerPageInput(symbolParam) || 'AAPL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [benchmarkIndex, setBenchmarkIndex] = useState(BENCHMARK);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quarterlyReturnsRaw, setQuarterlyReturnsRaw] = useState([]);
  const [quarterlyReturnsBenchRaw, setQuarterlyReturnsBenchRaw] = useState([]);
  const [dynamicSym, setDynamicSym] = useState([]);
  const [dynamicSpy, setDynamicSpy] = useState([]);
  const [statsRows, setStatsRows] = useState([]);
  const [statsRowsSpy, setStatsRowsSpy] = useState([]);
  const [detailRows, setDetailRows] = useState([]);
  const [chartStartYear, setChartStartYear] = useState(String(DEFAULT_START_YEAR));
  const [chartEndYear, setChartEndYear] = useState(String(DEFAULT_END_YEAR));
  const [tableStartYear, setTableStartYear] = useState(String(DEFAULT_START_YEAR));
  const [tableEndYear, setTableEndYear] = useState(String(DEFAULT_END_YEAR));
  const [tablePage, setTablePage] = useState(1);
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');

  useEffect(() => {
    const next = sanitizeTickerPageInput(symbolParam) || 'AAPL';
    setSym((prev) => (prev === next ? prev : next));
  }, [symbolParam]);

  usePageSeo({
    title: `${String(sym).toUpperCase()} Quarterly Returns | Odin500`,
    description: `Quarterly return charts and table for ${String(sym).toUpperCase()} on Odin500.`,
    canonicalPath: `/statistic/ticker-quarterly/${String(sym || 'aapl').toLowerCase()}`
  });

  const onSymbolChange = useCallback(
    (next) => {
      const s = sanitizeTickerPageInput(next) || 'AAPL';
      setSym(s);
      navigate('/statistic/ticker-quarterly/' + encodeURIComponent(s));
    },
    [navigate]
  );

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setError('Sign in to load ticker data.');
      setQuarterlyReturnsRaw([]);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const end = new Date().toISOString().slice(0, 10);
        const tickerU = String(sym || '').toUpperCase().trim();
        const body = {
          ticker: tickerU,
          customStartDate: RETURNS_DEFAULT_START,
          customEndDate: end
        };
        const oneYearStart = new Date(end + 'T12:00:00');
        oneYearStart.setFullYear(oneYearStart.getFullYear() - 1);
        const oneYearStartIso = oneYearStart.toISOString().slice(0, 10);
        const [qRes, qBenchRes, coreSymRes, coreSpyRes, ohlcSymRes, ohlcSpyRes, detailsRes] = await Promise.all([
          fetchJsonCached({ path: '/api/market/ticker-quarterly-returns', method: 'POST', body, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-quarterly-returns', method: 'POST', body: { ...body, ticker: benchmarkIndex }, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/ticker-core-returns', method: 'POST', body, ttlMs: 5 * 60 * 1000 }),
          fetchJsonCached({
            path: '/api/market/ticker-core-returns',
            method: 'POST',
            body: { ...body, ticker: benchmarkIndex },
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: `/api/market/ohlc?symbol=${encodeURIComponent(tickerU)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`,
            method: 'GET',
            ttlMs: 10 * 60 * 1000
          }),
          fetchJsonCached({
            path: `/api/market/ohlc?symbol=${encodeURIComponent(benchmarkIndex)}&start_date=${encodeURIComponent(oneYearStartIso)}&end_date=${encodeURIComponent(end)}&limit=400`,
            method: 'GET',
            ttlMs: 10 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-details',
            method: 'POST',
            body: { index: 'sp500', period: 'last-1-year' },
            ttlMs: 30 * 60 * 1000
          })
        ]);
        if (cancelled) return;
        const perf = qRes?.data?.performance || {};
        const perfBench = qBenchRes?.data?.performance || {};
        const coreSymPerf = coreSymRes?.data?.performance || {};
        const coreSpyPerf = coreSpyRes?.data?.performance || {};
        setQuarterlyReturnsRaw(Array.isArray(perf.quarterlyReturns) ? perf.quarterlyReturns : []);
        setQuarterlyReturnsBenchRaw(Array.isArray(perfBench.quarterlyReturns) ? perfBench.quarterlyReturns : []);
        setDynamicSym(Array.isArray(coreSymPerf.dynamicPeriods) ? coreSymPerf.dynamicPeriods : []);
        setDynamicSpy(Array.isArray(coreSpyPerf.dynamicPeriods) ? coreSpyPerf.dynamicPeriods : []);
        const symRows = Array.isArray(ohlcSymRes?.data?.data) ? ohlcSymRes.data.data : Array.isArray(ohlcSymRes?.data) ? ohlcSymRes.data : [];
        const spyRows = Array.isArray(ohlcSpyRes?.data?.data) ? ohlcSpyRes.data.data : Array.isArray(ohlcSpyRes?.data) ? ohlcSpyRes.data : [];
        setStatsRows(sortRowsAsc(symRows));
        setStatsRowsSpy(sortRowsAsc(spyRows));
        setDetailRows(Array.isArray(detailsRes?.data?.data) ? detailsRes.data.data : []);
        setAsOfDate(String(qRes?.data?.asOfDate || end).slice(0, 10));
      } catch (e) {
        if (!cancelled) {
          setError(e?.message || 'Failed to load quarterly returns');
          setQuarterlyReturnsRaw([]);
          setQuarterlyReturnsBenchRaw([]);
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
  }, [sym, benchmarkIndex]);

  const quarterlyRowsNormalized = useMemo(
    () =>
      (Array.isArray(quarterlyReturnsRaw) ? quarterlyReturnsRaw : [])
        .map((r) => ({
          period: r?.period,
          startDate: r?.startDate,
          endDate: r?.endDate,
          startClose: r?.startPrice,
          endClose: r?.endPrice,
          returnPct: r?.totalReturn,
          year: (() => {
            const fromPeriod = parseYear(r?.period);
            if (Number.isFinite(fromPeriod)) return fromPeriod;
            const fromStart = Number(String(r?.startDate || '').slice(0, 4));
            if (Number.isFinite(fromStart)) return fromStart;
            const fromEnd = Number(String(r?.endDate || '').slice(0, 4));
            if (Number.isFinite(fromEnd)) return fromEnd;
            return null;
          })()
        }))
        .filter((r) => r.period && Number.isFinite(r.year)),
    [quarterlyReturnsRaw]
  );
  const quarterlyRowsForChart = useMemo(
    () =>
      (Array.isArray(quarterlyReturnsRaw) ? quarterlyReturnsRaw : [])
        .map((r) => {
          const year = (() => {
            const fromPeriod = parseYear(r?.period);
            if (Number.isFinite(fromPeriod)) return fromPeriod;
            const fromStart = Number(String(r?.startDate || '').slice(0, 4));
            if (Number.isFinite(fromStart)) return fromStart;
            const fromEnd = Number(String(r?.endDate || '').slice(0, 4));
            if (Number.isFinite(fromEnd)) return fromEnd;
            return null;
          })();
          return {
            raw: r,
            year
          };
        })
        .filter((x) => Number.isFinite(x.year)),
    [quarterlyReturnsRaw]
  );
  const quarterYearOptions = useMemo(() => {
    const years = Array.from(new Set(quarterlyRowsNormalized.map((r) => r.year).filter(Number.isFinite))).sort(
      (a, b) => a - b
    );
    return years.length ? years : Array.from({ length: 2026 - 1980 + 1 }, (_, i) => 1980 + i);
  }, [quarterlyRowsNormalized]);

  const quarterlyChartRows = useMemo(() => {
    const startY = Number(chartStartYear);
    const endY = Number(chartEndYear);
    if (!Number.isFinite(startY) || !Number.isFinite(endY)) return quarterlyRowsForChart.map((x) => x.raw);
    const lo = Math.min(startY, endY);
    const hi = Math.max(startY, endY);
    return quarterlyRowsForChart
      .filter((x) => x.year >= lo && x.year <= hi)
      .map((x) => x.raw);
  }, [chartEndYear, chartStartYear, quarterlyRowsForChart]);
  const quarterlyComparisonRows = useMemo(() => {
    const tickerRows = normalizePeriodReturnsRows(quarterlyReturnsRaw, 'quarterly');
    const benchRows = normalizePeriodReturnsRows(quarterlyReturnsBenchRaw, 'quarterly');
    const aligned = alignComparisonRows(tickerRows, benchRows);
    return filterRowsByYearRange(aligned, chartStartYear, chartEndYear);
  }, [quarterlyReturnsRaw, quarterlyReturnsBenchRaw, chartStartYear, chartEndYear]);

  const tableRows = useMemo(() => {
    const startY = Number(tableStartYear);
    const endY = Number(tableEndYear);
    if (!Number.isFinite(startY) || !Number.isFinite(endY)) return quarterlyRowsNormalized;
    const lo = Math.min(startY, endY);
    const hi = Math.max(startY, endY);
    return quarterlyRowsNormalized.filter((r) => r.year >= lo && r.year <= hi);
  }, [quarterlyRowsNormalized, tableEndYear, tableStartYear]);

  const tableTotalPages = useMemo(() => Math.max(1, Math.ceil(tableRows.length / TABLE_PAGE_SIZE)), [tableRows.length]);
  const tablePageSafe = useMemo(() => Math.min(Math.max(1, tablePage), tableTotalPages), [tablePage, tableTotalPages]);
  const tablePageRows = useMemo(() => {
    const start = (tablePageSafe - 1) * TABLE_PAGE_SIZE;
    return tableRows.slice(start, start + TABLE_PAGE_SIZE);
  }, [tableRows, tablePageSafe]);

  useEffect(() => {
    setTablePage(1);
  }, [sym, tableStartYear, tableEndYear]);

  useEffect(() => {
    setTablePage((p) => Math.min(Math.max(1, p), tableTotalPages));
  }, [tableTotalPages]);

  useEffect(() => {
    if (!quarterYearOptions.length) return;
    const hasDefaultStart = quarterYearOptions.includes(DEFAULT_START_YEAR);
    const hasDefaultEnd = quarterYearOptions.includes(DEFAULT_END_YEAR);
    const nextStart = hasDefaultStart ? DEFAULT_START_YEAR : quarterYearOptions[0];
    const nextEnd = hasDefaultEnd ? DEFAULT_END_YEAR : quarterYearOptions[quarterYearOptions.length - 1];
    setChartStartYear((prev) =>
      quarterYearOptions.includes(Number(prev)) ? prev : String(nextStart)
    );
    setChartEndYear((prev) =>
      quarterYearOptions.includes(Number(prev)) ? prev : String(nextEnd)
    );
    setTableStartYear((prev) =>
      quarterYearOptions.includes(Number(prev)) ? prev : String(nextStart)
    );
    setTableEndYear((prev) =>
      quarterYearOptions.includes(Number(prev)) ? prev : String(nextEnd)
    );
  }, [quarterYearOptions]);

  const quarterYearDropdownOptions = useMemo(
    () => quarterYearOptions.map((y) => ({ id: String(y), label: String(y) })),
    [quarterYearOptions]
  );

  const chartRangeControls = (
    <div className="ticker-page__custom-range" aria-label="Quarterly chart year range">
      <span className="ticker-page__label ticker-page__label--inline">Start year</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={chartStartYear}
        options={quarterYearDropdownOptions}
        onChange={setChartStartYear}
        title="Start year"
        ariaLabelPrefix="Start year"
        labelFallback={chartStartYear}
      />
      <span className="ticker-page__label ticker-page__label--inline">End year</span>
      <ThemedDropdown
        size="sm"
        style={{ minWidth: 96 }}
        value={chartEndYear}
        options={quarterYearDropdownOptions}
        onChange={setChartEndYear}
        title="End year"
        ariaLabelPrefix="End year"
        labelFallback={chartEndYear}
      />
    </div>
  );

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

  return (
    <div className="ticker-page">
      {error ? (
        <div className="ticker-page__error" role="alert">
          {error}
        </div>
      ) : null}

      <header className="ticker-page__header ticker-page__header--figma">
        <div className="ticker-page__header-top">
          <div className="ticker-page__header-identity">
            <h1 className="ticker-page__company ticker-page__company--hero">{symU} Quarterly Returns</h1>
          </div>
          <div className="ticker-page__header-controls">
            <TickerSymbolCombobox symbol={sym} onSymbolChange={onSymbolChange} inputId="ticker-quarterly-symbol" />
            {loading ? (<span className="ticker-page__loading-pill">Loading quarterly data…</span>) : null}
            
          </div>
        </div>
      </header>

      <div className="ticker-page__grid">
        <div className="ticker-page__main">
          <TickerAnnualReturnsFigma
            symbol={symU}
            annualReturns={quarterlyChartRows}
            asOfDate={asOfDate}
            resizeStorageKey={RESIZE_KEY_QTR_FIGMA}
            resizeDefaultHeight={260}
            periodMode="quarterly"
            toolbarControls={chartRangeControls}
          />
          <TickerChartResizeScope storageKey={RESIZE_KEY_QTR_POSNEG} defaultHeight={260}>
            <TickerAnnualReturnsPosNeg
              symbol={symU}
              annualReturns={quarterlyChartRows}
              asOfDate={asOfDate}
              periodMode="quarterly"
              suppressChartDateFilter
            />
          </TickerChartResizeScope>
          <TickerChartResizeScope storageKey={RESIZE_KEY_QTR_MAIN} defaultHeight={288}>
            <TickerQuarterlyReturnsChart symbol={symU} quarterlyReturns={quarterlyChartRows} asOfDate={asOfDate} />
          </TickerChartResizeScope>
          <div className="stats-cmp-charts">
            <AnnualReturnBarChart
              mode="quarterly"
              ticker={symU}
              benchmarkIndex={benchmarkIndex}
              startYear={Number(chartStartYear)}
              endYear={Number(chartEndYear)}
              theme={chartTheme}
              rows={quarterlyComparisonRows}
              benchmarkOptions={BENCHMARK_OPTIONS}
              onBenchmarkChange={setBenchmarkIndex}
              controls={chartRangeControls}
              loading={loading}
            />
            <ExcessReturnLineChart
              mode="quarterly"
              ticker={symU}
              benchmarkIndex={benchmarkIndex}
              startYear={Number(chartStartYear)}
              endYear={Number(chartEndYear)}
              theme={chartTheme}
              rows={quarterlyComparisonRows}
              benchmarkOptions={BENCHMARK_OPTIONS}
              onBenchmarkChange={setBenchmarkIndex}
              controls={chartRangeControls}
              loading={loading}
            />
            <PeriodicReturnBarChart
              mode="quarterly"
              ticker={symU}
              benchmarkIndex={benchmarkIndex}
              startYear={Number(chartStartYear)}
              endYear={Number(chartEndYear)}
              theme={chartTheme}
              rows={quarterlyComparisonRows}
              benchmarkOptions={BENCHMARK_OPTIONS}
              onBenchmarkChange={setBenchmarkIndex}
              controls={chartRangeControls}
              loading={loading}
            />
          </div>

          <section className="statistic-data__card">
            <div className="statistic-data__table-head">
              <h2 className="statistic-data__table-title">Quarterly Returns</h2>
              <div className="statistic-data__head-actions">
                <div className="ticker-page__custom-range" aria-label="Quarterly table year range">
                  <span className="ticker-page__label ticker-page__label--inline">Start year</span>
                  <ThemedDropdown
                    size="sm"
                    style={{ minWidth: 96 }}
                    value={tableStartYear}
                    options={quarterYearDropdownOptions}
                    onChange={setTableStartYear}
                    title="Table start year"
                    ariaLabelPrefix="Start year"
                    labelFallback={tableStartYear}
                  />
                  <span className="ticker-page__label ticker-page__label--inline">End year</span>
                  <ThemedDropdown
                    size="sm"
                    style={{ minWidth: 96 }}
                    value={tableEndYear}
                    options={quarterYearDropdownOptions}
                    onChange={setTableEndYear}
                    title="Table end year"
                    ariaLabelPrefix="End year"
                    labelFallback={tableEndYear}
                  />
                </div>
              </div>
            </div>
            <div className="statistic-data__table-wrap">
              <table className="statistic-data__table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Start Close</th>
                    <th>End Close</th>
                    <th>Return</th>
                  </tr>
                </thead>
                <tbody>
                  {tablePageRows.length ? (
                    tablePageRows.map((row) => (
                      <tr key={`quarterly-table-${row.period}`}>
                        <td>{row.period}</td>
                        <td>{row.startDate || '—'}</td>
                        <td>{row.endDate || '—'}</td>
                        <td>{Number.isFinite(Number(row.startClose)) ? Number(row.startClose).toFixed(2) : '—'}</td>
                        <td>{Number.isFinite(Number(row.endClose)) ? Number(row.endClose).toFixed(2) : '—'}</td>
                        <td className={pctTone(row.returnPct)}>{fmtPct(row.returnPct)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="statistic-data__empty">
                        No quarterly rows yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="statistic-data__pager">
              <span className="statistic-data__pager-meta">
                Page {tablePageSafe} of {tableTotalPages} ({tableRows.length} rows)
              </span>
            </div>
          </section>
        </div>
        <aside className="ticker-page__aside">
          <section className="ticker-card ticker-card--signal" aria-labelledby="odin-signal-h-q">
            <div className="ticker-signal-head">
              <span className="ticker-signal-logo" aria-hidden />
              <h2 className="ticker-card__h ticker-card__h--inline" id="odin-signal-h-q">Odin Signal</h2>
            </div>
            <p className="ticker-signal-asof">As of {lastUpdatedFmt}</p>
            <div className="ticker-signal-lanes" role="list">
              {[{ k: 'L1', tone: 'green-dark' }, { k: 'L2', tone: 'green-dark' }, { k: 'L3', tone: 'green-bright' }, { k: 'S1', tone: 'orange' }, { k: 'S2', tone: 'orange-mid' }, { k: 'S3', tone: 'amber' }, { k: 'N', tone: 'gray' }].map((s) => (
                <div key={s.k} className={'ticker-signal-cell ticker-signal-cell--' + s.tone + (activeBucket === s.k ? ' ticker-signal-cell--active' : '')} role="listitem">{s.k}</div>
              ))}
            </div>
            <div className="ticker-signal-foot">
              <IconTrendUp className="ticker-signal-foot__ico" />
              <IconTrendDown className="ticker-signal-foot__ico" />
            </div>
          </section>
          <section className="ticker-card" aria-labelledby="key-data-h-q">
            <div className="ticker-card__h-with-tip">
              <h2 className="ticker-card__h ticker-card__h--flex" id="key-data-h-q">Key data &amp; performance</h2>
              <DataInfoTip align="start">
                <p className="ticker-data-tip__p">52w range, avg volume, and volatility come from last ~1y OHLC rows.</p>
              </DataInfoTip>
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
              {competitors.length ? competitors.map((t) => (<Link key={t} to={`/ticker/${encodeURIComponent(t)}`} className="ticker-kd-comp__a">{t}</Link>)) : <span className="ticker-page__muted">—</span>}
              </span>
            </p>
            
            <div className="ticker-subh-with-tip"><h3 className="ticker-subh ticker-subh--flex">vs {benchmarkIndex} (total return %, then difference)</h3></div>
            <div className="ticker-compare">
              <div className="ticker-compare__head"><span /><span>{symU}</span><span>{benchmarkIndex}</span><span>Diff</span></div>
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

