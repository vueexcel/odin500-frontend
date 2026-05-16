import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FigmaDataTable } from '../components/FigmaDataTable.jsx';
import { FigmaPagination } from '../components/FigmaPagination.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import {fetchJsonCached, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { useGatedCsvDownload } from '../hooks/useGatedCsvDownload.js';
import { usePageSeo } from '../seo/usePageSeo.js';

const DEFAULT_SYMBOL = 'AAPL';
const TABLE_RANGE_OPTIONS = [
  { value: '1', label: '1Y' },
  { value: '3', label: '3Y' },
  { value: '5', label: '5Y' },
  { value: '10', label: '10Y' },
  { value: 'max', label: 'Max' }
];
const TABLE_RANGE_DROPDOWN_OPTIONS = TABLE_RANGE_OPTIONS.map((opt) => ({
  id: opt.value,
  label: opt.label
}));
const PREDEFINED_YEAR_BUCKETS = [5, 10, 15, 20, 25, 50];
const TABLE_PAGE_SIZE = 30;
const RETURN_TABLE_HEADERS = [
  { key: 'period', label: 'Period' },
  { key: 'startClose', label: 'Start Close' },
  { key: 'endClose', label: 'End Close' },
  { key: 'returnPct', label: 'Return' }
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

function sortRowsAsc(rows) {
  return [...(rows || [])].sort((a, b) => {
    const ta = rowDateToTimeKey(a);
    const tb = rowDateToTimeKey(b);
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
}

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

/** @param {'key' | 'endDate'} mode */
function displayPeriodForRow(row, mode) {
  if (mode === 'endDate' && row.periodEndIso) return formatIsoDate(row.periodEndIso);
  return row.period;
}

function getReturnRowSortValue(row, headerKey) {
  if (row.__skeleton) return null;
  switch (headerKey) {
    case 'period': {
      if (row.periodEndIso) return String(row.periodEndIso);
      const p = String(row.period ?? '');
      const m = p.match(/Last\s+(\d+)\s+years/i);
      if (m) return Number(m[1]);
      return p;
    }
    case 'startClose':
      return Number.isFinite(Number(row.startClose)) ? Number(row.startClose) : null;
    case 'endClose':
      if (Number.isFinite(Number(row.endClose))) return Number(row.endClose);
      if (row.unavailableReason) return String(row.unavailableReason);
      return null;
    case 'returnPct':
      return row.returnPct != null && Number.isFinite(Number(row.returnPct)) ? Number(row.returnPct) : null;
    default:
      return null;
  }
}

function compareReturnRows(a, b, headerKey, dir) {
  const mul = dir === 'asc' ? 1 : -1;
  const va = getReturnRowSortValue(a, headerKey);
  const vb = getReturnRowSortValue(b, headerKey);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') {
    if (va !== vb) return va < vb ? -mul : mul;
    return 0;
  }
  const sa = String(va);
  const sb = String(vb);
  const cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' });
  if (cmp !== 0) return cmp * mul;
  return 0;
}

function sortReturnTableRows(rows, headerKey, dir) {
  if (!Array.isArray(rows) || !rows.length || !headerKey) return rows;
  return [...rows].sort((a, b) => compareReturnRows(a, b, headerKey, dir));
}

function toMiddayDate(iso) {
  return new Date(`${String(iso).slice(0, 10)}T12:00:00`);
}

function formatIsoDate(iso) {
  if (!iso) return '—';
  const d = toMiddayDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

function todayIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeGroupedReturns(rows, keyForDate, maxRows) {
  const sorted = sortRowsAsc(rows);
  const buckets = new Map();
  for (const row of sorted) {
    const iso = rowDateToTimeKey(row);
    const close = pickNum(row, ['Close', 'close']);
    if (!iso || close == null) continue;
    const key = keyForDate(iso);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push({ close, iso });
  }
  const out = [];
  for (const [key, values] of buckets.entries()) {
    if (!values.length) continue;
    const first = values[0];
    const last = values[values.length - 1];
    const ret = first.close === 0 ? null : ((last.close - first.close) / first.close) * 100;
    out.push({
      period: key,
      periodStartIso: first.iso,
      periodEndIso: last.iso,
      returnPct: ret,
      startClose: first.close,
      endClose: last.close
    });
  }
  out.sort((a, b) => String(b.period).localeCompare(String(a.period)));
  return Number.isFinite(maxRows) ? out.slice(0, maxRows) : out;
}

function computeDailyReturns(rows, maxRows) {
  const sorted = sortRowsAsc(rows);
  const out = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = pickNum(sorted[i - 1], ['Close', 'close']);
    const next = pickNum(sorted[i], ['Close', 'close']);
    const iso = rowDateToTimeKey(sorted[i]);
    if (!iso || prev == null || next == null || prev === 0) continue;
    out.push({
      period: iso,
      returnPct: ((next - prev) / prev) * 100,
      startClose: prev,
      endClose: next
    });
  }
  out.sort((a, b) => String(b.period).localeCompare(String(a.period)));
  return Number.isFinite(maxRows) ? out.slice(0, maxRows) : out;
}

function weekKey(iso) {
  const d = toMiddayDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  const firstDay = new Date(d.getFullYear(), 0, 1);
  const dayMs = 86400000;
  const dayOfYear = Math.floor((d.getTime() - firstDay.getTime()) / dayMs) + 1;
  const week = Math.ceil(dayOfYear / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function monthKey(iso) {
  const d = toMiddayDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function quarterKey(iso) {
  const d = toMiddayDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}

function yearKey(iso) {
  const d = toMiddayDate(iso);
  if (Number.isNaN(d.getTime())) return '';
  return String(d.getFullYear());
}

function filterRowsByRange(rows, rangeYears) {
  const sorted = sortRowsAsc(rows);
  if (!sorted.length || rangeYears === 'max') return sorted;
  const years = Number(rangeYears);
  if (!Number.isFinite(years) || years <= 0) return sorted;
  const lastIso = rowDateToTimeKey(sorted[sorted.length - 1]);
  if (!lastIso) return sorted;
  const cutoff = toMiddayDate(lastIso);
  cutoff.setFullYear(cutoff.getFullYear() - years);
  return sorted.filter((r) => {
    const iso = rowDateToTimeKey(r);
    return iso ? toMiddayDate(iso) >= cutoff : false;
  });
}

function computePredefinedRangeRows(rows) {
  const sorted = sortRowsAsc(rows);
  if (!sorted.length) return [];
  const firstIso = rowDateToTimeKey(sorted[0]);
  const lastIso = rowDateToTimeKey(sorted[sorted.length - 1]);
  const firstClose = pickNum(sorted[0], ['Close', 'close']);
  const lastClose = pickNum(sorted[sorted.length - 1], ['Close', 'close']);
  if (!firstIso || !lastIso || firstClose == null || lastClose == null) return [];
  const firstDate = toMiddayDate(firstIso);
  const lastDate = toMiddayDate(lastIso);

  return PREDEFINED_YEAR_BUCKETS.map((years) => {
    const requestedStart = new Date(lastDate);
    requestedStart.setFullYear(requestedStart.getFullYear() - years);
    const hasEnoughHistory = firstDate <= requestedStart;
    if (!hasEnoughHistory) {
      return {
        period: `Last ${years} years`,
        returnPct: null,
        startClose: null,
        endClose: null,
        unavailableReason: `Need data on/before ${formatIsoDate(requestedStart.toISOString().slice(0, 10))}`
      };
    }
    const startRow = sorted.find((r) => {
      const iso = rowDateToTimeKey(r);
      return iso ? toMiddayDate(iso) >= requestedStart : false;
    });
    const startClose = startRow ? pickNum(startRow, ['Close', 'close']) : null;
    if (!startRow || startClose == null || startClose === 0) {
      return {
        period: `Last ${years} years`,
        returnPct: null,
        startClose: null,
        endClose: null,
        unavailableReason: 'No usable start row'
      };
    }
    return {
      period: `Last ${years} years`,
      returnPct: ((lastClose - startClose) / startClose) * 100,
      startClose,
      endClose: lastClose,
      unavailableReason: ''
    };
  });
}

function ReturnTable({
  title,
  rows,
  rangeValue,
  onRangeChange,
  showRangeSelector = true,
  sectionKey = '',
  sectionRef = null,
  highlighted = false,
  loading = false,
  /** `endDate`: Period column shows last trading date in the bucket (e.g. quarter). */
  periodDisplayMode = 'key'
}) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return sortReturnTableRows(rows, sortKey, sortDir);
  }, [rows, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / TABLE_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const startIdx = (pageSafe - 1) * TABLE_PAGE_SIZE;
  const pageRows = sortedRows.slice(startIdx, startIdx + TABLE_PAGE_SIZE);
  const skeletonRows = useMemo(
    () => Array.from({ length: TABLE_PAGE_SIZE }, (_, i) => ({ __skeleton: true, __index: i })),
    []
  );

  useEffect(() => {
    setPage(1);
    setSortKey(null);
    setSortDir('asc');
  }, [title, rangeValue]);

  const onSortHeader = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir('asc');
      return key;
    });
    setPage(1);
  }, []);

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  const onDownloadCsv = () => {
    if (!sortedRows.length) return;
    const header = ['Period', 'Start Close', 'End Close', 'Return'];
    const csvRows = sortedRows.map((row) => [
      `"${String(displayPeriodForRow(row, periodDisplayMode) ?? '').replace(/"/g, '""')}"`,
      row.startClose != null && Number.isFinite(Number(row.startClose)) ? Number(row.startClose).toFixed(4) : '',
      row.endClose != null && Number.isFinite(Number(row.endClose))
        ? Number(row.endClose).toFixed(4)
        : `"${String(row.unavailableReason || '').replace(/"/g, '""')}"`,
      row.returnPct != null && Number.isFinite(Number(row.returnPct)) ? Number(row.returnPct).toFixed(4) : ''
    ]);
    const csv = [header.join(','), ...csvRows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onDownloadCsvClick = useGatedCsvDownload(onDownloadCsv);

  return (
    <section
      id={sectionKey ? `stat-section-${sectionKey}` : undefined}
      ref={sectionRef}
      className={'statistic-data__card' + (highlighted ? ' statistic-data__card--target' : '')}
    >
      <div className="statistic-data__table-head">
        <h2 className="statistic-data__table-title">{title}</h2>
        <div className="statistic-data__head-actions">
          {showRangeSelector ? (
            <label className="statistic-data__range">
              <span>Range</span>
              <ThemedDropdown
                size="sm"
                style={{ minWidth: 86 }}
                value={rangeValue}
                options={TABLE_RANGE_DROPDOWN_OPTIONS}
                onChange={(v) => onRangeChange?.(v)}
                title="Table range"
                ariaLabelPrefix="Range"
                labelFallback={TABLE_RANGE_OPTIONS.find((o) => o.value === rangeValue)?.label ?? rangeValue}
              />
            </label>
          ) : null}
          <button
            type="button"
            className="statistic-data__csv-btn"
            onClick={onDownloadCsvClick}
            disabled={!sortedRows.length || loading}
            title="Download CSV"
          >
            Download CSV
          </button>
        </div>
      </div>
      <FigmaDataTable
        headers={RETURN_TABLE_HEADERS}
        rows={loading ? skeletonRows : pageRows}
        sortKey={loading ? null : sortKey}
        sortDir={sortDir}
        onSortHeader={loading ? undefined : onSortHeader}
        getRowKey={(row) => (row.__skeleton ? `${title}-skel-${row.__index}` : `${title}-${row.period}`)}
        getRowClassName={(row) => (row.__skeleton ? 'statistic-data__tr--skeleton' : '')}
        wrapClassName={'statistic-data__table-wrap' + (loading ? ' statistic-data__table-wrap--loading-skel' : '')}
        tableAriaBusy={loading}
        emptyText="No rows yet."
        emptyColSpan={4}
        renderCell={({ header, row }) => {
          if (row.__skeleton) {
            const i = Number(row.__index) || 0;
            if (header.key === 'period') {
              return <span className="statistic-data__skel-cell" style={{ maxWidth: '88%', animationDelay: `${i * 0.04}s` }} />;
            }
            if (header.key === 'startClose') {
              return <span className="statistic-data__skel-cell" style={{ maxWidth: '72%', animationDelay: `${i * 0.04 + 0.02}s` }} />;
            }
            if (header.key === 'endClose') {
              return <span className="statistic-data__skel-cell" style={{ maxWidth: '80%', animationDelay: `${i * 0.04 + 0.04}s` }} />;
            }
            return <span className="statistic-data__skel-cell" style={{ maxWidth: '56%', animationDelay: `${i * 0.04 + 0.06}s` }} />;
          }
          if (header.key === 'period') return displayPeriodForRow(row, periodDisplayMode);
          if (header.key === 'startClose') return Number.isFinite(row.startClose) ? row.startClose.toFixed(2) : '—';
          if (header.key === 'endClose') {
            return Number.isFinite(row.endClose) ? row.endClose.toFixed(2) : row.unavailableReason ? row.unavailableReason : '—';
          }
          return fmtPct(row.returnPct);
        }}
        cellClassName={({ header, row }) => (row.__skeleton ? '' : header.key === 'returnPct' ? pctTone(row.returnPct) : '')}
      />
      <div className="statistic-data__pager">
        {loading ? (
          <span className="statistic-data__pager-meta statistic-data__pager-meta--stretch">Loading…</span>
        ) : totalPages > 1 ? (
          <>
            <FigmaPagination
              page={pageSafe}
              totalPages={totalPages}
              onPageChange={setPage}
              ariaLabel="Table pagination"
            />
            <span className="statistic-data__pager-meta">
              Page {pageSafe} of {totalPages} ({sortedRows.length} rows)
            </span>
          </>
        ) : null
        }
      </div>
    </section>
  );
}

export default function StatisticDataPage() {
  const location = useLocation();
  useEffect(() => {
    console.info('[statistic-data] page mounted');
    return () => {
      console.info('[statistic-data] page unmounted');
    };
  }, []);

  useEffect(() => {
    console.info('[statistic-data] location changed', {
      pathname: location.pathname,
      search: location.search,
      key: location.key
    });
  }, [location.pathname, location.search, location.key]);

  usePageSeo({
    title: 'Statistic Tables — Daily, Weekly, Monthly, Quarterly, Annual | Odin500',
    description:
      'Table-focused return analytics with CSV downloads across daily, weekly, monthly, quarterly, and annual ranges.',
    canonicalPath: '/statistic-data',
    noindex: Boolean(location.search)
  });
  const [symbol, setSymbol] = useState(() => {
    const qsSymbol = sanitizeTickerPageInput(new URLSearchParams(location.search).get('symbol') || '');
    return qsSymbol || DEFAULT_SYMBOL;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ohlcRows, setOhlcRows] = useState([]);
  const [dataCoverage, setDataCoverage] = useState({ minDate: '', maxDate: '' });
  const [dailyRange, setDailyRange] = useState('1');
  const [weeklyRange, setWeeklyRange] = useState('3');
  const [monthlyRange, setMonthlyRange] = useState('5');
  const [quarterlyRange, setQuarterlyRange] = useState('10');
  const [annualRange, setAnnualRange] = useState('max');
  const [activeSection, setActiveSection] = useState('');
  const predefinedRef = useRef(null);
  const dailyRef = useRef(null);
  const weeklyRef = useRef(null);
  const monthlyRef = useRef(null);
  const quarterlyRef = useRef(null);
  const annualRef = useRef(null);

  useEffect(() => {
    const rawSection = (new URLSearchParams(location.search).get('section') || '').toLowerCase();
    const sectionAliases = {
      predefined: 'predefined',
      'predefined-range': 'predefined',
      'predefined-ranges': 'predefined',
      daily: 'daily',
      'daily-return': 'daily',
      'daily-returns': 'daily',
      weekly: 'weekly',
      'weekly-return': 'weekly',
      'weekly-returns': 'weekly',
      monthly: 'monthly',
      'monthly-return': 'monthly',
      'monthly-returns': 'monthly',
      quarterly: 'quarterly',
      'quarterly-return': 'quarterly',
      'quarterly-returns': 'quarterly',
      annual: 'annual',
      'annual-return': 'annual',
      'annual-returns': 'annual'
    };
    const section = sectionAliases[rawSection] || '';
    const map = {
      predefined: predefinedRef,
      daily: dailyRef,
      weekly: weeklyRef,
      monthly: monthlyRef,
      quarterly: quarterlyRef,
      annual: annualRef
    };
    const targetRef = map[section];
    console.info('[statistic-data] section resolution', {
      rawSection,
      resolvedSection: section,
      hasTargetRef: Boolean(targetRef?.current)
    });
    setActiveSection(targetRef ? section : '');
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.search]);

  useEffect(() => {
    const qsSymbol = sanitizeTickerPageInput(new URLSearchParams(location.search).get('symbol') || '');
    if (!qsSymbol) return;
    setSymbol((prev) => (prev === qsSymbol ? prev : qsSymbol));
  }, [location.search]);

  useEffect(() => {
    const clean = sanitizeTickerPageInput(symbol) || DEFAULT_SYMBOL;
    let cancelled = false;
    if (!canFetchProtectedApi()) {
      setError('Sign in to load statistics.');
      setOhlcRows([]);
      setDataCoverage({ minDate: '', maxDate: '' });
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const startDate = '1980-01-01';
        const endDate = todayIso();
        const ohlcRes = await fetchJsonCached({
          path: '/api/market/ohlc-signals-indicator',
          method: 'POST',
          body: { ticker: clean, start_date: startDate, end_date: endDate },
          ttlMs: 10 * 60 * 1000
        });
        if (cancelled) return;
        const payload = ohlcRes?.data;
        const nextRows = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(ohlcRes?.data)
            ? ohlcRes.data
            : [];
        setOhlcRows(nextRows);
        setDataCoverage({
          minDate: rowDateToTimeKey(nextRows[nextRows.length - 1]) || payload?.start_date || '',
          maxDate: rowDateToTimeKey(nextRows[0]) || payload?.end_date || ''
        });
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load statistic tables');
          setOhlcRows([]);
          setDataCoverage({ minDate: '', maxDate: '' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const dailyRows = useMemo(() => computeDailyReturns(filterRowsByRange(ohlcRows, dailyRange)), [ohlcRows, dailyRange]);
  const weeklyRows = useMemo(
    () => computeGroupedReturns(filterRowsByRange(ohlcRows, weeklyRange), weekKey),
    [ohlcRows, weeklyRange]
  );
  const monthlyRows = useMemo(
    () => computeGroupedReturns(filterRowsByRange(ohlcRows, monthlyRange), monthKey),
    [ohlcRows, monthlyRange]
  );
  const quarterlyRows = useMemo(
    () => computeGroupedReturns(filterRowsByRange(ohlcRows, quarterlyRange), quarterKey),
    [ohlcRows, quarterlyRange]
  );
  const annualRows = useMemo(
    () => computeGroupedReturns(filterRowsByRange(ohlcRows, annualRange), yearKey),
    [ohlcRows, annualRange]
  );
  const predefinedRows = useMemo(() => computePredefinedRangeRows(ohlcRows), [ohlcRows]);

  return (
    <div className="statistic-data-page">
      <header className="statistic-data__header">
        <h1>Statistic Tables</h1>
        <p>Table-only return dashboard for daily, weekly, monthly, quarterly, annual, and predefined windows.</p>
      </header>

      <section className="statistic-data__toolbar">
        <div className="statistic-data__symbol">
          <label htmlFor="statistic-data-symbol">Ticker</label>
          <TickerSymbolCombobox
            symbol={symbol}
            onSymbolChange={(next) => setSymbol(sanitizeTickerPageInput(next) || DEFAULT_SYMBOL)}
            inputId="statistic-data-symbol"
            placeholder="Search ticker (e.g. NVDA)"
          />
        </div>
        {error ? <span className="statistic-data__status statistic-data__status--err">{error}</span> : null}
        {dataCoverage.minDate ? (
          <span className="statistic-data__status">
            Coverage: {formatIsoDate(dataCoverage.minDate)} → {formatIsoDate(dataCoverage.maxDate)}
          </span>
        ) : null}
      </section>

      <div className="statistic-data__grid">
        <ReturnTable
          title="Predefined Range Returns"
          rows={predefinedRows}
          showRangeSelector={false}
          sectionKey="predefined"
          sectionRef={predefinedRef}
          highlighted={activeSection === 'predefined'}
          loading={loading}
        />
        <ReturnTable
          title="Daily Returns"
          rows={dailyRows}
          rangeValue={dailyRange}
          onRangeChange={setDailyRange}
          sectionKey="daily"
          sectionRef={dailyRef}
          highlighted={activeSection === 'daily'}
          loading={loading}
        />
        <ReturnTable
          title="Weekly Returns"
          rows={weeklyRows}
          rangeValue={weeklyRange}
          onRangeChange={setWeeklyRange}
          sectionKey="weekly"
          sectionRef={weeklyRef}
          highlighted={activeSection === 'weekly'}
          loading={loading}
          periodDisplayMode="endDate"
        />
        <ReturnTable
          title="Monthly Returns"
          rows={monthlyRows}
          rangeValue={monthlyRange}
          onRangeChange={setMonthlyRange}
          sectionKey="monthly"
          sectionRef={monthlyRef}
          highlighted={activeSection === 'monthly'}
          loading={loading}
        />
        <ReturnTable
          title="Quarterly Returns"
          rows={quarterlyRows}
          rangeValue={quarterlyRange}
          onRangeChange={setQuarterlyRange}
          sectionKey="quarterly"
          sectionRef={quarterlyRef}
          highlighted={activeSection === 'quarterly'}
          loading={loading}
          periodDisplayMode="endDate"
        />
        <ReturnTable
          title="Annual Returns"
          rows={annualRows}
          rangeValue={annualRange}
          onRangeChange={setAnnualRange}
          sectionKey="annual"
          sectionRef={annualRef}
          highlighted={activeSection === 'annual'}
          loading={loading}
        />
      </div>
    </div>
  );
}
