import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { OdinFigmaSignalTreemap } from '../components/OdinFigmaSignalTreemap.jsx';
import { ChartPanel } from '../components/ChartPanel.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { fetchJsonCached } from '../store/apiStore.js';
import { fetchWithAuth, getAuthToken } from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { mapRowsToCandles } from '../utils/chartData.js';
import { toDateInput } from '../utils/misc.js';
import { mapOhlcRowsToOdinSignalMarkers } from '../utils/odinChartMarkers.js';
import {
  DEFAULT_TICKERS_PAGE_SYMBOL,
  resolveTickersPageSymbol,
  sanitizeTickerPageInput
} from '../utils/tickerUrlSync.js';
import { ODIN_FIGMA_LEGEND_ITEMS, figmaFillForSignal } from '../utils/odinSignalTreemap.js';

const RANGE_PRESETS = [
  { key: '1y', label: '1Y', years: 1 },
  { key: '3y', label: '3Y', years: 3 },
  { key: '5y', label: '5Y', years: 5 },
  { key: '10y', label: '10Y', years: 10 }
];

const SIGNAL_LEGEND = [
  { code: 'L1', label: 'Long L1', color: '#14532d' },
  { code: 'L2', label: 'Long L2', color: '#22c55e' },
  { code: 'L3', label: 'Long L3', color: '#86efac' },
  { code: 'S1', label: 'Short S1', color: '#dc2626' },
  { code: 'S2', label: 'Short S2', color: '#9a3412' },
  { code: 'S3', label: 'Short S3', color: '#fb923c' }
];

const INDEX_MENU = [
  { id: 'sp500', apiIndex: 'SP500', label: 'SP 500' },
  { id: 'dow', apiIndex: 'Dow Jones', label: 'Dow Jones 30' },
  { id: 'nasdaq', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100' },
  { id: 'russell', apiIndex: 'Russell 2000', label: 'Russell 2000' },
  { id: 'all', apiIndex: 'All Stocks', label: 'All Stocks' }
];

function fmtPrice(n) {
  if (!Number.isFinite(Number(n))) return '—';
  return Number(n).toFixed(2);
}

function signalFromReturn(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'N';
  if (n >= 2) return 'L1';
  if (n >= 0) return 'L2';
  if (n <= -2) return 'S1';
  return 'S2';
}

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutArcPath(cx, cy, r0, r1, a0, a1) {
  const p0 = polar(cx, cy, r1, a0);
  const p1 = polar(cx, cy, r1, a1);
  const p2 = polar(cx, cy, r0, a1);
  const p3 = polar(cx, cy, r0, a0);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M ${p0.x} ${p0.y} A ${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y} L ${p2.x} ${p2.y} A ${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y} Z`;
}

function subtractYearsFromIsoEnd(endIso, years) {
  const d = new Date(endIso + 'T12:00:00');
  d.setFullYear(d.getFullYear() - years);
  return toDateInput(d);
}

function formatListDate(d) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(d);
}

export default function OdinSignalsPage() {
  const chartRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const symbol = useMemo(() => resolveTickersPageSymbol(searchParams), [searchParams]);
  const [rangeKey, setRangeKey] = useState('3y');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ rowCount: 0, signalCount: 0, maPoints: 0 });
  const [indexId, setIndexId] = useState('sp500');
  const [indexRows, setIndexRows] = useState([]);
  const [indexLoading, setIndexLoading] = useState(false);
  const [odinHeatmapZoom, setOdinHeatmapZoom] = useState(1);
  const [odinSignalBinSpan, setOdinSignalBinSpan] = useState(15);
  const [odinHeatmapHover, setOdinHeatmapHover] = useState('');
  const odinHeatmapMainRef = useRef(null);
  const odinTreemapHostRef = useRef(null);

  const { startDate, endDate } = useMemo(() => {
    const end = toDateInput(new Date());
    const preset = RANGE_PRESETS.find((r) => r.key === rangeKey);
    const years = preset ? preset.years : 3;
    const start = subtractYearsFromIsoEnd(end, years);
    return { startDate: start, endDate: end };
  }, [rangeKey]);

  const setSymbolInUrl = useCallback(
    (sym) => {
      const clean = sanitizeTickerPageInput(sym) || DEFAULT_TICKERS_PAGE_SYMBOL;
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('ticker', clean);
          next.delete('symbol');
          return next;
        },
        { replace: false }
      );
    },
    [setSearchParams]
  );

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    async function run() {
      if (!getAuthToken()) {
        setError('Sign in to load the chart.');
        setLoading(false);
        return;
      }
      setError('');
      setLoading(true);
      try {
        const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: symbol,
            start_date: startDate,
            end_date: endDate
          }),
          signal: ac.signal
        });
        const payload = await res.json();
        if (!res.ok || !payload.success) {
          throw new Error(payload.error || payload.message || 'Request failed');
        }
        if (cancelled) return;
        const rows = Array.isArray(payload.data) ? payload.data : [];
        const candles = mapRowsToCandles(rows);
        const markers = mapOhlcRowsToOdinSignalMarkers(rows);
        const ma200 = Array.isArray(payload.ma200)
          ? payload.ma200
              .filter((r) => r.date && r.value != null && !Number.isNaN(Number(r.value)))
              .map((r) => ({ time: r.date, value: Number(r.value) }))
              .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
          : [];
        chartRef.current?.setChartData({ candles, markers, ma200 });
        setMeta({
          rowCount: candles.length,
          signalCount: markers.length,
          maPoints: ma200.length
        });
      } catch (e) {
        if (e.name === 'AbortError' || cancelled) return;
        setError(e.message || 'Failed to load chart');
        chartRef.current?.setChartData({ candles: [], markers: [], ma200: [] });
        setMeta({ rowCount: 0, signalCount: 0, maPoints: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [symbol, startDate, endDate]);

  const activeIndex = useMemo(() => INDEX_MENU.find((x) => x.id === indexId) || INDEX_MENU[0], [indexId]);

  const signalStats = useMemo(() => {
    const out = { L1: 0, L2: 0, L3: 0, S1: 0, S2: 0, S3: 0, N: 0 };
    for (const r of indexRows) {
      const s = String(r.signal || 'N').toUpperCase();
      if (out[s] == null) out.N += 1;
      else out[s] += 1;
    }
    const total = indexRows.length || 0;
    const long = out.L1 + out.L2 + out.L3;
    const short = out.S1 + out.S2 + out.S3;
    const neutral = out.N;
    return { ...out, total, long, short, neutral };
  }, [indexRows]);

  const strongestBucket = useMemo(() => {
    const candidates = [
      { key: 'S1', label: 'Strong Bearish' },
      { key: 'S2', label: 'Bearish' },
      { key: 'N', label: 'Neutral' },
      { key: 'L2', label: 'Bullish' },
      { key: 'L1', label: 'Strong Bullish' }
    ];
    let best = candidates[0];
    let max = signalStats[best.key] || 0;
    for (const c of candidates) {
      const v = signalStats[c.key] || 0;
      if (v > max) {
        max = v;
        best = c;
      }
    }
    return { ...best, count: max };
  }, [signalStats]);

  useEffect(() => {
    let cancelled = false;
    async function loadIndexRows() {
      if (!getAuthToken()) return;
      setIndexLoading(true);
      try {
        const { data } = await fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: activeIndex.apiIndex, period: 'last-date' },
          ttlMs: 5 * 60 * 1000
        });
        if (cancelled) return;
        const list = Array.isArray(data?.data) ? data.data : [];
        const mapped = list
          .map((r) => ({
            symbol: String(r.symbol || '').toUpperCase(),
            security: String(r.security || ''),
            price: Number(r.price),
            sector: String(r.sector || 'Other').trim() || 'Other',
            industry: String(r.industry || 'General').trim() || 'General',
            totalReturnPercentage: r.totalReturnPercentage,
            signal: signalFromReturn(r.totalReturnPercentage),
            ret: Number(r.totalReturnPercentage)
          }))
          .filter((r) => r.symbol)
          .sort((a, b) => Math.abs(Number(b.ret) || 0) - Math.abs(Number(a.ret) || 0));
        setIndexRows(mapped);
      } catch {
        if (!cancelled) setIndexRows([]);
      } finally {
        if (!cancelled) setIndexLoading(false);
      }
    }
    loadIndexRows();
    return () => {
      cancelled = true;
    };
  }, [activeIndex.apiIndex]);

  const odinTreemapRows = useMemo(
    () =>
      indexRows.map((r) => ({
        symbol: r.symbol,
        security: r.security,
        price: r.price,
        sector: r.sector,
        industry: r.industry,
        totalReturnPercentage: r.totalReturnPercentage
      })),
    [indexRows]
  );

  const toggleOdinHeatmapFullscreen = useCallback(() => {
    const el = odinHeatmapMainRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  }, []);

  const downloadOdinHeatmapCsv = useCallback(() => {
    if (!odinTreemapRows.length) return;
    const header = ['Symbol', 'Security', 'Sector', 'Industry', 'Price', 'ChangePercent'];
    const lines = [
      header.join(','),
      ...odinTreemapRows.map((r) =>
        [
          r.symbol,
          `"${String(r.security || '').replace(/"/g, '""')}"`,
          `"${String(r.sector || '').replace(/"/g, '""')}"`,
          `"${String(r.industry || '').replace(/"/g, '""')}"`,
          r.price != null ? Number(r.price) : '',
          r.totalReturnPercentage != null ? Number(r.totalReturnPercentage) : ''
        ].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `odin-signals-heatmap-${activeIndex.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [odinTreemapRows, activeIndex.id]);

  return (
    <div className="odin-signals-page">
      <div className="odin-signals-layout">
        <aside className="odin-signals-left">
          <section className="odin-side-card">
            <header className="odin-side-card__head">index-selection-1</header>
            <div className="odin-index-list__sub">Index / List selection</div>
            <div className="odin-index-list">
              {INDEX_MENU.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={'odin-index-list__row' + (indexId === m.id ? ' odin-index-list__row--active' : '')}
                  onClick={() => setIndexId(m.id)}
                >
                  <span>{m.label}</span>
                  <span>›</span>
                </button>
              ))}
            </div>
          </section>

          <section className="odin-side-card">
            <header className="odin-side-card__head">tickers-list-signals-1</header>
            <div className="odin-tickers-list">
              <div className="odin-tickers-list__head">
                <span>Ticker</span>
                <span>Signal</span>
                <span>Price</span>
                <span />
              </div>
              {indexRows.slice(0, 40).map((r) => (
                <button
                  key={r.symbol}
                  type="button"
                  className="odin-tickers-list__row"
                  onClick={() => setSymbolInUrl(r.symbol)}
                  onMouseEnter={() => setOdinHeatmapHover(r.symbol)}
                  onMouseLeave={() => setOdinHeatmapHover('')}
                >
                  <span>{r.symbol}</span>
                  <span>{r.signal}</span>
                  <span>{fmtPrice(r.price)}</span>
                  <span className="odin-tickers-list__icons">☑ ⟲</span>
                </button>
              ))}
              {indexLoading ? <div className="odin-tickers-list__status">Loading…</div> : null}
              {!indexLoading && !indexRows.length ? <div className="odin-tickers-list__status">No tickers</div> : null}
            </div>
          </section>
        </aside>

        <main className="odin-signals-main">
          <section className="odin-omx">
            <header className="odin-omx__head">Odin Market Indication (OMX)</header>
            <div className="odin-omx__grid">
              <article className="odin-omx-card">
                <header className="odin-omx-card__cap">{activeIndex.label} OMX</header>
                <svg viewBox="0 0 320 170" className="odin-omx-gauge" aria-hidden>
                  {[
                    { from: 180, to: 210, color: '#ff0000' },
                    { from: 212, to: 240, color: '#ff3b30' },
                    { from: 242, to: 270, color: '#ffc107' },
                    { from: 272, to: 300, color: '#9e9e9e' },
                    { from: 302, to: 330, color: '#8bcf4a' },
                    { from: 332, to: 360, color: '#4a7d2f' }
                  ].map((s, i) => (
                    <path key={i} d={donutArcPath(160, 140, 62, 105, s.from, s.to)} fill={s.color} />
                  ))}
                  <path d={donutArcPath(160, 140, 0, 54, 228, 233)} fill="#1e3a8a" />
                </svg>
                <div className="odin-omx-card__kpi">{strongestBucket.count}</div>
                <div className="odin-omx-card__sub">{strongestBucket.label}</div>
              </article>

              <article className="odin-omx-card">
                <header className="odin-omx-card__cap">{activeIndex.label.toLowerCase()}-direction-breakdown-1</header>
                <svg viewBox="0 0 320 210" className="odin-omx-donut" aria-hidden>
                  {(() => {
                    const total = Math.max(1, signalStats.total);
                    const parts = [
                      { key: 'long', value: signalStats.long, color: '#3b82f6', label: 'Long' },
                      { key: 'short', value: signalStats.short, color: '#f08a35', label: 'Short' },
                      { key: 'neutral', value: signalStats.neutral, color: '#9e9e9e', label: 'Neutral' }
                    ];
                    let a = -90;
                    return parts.map((p) => {
                      const span = (p.value / total) * 360;
                      const d = donutArcPath(160, 100, 56, 88, a, a + span);
                      const mid = a + span / 2;
                      const lp = polar(160, 100, 96, mid);
                      a += span;
                      const pct = Math.round((p.value / total) * 100);
                      return (
                        <g key={p.key}>
                          <path d={d} fill={p.color} />
                          <text x={lp.x} y={lp.y} textAnchor="middle" fill="#4b5563" fontSize="13" fontWeight="700">
                            {p.label}, {p.value}, {pct}%
                          </text>
                        </g>
                      );
                    });
                  })()}
                </svg>
                <div className="odin-omx-card__legend">
                  <span><i style={{ background: '#3b82f6' }} />Long</span>
                  <span><i style={{ background: '#f08a35' }} />Short</span>
                  <span><i style={{ background: '#9e9e9e' }} />Neutral</span>
                </div>
              </article>

              <article className="odin-omx-card">
                <header className="odin-omx-card__cap">{activeIndex.label}-signals-breakdown-1</header>
                <svg viewBox="0 0 320 210" className="odin-omx-donut" aria-hidden>
                  {(() => {
                    const total = Math.max(1, signalStats.total);
                    const parts = [
                      { key: 'L1', value: signalStats.L1, color: '#2f7ae5' },
                      { key: 'L2', value: signalStats.L2, color: '#f08a35' },
                      { key: 'L3', value: signalStats.L3, color: '#9e9e9e' },
                      { key: 'S1', value: signalStats.S1, color: '#f9c80e' },
                      { key: 'S2', value: signalStats.S2, color: '#8bcf4a' },
                      { key: 'S3', value: signalStats.S3, color: '#4aa2f0' },
                      { key: 'N', value: signalStats.N, color: '#546e7a' }
                    ];
                    let a = -90;
                    return parts.map((p) => {
                      const span = (p.value / total) * 360;
                      const d = donutArcPath(160, 100, 56, 88, a, a + span);
                      const mid = a + span / 2;
                      const lp = polar(160, 100, 96, mid);
                      a += span;
                      const pct = Math.round((p.value / total) * 100);
                      return (
                        <g key={p.key}>
                          <path d={d} fill={p.color} />
                          {p.value > 0 ? (
                            <text x={lp.x} y={lp.y} textAnchor="middle" fill="#4b5563" fontSize="11" fontWeight="700">
                              {p.key}, {p.value}, {pct}%
                            </text>
                          ) : null}
                        </g>
                      );
                    });
                  })()}
                </svg>
                <div className="odin-omx-card__legend odin-omx-card__legend--signals">
                  <span><i style={{ background: '#2f7ae5' }} />L1</span>
                  <span><i style={{ background: '#f08a35' }} />L2</span>
                  <span><i style={{ background: '#9e9e9e' }} />L3</span>
                  <span><i style={{ background: '#f9c80e' }} />S1</span>
                  <span><i style={{ background: '#8bcf4a' }} />S2</span>
                  <span><i style={{ background: '#4aa2f0' }} />S3</span>
                  <span><i style={{ background: '#546e7a' }} />n</span>
                </div>
              </article>
            </div>
          </section>

          <section className="odin-s22">
            <div className="odin-s22__frame">
              <article className="odin-s22__panel">
                <h3 className="odin-s22__title">
                  <span className="odin-s22__title-icon" aria-hidden>
                    ◎
                  </span>
                  What is Odin Signal
                </h3>
                <p className="odin-s22__text">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore
                  et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
                  aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse
                  cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
                  culpa qui officia deserunt mollit anim id est laborum.
                </p>
              </article>
            </div>
          </section>

          <section className="odin-signals-heatmap" aria-label="Signal heatmap by sector">
            <h2 className="odin-signals-heatmap__title">
              {activeIndex.label} — signal heatmap
            </h2>
            <p className="odin-signals-heatmap__sub">
              Tiles are grouped by signal (s1, s3, l1, …). Size follows strength tier; colors match the Odin Figma
              palette.
            </p>
            <div className="odin-signals-heatmap__main heatmap-main" ref={odinHeatmapMainRef}>
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
                  <button
                    type="button"
                    className="heatmap-icon-btn"
                    onClick={toggleOdinHeatmapFullscreen}
                    title="Fullscreen"
                  >
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
                  <button
                    type="button"
                    className="heatmap-icon-btn"
                    onClick={downloadOdinHeatmapCsv}
                    title="Download CSV"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v12m0 0l4-4m-4 4L8 11M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="heatmap-icon-btn"
                    onClick={() =>
                      setOdinHeatmapZoom((z) => Math.min(2.25, Math.round((z + 0.25) * 100) / 100))
                    }
                    title="Zoom in"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4-4M11 8v6M8 11h6" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="heatmap-icon-btn"
                    onClick={() =>
                      setOdinHeatmapZoom((z) => Math.max(0.75, Math.round((z - 0.25) * 100) / 100))
                    }
                    title="Zoom out"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4-4M8 11h6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </header>

              {indexLoading ? <div className="heatmap-main__loading">Loading heatmap…</div> : null}
              {!indexLoading && !odinTreemapRows.length ? (
                <div className="heatmap-main__error">No tickers for this index.</div>
              ) : null}

              <div className="heatmap-treemap-outer odin-signals-heatmap__treemap" ref={odinTreemapHostRef}>
                {odinTreemapRows.length > 0 ? (
                  <div
                    className="heatmap-treemap-zoom"
                    style={{
                      transform: `scale(${odinHeatmapZoom})`,
                      transformOrigin: 'top left'
                    }}
                  >
                    <OdinFigmaSignalTreemap
                      rows={odinTreemapRows}
                      signalBinSpan={odinSignalBinSpan}
                      scaleMin={-3}
                      scaleMax={3}
                      highlightSymbol={odinHeatmapHover}
                    />
                  </div>
                ) : null}
              </div>

              <footer className="heatmap-scale-bar odin-signals-heatmap__scale">
                <div className="heatmap-scale-bar__swatches odin-signals-heatmap__figma-legend">
                  {ODIN_FIGMA_LEGEND_ITEMS.map((item) => (
                    <div key={item.code} className="heatmap-scale-bar__cell">
                      <span
                        className="heatmap-scale-bar__chip"
                        style={{ background: figmaFillForSignal(item.code) }}
                      />
                      <span className="heatmap-scale-bar__lbl">{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="heatmap-scale-bar__slider">
                  <label htmlFor="odin-signal-bin-span">Return range ±{odinSignalBinSpan}% → buckets S3…L3</label>
                  <input
                    id="odin-signal-bin-span"
                    type="range"
                    min="5"
                    max="40"
                    step="1"
                    value={odinSignalBinSpan}
                    onChange={(e) => setOdinSignalBinSpan(Number(e.target.value))}
                  />
                </div>
              </footer>
            </div>
          </section>

          {/* <div className="odin-signals-page__toolbar">
            <div className="odin-signals-page__title-block">
              <h1 className="odin-signals-page__title">Odin Signals</h1>
              <p className="odin-signals-page__subtitle">
                OHLC with 200 DMA and L1–L3 / S1–S3 markers from consolidated signals (same data as{' '}
                <code className="odin-signals-page__code">/api/market/ohlc-signals-indicator</code>).
              </p>
            </div>
            <div className="odin-signals-page__controls">
              <TickerSymbolCombobox
                symbol={symbol}
                onSymbolChange={setSymbolInUrl}
                inputId="odin-signals-symbol-input"
                placeholder="Ticker (e.g. TSLA)"
              />
              <div className="odin-signals-range" role="group" aria-label="Date range">
                {RANGE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    className={
                      'odin-signals-range__btn' +
                      (rangeKey === p.key ? ' odin-signals-range__btn--active' : '')
                    }
                    onClick={() => setRangeKey(p.key)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div> */}

          {/* {error ? <div className="odin-signals-page__error">{error}</div> : null}
          {loading ? <div className="odin-signals-page__loading">Loading…</div> : null}

          <div className="odin-signals-page__meta">
            {symbol} · {startDate} → {endDate} · {meta.rowCount} bars · {meta.signalCount} signals · MA200{' '}
            {meta.maPoints} pts
          </div> */}

          {/* <div className="odin-signals-legend" aria-label="Signal legend">
            {SIGNAL_LEGEND.map((s) => (
              <span key={s.code} className="odin-signals-legend__item">
                <span className="odin-signals-legend__swatch" style={{ background: s.color }} />
                {s.code}
              </span>
            ))}
            <span className="odin-signals-legend__item odin-signals-legend__item--line">
              <span className="odin-signals-legend__line" />
              MA200
            </span>
          </div> */}

          {/* <ChartPanel ref={chartRef} /> */}
        </main>
      </div>
    </div>
  );
}
