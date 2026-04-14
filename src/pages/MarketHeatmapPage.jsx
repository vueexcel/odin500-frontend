import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SectorTreemap } from '../components/SectorTreemap.jsx';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { returnToHeatColor } from '../utils/heatmapColors.js';

/** `apiIndex` must match `market_groups.name` from Supabase (see GET /api/market/indices). */
const INDEX_MENU = [
  { id: 'sp500', apiIndex: 'SP500', label: 'S&P 500' },
  { id: 'dow', apiIndex: 'Dow Jones', label: 'Dow Jones' },
  { id: 'nasdaq', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100' },
  { id: 'etf', apiIndex: 'ETF', label: 'ETF' },
  { id: 'other', apiIndex: 'Other', label: 'Other' },
  { id: 'all', apiIndex: 'SP500', label: 'All Stocks' }
];

const PERIOD_LABEL_OVERRIDES = {
  'last-date': '1 day performance',
  week: '1 week performance',
  'last-month': '1 month performance',
  'last-3-months': '3 month performance',
  'last-6-months': '6 month performance',
  ytd: 'Year to date',
  'last-1-year': '1 year performance',
  'last-2-years': '2 year performance',
  'last-3-years': '3 year performance',
  'last-5-years': '5 year performance',
  'last-10-years': '10 year performance'
};

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function indexAvailableOnServer(apiIndex, apiIndices) {
  if (!apiIndices?.length) return true;
  const want = norm(apiIndex);
  return apiIndices.some((x) => norm(x) === want);
}

function formatListDate(d) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(d);
}

function formatPriceEu(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPctEuSigned(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n);
  const s = (v >= 0 ? '+' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%';
  return s;
}

function parsePct(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const compact = String(v).trim().replace(/[%\s]/g, '').replace(/,/g, '');
  const n = Number(compact);
  return Number.isFinite(n) ? n : NaN;
}

export default function MarketHeatmapPage() {
  const [apiIndices, setApiIndices] = useState([]);
  const [periodOptions, setPeriodOptions] = useState([]);
  const [indexMenuId, setIndexMenuId] = useState('sp500');
  const [periodValue, setPeriodValue] = useState('last-date');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoverSymbol, setHoverSymbol] = useState('');
  const [scaleSpan, setScaleSpan] = useState(3);
  const [zoom, setZoom] = useState(1);
  const mainRef = useRef(null);
  const treemapHostRef = useRef(null);
  const indicesInitRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadMeta() {
      if (!getAuthToken()) return;
      try {
        const [ir, pr] = await Promise.all([
          fetchJsonCached({ path: '/api/market/indices', method: 'GET', ttlMs: 60 * 60 * 1000 }),
          fetchJsonCached({ path: '/api/market/period-options', method: 'GET', ttlMs: 60 * 60 * 1000 })
        ]);
        if (cancelled) return;
        const idx = Array.isArray(ir.data?.indices) ? ir.data.indices : [];
        const periods = Array.isArray(pr.data?.periods) ? pr.data.periods : [];
        setApiIndices(idx);
        setPeriodOptions(periods);
      } catch {
        if (!cancelled) {
          setApiIndices([]);
          setPeriodOptions([]);
        }
      }
    }
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!apiIndices.length || indicesInitRef.current) return;
    indicesInitRef.current = true;
    setIndexMenuId((currentId) => {
      const cur = INDEX_MENU.find((m) => m.id === currentId);
      const ok =
        cur &&
        (cur.id === 'all' || indexAvailableOnServer(cur.apiIndex, apiIndices));
      if (ok) return currentId;
      const fb = INDEX_MENU.find(
        (m) => m.id === 'all' || indexAvailableOnServer(m.apiIndex, apiIndices)
      );
      return fb ? fb.id : currentId;
    });
  }, [apiIndices]);

  const activeMenu = INDEX_MENU.find((m) => m.id === indexMenuId) || INDEX_MENU[0];
  const fetchIndex = activeMenu.apiIndex;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAuthToken()) {
        setError('Sign in to load market data.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data: payload } = await fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: fetchIndex, period: periodValue },
          ttlMs: 3 * 60 * 1000
        });
        if (cancelled) return;
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setRows(list);
        if (!list.length) setError('No rows returned for this index and period.');
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load heatmap data');
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchIndex, periodValue]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.symbol || '')
          .toUpperCase()
          .includes(q) ||
        String(r.security || '')
          .toUpperCase()
          .includes(q)
    );
  }, [rows, searchQuery]);

  const tableRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const da = Math.abs(parsePct(a.totalReturnPercentage) || 0);
      const db = Math.abs(parsePct(b.totalReturnPercentage) || 0);
      return db - da;
    });
    return copy.slice(0, 80);
  }, [filteredRows]);

  const periodSelectOptions = useMemo(() => {
    if (!periodOptions.length) {
      return Object.entries(PERIOD_LABEL_OVERRIDES).map(([value, label]) => ({ value, label }));
    }
    return periodOptions.map((p) => ({
      value: p.value,
      label: PERIOD_LABEL_OVERRIDES[p.value] || p.label || p.value
    }));
  }, [periodOptions]);

  useEffect(() => {
    if (!periodSelectOptions.length) return;
    if (!periodSelectOptions.some((o) => o.value === periodValue)) {
      setPeriodValue(periodSelectOptions[0].value);
    }
  }, [periodSelectOptions, periodValue]);

  const scaleMin = -scaleSpan;
  const scaleMax = scaleSpan;

  const toggleFullscreen = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  const downloadCsv = useCallback(() => {
    if (!filteredRows.length) return;
    const header = ['Symbol', 'Security', 'Sector', 'Price', 'ChangePercent'];
    const lines = [
      header.join(','),
      ...filteredRows.map((r) =>
        [
          r.symbol,
          `"${String(r.security || '').replace(/"/g, '""')}"`,
          `"${String(r.sector || '').replace(/"/g, '""')}"`,
          r.price != null ? Number(r.price) : '',
          r.totalReturnPercentage != null ? Number(r.totalReturnPercentage) : ''
        ].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `heatmap-${fetchIndex}-${periodValue}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, fetchIndex, periodValue]);

  const zoomIn = () => setZoom((z) => Math.min(2.25, Math.round((z + 0.25) * 100) / 100));
  const zoomOut = () => setZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100));

  return (
    <div className="heatmap-page">
      <div className="heatmap-page__grid">
        <aside className="heatmap-sidebar" aria-label="Filters">
          <section className="heatmap-card">
            <h2 className="heatmap-card__title">Index / List selection</h2>
            <ul className="heatmap-index-list">
              {INDEX_MENU.map((item) => {
                const enabled =
                  item.id === 'all' || apiIndices.length === 0
                    ? true
                    : indexAvailableOnServer(item.apiIndex, apiIndices);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={
                        'heatmap-index-row' +
                        (indexMenuId === item.id ? ' heatmap-index-row--active' : '') +
                        (!enabled ? ' heatmap-index-row--disabled' : '')
                      }
                      disabled={!enabled}
                      onClick={() => enabled && setIndexMenuId(item.id)}
                    >
                      <span>{item.label}</span>
                      <span className="heatmap-index-row__chev" aria-hidden>
                        ›
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {activeMenu.id === 'all' ? (
              <p className="heatmap-card__hint">Uses the same universe as SP500 (broad market set).</p>
            ) : null}
          </section>

          <section className="heatmap-card">
            <h2 className="heatmap-card__title">Period selection</h2>
            <label className="heatmap-field-label" htmlFor="heatmap-period">
              Choose period
            </label>
            <select
              id="heatmap-period"
              className="heatmap-select"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
            >
              {periodSelectOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </section>

          <section className="heatmap-card heatmap-card--table">
            <h2 className="heatmap-card__title">Tickers</h2>
            <div className="heatmap-search">
              <span className="heatmap-search__icon" aria-hidden>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <input
                type="search"
                className="heatmap-search__input"
                placeholder="Search ticker"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search ticker"
              />
            </div>
            <div className="heatmap-table-wrap">
              <table className="heatmap-table">
                <thead>
                  <tr>
                    <th>Ticker</th>
                    <th>Price</th>
                    <th>Change %</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((t) => {
                    const pct = parsePct(t.totalReturnPercentage);
                    const neg = Number.isFinite(pct) && pct < 0;
                    const pos = Number.isFinite(pct) && pct > 0;
                    return (
                      <tr
                        key={t.symbol}
                        onMouseEnter={() => setHoverSymbol(String(t.symbol || ''))}
                        onMouseLeave={() => setHoverSymbol('')}
                      >
                        <td>
                          <span className="heatmap-table__ticker">{t.symbol}</span>
                        </td>
                        <td>{formatPriceEu(t.price)}</td>
                        <td
                          className={
                            'heatmap-table__chg' +
                            (pos ? ' heatmap-table__chg--up' : '') +
                            (neg ? ' heatmap-table__chg--down' : '')
                          }
                        >
                          {formatPctEuSigned(t.totalReturnPercentage)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </aside>

        <main className="heatmap-main" ref={mainRef}>
          <header className="heatmap-main__header">
            <div className="heatmap-main__date">
              <span className="heatmap-main__cal" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
                  <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
              </span>
              {formatListDate(new Date())}
            </div>
            <div className="heatmap-main__tools">
              <button type="button" className="heatmap-icon-btn" onClick={toggleFullscreen} title="Fullscreen">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 3H5a2 2 0 00-2 2v4M21 9V5a2 2 0 00-2-2h-4M15 21h4a2 2 0 002-2v-4M3 15v4a2 2 0 002 2h4" />
                </svg>
              </button>
              <button type="button" className="heatmap-icon-btn" title="Share" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
                </svg>
              </button>
              <button type="button" className="heatmap-icon-btn" onClick={downloadCsv} title="Download CSV">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12m0 0l4-4m-4 4L8 11M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button type="button" className="heatmap-icon-btn" onClick={zoomIn} title="Zoom in">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4M11 8v6M8 11h6" strokeLinecap="round" />
                </svg>
              </button>
              <button type="button" className="heatmap-icon-btn" onClick={zoomOut} title="Zoom out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M21 21l-4-4M8 11h6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </header>

          {error ? <div className="heatmap-main__error">{error}</div> : null}
          {loading ? <div className="heatmap-main__loading">Loading…</div> : null}

          <div className="heatmap-treemap-outer" ref={treemapHostRef}>
            <div
              className="heatmap-treemap-zoom"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top left'
              }}
            >
              <SectorTreemap
                rows={filteredRows}
                scaleMin={scaleMin}
                scaleMax={scaleMax}
                highlightSymbol={hoverSymbol}
              />
            </div>
          </div>

          <footer className="heatmap-scale-bar">
            <div className="heatmap-scale-bar__swatches">
              {[-3, -2, -1, 0, 1, 2, 3].map((k) => {
                const v = (k / 3) * scaleSpan;
                const lbl =
                  Math.abs(v) < 0.05 ? '0' : v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1);
                return (
                  <div key={k} className="heatmap-scale-bar__cell">
                    <span
                      className="heatmap-scale-bar__chip"
                      style={{ background: returnToHeatColor(v, scaleMin, scaleMax) }}
                    />
                    <span className="heatmap-scale-bar__lbl">{lbl}</span>
                  </div>
                );
              })}
            </div>
            <div className="heatmap-scale-bar__slider">
              <label htmlFor="heatmap-span">Color scale ±{scaleSpan}%</label>
              <input
                id="heatmap-span"
                type="range"
                min="1"
                max="15"
                step="0.5"
                value={scaleSpan}
                onChange={(e) => setScaleSpan(Number(e.target.value))}
              />
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
