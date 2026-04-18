import { useEffect, useMemo, useState } from 'react';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';

const ROWS_MAIN = [
  { id: 'nasdaq', label: 'Nasdaq 100', symbols: ['QQQ'], tone: 'purple' },
  { id: 'dow', label: 'Dow Jones', symbols: ['DIA'], tone: 'orange' },
  { id: 'sp500', label: 'S&P 500', symbols: ['SPY'], tone: 'blue' }
];

const ROWS_VOL = [{ id: 'vix', label: 'CBOE VIX', symbols: ['VIX', '^VIX', 'VIXY'], tone: 'muted' }];

function pickNum(row, keys) {
  for (const k of keys) {
    if (row?.[k] == null || row[k] === '') continue;
    const n = Number(row[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function fmtPx(n) {
  if (!Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAbs(n) {
  if (!Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return `${v >= 0 ? '+' : ''}${Math.abs(v).toFixed(2)}`;
}

function fmtPct(n) {
  if (!Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  return `${v >= 0 ? '+' : ''}${Math.abs(v).toFixed(1)}%`;
}

async function fetchLatestForSymbol(symbol) {
  const r = await fetchJsonCached({
    path: '/api/market/ohlc?symbol=' + encodeURIComponent(symbol) + '&limit=4',
    method: 'GET',
    ttlMs: 30 * 1000
  });
  const rows = Array.isArray(r?.data?.data) ? r.data.data : Array.isArray(r?.data) ? r.data : [];
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => {
    const ta = String(a.Date || a.date || '');
    const tb = String(b.Date || b.date || '');
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  const last = sorted[sorted.length - 1];
  const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null;
  const close = pickNum(last, ['Close', 'close']);
  const prevClose = pickNum(prev, ['Close', 'close']);
  if (!Number.isFinite(close)) return null;
  const chg = Number.isFinite(prevClose) ? close - prevClose : 0;
  const chgPct = Number.isFinite(prevClose) && prevClose !== 0 ? (chg / prevClose) * 100 : 0;
  return { symbol, close, chg, chgPct };
}

async function fetchFirstAvailable(symbols) {
  for (const s of symbols) {
    try {
      const v = await fetchLatestForSymbol(s);
      if (v) return v;
    } catch {
      // try next fallback
    }
  }
  return null;
}

export function UsEquityMarketsCard() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataMap, setDataMap] = useState({});

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    async function load() {
      if (!getAuthToken()) {
        setError('Sign in to load market overview.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const defs = [...ROWS_MAIN, ...ROWS_VOL];
        const results = await Promise.all(defs.map((d) => fetchFirstAvailable(d.symbols)));
        if (cancelled) return;
        const next = {};
        defs.forEach((d, i) => {
          next[d.id] = results[i];
        });
        setDataMap(next);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed loading overview');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    timer = window.setInterval(load, 60 * 1000);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const rowsMain = useMemo(
    () =>
      ROWS_MAIN.map((r) => ({
        ...r,
        value: dataMap[r.id] || null
      })),
    [dataMap]
  );
  const rowsVol = useMemo(
    () =>
      ROWS_VOL.map((r) => ({
        ...r,
        value: dataMap[r.id] || null
      })),
    [dataMap]
  );

  return (
    <section className="usm-card" aria-label="US Equity Markets">
      <header className="usm-card__head">
        <h3 className="usm-card__title">U.S Equity Markets</h3>
        <button type="button" className="usm-card__open" aria-label="Open in new tab">
          ↗
        </button>
      </header>

      <div className="usm-card__table-head">
        <span className="usm-col usm-col--name">Major Indices &amp; ETFs</span>
        <span className="usm-col usm-col--px">Price</span>
        <span className="usm-col usm-col--chg">Chg</span>
        <span className="usm-col usm-col--pct">%</span>
      </div>

      {rowsMain.map((r) => {
        const v = r.value;
        const down = Number(v?.chg) < 0;
        const up = Number(v?.chg) > 0;
        return (
          <div key={r.id} className="usm-row">
            <span className={'usm-check usm-check--' + r.tone}>✓</span>
            <span className="usm-col usm-col--name">{r.label}</span>
            <span className="usm-col usm-col--px">{v ? fmtPx(v.close) : '—'}</span>
            <span className={'usm-col usm-col--chg' + (up ? ' is-up' : down ? ' is-down' : '')}>{v ? fmtAbs(v.chg) : '—'}</span>
            <span className={'usm-col usm-col--pct' + (up ? ' is-up' : down ? ' is-down' : '')}>{v ? fmtPct(v.chgPct) : '—'}</span>
          </div>
        );
      })}

      <div className="usm-card__subhead">
        <span className="usm-col usm-col--name">Volatility Index</span>
        <span className="usm-col usm-col--px">Price</span>
        <span className="usm-col usm-col--chg">Chg</span>
        <span className="usm-col usm-col--pct">%</span>
      </div>

      {rowsVol.map((r) => {
        const v = r.value;
        const down = Number(v?.chg) < 0;
        const up = Number(v?.chg) > 0;
        return (
          <div key={r.id} className="usm-row">
            <span className={'usm-check usm-check--' + r.tone}>✓</span>
            <span className="usm-col usm-col--name">{r.label}</span>
            <span className="usm-col usm-col--px">{v ? fmtPx(v.close) : '—'}</span>
            <span className={'usm-col usm-col--chg' + (up ? ' is-up' : down ? ' is-down' : '')}>{v ? fmtAbs(v.chg) : '—'}</span>
            <span className={'usm-col usm-col--pct' + (up ? ' is-up' : down ? ' is-down' : '')}>{v ? fmtPct(v.chgPct) : '—'}</span>
          </div>
        );
      })}

      {loading ? <div className="usm-status">Refreshing…</div> : null}
      {error ? <div className="usm-status usm-status--err">{error}</div> : null}
    </section>
  );
}

