import { useEffect, useMemo, useState } from 'react';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { fetchWithAuth, getAuthToken } from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { META_BY_KEY, TICKER_BY_KEY, MARKET_SERIES } from './marketSeriesRegistry.js';
import { TF_OPTIONS, tfRange, normalizeRows } from '../utils/marketCalculations.js';

function linePath(points, x0, y0, w, h, minY, maxY, minT, maxT) {
  if (!points.length) return '';
  const dx = Math.max(1, maxT - minT);
  const pt = (p) => {
    const x = x0 + ((p.t - minT) / dx) * w;
    const y = y0 + ((maxY - p.v) / (maxY - minY)) * h;
    return [x, y];
  };
  const [sx, sy] = pt(points[0]);
  let d = `M ${sx} ${sy}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = pt(points[i]);
    d += ` L ${x} ${y}`;
  }
  return d;
}

function fmtPct(v) {
  const n = Number(v || 0);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function NormalizedPerformanceCard({
  selectedKeys,
  onSelectedKeysChange,
  timeframe,
  onTimeframeChange,
  axisMode = 'auto',
  refreshMs = 0,
  loadSeriesRows = null
}) {
  const [tfLocal, setTfLocal] = useState('6M');
  const [activeKeysLocal, setActiveKeysLocal] = useState(['INDU', 'SPX', 'NDX', 'XLK']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [series, setSeries] = useState({});
  const tf = timeframe || tfLocal;
  const setTf = onTimeframeChange || setTfLocal;
  const activeKeys = Array.isArray(selectedKeys) ? selectedKeys : activeKeysLocal;
  const setActiveKeys = onSelectedKeysChange || setActiveKeysLocal;

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setError('Sign in to load performance data.');
      return () => {
        cancelled = true;
      };
    }
    if (!activeKeys.length) {
      setSeries({});
      return () => {
        cancelled = true;
      };
    }

    const { start, end } = tfRange(tf);
    async function load() {
      setLoading(true);
      setError('');
      try {
        const keysToLoad = activeKeys.filter((k) => TICKER_BY_KEY[k]);
        const results = await Promise.all(
          keysToLoad.map(async (k) => {
            const ticker = TICKER_BY_KEY[k];
            if (typeof loadSeriesRows === 'function') {
              const rows = await loadSeriesRows(ticker, start, end);
              return [k, normalizeRows(rows)];
            }
            const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker, start_date: start, end_date: end })
            });
            const payload = await res.json();
            if (!res.ok || !payload?.success) {
              throw new Error(payload?.error || `Failed loading ${k}`);
            }
            return [k, normalizeRows(payload.data)];
          })
        );
        if (cancelled) return;
        setSeries(Object.fromEntries(results));
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed loading chart.');
          setSeries({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    let timer = null;
    if (refreshMs > 0) timer = window.setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [tf, activeKeys, refreshMs, loadSeriesRows]);

  const allPts = useMemo(() => {
    const vals = [];
    for (const k of activeKeys) {
      for (const p of series[k] || []) vals.push(p);
    }
    return vals;
  }, [activeKeys, series]);

  const last = useMemo(() => {
    const out = {};
    for (const k of activeKeys) {
      const arr = series[k] || [];
      out[k] = arr.length ? arr[arr.length - 1].v : 0;
    }
    return out;
  }, [activeKeys, series]);

  const yDomain = useMemo(() => {
    if (axisMode === 'fixed10') return { min: -10, max: 10 };
    if (axisMode === 'fixed20') return { min: -20, max: 20 };
    if (!allPts.length) return { min: -10, max: 10 };
    const lo = Math.min(...allPts.map((p) => p.v), 0);
    const hi = Math.max(...allPts.map((p) => p.v), 0);
    const pad = Math.max((hi - lo) * 0.15, 1.5);
    const min = Math.floor((lo - pad) / 5) * 5;
    const max = Math.ceil((hi + pad) / 5) * 5;
    return { min, max: Math.max(min + 5, max) };
  }, [allPts, axisMode]);

  const xDomain = useMemo(() => {
    if (!allPts.length) {
      const now = Date.now();
      return { min: now - 1000 * 60 * 60 * 24 * 180, max: now };
    }
    return {
      min: Math.min(...allPts.map((p) => p.t)),
      max: Math.max(...allPts.map((p) => p.t))
    };
  }, [allPts]);

  const minY = yDomain.min;
  const maxY = yDomain.max;
  const chart = { x: 44, y: 24, w: 720, h: 390 };
  const yStep = Math.max(1, Math.ceil((maxY - minY) / 6 / 5) * 5);
  const yTicks = [];
  for (let t = Math.ceil(minY / yStep) * yStep; t <= maxY + 1e-9; t += yStep) yTicks.push(Math.round(t * 100) / 100);

  const xTicks = useMemo(() => {
    const out = [];
    const n = 6;
    const span = Math.max(1, xDomain.max - xDomain.min);
    for (let i = 0; i < n; i++) {
      const p = i / (n - 1);
      const t = xDomain.min + span * p;
      const d = new Date(t);
      out.push([d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), p]);
    }
    return out;
  }, [xDomain]);

  return (
    <section className="np-card" aria-label="Normalized performance">
      <header className="np-card__head">
        <h2 className="np-card__title">
          Normalized Performance <ChartInfoTip tip={CHART_INFO_TIPS.normalizedPerformance} align="start" />
        </h2>
        <div className="np-card__head-actions">
          <button type="button" className="np-card__linkbtn">
            Export
          </button>
          <button type="button" className="np-card__iconbtn" aria-label="Open in new">
            ↗
          </button>
        </div>
      </header>

      <div className="np-card__tf-row">
        {TF_OPTIONS.map((id) => (
          <button
            key={id}
            type="button"
            className={'np-card__tf' + (tf === id ? ' np-card__tf--active' : '')}
            onClick={() => setTf(id)}
          >
            {id}
          </button>
        ))}
      </div>

      <div className="np-card__chips">
        {activeKeys.map((k) => {
          const s = META_BY_KEY[k];
          if (!s) return null;
          return (
          <div key={s.key} className="np-card__chip">
            <span className="np-card__chip-bar" style={{ background: s.color }} />
            {s.label}
            <button
              type="button"
              className="np-card__chip-x"
              aria-label={`Remove ${s.label}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setActiveKeys((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x !== s.key)));
              }}
            >
              ×
            </button>
          </div>
          );
        })}
      </div>

      <div className="np-chart-wrap">
        {loading ? <div className="np-card__status">Loading normalized performance…</div> : null}
        {error ? <div className="np-card__status np-card__status--error">{error}</div> : null}
        <svg className="np-chart" viewBox="0 0 820 470" preserveAspectRatio="none" role="img" aria-label="Normalized performance chart">
          <rect x={0} y={0} width={820} height={470} className="np-chart__bg" />
          {yTicks.map((t) => {
            const y = chart.y + ((maxY - t) / (maxY - minY)) * chart.h;
            return (
              <g key={t}>
                <line x1={chart.x} x2={chart.x + chart.w} y1={y} y2={y} className="np-chart__grid" />
                <text x={chart.x + chart.w + 10} y={y + 4} className="np-chart__ytext">
                  {t.toFixed(2)}%
                </text>
              </g>
            );
          })}
          {xTicks.map(([lbl, p]) => {
            const x = chart.x + chart.w * p;
            return (
              <g key={lbl}>
                <line x1={x} x2={x} y1={chart.y} y2={chart.y + chart.h} className="np-chart__grid np-chart__grid--v" />
                <text x={x} y={chart.y + chart.h + 24} className="np-chart__xtext">
                  {lbl}
                </text>
              </g>
            );
          })}
          <line
            x1={chart.x}
            x2={chart.x + chart.w}
            y1={chart.y + ((maxY - 0) / (maxY - minY)) * chart.h}
            y2={chart.y + ((maxY - 0) / (maxY - minY)) * chart.h}
            className="np-chart__zero"
          />
          {MARKET_SERIES.map((s) => (
            activeKeys.includes(s.key) ? (
              <path
                key={s.key}
                d={linePath(series[s.key] || [], chart.x, chart.y, chart.w, chart.h, minY, maxY, xDomain.min, xDomain.max)}
                stroke={s.color}
                className="np-chart__line"
              />
            ) : null
          ))}
        </svg>
        <div className="np-chart-badges">
          {activeKeys.map((k) => {
            const s = META_BY_KEY[k];
            if (!s) return null;
            return (
            <div key={s.key} className="np-chart-badge" style={{ background: s.badge }}>
              <strong>{s.key}</strong>&nbsp;&nbsp;{fmtPct(last[s.key])}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

