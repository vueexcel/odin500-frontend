import { useCallback, useEffect, useMemo, useState } from 'react';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';

const PAGE_SIZE = 50;
const DEFAULT_TICKER = 'AAPL';

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

  const runQuery = useCallback(async () => {
    const sym = sanitizeTickerPageInput(ticker) || DEFAULT_TICKER;
    if (!getAuthToken()) {
      setError('Sign in to load historical data.');
      setRows([]);
      return;
    }
    if (!startDate || !endDate) {
      setError('Pick both start and end date.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (frequency === 'daily') {
        const res = await fetchJsonCached({
          path:
            `/api/market/ohlc?symbol=${encodeURIComponent(sym)}` +
            `&start_date=${encodeURIComponent(startDate)}` +
            `&end_date=${encodeURIComponent(endDate)}`,
          method: 'GET',
          ttlMs: 5 * 60 * 1000
        });
        const list = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
        setRows(normalizeDailyRows(list));
      } else if (frequency === 'weekly') {
        const res = await fetchJsonCached({
          path: '/api/market/weekly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startDate, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const weekly = res?.data?.weeklyOHLC;
        setRows(normalizeWeeklyRows(weekly));
      } else if (frequency === 'monthly') {
        const res = await fetchJsonCached({
          path: '/api/market/monthly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startDate, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const monthly = res?.data?.monthlyOHLC;
        setRows(normalizeMonthlyRows(monthly));
      } else if (frequency === 'quarterly') {
        const res = await fetchJsonCached({
          path: '/api/market/monthly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startDate, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const monthly = res?.data?.monthlyOHLC;
        setRows(aggregateMonthlyToQuarterly(monthly));
      } else if (frequency === 'annual') {
        const res = await fetchJsonCached({
          path: '/api/market/monthly-ohlc',
          method: 'POST',
          body: { ticker: sym, start_date: startDate, end_date: endDate },
          ttlMs: 5 * 60 * 1000
        });
        const monthly = res?.data?.monthlyOHLC;
        setRows(aggregateMonthlyToAnnual(monthly));
      }
      setPage(1);
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

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), [rows.length]);
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, pageSafe]);

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
    if (!rows.length) return;
    const headers = [periodColumnLabel, 'Open', 'High', 'Low', 'Close', 'Return %'];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
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
    a.download = `historical-data-${sanitizeTickerPageInput(ticker) || DEFAULT_TICKER}-${frequency}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, ticker, startDate, endDate, frequency, periodColumnLabel]);

  return (
    <div className="historical-data-page">
      <header className="historical-data__head">
        <h1>Historical Data</h1>
        <p>OHLC by ticker and date range — daily from raw bars; weekly and monthly from aggregated APIs; quarterly and annually rolled up from monthly.</p>
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
        <div className="historical-data__frequency">
          <label htmlFor="historical-data-frequency">Frequency</label>
          <select
            id="historical-data-frequency"
            className="historical-data__select"
            value={frequency}
            onChange={(e) => setFrequency(/** @type {OhlcFrequency} */ (e.target.value))}
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="historical-data__dates">
          <label htmlFor="historical-data-start">Start date</label>
          <input
            id="historical-data-start"
            type="date"
            className="historical-data__date-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
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
          <button type="button" className="historical-data__btn" onClick={runQuery} disabled={busy}>
            Search Ticker
          </button>
          <button type="button" className="historical-data__btn historical-data__btn--primary" onClick={runQuery} disabled={busy}>
            Submit
          </button>
          <button type="button" className="historical-data__btn" onClick={onDownloadCsv} disabled={!rows.length}>
            Download CSV
          </button>
        </div>
      </section>

      {busy ? <p className="historical-data__status">{loadingLabel}</p> : null}
      {error ? <p className="historical-data__status historical-data__status--err">{error}</p> : null}

      <section className="historical-data__table-card">
        <div className="historical-data__table-wrap">
          <table className="historical-data__table">
            <thead>
              <tr>
                <th>{periodColumnLabel}</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Return %</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((r, idx) => (
                  <tr key={`${r.sortKey}-${idx}`}>
                    <td>{r.period || '—'}</td>
                    <td>{r.open != null ? r.open.toFixed(2) : '—'}</td>
                    <td>{r.high != null ? r.high.toFixed(2) : '—'}</td>
                    <td>{r.low != null ? r.low.toFixed(2) : '—'}</td>
                    <td>{r.close != null ? r.close.toFixed(2) : '—'}</td>
                    <td>{r.returnPct != null ? `${r.returnPct.toFixed(2)}%` : '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="historical-data__empty">
                    No rows yet. Select ticker, frequency, date range, and submit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="historical-data__pager">
          <button type="button" className="historical-data__btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={pageSafe <= 1}>
            Previous
          </button>
          <span>
            Page {pageSafe} / {totalPages} ({rows.length} rows)
          </span>
          <button
            type="button"
            className="historical-data__btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageSafe >= totalPages}
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}
