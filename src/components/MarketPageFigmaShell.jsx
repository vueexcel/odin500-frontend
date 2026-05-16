import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import {fetchJsonCached, fetchWithAuth, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { NormalizedPerformanceCard } from './NormalizedPerformanceCard.jsx';
import { SectorTreemap } from './SectorTreemap.jsx';
import TradingChartLoader from './TradingChartLoader.jsx';
import { DEFAULT_SELECTED_KEYS, META_BY_KEY, MARKET_SERIES } from './marketSeriesRegistry.js';
import { useRightRailDock } from '../context/WatchlistDockContext.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import {
  calcRangeReturnPct,
  calcRangeSnapshot,
  fmtAbsSigned,
  fmtPctSigned,
  fmtPrice,
  tfRange
} from '../utils/marketCalculations.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';

const LEFT_GROUPS = [
  { id: 'us', title: 'Key US Indices ' },
  { id: 'sector', title: 'SP500 Sectors' },
  { id: 'other', title: 'Other Markets (ETFs)' }
];
const REFRESH_MAP = { manual: 0, '15s': 15000, '30s': 30000, '60s': 60000 };
const LS_KEYS = {
  selected: 'market_shell_selected_keys',
  tf: 'market_shell_tf',
  axis: 'market_shell_axis',
  refresh: 'market_shell_refresh'
};

function groupRows(groupId) {
  return MARKET_SERIES.filter((s) => s.group === groupId);
}

function LeftSnapshotStack({
  selectedKeys,
  onToggleSeries,
  onSelectGroupAll,
  onClearGroup,
  loadOhlcRows,
  timeframe,
  refreshMs
}) {
  const [rowsByGroup, setRowsByGroup] = useState({});

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!canFetchProtectedApi() || typeof loadOhlcRows !== 'function') return;
      const { start, end } = tfRange(timeframe || '6M');
      const out = {};
      for (const g of LEFT_GROUPS) {
        const seriesRows = groupRows(g.id);
        const vals = await Promise.allSettled(
          seriesRows.map((r) =>
            loadOhlcRows(r.ticker, start, end).then((data) => calcRangeSnapshot(data))
          )
        );
        out[g.id] = Object.fromEntries(
          seriesRows.map((r, i) => [r.key, vals[i].status === 'fulfilled' ? vals[i].value : null])
        );
      }
      if (!cancel) setRowsByGroup(out);
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [loadOhlcRows, timeframe, refreshMs]);

return (
    <aside className="mkt-left">
      {LEFT_GROUPS.map((g) => (
        <section key={g.id} className="mkt-mini-card">
          <header className="mkt-mini-card__head">
            <span className="uppercase text-[12px]" >
              {g.title}
              <span
                className={'mkt-mini-card__tf' + (String(timeframe).toUpperCase() === '10Y' ? ' mkt-mini-card__tf--10y' : '')}
                title="Same date range as the performance chart"
              >
                {timeframe}
              </span>
            </span>
            <span className="mkt-mini-card__head-actions">
              <button type="button" className="mkt-mini-card__tiny-btn" onClick={() => onSelectGroupAll(g.id)}>
                All
              </button>
              <button type="button" className="mkt-mini-card__tiny-btn" onClick={() => onClearGroup(g.id)}>
                None
              </button>
            </span>
          </header>
          <div className="mkt-mini-card__subhead" title="Last close and total move over the chart timeframe">
            <span>M</span>
            <span>Name</span>
            <span>Ticker</span>
            <span>Last</span>
            <span>Δ</span>
            <span>%</span>
          </div>
          {groupRows(g.id).map((r) => {
            const v = rowsByGroup[g.id]?.[r.key];
            const up = Number(v?.chgPct) > 0;
            const down = Number(v?.chgPct) < 0;
            const checked = selectedKeys.includes(r.key);
            const tickerLabel = String(r.symbol || r.ticker || r.key || '').toUpperCase();
            const routeSym = sanitizeTickerPageInput(r.ticker || r.symbol || r.key);
            const tickerTo = routeSym
              ? `/ticker/${encodeURIComponent(routeSym)}?ticker=${encodeURIComponent(routeSym)}`
              : '';
            return (
              <div key={r.key} className="mkt-mini-card__row">
                <label
                  className="mkt-mini-card__check-label"
                  style={{ ['--mkt-check-accent']: r.color }}
                >
                  <input
                    type="checkbox"
                    className="mkt-mini-card__check"
                    checked={checked}
                    onChange={() => onToggleSeries(r.key)}
                    aria-label={`Show ${r.label} in chart`}
                  />
                </label>
                <span className="mkt-mini-card__name">{r.label}</span>
                {routeSym ? (
                  <Link
                    className="mkt-mini-card__ticker mkt-mini-card__ticker--link"
                    to={tickerTo}
                    title={`Open ${routeSym} on ticker page (OHLC: ${String(r.ticker || '').toUpperCase()})`}
                  >
                    {tickerLabel || '—'}
                  </Link>
                ) : (
                  <span className="mkt-mini-card__ticker" title={`OHLC symbol: ${String(r.ticker || '').toUpperCase()}`}>
                    {tickerLabel || '—'}
                  </span>
                )}
                <span>{v ? fmtPrice(v.close) : '—'}</span>
                <span className={up ? 'is-up' : down ? 'is-down' : ''}>{v ? fmtAbsSigned(v.chg) : '—'}</span>
                <span className={up ? 'is-up' : down ? 'is-down' : ''}>{v ? fmtPctSigned(v.chgPct, 1) : '—'}</span>
              </div>
            );
          })}
        </section>
      ))}
    </aside>
  );
}

/** Figma sample values use plain `1.2%` (no `+` on positives). */
function fmtSummaryPct(v) {
  if (!Number.isFinite(Number(v))) return '—';
  return Number(v).toFixed(1) + '%';
}

function SummaryReturnsCard({ refreshMs = 0, loadOhlcRows = null }) {
  const [vals, setVals] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const defs = useMemo(
    () => [
      { key: 'SPX', label: 'S&P 500' },
      { key: 'INDU', label: 'Dow Jones' },
      { key: 'NDX', label: 'Nasdaq-100' },
      { key: 'XLK', label: 'Technology' },
      { key: 'XLE', label: 'Energy' },
      { key: 'XLV', label: 'Healthcare' },
      { key: 'XLI', label: 'Industrials' },
      
    ],
    []
  );
  const tfs = useMemo(
    () => [
      { key: '1D', days: 3 },
      { key: '1M', days: 31 },
      { key: '6M', days: 184 },
      { key: '1Y', days: 365 }
    ],
    []
  );

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!canFetchProtectedApi()) return;
      setLoading(true);
      setError('');
      const now = new Date();
      const end = now.toISOString().slice(0, 10);
      const out = {};
      try {
        for (const d of defs) {
          out[d.key] = {};
          for (const tf of tfs) {
            const startDate = new Date(now);
            startDate.setDate(now.getDate() - tf.days);
            const start = startDate.toISOString().slice(0, 10);
            const ticker = META_BY_KEY[d.key]?.ticker;
            let rows = [];
            if (typeof loadOhlcRows === 'function') {
              rows = await loadOhlcRows(ticker, start, end);
            } else {
              const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticker, start_date: start, end_date: end })
              });
              const payload = await res.json();
              rows = Array.isArray(payload?.data) ? payload.data : [];
            }
            out[d.key][tf.key] = calcRangeReturnPct(rows);
          }
        }
        if (!cancel) setVals(out);
      } catch (e) {
        if (!cancel) setError(e.message || 'Failed loading summary');
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [defs, tfs, refreshMs, loadOhlcRows]);

  return (
    <section className="mkt-watch-card mkt-returns-summary">
      <header className="mkt-watch-card__head mkt-returns-summary__head">
        <span className="mkt-watch-card__title mkt-returns-summary__title-row">
          Index & sector returns
          <ChartInfoTip tip={CHART_INFO_TIPS.marketIndexReturns} align="start" />
        </span>
      </header>
      <div className="mkt-watch-card__table">
        <div className="mkt-watch-card__row mkt-watch-card__row--head mkt-returns-summary__row" role="row">
          <span className="mkt-returns-summary__h" role="columnheader">
            Index / sector
          </span>
          {tfs.map((tf) => (
            <span key={tf.key} className="mkt-returns-summary__h mkt-returns-summary__h--num" role="columnheader">
              {tf.key}
            </span>
          ))}
        </div>
        {defs.map((d) => {
          const ticker = META_BY_KEY[d.key]?.ticker;
          const routeSym = sanitizeTickerPageInput(ticker || d.key);
          const tickerTo =
            routeSym && ticker
              ? `/ticker/${encodeURIComponent(routeSym)}?ticker=${encodeURIComponent(routeSym)}`
              : '';
          const cells = tfs.map((tf) => {
            const raw = vals?.[d.key]?.[tf.key];
            const v = Number(raw);
            const pending = loading && raw === undefined;
            const text = pending ? '…' : Number.isFinite(v) ? fmtSummaryPct(v) : '—';
            const tone =
              !pending && Number.isFinite(v) ? (v > 0 ? 'app-num--up' : v < 0 ? 'app-num--down' : '') : '';
            return (
              <span key={tf.key} className={tone ? tone : undefined}>
                {text}
              </span>
            );
          });
          if (tickerTo) {
            return (
              <Link key={d.key} to={tickerTo} className="mkt-watch-card__row mkt-returns-summary__row" title={`Open ${routeSym}`}>
                <span>{d.label}</span>
                {cells}
              </Link>
            );
          }
          return (
            <div key={d.key} className="mkt-watch-card__row mkt-returns-summary__row">
              <span>{d.label}</span>
              {cells}
            </div>
          );
        })}
      </div>
      {loading ? <div className="mkt-panel-status">Refreshing…</div> : null}
      {error ? <div className="mkt-panel-status mkt-panel-status--err">{error}</div> : null}
    </section>
  );
}

/** Thumbnail index (not SP500). Same strings as `MarketHeatmapPage` INDEX_MENU `apiIndex`. */
const HEATMAP_THUMB_INDEX = 'Dow Jones';

function MarketHeatmapThumbnail({ refreshMs = 0 }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!canFetchProtectedApi()) {
        setError('Sign in to load heatmap.');
        setRows([]);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data: payload } = await fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: HEATMAP_THUMB_INDEX, period: 'last-date' },
          auth: true,
          ttlMs: 3 * 60 * 1000
        });
        if (cancel) return;
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setRows(list);
        if (!list.length) setError('No heatmap rows for this index.');
      } catch (e) {
        if (!cancel) {
          setError(e.message || 'Failed to load heatmap');
          setRows([]);
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [refreshMs]);

  return (
    <section className="mkt-heat-thumb-card mkt-heat-thumb-card--figma">
      <header className="mkt-heat-thumb-card__head mkt-heat-thumb-card__head--figma mkt-heat-thumb-card__head--row">
      <div className="flex align-center gap-2">
        <span className="mkt-heat-thumb-card__title align-center">Stock Market Heatmap</span>
        <ChartInfoTip tip={CHART_INFO_TIPS.marketHeatmapThumb} align="end" />
        </div>
        <Link to="/heatmap" className="mkt-heat-thumb-card__link mkt-heat-thumb-card__link--icon" aria-label="Open full heatmap">
        ↗
        </Link>
        
      </header>
      <div className="mkt-treemap-thumb-host mkt-treemap-thumb-host--figma" aria-busy={loading}>
        <Link
          to="/heatmap"
          className="mkt-treemap-thumb-host__link"
          aria-label={'Open full heatmap for ' + HEATMAP_THUMB_INDEX}
        >
          {error ? <div className="mkt-treemap-thumb-host__err">{error}</div> : null}
          {!error && rows.length > 0 ? (
            <SectorTreemap rows={rows} scaleMin={-3} scaleMax={3} highlightSymbol="" disableTooltip />
          ) : !error && !loading ? (
            <div className="mkt-treemap-thumb-host__empty">No data</div>
          ) : null}
          {loading && !rows.length ? (
            <div className="mkt-treemap-thumb-host__loading" role="status" aria-live="polite">
              <TradingChartLoader label="Loading heatmap…" sublabel={HEATMAP_THUMB_INDEX} />
            </div>
          ) : null}
        </Link>
      </div>
    </section>
  );
}

const WATCHLIST_INDEX_OPTIONS = [
  { id: 'dow-jones', label: 'Dow Jones', apiIndex: 'Dow Jones' },
  { id: 'sp500', label: 'S&P 500', apiIndex: 'sp500' },
  { id: 'nasdaq-100', label: 'Nasdaq 100', apiIndex: 'Nasdaq 100' }
];

function watchRowSymbolUpper(r) {
  return String(r.symbol || r.ticker || '').toUpperCase().trim();
}

function watchRowLastNum(r) {
  const n = Number(r.price ?? r.close);
  return Number.isFinite(n) ? n : NaN;
}

function watchRowPctNum(r) {
  const rawPct = Number(r.totalReturnPercentage);
  const fallbackPct = Number(r.change_pct);
  return Number.isFinite(rawPct) ? rawPct : Number.isFinite(fallbackPct) ? fallbackPct * 100 : NaN;
}

function RightWatchlistCard({ refreshMs = 0 }) {
  const [selectedIndexId, setSelectedIndexId] = useState('dow-jones');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState({ key: 'security', dir: 'asc' });

  const selectedIndex = useMemo(
    () => WATCHLIST_INDEX_OPTIONS.find((opt) => opt.id === selectedIndexId) || WATCHLIST_INDEX_OPTIONS[0],
    [selectedIndexId]
  );

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!canFetchProtectedApi()) {
        setRows([]);
        setError('Sign in to load tickers.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data: payload } = await fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: selectedIndex.apiIndex, period: 'last-date' },
          auth: true,
          ttlMs: 2 * 60 * 1000
        });
        if (cancel) return;
        const list = Array.isArray(payload?.data) ? payload.data : [];
        setRows(list);
        if (!list.length) setError('No rows for selected index.');
      } catch (e) {
        if (!cancel) {
          setRows([]);
          setError(e.message || 'Failed loading tickers');
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancel = true;
      if (timer) window.clearInterval(timer);
    };
  }, [refreshMs, selectedIndex.apiIndex]);

  useEffect(() => {
    setSort({ key: 'security', dir: 'asc' });
  }, [selectedIndexId]);

  const sortedRows = useMemo(() => {
    const list = [...rows];
    const dirMul = sort.dir === 'asc' ? 1 : -1;
    const tie = (a, b) => watchRowSymbolUpper(a).localeCompare(watchRowSymbolUpper(b), undefined, { sensitivity: 'base' });
    list.sort((a, b) => {
      if (sort.key === 'security') {
        return dirMul * watchRowSymbolUpper(a).localeCompare(watchRowSymbolUpper(b), undefined, { sensitivity: 'base' });
      }
      if (sort.key === 'last') {
        const na = watchRowLastNum(a);
        const nb = watchRowLastNum(b);
        const aNa = !Number.isFinite(na);
        const bNa = !Number.isFinite(nb);
        if (aNa && bNa) return tie(a, b);
        if (aNa) return 1;
        if (bNa) return -1;
        const c = dirMul * (na - nb);
        return c !== 0 ? c : tie(a, b);
      }
      if (sort.key === 'pct') {
        const pa = watchRowPctNum(a);
        const pb = watchRowPctNum(b);
        const aNa = !Number.isFinite(pa);
        const bNa = !Number.isFinite(pb);
        if (aNa && bNa) return tie(a, b);
        if (aNa) return 1;
        if (bNa) return -1;
        const c = dirMul * (pa - pb);
        return c !== 0 ? c : tie(a, b);
      }
      return tie(a, b);
    });
    return list;
  }, [rows, sort]);

  const onWatchSort = useCallback((key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { key, dir: 'asc' };
    });
  }, []);

  const watchSortGlyph = (key) => (sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕');

  const watchSortIcoClass = (key) =>
    'mkt-watch-card__sort-ico' +
    (sort.key === key ? ' mkt-watch-card__sort-ico--active' : ' mkt-watch-card__sort-ico--idle');

  const ariaSortFor = (key) => {
    if (sort.key !== key) return 'none';
    return sort.dir === 'asc' ? 'ascending' : 'descending';
  };

  return (
    <aside className="mkt-right">
      <section className="mkt-watch-card">
        <header className="mkt-watch-card__head">
          <span className="mkt-watch-card__title">Tickers List</span>
          <div className="mkt-watch-card__controls">
            <ThemedDropdown
              className="mkt-watch-card__dd"
              size="sm"
              wideLabel
              value={selectedIndexId}
              options={WATCHLIST_INDEX_OPTIONS.map((opt) => ({ id: opt.id, label: opt.label }))}
              onChange={setSelectedIndexId}
              title="Index selection"
              ariaLabelPrefix="Index"
            />
          </div>
        </header>
        <div className="mkt-watch-card__table">
          <div className="mkt-watch-card__row mkt-watch-card__row--head" role="row">
            <button
              type="button"
              className="mkt-watch-card__th"
              onClick={() => onWatchSort('security')}
              aria-sort={ariaSortFor('security')}
              title="Sort by security name"
            >
              Security
              <span className={watchSortIcoClass('security')} aria-hidden>
                {watchSortGlyph('security')}
              </span>
            </button>
            <button
              type="button"
              className="mkt-watch-card__th mkt-watch-card__th--num"
              onClick={() => onWatchSort('last')}
              aria-sort={ariaSortFor('last')}
              title="Sort by last price"
            >
              Last
              <span className={watchSortIcoClass('last')} aria-hidden>
                {watchSortGlyph('last')}
              </span>
            </button>
            <button
              type="button"
              className="mkt-watch-card__th mkt-watch-card__th--num"
              onClick={() => onWatchSort('pct')}
              aria-sort={ariaSortFor('pct')}
              title="Sort by 1 day percent change"
            >
              1D%
              <span className={watchSortIcoClass('pct')} aria-hidden>
                {watchSortGlyph('pct')}
              </span>
            </button>
          </div>
          {loading && !rows.length ? (
            <div className="mkt-panel-status">Loading…</div>
          ) : null}
          {!loading && error ? (
            <div className="mkt-panel-status mkt-panel-status--err">{error}</div>
          ) : null}
          {!loading && !error && !rows.length ? (
            <div className="mkt-panel-status">No data</div>
          ) : null}
          {!error &&
            sortedRows.map((r, idx) => {
              const symbol = watchRowSymbolUpper(r);
              const last = watchRowLastNum(r);
              const pct = watchRowPctNum(r);
              return (
                <Link to={'/ticker/' + encodeURIComponent(symbol)} className="mkt-watch-card__row" key={symbol || `idx-${idx}`}>
                  <span>{symbol || '—'}</span>
                  <span>{Number.isFinite(last) ? last.toFixed(2) : '—'}</span>
                  <span className={pct > 0 ? 'app-num--up' : pct < 0 ? 'app-num--down' : ''}>
                    {Number.isFinite(pct) ? pct.toFixed(1) + '%' : '—'}
                  </span>
                </Link>
              );
            })}
        </div>
      </section>
    </aside>
  );
}

export function MarketPageFigmaShell() {
  const { isDockOpen } = useRightRailDock();
  const [selectedSeries, setSelectedSeries] = useState(() => {
    try {
      const raw = localStorage.getItem(LS_KEYS.selected);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SELECTED_KEYS;
    } catch {
      return DEFAULT_SELECTED_KEYS;
    }
  });
  const [timeframe, setTimeframe] = useState(() => localStorage.getItem(LS_KEYS.tf) || '6M');
  const [axisMode, setAxisMode] = useState(() => localStorage.getItem(LS_KEYS.axis) || 'auto');
  const [refreshMode, setRefreshMode] = useState(() => localStorage.getItem(LS_KEYS.refresh) || '60s');
  const refreshMs = REFRESH_MAP[refreshMode] ?? 60000;
  const ohlcCacheRef = useRef(new Map());

  const loadOhlcRows = useCallback(async (ticker, startDate, endDate) => {
    const key = `${String(ticker).toUpperCase()}|${startDate}|${endDate}`;
    const now = Date.now();
    const hit = ohlcCacheRef.current.get(key);
    if (hit && now - hit.ts < Math.max(1000, refreshMs || 60000)) return hit.rows;
    const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ticker, start_date: startDate, end_date: endDate })
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload?.success) {
      throw new Error(payload?.error || `Failed loading ${ticker}`);
    }
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    ohlcCacheRef.current.set(key, { ts: now, rows });
    return rows;
  }, [refreshMs]);

  useEffect(() => {
    ohlcCacheRef.current.clear();
  }, [refreshMs, timeframe]);

  const onToggleSeries = (seriesKey) => {
    setSelectedSeries((prev) => {
      if (prev.includes(seriesKey)) return prev.length <= 1 ? prev : prev.filter((k) => k !== seriesKey);
      return [...prev, seriesKey];
    });
  };
  const onSelectGroupAll = (groupId) => {
    const groupKeys = groupRows(groupId).map((s) => s.key);
    setSelectedSeries((prev) => Array.from(new Set([...prev, ...groupKeys])));
  };
  const onClearGroup = (groupId) => {
    const groupKeys = new Set(groupRows(groupId).map((s) => s.key));
    setSelectedSeries((prev) => {
      const next = prev.filter((k) => !groupKeys.has(k));
      return next.length ? next : prev;
    });
  };

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.selected, JSON.stringify(selectedSeries));
    } catch {
      /* ignore */
    }
  }, [selectedSeries]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEYS.tf, timeframe);
      localStorage.setItem(LS_KEYS.axis, axisMode);
      localStorage.setItem(LS_KEYS.refresh, refreshMode);
    } catch {
      /* ignore */
    }
  }, [timeframe, axisMode, refreshMode]);

  return (
    <section className={'mkt-fig-shell' + (isDockOpen ? ' mkt-fig-shell--watchlist-dock-open' : '')}>
      <LeftSnapshotStack
        selectedKeys={selectedSeries}
        onToggleSeries={onToggleSeries}
        onSelectGroupAll={onSelectGroupAll}
        onClearGroup={onClearGroup}
        loadOhlcRows={loadOhlcRows}
        timeframe={timeframe}
        refreshMs={refreshMs}
      />
      <main className="mkt-center">
        {/* <div className="mkt-options">
          <label className="mkt-options__item">
            <span>Refresh</span>
            <ThemedDropdown
              className="mkt-options__dd"
              size="sm"
              wideLabel
              value={refreshMode}
              options={[
                { id: 'manual', label: 'Manual' },
                { id: '15s', label: '15s' },
                { id: '30s', label: '30s' },
                { id: '60s', label: '60s' }
              ]}
              onChange={setRefreshMode}
              title="Refresh interval"
              ariaLabelPrefix="Refresh"
            />
          </label>
          <label className="mkt-options__item">
            <span>Axis</span>
            <ThemedDropdown
              className="mkt-options__dd"
              size="sm"
              wideLabel
              value={axisMode}
              options={[
                { id: 'auto', label: 'Auto' },
                { id: 'fixed10', label: 'Fixed ±10%' },
                { id: 'fixed20', label: 'Fixed ±20%' }
              ]}
              onChange={setAxisMode}
              title="Chart axis mode"
              ariaLabelPrefix="Axis"
            />
          </label>
        </div> */}
        <NormalizedPerformanceCard
          selectedKeys={selectedSeries}
          onSelectedKeysChange={setSelectedSeries}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          axisMode={axisMode}
          refreshMs={refreshMs}
          loadSeriesRows={loadOhlcRows}
        />
        <div className="mkt-center-bottom">
          <SummaryReturnsCard refreshMs={refreshMs} loadOhlcRows={loadOhlcRows} />
          <MarketHeatmapThumbnail refreshMs={refreshMs} />
        </div>
      </main>
      {!isDockOpen ? <RightWatchlistCard refreshMs={refreshMs} /> : null}
    </section>
  );
}

