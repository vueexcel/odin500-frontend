import { useCallback, useEffect, useMemo, useState } from 'react';
import { FigmaDataTable } from '../components/FigmaDataTable.jsx';
import { FigmaPagination } from '../components/FigmaPagination.jsx';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import {fetchJsonCached, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { useGatedCsvDownload } from '../hooks/useGatedCsvDownload.js';
import { usePageSeo } from '../seo/usePageSeo.js';

const PAGE_SIZE = 50;
const TABLE_SKELETON_ROWS = 24;
const DEFAULT_TICKER = 'AAPL';
/** Daily OHLC requests are limited to this many calendar years before the end date. */
const DAILY_MAX_HISTORY_YEARS = 3;

/** @typedef {'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'} OhlcFrequency */

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annually' }
];

function toIsoDate(d) {
  return d.toISOString().slice(0, 10);
}

function defaultStartDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toIsoDate(d);
}

function todayIsoDate() {
  return toIsoDate(new Date());
}

function isoAddCalendarYears(iso, deltaYears) {
  if (!iso) return iso;
  const d = new Date(`${iso}T12:00:00`);
  d.setFullYear(d.getFullYear() + deltaYears);
  return toIsoDate(d);
}

function clampDailyStartDate(startIso, endIso) {
  if (!endIso) return startIso || '';
  const minStart = isoAddCalendarYears(endIso, -DAILY_MAX_HISTORY_YEARS);
  let s = startIso || minStart;
  if (s < minStart) s = minStart;
  if (s > endIso) s = endIso;
  return s;
}

function pickNum(row, keys) {
  for (const k of keys) {
    const v = row?.[k];
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function computeReturnPct(openValue, closeValue) {
  if (!Number.isFinite(openValue) || !Number.isFinite(closeValue) || openValue === 0) return null;
  const pct = ((closeValue - openValue) / openValue) * 100;
  return Number.isFinite(pct) ? pct : null;
}

function signedToneClass(v) {
  if (!Number.isFinite(Number(v))) return '';
  return Number(v) > 0 ? 'app-num--up' : Number(v) < 0 ? 'app-num--down' : '';
}

function IcoDownload() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M7.00049 2.48828V9.05078"
        stroke="white"
        strokeWidth="0.875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.53955 6.58984L7.00049 9.05078L9.46143 6.58984"
        stroke="white"
        strokeWidth="0.875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.1528 9.05078V9.87109C13.1528 10.3062 12.98 10.7235 12.6723 11.0312C12.3646 11.3389 11.9473 11.5117 11.5122 11.5117H2.48877C2.05365 11.5117 1.63635 11.3389 1.32867 11.0312C1.021 10.7235 0.848145 10.3062 0.848145 9.87109V9.05078"
        stroke="white"
        strokeWidth="0.875"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function sortNormalizedDesc(rows) {
  return [...rows].sort((a, b) => (a.sortKey > b.sortKey ? -1 : a.sortKey < b.sortKey ? 1 : 0));
}

/** @returns {{ period: string, sortKey: string, open: number|null, high: number|null, low: number|null, close: number|null, returnPct: number|null }[]} */
function normalizeDailyRows(list) {
  const sorted = [...list].sort((a, b) => {
    const ta = rowDateToTimeKey(a) || '';
    const tb = rowDateToTimeKey(b) || '';
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });
  return sorted.map((r) => {
    const iso = rowDateToTimeKey(r) || '';
    const open = pickNum(r, ['Open', 'open']);
    const high = pickNum(r, ['High', 'high']);
    const low = pickNum(r, ['Low', 'low']);
    const close = pickNum(r, ['Close', 'close']);
    return {
      period: iso,
      sortKey: iso,
      open,
      high,
      low,
      close,
      returnPct: computeReturnPct(open, close)
    };
  });
}

/** Weekly rows from POST /api/market/weekly-ohlc */
function normalizeWeeklyRows(weeklyOHLC) {
  if (!Array.isArray(weeklyOHLC)) return [];
  const out = [];
  for (const r of weeklyOHLC) {
    const open = Number(r?.open);
    const high = Number(r?.high);
    const low = Number(r?.low);
    const close = Number(r?.close);
    const year = Number(r?.year);
    const week = Number(r?.week);
    const lastDay = String(r?.end_date || '').slice(0, 10);
    const firstDay = String(r?.start_date || '').slice(0, 10);
    const weekStart = String(r?.week_start || '').slice(0, 10);
    // Period column: show a calendar date (prefer last trading day of the week).
    const period =
      lastDay ||
      firstDay ||
      weekStart ||
      (Number.isFinite(year) && Number.isFinite(week) && week >= 1 && week <= 53
        ? `${year}-W${String(week).padStart(2, '0')}`
        : '—');
    const sortKey = lastDay || firstDay || weekStart || period;
    let returnPct = Number(r?.return_pct);
    if (!Number.isFinite(returnPct)) {
      returnPct = computeReturnPct(open, close);
    }
    out.push({
      period,
      sortKey,
      open: Number.isFinite(open) ? open : null,
      high: Number.isFinite(high) ? high : null,
      low: Number.isFinite(low) ? low : null,
      close: Number.isFinite(close) ? close : null,
      returnPct: Number.isFinite(returnPct) ? returnPct : null
    });
  }
  return sortNormalizedDesc(out);
}

/** Monthly rows from POST /api/market/monthly-ohlc */
function normalizeMonthlyRows(monthlyOHLC) {
  if (!Array.isArray(monthlyOHLC)) return [];
  const out = [];
  for (const r of monthlyOHLC) {
    const year = Number(r?.year);
    const month = Number(r?.month);
    const open = Number(r?.open);
    const high = Number(r?.high);
    const low = Number(r?.low);
    const close = Number(r?.close);
    const endDate = String(r?.end_date || '').slice(0, 10);
    const period =
      Number.isFinite(year) && Number.isFinite(month)
        ? `${year}-${String(month).padStart(2, '0')}`
        : endDate || '—';
    const sortKey = endDate || period;
    const returnPct = computeReturnPct(open, close);
    out.push({
      period,
      sortKey,
      open: Number.isFinite(open) ? open : null,
      high: Number.isFinite(high) ? high : null,
      low: Number.isFinite(low) ? low : null,
      close: Number.isFinite(close) ? close : null,
      returnPct
    });
  }
  return sortNormalizedDesc(out);
}

/** Build yearly OHLC from monthly OHLC (first open / last close of year, range high/low). */
function aggregateMonthlyToAnnual(monthlyOHLC) {
  if (!Array.isArray(monthlyOHLC) || !monthlyOHLC.length) return [];
  const byYear = new Map();
  const chron = [...monthlyOHLC].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    if (ya !== yb) return ya - yb;
    return Number(a.month) - Number(b.month);
  });
  for (const r of chron) {
    const y = Number(r.year);
    if (!Number.isFinite(y)) continue;
    const open = Number(r.open);
    const high = Number(r.high);
    const low = Number(r.low);
    const close = Number(r.close);
    const endDate = String(r.end_date || '').slice(0, 10);
    if (!byYear.has(y)) {
      byYear.set(y, {
        year: y,
        open: Number.isFinite(open) ? open : null,
        high: Number.isFinite(high) ? high : null,
        low: Number.isFinite(low) ? low : null,
        close: Number.isFinite(close) ? close : null,
        sortKey: endDate || `${y}-12-31`
      });
    } else {
      const agg = byYear.get(y);
      if (Number.isFinite(high) && (agg.high == null || high > agg.high)) agg.high = high;
      if (Number.isFinite(low) && (agg.low == null || low < agg.low)) agg.low = low;
      if (Number.isFinite(close)) {
        agg.close = close;
        if (endDate) agg.sortKey = endDate;
      }
    }
  }
  const out = [];
  for (const [, agg] of byYear) {
    const returnPct = computeReturnPct(agg.open, agg.close);
    out.push({
      period: String(agg.year),
      sortKey: agg.sortKey || `${agg.year}-12-31`,
      open: agg.open,
      high: agg.high,
      low: agg.low,
      close: agg.close,
      returnPct
    });
  }
  return sortNormalizedDesc(out);
}

/** Build quarterly OHLC from monthly OHLC (first open / last close of quarter, range high/low). */
function aggregateMonthlyToQuarterly(monthlyOHLC) {
  if (!Array.isArray(monthlyOHLC) || !monthlyOHLC.length) return [];
  const byQuarter = new Map();
  const chron = [...monthlyOHLC].sort((a, b) => {
    const ya = Number(a.year);
    const yb = Number(b.year);
    if (ya !== yb) return ya - yb;
    return Number(a.month) - Number(b.month);
  });
  for (const r of chron) {
    const y = Number(r.year);
    const m = Number(r.month);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) continue;
    const q = Math.floor((m - 1) / 3) + 1;
    const key = `${y}-Q${q}`;
    const open = Number(r.open);
    const high = Number(r.high);
    const low = Number(r.low);
    const close = Number(r.close);
    const endDate = String(r.end_date || '').slice(0, 10);
    if (!byQuarter.has(key)) {
      byQuarter.set(key, {
        period: key,
        open: Number.isFinite(open) ? open : null,
        high: Number.isFinite(high) ? high : null,
        low: Number.isFinite(low) ? low : null,
        close: Number.isFinite(close) ? close : null,
        sortKey: endDate || key
      });
    } else {
      const agg = byQuarter.get(key);
      if (Number.isFinite(high) && (agg.high == null || high > agg.high)) agg.high = high;
      if (Number.isFinite(low) && (agg.low == null || low < agg.low)) agg.low = low;
      if (Number.isFinite(close)) {
        agg.close = close;
        if (endDate) agg.sortKey = endDate;
      }
    }
  }

  return sortNormalizedDesc(
    [...byQuarter.values()].map((q) => ({
      period: q.period,
      sortKey: q.sortKey,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
      returnPct: computeReturnPct(q.open, q.close)
    }))
  );
}

function getHistoricalSortValue(row, headerKey) {
  if (row.__skeleton) return null;
  switch (headerKey) {
    case 'period':
      return row.sortKey != null && row.sortKey !== '' ? String(row.sortKey) : String(row.period ?? '');
    case 'open':
    case 'high':
    case 'low':
    case 'close': {
      const n = row[headerKey];
      return n != null && Number.isFinite(Number(n)) ? Number(n) : null;
    }
    case 'returnPct':
      return row.returnPct != null && Number.isFinite(Number(row.returnPct)) ? Number(row.returnPct) : null;
    default:
      return null;
  }
}

function compareHistoricalRows(a, b, headerKey, dir) {
  const mul = dir === 'asc' ? 1 : -1;
  const va = getHistoricalSortValue(a, headerKey);
  const vb = getHistoricalSortValue(b, headerKey);
  if (va == null && vb == null) return 0;
  if (va == null) return 1;
  if (vb == null) return -1;
  if (typeof va === 'number' && typeof vb === 'number') {
    if (va !== vb) return va < vb ? -mul : mul;
    return 0;
  }
  const sa = String(va);
  const sb = String(vb);
  if (sa < sb) return -mul;
  if (sa > sb) return mul;
  return 0;
}

function sortHistoricalRows(rows, headerKey, dir) {
  if (!Array.isArray(rows) || !rows.length) return rows;
  return [...rows].sort((a, b) => compareHistoricalRows(a, b, headerKey, dir));
}

export default function HistoricalDataPage() {
  usePageSeo({
    title: 'Historical OHLC Data and CSV Export | Odin500',
    description:
      'Query historical OHLC data by ticker and date range, then export clean CSV tables for analysis.',
    canonicalPath: '/historical-data'
  });
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  /** @type {[OhlcFrequency, function]} */
  const [frequency, setFrequency] = useState('daily');
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayIsoDate);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState('period');
  const [sortDir, setSortDir] = useState('desc');

  const displayTicker = sanitizeTickerPageInput(ticker) || DEFAULT_TICKER;
  const dailyMinStart = frequency === 'daily' ? isoAddCalendarYears(endDate, -DAILY_MAX_HISTORY_YEARS) : '';

  useEffect(() => {
    if (frequency !== 'daily') return;
    setStartDate((s) => clampDailyStartDate(s, endDate));
  }, [frequency, endDate]);

  const runQuery = useCallback(async () => {
    const sym = sanitizeTickerPageInput(ticker) || DEFAULT_TICKER;
    if (!canFetchProtectedApi()) {
      setError('Sign in to load historical data.');
      setRows([]);
      return;
    }
    if (!startDate || !endDate) {
      setError('Pick both start and end date.');
      return;
    }
    const startForRequest = frequency === 'daily' ? clampDailyStartDate(startDate, endDate) : startDate;
    setBusy(true);
    setError('');
    try {
      if (frequency === 'daily') {
        const res = await fetchJsonCached({
          path:
            `/api/market/ohlc?symbol=${encodeURIComponent(sym)}` +
            `&start_date=${encodeURIComponent(startForRequest)}` +
            `&end_date=${encodeURIComponent(endDate)}`,
          method: 'GET',
          ttlMs: 5 * 60 * 1000
        });
        const list = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        const normalized = normalizeDailyRows(list);
        setRows(normalized.filter((r) => !r.sortKey || String(r.sortKey) >= startForRequest));
      } else if (frequency === 'weekly') {
        const res = await fetchJsonCached({
          path: '/api/market/weekly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startForRequest, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const weekly = res?.data?.weeklyOHLC;
        setRows(normalizeWeeklyRows(weekly));
      } else if (frequency === 'monthly') {
        const res = await fetchJsonCached({
          path: '/api/market/monthly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startForRequest, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const monthly = res?.data?.monthlyOHLC;
        setRows(normalizeMonthlyRows(monthly));
      } else if (frequency === 'quarterly') {
        const res = await fetchJsonCached({
          path: '/api/market/monthly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startForRequest, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const monthly = res?.data?.monthlyOHLC;
        setRows(aggregateMonthlyToQuarterly(monthly));
      } else if (frequency === 'annual') {
        const res = await fetchJsonCached({
          path: '/api/market/monthly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startForRequest, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const monthly = res?.data?.monthlyOHLC;
        setRows(aggregateMonthlyToAnnual(monthly));
      }
      setPage(1);
      setSortKey('period');
      setSortDir('desc');
    } catch (e) {
      setError(e.message || 'Failed to load historical data');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [ticker, startDate, endDate, frequency]);

  useEffect(() => {
    void runQuery();
  }, [runQuery]);

  const sortedRows = useMemo(
    () => sortHistoricalRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir]
  );
  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE)), [sortedRows.length]);
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, pageSafe]);

  const onSortHeader = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(key === 'period' ? 'desc' : 'asc');
      return key;
    });
    setPage(1);
  }, []);

  const periodColumnLabel = frequency === 'daily' ? 'Date' : 'Period';

  const loadingLabel = useMemo(() => {
    switch (frequency) {
      case 'weekly':
        return 'Loading weekly OHLC…';
      case 'monthly':
        return 'Loading monthly OHLC…';
      case 'quarterly':
        return 'Loading quarterly OHLC…';
      case 'annual':
        return 'Loading annual OHLC…';
      default:
        return 'Loading daily OHLC…';
    }
  }, [frequency]);

  const onDownloadCsv = useCallback(() => {
    if (!sortedRows.length) return;
    const headers = [periodColumnLabel, 'Open', 'High', 'Low', 'Close', 'Return %'];
    const lines = [
      headers.join(','),
      ...sortedRows.map((r) =>
        [
          csvEscape(r.period),
          csvEscape(r.open ?? ''),
          csvEscape(r.high ?? ''),
          csvEscape(r.low ?? ''),
          csvEscape(r.close ?? ''),
          csvEscape(r.returnPct != null ? r.returnPct.toFixed(4) : '')
        ].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historical-data-${sanitizeTickerPageInput(ticker) || DEFAULT_TICKER}-${frequency}-${
      frequency === 'daily' ? clampDailyStartDate(startDate, endDate) : startDate
    }-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sortedRows, ticker, startDate, endDate, frequency, periodColumnLabel]);

  const onDownloadCsvClick = useGatedCsvDownload(onDownloadCsv);

  return (
    <div className="historical-data-page">
      <header className="historical-data__head">
        <h1 className="historical-data__head-title">
          <span className="historical-data__head-ticker">{displayTicker}</span>
          <span className="historical-data__head-sep" aria-hidden="true">
            ·
          </span>
          <span className="historical-data__head-label">Historical Data</span>
        </h1>
      </header>

      <section className="historical-data__controls">
        <div className="historical-data__ticker">
          <label htmlFor="historical-data-ticker">Ticker</label>
          <TickerSymbolCombobox
            symbol={ticker}
            onSymbolChange={(next) => setTicker(sanitizeTickerPageInput(next) || DEFAULT_TICKER)}
            inputId="historical-data-ticker"
            placeholder="Search ticker (e.g. NVDA)"
          />
        </div>
        <div className="historical-data__controls-right" aria-label="Filters and export">
          <div className="historical-data__frequency">
            <label htmlFor="historical-data-frequency">Frequency</label>
            <ThemedDropdown
              buttonId="historical-data-frequency"
              className="historical-data__select-dd"
              style={{ width: '100%' }}
              value={frequency}
              options={FREQUENCY_OPTIONS.map((opt) => ({ id: opt.value, label: opt.label }))}
              onChange={(v) => setFrequency(/** @type {OhlcFrequency} */ (v))}
              title="OHLC frequency"
              ariaLabelPrefix="Frequency"
              wideLabel
            />
          </div>
          <div className="historical-data__dates">
            <label htmlFor="historical-data-start">Start date</label>
            <input
              id="historical-data-start"
              type="date"
              className="historical-data__date-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              min={frequency === 'daily' ? dailyMinStart : undefined}
              max={endDate}
            />
          </div>
          <div className="historical-data__dates">
            <label htmlFor="historical-data-end">End date</label>
            <input
              id="historical-data-end"
              type="date"
              className="historical-data__date-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
            />
          </div>
          <div className="historical-data__actions">
            <button
              type="button"
              className="ticker-annual-figma__btn ticker-annual-figma__btn--outline"
              onClick={onDownloadCsvClick}
              disabled={!sortedRows.length}
              title="Download CSV"
            >
              <IcoDownload /> Download CSV
            </button>
          </div>
        </div>
      </section>

      {error ? <p className="historical-data__status historical-data__status--err">{error}</p> : null}

      <section className="historical-data__table-card">
        <FigmaDataTable
          headers={[
            { key: 'period', label: periodColumnLabel },
            { key: 'open', label: 'Open' },
            { key: 'high', label: 'High' },
            { key: 'low', label: 'Low' },
            { key: 'close', label: 'Close' },
            { key: 'returnPct', label: 'Return %' }
          ]}
          sortKey={busy ? null : sortKey}
          sortDir={sortDir}
          onSortHeader={busy ? undefined : onSortHeader}
          rows={
            busy
              ? Array.from({ length: TABLE_SKELETON_ROWS }, (_, i) => ({ __skeleton: true, __index: i }))
              : pageRows
          }
          getRowKey={(row, idx) => (row.__skeleton ? `hist-skel-${row.__index}` : `${row.sortKey}-${idx}`)}
          getRowClassName={(row) => (row.__skeleton ? 'historical-data__tr--skeleton' : '')}
          wrapClassName={'historical-data__table-wrap' + (busy ? ' historical-data__table-wrap--loading' : '')}
          tableAriaBusy={busy}
          tableAriaLabel={busy ? loadingLabel : undefined}
          emptyText="No rows for this selection. Adjust ticker, frequency, or date range."
          emptyColSpan={6}
          renderCell={({ header, row }) => {
            if (row.__skeleton) {
              const i = Number(row.__index) || 0;
              if (header.key === 'period') {
                return <span className="historical-data__skel-cell" style={{ maxWidth: '92%', animationDelay: `${i * 0.035}s` }} />;
              }
              if (header.key === 'returnPct') {
                return <span className="historical-data__skel-cell" style={{ maxWidth: '52%', animationDelay: `${i * 0.035 + 0.1}s` }} />;
              }
              const offsets = { open: 0.02, high: 0.04, low: 0.06, close: 0.08 };
              const off = offsets[header.key] ?? 0.02;
              return <span className="historical-data__skel-cell" style={{ maxWidth: '64%', animationDelay: `${i * 0.035 + off}s` }} />;
            }
            if (header.key === 'period') return row.period || '—';
            if (header.key === 'open') return row.open != null ? row.open.toFixed(2) : '—';
            if (header.key === 'high') return row.high != null ? row.high.toFixed(2) : '—';
            if (header.key === 'low') return row.low != null ? row.low.toFixed(2) : '—';
            if (header.key === 'close') return row.close != null ? row.close.toFixed(2) : '—';
            return row.returnPct != null ? `${row.returnPct >= 0 ? '+' : ''}${row.returnPct.toFixed(2)}%` : '—';
          }}
          cellClassName={({ header, row }) => (row.__skeleton ? '' : header.key === 'returnPct' ? signedToneClass(row.returnPct) : '')}
        />
        <div className="historical-data__pager">
          {busy ? (
            <span className="historical-data__pager-loading">{loadingLabel}</span>
          ) : totalPages > 1 ? (
            <>
              <FigmaPagination
                page={pageSafe}
                totalPages={totalPages}
                onPageChange={setPage}
                ariaLabel="Historical data table pagination"
              />
              <span className="historical-data__pager-meta">
                Page {pageSafe} of {totalPages} ({sortedRows.length} rows)
              </span>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
