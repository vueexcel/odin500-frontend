import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createChart, PriceScaleMode } from 'lightweight-charts';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import TradingChartLoader from './TradingChartLoader.jsx';
import { fetchWithAuth, getAuthToken } from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { META_BY_KEY, TICKER_BY_KEY, MARKET_SERIES } from './marketSeriesRegistry.js';
import { TF_OPTIONS, tfRange, normalizeRows } from '../utils/marketCalculations.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';

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
  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef(new Map());
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
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

  useEffect(() => {
    const el = chartHostRef.current;
    if (!el) return;
    const isLight = chartTheme === 'light';
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 390,
      layout: {
        background: { color: isLight ? '#ffffff' : '#0b1220' },
        textColor: isLight ? '#475569' : '#94a3b8',
        attributionLogo: false
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.12)' },
        horzLines: { color: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.12)' }
      },
      rightPriceScale: {
        borderColor: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.25)',
        mode: PriceScaleMode.Normal
      },
      timeScale: {
        borderColor: isLight ? 'rgba(15, 23, 42, 0.12)' : 'rgba(148, 163, 184, 0.25)',
        rightOffset: 4,
        barSpacing: 8,
        fixLeftEdge: false,
        fixRightEdge: false,
        timeVisible: true
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
        mouseWheel: true,
        pinch: true
      }
    });
    chartRef.current = chart;
    seriesRefs.current = new Map();

    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !chartHostRef.current) return;
      chartRef.current.applyOptions({
        width: chartHostRef.current.clientWidth,
        height: chartHostRef.current.clientHeight || 390
      });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = new Map();
    };
  }, [chartTheme]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const fixed = axisMode === 'fixed10' ? 10 : axisMode === 'fixed20' ? 20 : null;
    const existing = seriesRefs.current;
    const nextKeys = new Set(activeKeys);

    for (const [k, seriesObj] of existing.entries()) {
      if (!nextKeys.has(k)) {
        chart.removeSeries(seriesObj);
        existing.delete(k);
      }
    }

    for (const k of activeKeys) {
      const meta = META_BY_KEY[k];
      if (!meta) continue;
      let s = existing.get(k);
      if (!s) {
        s = chart.addLineSeries({
          color: meta.color,
          lineWidth: 2,
          crosshairMarkerVisible: false,
          lastValueVisible: false,
          priceLineVisible: false
        });
        existing.set(k, s);
      }
      const rawPoints = (series[k] || [])
        .filter((p) => Number.isFinite(p?.t) && Number.isFinite(p?.v))
        .map((p) => ({ time: Math.floor(Number(p.t) / 1000), value: Number(p.v) }))
        .sort((a, b) => a.time - b.time);
      // lightweight-charts requires STRICT ascending time; keep last value for duplicate timestamps.
      const points = [];
      for (const pt of rawPoints) {
        const lastPt = points[points.length - 1];
        if (lastPt && lastPt.time === pt.time) {
          lastPt.value = pt.value;
        } else if (!lastPt || pt.time > lastPt.time) {
          points.push(pt);
        }
      }
      s.setData(points);
    }

    if (fixed != null) {
      const top = chart.addLineSeries({
        color: 'rgba(0,0,0,0)',
        lineWidth: 1,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false
      });
      const bot = chart.addLineSeries({
        color: 'rgba(0,0,0,0)',
        lineWidth: 1,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false
      });
      const nowSec = Math.floor(Date.now() / 1000);
      top.setData([{ time: nowSec, value: fixed }]);
      bot.setData([{ time: nowSec, value: -fixed }]);
      chart.timeScale().fitContent();
      chart.removeSeries(top);
      chart.removeSeries(bot);
    } else {
      chart.timeScale().fitContent();
    }
  }, [series, activeKeys, axisMode]);

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
        {loading ? (
          <div className="chart-viz-loading-wrap" style={{ minHeight: 390 }}>
            <TradingChartLoader label="Loading chart…" sublabel="Normalized performance" />
          </div>
        ) : (
          <div
            ref={chartHostRef}
            className="np-chart np-chart--interactive"
            role="img"
            aria-label="Normalized performance chart. Drag to pan, wheel or pinch to zoom."
          />
        )}
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

