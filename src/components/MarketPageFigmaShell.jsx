import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJsonCached, fetchWithAuth, getAuthToken } from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { NormalizedPerformanceCard } from './NormalizedPerformanceCard.jsx';
import { SectorTreemap } from './SectorTreemap.jsx';
import { DEFAULT_SELECTED_KEYS, META_BY_KEY, MARKET_SERIES } from './marketSeriesRegistry.js';
import { returnToSummaryTableHeatColor, summaryTableTextOnFill } from '../utils/heatmapColors.js';
import {
  calcLatestDelta,
  calcRangeReturnPct,
  fmtAbsSigned,
  fmtPctSigned,
  fmtPrice,
  tfRange
} from '../utils/marketCalculations.js';

const LEFT_GROUPS = [
  { id: 'us', title: 'key US indices snapshot-1' },
  { id: 'sector', title: 'sp500 sectors-snapshot-1' },
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

async function fetchLatestForTicker(ticker) {
  try {
    const r = await fetchJsonCached({
      path: '/api/market/ohlc?symbol=' + encodeURIComponent(ticker) + '&limit=8',
      method: 'GET',
      ttlMs: 30 * 1000
    });
    const rows = Array.isArray(r?.data?.data) ? r.data.data : Array.isArray(r?.data) ? r.data : [];
    const latest = calcLatestDelta(rows);
    if (latest) return latest;
  } catch {
    /* fall through to POST fallback */
  }
  const end = new Date();
  const { start, end: endIso } = tfRange('1D');
  const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker,
      start_date: start,
      end_date: endIso || end.toISOString().slice(0, 10)
    })
  });
  const payload = await res.json().catch(() => ({}));
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return calcLatestDelta(rows);
}

function LeftSnapshotStack({ selectedKeys, onToggleSeries, onSelectGroupAll, onClearGroup }) {
  const [rowsByGroup, setRowsByGroup] = useState({});

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!getAuthToken()) return;
      const out = {};
      for (const g of LEFT_GROUPS) {
        const rows = groupRows(g.id);
        const vals = await Promise.allSettled(rows.map((r) => fetchLatestForTicker(r.ticker)));
        out[g.id] = Object.fromEntries(
          rows.map((r, i) => [r.key, vals[i].status === 'fulfilled' ? vals[i].value : null])
        );
      }
      if (!cancel) setRowsByGroup(out);
    }
    load();
    const t = window.setInterval(load, 60 * 1000);
    return () => {
      cancel = true;
      window.clearInterval(t);
    };
  }, []);

  return (
    <aside className="mkt-left">
      {LEFT_GROUPS.map((g) => (
        <section key={g.id} className="mkt-mini-card">
          <header className="mkt-mini-card__head">
            <span>{g.title}</span>
            <span className="mkt-mini-card__head-actions">
              <button type="button" className="mkt-mini-card__tiny-btn" onClick={() => onSelectGroupAll(g.id)}>
                All
              </button>
              <button type="button" className="mkt-mini-card__tiny-btn" onClick={() => onClearGroup(g.id)}>
                None
              </button>
            </span>
          </header>
          <div className="mkt-mini-card__subhead">
            <span>M</span>
            <span>Name</span>
            <span>Price</span>
            <span>Chg</span>
            <span>%</span>
          </div>
          {groupRows(g.id).map((r) => {
            const v = rowsByGroup[g.id]?.[r.key];
            const up = Number(v?.chg) > 0;
            const down = Number(v?.chg) < 0;
            const checked = selectedKeys.includes(r.key);
            return (
              <div key={r.key} className="mkt-mini-card__row">
                <input
                  type="checkbox"
                  className={'mkt-mini-card__check mkt-mini-card__check--' + r.tone}
                  checked={checked}
                  onChange={() => onToggleSeries(r.key)}
                  aria-label={`Show ${r.label} in chart`}
                />
                <span className="mkt-mini-card__name">{r.label}</span>
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

/** Index returns table uses `returnToSummaryTableHeatColor` (Figma ramp), not treemap `returnToHeatColor`. */
function summaryHeatCellStyle(pct) {
  const v = Number(pct);
  if (!Number.isFinite(v)) {
    return { background: '#e2e8f0', color: '#64748b' };
  }
  const bg = returnToSummaryTableHeatColor(v, -8, 8);
  return { backgroundColor: bg, color: summaryTableTextOnFill(bg), fontWeight: 700 };
}

/** Figma sample values use plain `1.2%` (no `+` on positives). */
function fmtSummaryPct(v) {
  if (!Number.isFinite(Number(v))) return '—';
  return Number(v).toFixed(1) + '%';
}

function SummaryReturnsCard({ refreshMs = 0 }) {
  const [vals, setVals] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const defs = useMemo(
    () => [
      { key: 'SPX', label: 'S&P 500' },
      { key: 'INDU', label: 'Dow Jones' },
      { key: 'NDX', label: 'Nasdaq-100' }
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
      if (!getAuthToken()) return;
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
            const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker, start_date: start, end_date: end })
            });
            const payload = await res.json();
            const rows = Array.isArray(payload?.data) ? payload.data : [];
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
  }, [defs, tfs, refreshMs]);

  return (
    <section className="mkt-summary-card mkt-summary-card--figma">
      <header className="mkt-summary-card__head mkt-summary-card__head--figma">Index returns</header>
      <div className="mkt-summary-card__table-wrap">
      <table className="mkt-summary-card__table mkt-summary-card__table--figma">
        <thead>
          <tr>
            <th className="mkt-summary-card__corner" scope="col" aria-hidden="true" />
            {tfs.map((tf) => (
              <th key={tf.key} scope="col">{tf.key}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {defs.map((d) => (
            <tr key={d.key}>
              <th className="mkt-summary-rowlabel" scope="row">{d.label}</th>
              {tfs.map((tf) => {
                const raw = vals?.[d.key]?.[tf.key];
                const v = Number(raw);
                const pending = loading && raw === undefined;
                const style =
                  !pending && Number.isFinite(v)
                    ? summaryHeatCellStyle(v)
                    : { background: '#f1f5f9', color: '#64748b' };
                return (
                  <td key={tf.key} className="mkt-summary-heat-cell" style={style}>
                    {pending ? '…' : Number.isFinite(v) ? fmtSummaryPct(v) : '—'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
      if (!getAuthToken()) {
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
        <span className="mkt-heat-thumb-card__title">{HEATMAP_THUMB_INDEX} heatmap</span>
        <Link to="/heatmap" className="mkt-heat-thumb-card__link">
          Full heatmap →
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
          {loading && !rows.length ? <div className="mkt-treemap-thumb-host__loading">Loading…</div> : null}
        </Link>
      </div>
    </section>
  );
}

function RightWatchlistCard({ refreshMs = 0 }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        const res = await fetchJsonCached({ path: '/api/watchlists/defaults', auth: false, ttlMs: 2 * 60 * 1000 });
        const groups = Array.isArray(res?.data) ? res.data : [];
        const first = Array.isArray(groups[0]?.items) ? groups[0].items : [];
        if (!cancel) setRows(first.slice(0, 9));
      } catch {
        if (!cancel) setRows([]);
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
    <aside className="mkt-right">
      <section className="mkt-watch-card">
        <header className="mkt-watch-card__head">tickers-list-1</header>
        <div className="mkt-watch-card__table">
          <div className="mkt-watch-card__row mkt-watch-card__row--head">
            <span>Security</span>
            <span>Last</span>
            <span>1D%</span>
          </div>
          {rows.map((r) => {
            const pct = Number(r.change_pct);
            return (
              <Link to={'/ticker/' + encodeURIComponent(String(r.symbol || ''))} className="mkt-watch-card__row" key={String(r.symbol || '')}>
                <span>{String(r.symbol || '')}</span>
                <span>{Number(r.close || 0).toFixed(2)}</span>
                <span className={pct > 0 ? 'is-up' : pct < 0 ? 'is-down' : ''}>{Number.isFinite(pct) ? (pct * 100).toFixed(1) + '%' : '—'}</span>
              </Link>
            );
          })}
        </div>
      </section>
    </aside>
  );
}

export function MarketPageFigmaShell() {
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
    <section className="mkt-fig-shell">
      <LeftSnapshotStack
        selectedKeys={selectedSeries}
        onToggleSeries={onToggleSeries}
        onSelectGroupAll={onSelectGroupAll}
        onClearGroup={onClearGroup}
      />
      <main className="mkt-center">
        <div className="mkt-options">
          <label className="mkt-options__item">
            <span>Refresh</span>
            <select value={refreshMode} onChange={(e) => setRefreshMode(e.target.value)}>
              <option value="manual">Manual</option>
              <option value="15s">15s</option>
              <option value="30s">30s</option>
              <option value="60s">60s</option>
            </select>
          </label>
          <label className="mkt-options__item">
            <span>Axis</span>
            <select value={axisMode} onChange={(e) => setAxisMode(e.target.value)}>
              <option value="auto">Auto</option>
              <option value="fixed10">Fixed ±10%</option>
              <option value="fixed20">Fixed ±20%</option>
            </select>
          </label>
        </div>
        <NormalizedPerformanceCard
          selectedKeys={selectedSeries}
          onSelectedKeysChange={setSelectedSeries}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          axisMode={axisMode}
          refreshMs={refreshMs}
        />
        <div className="mkt-center-bottom">
          <SummaryReturnsCard refreshMs={refreshMs} />
          <MarketHeatmapThumbnail refreshMs={refreshMs} />
        </div>
      </main>
      <RightWatchlistCard refreshMs={refreshMs} />
    </section>
  );
}

