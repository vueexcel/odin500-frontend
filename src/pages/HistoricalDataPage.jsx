import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';

const PAGE_SIZE = 50;
const DEFAULT_TICKER = 'AAPL';

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

function sortRowsDesc(rows) {
  return [...rows].sort((a, b) => {
    const ta = rowDateToTimeKey(a) || '';
    const tb = rowDateToTimeKey(b) || '';
    return ta > tb ? -1 : ta < tb ? 1 : 0;
  });
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function computeCagr(beginValue, endValue, startIso, endIso) {
  const start = new Date(`${String(startIso || '').slice(0, 10)}T12:00:00`);
  const end = new Date(`${String(endIso || '').slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(beginValue) || !Number.isFinite(endValue) || beginValue <= 0) return null;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return null;
  const years = (end.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(years) || years <= 0) return null;
  const cagr = (Math.pow(endValue / beginValue, 1 / years) - 1) * 100;
  return Number.isFinite(cagr) ? cagr : null;
}

export default function HistoricalDataPage() {
  const [ticker, setTicker] = useState(DEFAULT_TICKER);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(todayIsoDate);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const hasAutoloadedRef = useRef(false);

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
      const res = await fetchJsonCached({
        path:
          `/api/market/ohlc?symbol=${encodeURIComponent(sym)}` +
          `&start_date=${encodeURIComponent(startDate)}` +
          `&end_date=${encodeURIComponent(endDate)}`,
        method: 'GET',
        ttlMs: 5 * 60 * 1000
      });
      const list = Array.isArray(res?.data?.data) ? res.data.data : Array.isArray(res?.data) ? res.data : [];
      setRows(sortRowsDesc(list));
      setPage(1);
    } catch (e) {
      setError(e.message || 'Failed to load historical data');
      setRows([]);
    } finally {
      setBusy(false);
    }
  }, [ticker, startDate, endDate]);

  useEffect(() => {
    if (hasAutoloadedRef.current) return;
    hasAutoloadedRef.current = true;
    void runQuery();
  }, [runQuery]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / PAGE_SIZE)), [rows.length]);
  const pageSafe = Math.min(Math.max(1, page), totalPages);
  const cagrByDate = useMemo(() => {
    if (!rows.length) return new Map();
    const oldest = rows[rows.length - 1];
    const startIso = rowDateToTimeKey(oldest);
    const baseClose = pickNum(oldest, ['Close', 'close']);
    const out = new Map();
    for (const row of rows) {
      const endIso = rowDateToTimeKey(row);
      const endClose = pickNum(row, ['Close', 'close']);
      const cagr = computeCagr(baseClose, endClose, startIso, endIso);
      out.set(endIso || '', cagr);
    }
    return out;
  }, [rows]);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, pageSafe]);

  const onDownloadCsv = useCallback(() => {
    if (!rows.length) return;
    const headers = ['Date', 'Open', 'High', 'Low', 'Close', 'CAGR'];
    const lines = [
      headers.join(','),
      ...rows.map((r) => {
        const iso = rowDateToTimeKey(r) || '';
        const cagr = cagrByDate.get(iso);
        return [
          csvEscape(iso),
          csvEscape(pickNum(r, ['Open', 'open']) ?? ''),
          csvEscape(pickNum(r, ['High', 'high']) ?? ''),
          csvEscape(pickNum(r, ['Low', 'low']) ?? ''),
          csvEscape(pickNum(r, ['Close', 'close']) ?? ''),
          csvEscape(cagr != null ? cagr.toFixed(4) : '')
        ].join(',');
      })
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historical-data-${sanitizeTickerPageInput(ticker) || DEFAULT_TICKER}-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, cagrByDate, ticker, startDate, endDate]);

  return (
    <div className="historical-data-page">
      <header className="historical-data__head">
        <h1>Historical Data</h1>
        <p>OHLC data by ticker and date range with CSV export.</p>
      </header>

      <section className="historical-data__controls">
        <div className="historical-data__ticker">
          <label htmlFor="historical-data-ticker">Ticker</label>
          {/* Uses built-in debounced ticker search suggestions */}
          <TickerSymbolCombobox
            symbol={ticker}
            onSymbolChange={(next) => setTicker(sanitizeTickerPageInput(next) || DEFAULT_TICKER)}
            inputId="historical-data-ticker"
            placeholder="Search ticker (e.g. NVDA)"
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

      {busy ? <p className="historical-data__status">Loading OHLC rows…</p> : null}
      {error ? <p className="historical-data__status historical-data__status--err">{error}</p> : null}

      <section className="historical-data__table-card">
        <div className="historical-data__table-wrap">
          <table className="historical-data__table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>CAGR</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length ? (
                pageRows.map((r, idx) => (
                  <tr key={`${rowDateToTimeKey(r) || 'row'}-${idx}`}>
                    <td>{rowDateToTimeKey(r) || '—'}</td>
                    <td>{pickNum(r, ['Open', 'open'])?.toFixed?.(2) ?? '—'}</td>
                    <td>{pickNum(r, ['High', 'high'])?.toFixed?.(2) ?? '—'}</td>
                    <td>{pickNum(r, ['Low', 'low'])?.toFixed?.(2) ?? '—'}</td>
                    <td>{pickNum(r, ['Close', 'close'])?.toFixed?.(2) ?? '—'}</td>
                    <td>
                      {(() => {
                        const iso = rowDateToTimeKey(r) || '';
                        const cagr = cagrByDate.get(iso);
                        return cagr != null ? `${cagr.toFixed(2)}%` : '—';
                      })()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="historical-data__empty">
                    No rows yet. Select ticker/date range and submit.
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
