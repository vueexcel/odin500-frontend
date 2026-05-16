import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import {fetchJsonCached, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL, sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';

const TOP_N = 10;

/** Header strip colors (match Market Movers leader panels / charts). */
const RANGE_HEADER_GAIN_BG = '#5D9C59';
const RANGE_HEADER_LOSS_BG = '#990000';

const INDEX_OPTIONS = [
  { id: 'sp500', apiIndex: 'SP500', label: 'S&P 500' },
  { id: 'nasdaq', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100' },
  { id: 'dow', apiIndex: 'Dow Jones', label: 'Dow Jones' }
];

/** Same `apiPeriod` values as Market Movers page → POST /api/market/index-market-movers */
const RANGE_OPTIONS = [
  { id: '1d', apiPeriod: 'last-date', label: '1 day' },
  { id: '5d', apiPeriod: 'last-5-days', label: '5 days' },
  { id: 'mtd', apiPeriod: 'mtd', label: 'MTD' },
  { id: '1m', apiPeriod: 'last-month', label: '1 month' },
  { id: 'qtd', apiPeriod: 'qtd', label: 'QTD' },
  { id: '3m', apiPeriod: 'last-3-months', label: '3 months' },
  { id: '6m', apiPeriod: 'last-6-months', label: '6 months' },
  { id: 'ytd', apiPeriod: 'ytd', label: 'YTD' },
  { id: '1y', apiPeriod: 'last-1-year', label: '1 year' },
  { id: '3y', apiPeriod: 'last-3-years', label: '3 years' },
  { id: '5y', apiPeriod: 'last-5-years', label: '5 years' },
  { id: '10y', apiPeriod: 'last-10-years', label: '10 years' },
  { id: '20y', apiPeriod: 'last-20-years', label: '20 years' },
  { id: 'all', apiPeriod: 'all-available', label: 'All' }
];

function IcoClose({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function parsePct(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Match `WatchlistRailFlyout` last-price formatting. */
function formatLast(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const x = Number(n);
  const abs = Math.abs(x);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : 4;
  return x.toFixed(digits);
}

/** `dayReturnPct` is in percent points (e.g. 2.5 → 2.5%); store as fraction for watchlist pct helpers. */
function pctToFraction(pct) {
  if (pct == null || !Number.isFinite(pct)) return null;
  return pct / 100;
}

/** Match `WatchlistRailFlyout` percent display (fraction = decimal return). */
function formatPctDisplay(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
}

function pctTone(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return 'wl-flyout__pct--na';
  if (fraction > 0) return 'wl-flyout__pct--up';
  if (fraction < 0) return 'wl-flyout__pct--down';
  return 'wl-flyout__pct--flat';
}

/**
 * Slide-out panel: top 10 gainers / losers for selected index and range (same API as Market Movers page).
 * @param {{ open: boolean, onClose: () => void, docked?: boolean }} props
 */
export function MarketMoversRailFlyout({ open, onClose, docked = false }) {
  const [indexId, setIndexId] = useState('sp500');
  const [rangeId, setRangeId] = useState('1d');
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeIndex = INDEX_OPTIONS.find((o) => o.id === indexId) || INDEX_OPTIONS[0];
  const activeRange = RANGE_OPTIONS.find((o) => o.id === rangeId) || RANGE_OPTIONS[0];

  const load = useCallback(async () => {
    if (!open) return;
    if (!canFetchProtectedApi()) {
      setError('Sign in to load market movers.');
      setPoints([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data: payload } = await fetchJsonCached({
        path: '/api/market/index-market-movers',
        method: 'POST',
        body: { index: activeIndex.apiIndex, period: activeRange.apiPeriod },
        ttlMs: 90 * 1000,
        force: false
      });
      const list = Array.isArray(payload?.points) ? payload.points : [];
      setPoints(list);
      if (!list.length) setError('No data for this index.');
    } catch (e) {
      setError(e.message || 'Failed to load');
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [open, activeIndex.apiIndex, activeRange.apiPeriod]);

  useEffect(() => {
    void load();
  }, [load]);

  const { gainers, losers } = useMemo(() => {
    const g = [];
    const l = [];
    for (const p of points) {
      const pct = parsePct(p.dayReturnPct);
      if (pct == null || !Number.isFinite(pct)) continue;
      if (pct > 0) g.push(p);
      else if (pct < 0) l.push(p);
    }
    g.sort((a, b) => (parsePct(b.dayReturnPct) || 0) - (parsePct(a.dayReturnPct) || 0));
    l.sort((a, b) => (parsePct(a.dayReturnPct) || 0) - (parsePct(b.dayReturnPct) || 0));
    return { gainers: g.slice(0, TOP_N), losers: l.slice(0, TOP_N) };
  }, [points]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const renderMoverBlock = (title, rows, tone) => {
    const barBg = tone === 'gain' ? RANGE_HEADER_GAIN_BG : RANGE_HEADER_LOSS_BG;
    const pctColLabel = '%';
    return (
      <section className="rail-mm-block pb-2" aria-label={title}>
        <h3
          className="rail-mm-block__title mx-3 mb-0 mt-2 rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm"
          style={{ backgroundColor: barBg }}
        >
          {title}
        </h3>
        <div className="wl-flyout__table-wrap rail-mm-block__table-wrap">
          <table className="wl-flyout__table">
            <thead>
              <tr>
                <th scope="col">Security</th>
                <th scope="col" className="wl-flyout__th-num">
                  Last
                </th>
                <th scope="col" className="wl-flyout__th-pct" title={`${activeRange.label} change`}>
                  {pctColLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="wl-flyout__empty-cell">
                    <p className="wl-flyout__td-muted wl-flyout__empty-fallback">
                      {loading ? 'Loading…' : `No ${title.toLowerCase()}.`}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const pctPts = parsePct(p.dayReturnPct);
                  const frac = pctToFraction(pctPts);
                  const symRoute = sanitizeTickerPageInput(p.symbol) || DEFAULT_TICKER_ROUTE_SYMBOL;
                  const name = p.companyName || '—';
                  return (
                    <tr key={p.symbol}>
                      <td>
                        <Link
                          className="wl-flyout__sec-link"
                          to={`/ticker/${encodeURIComponent(symRoute)}`}
                          onClick={onClose}
                        >
                          <span className="wl-flyout__sec-top">
                            <span className="wl-flyout__bullet" style={{ backgroundColor: barBg }} aria-hidden />
                            <span className="wl-flyout__sym">{p.symbol}</span>
                          </span>
                          <span className="wl-flyout__co">{name}</span>
                        </Link>
                      </td>
                      <td className="wl-flyout__td-num">{formatLast(p.lastPrice)}</td>
                      <td className={'wl-flyout__td-pct ' + pctTone(frac)}>{formatPctDisplay(frac)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <>
      {docked ? null : <div className="wl-flyout__backdrop" aria-hidden onClick={onClose} />}
      <div
        className={'wl-flyout rail-mm-flyout flex min-h-0 flex-col' + (docked ? ' wl-flyout--docked' : '')}
        role={docked ? 'complementary' : 'dialog'}
        aria-modal={docked ? undefined : 'true'}
        aria-labelledby="rail-mm-flyout-title"
      >
        <div className="wl-flyout__head flex-shrink-0">
          <h2 id="rail-mm-flyout-title" className="wl-flyout__title">
            Market movers
          </h2>
          <button type="button" className="wl-flyout__iconbtn" onClick={onClose} title="Close" aria-label="Close">
            <IcoClose className="wl-flyout__iconbtn-svg" />
          </button>
        </div>

        <div className="flex-shrink-0 space-y-3 border-b border-white/10 px-4 pb-3">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Index</label>
            <ThemedDropdown
              buttonId="rail-mm-index"
              className="market-movers-page__mm-dd market-movers-page__mm-dd--index w-full min-w-0"
              style={{ width: '100%' }}
              value={indexId}
              options={INDEX_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              onChange={setIndexId}
              title="Index universe"
              ariaLabelPrefix="Index"
              wideLabel
              size="sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-500">Range</label>
            <ThemedDropdown
              buttonId="rail-mm-range"
              className="market-movers-page__mm-dd market-movers-page__mm-dd--index w-full min-w-0"
              style={{ width: '100%' }}
              value={rangeId}
              options={RANGE_OPTIONS.map((o) => ({ id: o.id, label: o.label }))}
              onChange={setRangeId}
              title="Return period"
              ariaLabelPrefix="Range"
              wideLabel
              size="sm"
              labelFallback={activeRange.label}
            />
          </div>
        </div>

        {error ? <p className="wl-flyout__err mx-4 mb-2 flex-shrink-0">{error}</p> : null}

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain mt-2"
          style={{ scrollbarWidth: 'none' }}
          aria-busy={loading}
        >
          {renderMoverBlock(`Top ${TOP_N} gainers`, gainers, 'gain')}
          {renderMoverBlock(`Top ${TOP_N} losers`, losers, 'loss')}
        </div>
      </div>
    </>
  );
}
