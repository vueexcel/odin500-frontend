import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { rowDateToTimeKey } from '../utils/chartData.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { usePageSeo } from '../seo/usePageSeo.js';

const DEFAULT_SYMBOL = 'AAPL';
const TABLE_RANGE_OPTIONS = [
  { value: '1', label: '1Y' },
  { value: '3', label: '3Y' },
  { value: '5', label: '5Y' },
  { value: '10', label: '10Y' },
  { value: 'max', label: 'Max' }
];
const PREDEFINED_YEAR_BUCKETS = [5, 10, 15, 20, 25, 50];
const TABLE_PAGE_SIZE = 30;
const PAGER_SIBLING_COUNT = 1;

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
    buckets.get(key).push({ close });
  }
  const out = [];
  for (const [key, values] of buckets.entries()) {
    if (!values.length) continue;
    const first = values[0];
    const last = values[values.length - 1];
    const ret = first.close === 0 ? null : ((last.close - first.close) / first.close) * 100;
    out.push({ period: key, returnPct: ret, startClose: first.close, endClose: last.close });
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

function FigmaPagination({ page, totalPages, onPageChange }) {
  const items = useMemo(() => buildPaginationItems(totalPages, page), [totalPages, page]);
  const canPrev = page > 1;
  const canNext = page < totalPages;
  return (
    <div className="statistic-data__pager-figma" role="navigation" aria-label="Table pagination">
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="First page"
        onClick={() => onPageChange(1)}
        disabled={!canPrev}
      >
        <IconChevronLeft double />
      </button>
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
        disabled={!canPrev}
      >
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
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
        disabled={!canNext}
      >
        <IconChevronRight />
      </button>
      <button
        type="button"
        className="statistic-data__pg-btn statistic-data__pg-btn--icon"
        aria-label="Last page"
        onClick={() => onPageChange(totalPages)}
        disabled={!canNext}
      >
        <IconChevronRight double />
      </button>
    </div>
  );
}

function ReturnTable({
  title,
  rows,
  rangeValue,
  onRangeChange,
  showRangeSelector = true,
  sectionKey = '',
  sectionRef = null,
  highlighted = false
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const startIdx = (pageSafe - 1) * TABLE_PAGE_SIZE;
  const pageRows = rows.slice(startIdx, startIdx + TABLE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [title, rangeValue]);

  useEffect(() => {
    setPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);

  const onDownloadCsv = () => {
    if (!rows.length) return;
    const header = ['Period', 'Return', 'Start Close', 'End Close'];
    const csvRows = rows.map((row) => [
      `"${String(row.period ?? '').replace(/"/g, '""')}"`,
      row.returnPct != null && Number.isFinite(Number(row.returnPct)) ? Number(row.returnPct).toFixed(4) : '',
      row.startClose != null && Number.isFinite(Number(row.startClose)) ? Number(row.startClose).toFixed(4) : '',
      row.endClose != null && Number.isFinite(Number(row.endClose))
        ? Number(row.endClose).toFixed(4)
        : `"${String(row.unavailableReason || '').replace(/"/g, '""')}"`
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
              <select value={rangeValue} onChange={(e) => onRangeChange?.(e.target.value)}>
                {TABLE_RANGE_OPTIONS.map((opt) => (
                  <option class="options" key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button type="button" className="statistic-data__csv-btn" onClick={onDownloadCsv} disabled={!rows.length}>
            Download CSV
          </button>
        </div>
      </div>
      <div className="statistic-data__table-wrap">
        <table className="statistic-data__table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Return</th>
              <th>Start Close</th>
              <th>End Close</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length ? (
              pageRows.map((row) => (
                <tr key={`${title}-${row.period}`}>
                  <td>{row.period}</td>
                  <td className={pctTone(row.returnPct)}>{fmtPct(row.returnPct)}</td>
                  <td>{Number.isFinite(row.startClose) ? row.startClose.toFixed(2) : '—'}</td>
                  <td>
                    {Number.isFinite(row.endClose)
                      ? row.endClose.toFixed(2)
                      : row.unavailableReason
                        ? row.unavailableReason
                        : '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="statistic-data__empty">
                  No rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="statistic-data__pager">
        <FigmaPagination page={pageSafe} totalPages={totalPages} onPageChange={setPage} />
        <span className="statistic-data__pager-meta">
          Page {pageSafe} of {totalPages} ({rows.length} rows)
        </span>
      </div>
    </section>
  );
}

export default function StatisticDataPage() {
  const location = useLocation();
  usePageSeo({
    title: 'Statistic Tables — Daily, Weekly, Monthly, Quarterly, Annual | Odin500',
    description:
      'Table-focused return analytics with CSV downloads across daily, weekly, monthly, quarterly, and annual ranges.',
    canonicalPath: '/statistic-data',
    noindex: Boolean(location.search)
  });
  const [symbol, setSymbol] = useState(DEFAULT_SYMBOL);
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
    const section = new URLSearchParams(location.search).get('section') || '';
    const map = {
      predefined: predefinedRef,
      daily: dailyRef,
      weekly: weeklyRef,
      monthly: monthlyRef,
      quarterly: quarterlyRef,
      annual: annualRef
    };
    const targetRef = map[section];
    setActiveSection(targetRef ? section : '');
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.search]);

  useEffect(() => {
    const clean = sanitizeTickerPageInput(symbol) || DEFAULT_SYMBOL;
    let cancelled = false;
    if (!getAuthToken()) {
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
        {loading ? <span className="statistic-data__status">Loading tables…</span> : null}
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
        />
        <ReturnTable
          title="Daily Returns"
          rows={dailyRows}
          rangeValue={dailyRange}
          onRangeChange={setDailyRange}
          sectionKey="daily"
          sectionRef={dailyRef}
          highlighted={activeSection === 'daily'}
        />
        <ReturnTable
          title="Weekly Returns"
          rows={weeklyRows}
          rangeValue={weeklyRange}
          onRangeChange={setWeeklyRange}
          sectionKey="weekly"
          sectionRef={weeklyRef}
          highlighted={activeSection === 'weekly'}
        />
        <ReturnTable
          title="Monthly Returns"
          rows={monthlyRows}
          rangeValue={monthlyRange}
          onRangeChange={setMonthlyRange}
          sectionKey="monthly"
          sectionRef={monthlyRef}
          highlighted={activeSection === 'monthly'}
        />
        <ReturnTable
          title="Quarterly Returns"
          rows={quarterlyRows}
          rangeValue={quarterlyRange}
          onRangeChange={setQuarterlyRange}
          sectionKey="quarterly"
          sectionRef={quarterlyRef}
          highlighted={activeSection === 'quarterly'}
        />
        <ReturnTable
          title="Annual Returns"
          rows={annualRows}
          rangeValue={annualRange}
          onRangeChange={setAnnualRange}
          sectionKey="annual"
          sectionRef={annualRef}
          highlighted={activeSection === 'annual'}
        />
      </div>
    </div>
  );
}
