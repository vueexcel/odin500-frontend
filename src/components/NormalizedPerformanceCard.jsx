import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Upload } from 'lucide-react';
import { createChart, PriceScaleMode } from 'lightweight-charts';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import TradingChartLoader from './TradingChartLoader.jsx';
import {fetchWithAuth, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { DEFAULT_SELECTED_KEYS, META_BY_KEY, TICKER_BY_KEY } from './marketSeriesRegistry.js';
import { TF_OPTIONS, tfRange, normalizeRows } from '../utils/marketCalculations.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { ChartFullscreenToggleIcon } from './ChartFullscreenToggleIcon.jsx';
import { ChartSnapshotExportModal } from './ChartSnapshotExportModal.jsx';
import { useChartSnapshotExport } from '../hooks/useChartSnapshotExport.js';
import { notifyChartFullscreenLayout } from '../utils/chartFullscreenLayout.js';

function fmtPct(v) {
  const n = Number(v || 0);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function getNpChartBgColor(isLight) {
  if (isLight) return '#ffffff';
  if (typeof window === 'undefined') return 'rgba(255, 255, 255, 0.03)';
  const cssVar = getComputedStyle(document.documentElement)
    .getPropertyValue('--colors-opacity-bg-opacity-3')
    .trim();
  return cssVar || 'rgba(255, 255, 255, 0.03)';
}

/** Readable text on solid hex fill (axis badges). */
function textColorOnHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  if (!m) return '#ffffff';
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.55 ? '#0f172a' : '#ffffff';
}

/** Keep stacked badges readable when Y levels are close (TradingView-style). */
function layoutBadgeTopsPx(keys, getRawY, containerHeight, minGap = 22, pad = 10) {
  const h = Number(containerHeight);
  if (!Number.isFinite(h) || h <= 0) return {};
  let items = keys
    .map((key) => {
      const raw = getRawY(key);
      const y = raw == null ? null : Number(raw);
      return { key, y: Number.isFinite(y) ? y : null };
    })
    .filter((x) => x.y != null);
  items.sort((a, b) => a.y - b.y);
  for (let i = 1; i < items.length; i++) {
    const prevTop = items[i - 1].y + minGap;
    if (items[i].y < prevTop) items[i].y = prevTop;
  }
  for (let i = items.length - 2; i >= 0; i--) {
    const nextTop = items[i + 1].y - minGap;
    if (items[i].y > nextTop) items[i].y = nextTop;
  }
  const out = {};
  for (const it of items) {
    const clamped = Math.min(Math.max(it.y, pad), h - pad);
    out[it.key] = clamped;
  }
  return out;
}

const DEFAULT_NP_TIMEFRAME = '6M';

/**
 * html2canvas onclone: export-friendly layout + axis badge position fix.
 * html2canvas walks the cloned DOM and paints to a canvas; it often mis-measures
 * flex + bold text + tight line-heights, so glyphs look vertically clipped. We inject
 * looser line-heights / padding only on the clone (live UI unchanged) and avoid
 * translateY(-50%) by converting "center Y" to a top edge using measured height.
 */
function applyNpSnapshotCloneFixes(clonedDoc, clonedRoot) {
  if (!(clonedRoot instanceof HTMLElement)) return;

  const snapStyle = clonedDoc.createElement('style');
  snapStyle.setAttribute('data-np-export-snapshot', '1');
  snapStyle.textContent = `
    .np-card__head { display: none !important; }
    .np-card__chip-x { display: none !important; }
    .np-card__chip {
      overflow: visible !important;
      min-height: 44px !important;
    }
    .np-card__chip-main {
      flex: 0 1 auto !important;
      min-height: 40px !important;
      min-width: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      padding: 10px 12px 8px !important;
      box-sizing: border-box !important;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
    }
    .np-card__chip-label {
      flex: 0 1 auto !important;
      min-width: 0 !important;
      line-height: 1.5 !important;
      overflow: visible !important;
      text-overflow: clip !important;
      white-space: nowrap !important;
      display: flex !important;
      align-items: center !important;
      padding: 2px 0 6px 0 !important;
      -webkit-font-smoothing: antialiased !important;
    }
    .np-chart-axis-badge {
      display: flex !important;
      align-items: center !important;
      line-height: 1.45 !important;
      padding: 11px 12px 11px 15px !important;
      box-sizing: border-box !important;
      -webkit-font-smoothing: antialiased !important;
    }
    .np-chart-axis-badge__body {
      display: flex !important;
      align-items: center !important;
      align-self: center !important;
      line-height: 1.45 !important;
      overflow: visible !important;
      min-height: 1.45em !important;
    }
    .np-chart-axis-badge__sym,
    .np-chart-axis-badge__val {
      line-height: 1.45 !important;
      padding: 3px 0 !important;
    }
  `;
  clonedDoc.head.appendChild(snapStyle);

  void clonedRoot.offsetHeight;

  clonedRoot.querySelectorAll('.np-chart-axis-badge').forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const op = clonedDoc.defaultView?.getComputedStyle(node).opacity ?? '1';
    if (parseFloat(op) < 0.01) {
      node.remove();
      return;
    }
    const topStr = node.style.top;
    const centerY = parseFloat(topStr);
    if (Number.isFinite(centerY) && centerY > -9000) {
      node.dataset.npCenterY = String(centerY);
    }
  });

  const placeBadges = () => {
    clonedRoot.querySelectorAll('.np-chart-axis-badge').forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const centerStr = node.dataset.npCenterY;
      const centerY = centerStr != null ? parseFloat(centerStr) : NaN;
      if (!Number.isFinite(centerY)) return;
      void node.offsetHeight;
      const h = node.offsetHeight;
      if (!(h > 0)) return;
      node.style.setProperty('transform', 'none', 'important');
      node.style.setProperty('top', `${Math.round(centerY - h / 2)}px`, 'important');
    });
  };

  placeBadges();
  void clonedRoot.offsetHeight;
  placeBadges();
}

async function dataUrlToPngFile(dataUrl, filename) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: 'image/png' });
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
  const [tfLocal, setTfLocal] = useState(DEFAULT_NP_TIMEFRAME);
  const [activeKeysLocal, setActiveKeysLocal] = useState(() => [...DEFAULT_SELECTED_KEYS]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [series, setSeries] = useState({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportPageUrl, setExportPageUrl] = useState('');
  const [exportShareHint, setExportShareHint] = useState('');
  const cardRef = useRef(null);
  const snapshotExportRef = useRef(null);
  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRefs = useRef(new Map());
  const [axisBadgeTops, setAxisBadgeTops] = useState({});
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const tf = timeframe || tfLocal;
  const setTf = onTimeframeChange || setTfLocal;
  const activeKeys = Array.isArray(selectedKeys) ? selectedKeys : activeKeysLocal;
  const setActiveKeys = onSelectedKeysChange || setActiveKeysLocal;

  const buildNpExportFilename = useCallback(() => {
    const datePart = new Date().toISOString().slice(0, 10);
    const tfPart = String(tf || 'range').toLowerCase();
    return `normalized-performance-${tfPart}-${datePart}.png`;
  }, [tf]);

  const {
    exportingSnapshot,
    exportModalOpen,
    exportModalStatus,
    exportPreviewUrl,
    exportFilename,
    exportModalError,
    openExportModal,
    closeExportModal,
    downloadFromExportModal
  } = useChartSnapshotExport({
    snapshotRootRef: snapshotExportRef,
    plotHostRef: chartHostRef,
    buildFilename: buildNpExportFilename,
    disabled: loading,
    getBackgroundColor: getNpChartBgColor,
    getFallbackCanvas: () => {
      const chart = chartRef.current;
      if (chart && typeof chart.takeScreenshot === 'function') {
        try {
          return chart.takeScreenshot();
        } catch {
          return null;
        }
      }
      return null;
    },
    onclone: applyNpSnapshotCloneFixes
  });

  useEffect(() => {
    let cancelled = false;
    if (!canFetchProtectedApi()) {
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

  const lastRef = useRef(last);
  lastRef.current = last;
  const activeKeysRef = useRef(activeKeys);
  activeKeysRef.current = activeKeys;

  const updateAxisBadgePositions = useCallback(() => {
    const chart = chartRef.current;
    const host = chartHostRef.current;
    if (!chart || !host) return;
    const keys = activeKeysRef.current;
    const lastVals = lastRef.current;
    const height = host.clientHeight;
    const getRawY = (key) => {
      const line = seriesRefs.current.get(key);
      const val = lastVals[key];
      if (!line || !Number.isFinite(val)) return null;
      const y = line.priceToCoordinate(val);
      return y == null ? null : Number(y);
    };
    setAxisBadgeTops(layoutBadgeTopsPx(keys, getRawY, height));
  }, []);

  useLayoutEffect(() => {
    if (loading) return;
    const chart = chartRef.current;
    const host = chartHostRef.current;
    if (!chart || !host) return;

    const run = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => updateAxisBadgePositions());
      });
    };

    run();
    const ro = new ResizeObserver(() => run());
    ro.observe(host);

    const ts = chart.timeScale();
    const onRange = () => run();
    ts.subscribeVisibleLogicalRangeChange(onRange);
    ts.subscribeVisibleTimeRangeChange(onRange);

    return () => {
      ro.disconnect();
      ts.unsubscribeVisibleLogicalRangeChange(onRange);
      ts.unsubscribeVisibleTimeRangeChange(onRange);
    };
  }, [loading, updateAxisBadgePositions, chartTheme]);

  useEffect(() => {
    if (loading) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateAxisBadgePositions());
    });
  }, [loading, series, activeKeys, last, axisMode, updateAxisBadgePositions]);

  useEffect(() => {
    if (loading) return;
    const el = chartHostRef.current;
    if (!el) return;
    const isLight = chartTheme === 'light';
    const npChartBg = getNpChartBgColor(isLight);
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight || 390,
      layout: {
        background: { color: npChartBg },
        textColor: isLight ? '#475569' : '#94a3b8',
        attributionLogo: false
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.08)' },
        horzLines: { color: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(148, 163, 184, 0.08)' }
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

    requestAnimationFrame(() => {
      if (!chartRef.current || !chartHostRef.current) return;
      chartRef.current.applyOptions({
        width: chartHostRef.current.clientWidth,
        height: chartHostRef.current.clientHeight || 390
      });
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRefs.current = new Map();
    };
  }, [chartTheme, loading]);

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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateAxisBadgePositions());
    });
  }, [series, activeKeys, axisMode, loading, chartTheme, updateAxisBadgePositions]);

  const handleResetView = useCallback(() => {
    setActiveKeys([...DEFAULT_SELECTED_KEYS]);
    setTf(DEFAULT_NP_TIMEFRAME);
    const chart = chartRef.current;
    if (chart) {
      try {
        chart.timeScale().fitContent();
        chart.priceScale('right').applyOptions({ autoScale: true });
      } catch {
        /* ignore */
      }
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => updateAxisBadgePositions());
    });
  }, [setActiveKeys, setTf, updateAxisBadgePositions]);

  const toggleFullscreen = useCallback(async () => {
    const el = cardRef.current;
    if (!el) return;
    /** @type {Document & { webkitFullscreenElement?: Element | null, webkitExitFullscreen?: () => Promise<void> | void }} */
    const d = document;
    const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement;
    try {
      if (fsEl === el) {
        if (d.exitFullscreen) await d.exitFullscreen();
        else d.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        /** @type {{ webkitRequestFullscreen?: () => Promise<void> | void }} */
        (el).webkitRequestFullscreen?.();
      }
    } catch {
      // Ignore user gesture/fullscreen API failures.
    }
    notifyChartFullscreenLayout();
  }, []);

  const handleOpenExportModal = useCallback(() => {
    setExportPageUrl(typeof window !== 'undefined' ? window.location.href : '');
    setExportShareHint('');
    openExportModal();
  }, [openExportModal]);

  const exportShareText = useMemo(
    () => `Normalized performance chart (${tf}) — Odin500`,
    [tf]
  );

  const openShareUrl = useCallback((url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  const shareTwitter = useCallback(() => {
    const u = new URL('https://twitter.com/intent/tweet');
    u.searchParams.set('text', exportShareText);
    if (exportPageUrl) u.searchParams.set('url', exportPageUrl);
    openShareUrl(u.toString());
  }, [exportShareText, exportPageUrl, openShareUrl]);

  const shareFacebook = useCallback(() => {
    if (!exportPageUrl) return;
    const u = new URL('https://www.facebook.com/sharer/sharer.php');
    u.searchParams.set('u', exportPageUrl);
    openShareUrl(u.toString());
  }, [exportPageUrl, openShareUrl]);

  const shareLinkedIn = useCallback(() => {
    if (!exportPageUrl) return;
    const u = new URL('https://www.linkedin.com/sharing/share-offsite/');
    u.searchParams.set('url', exportPageUrl);
    openShareUrl(u.toString());
  }, [exportPageUrl, openShareUrl]);

  const shareReddit = useCallback(() => {
    if (!exportPageUrl) return;
    const u = new URL('https://www.reddit.com/submit');
    u.searchParams.set('url', exportPageUrl);
    u.searchParams.set('title', exportShareText);
    openShareUrl(u.toString());
  }, [exportPageUrl, exportShareText, openShareUrl]);

  const copyPageLink = useCallback(async () => {
    if (!exportPageUrl) return;
    try {
      await navigator.clipboard.writeText(exportPageUrl);
      setExportShareHint('Link copied to clipboard.');
    } catch {
      setExportShareHint('Could not copy link.');
    }
  }, [exportPageUrl]);

  const copyChartImage = useCallback(async () => {
    if (!exportPreviewUrl || !exportFilename) return;
    try {
      if (!navigator.clipboard?.write) {
        setExportShareHint('Image copy is not supported in this browser.');
        return;
      }
      const file = await dataUrlToPngFile(exportPreviewUrl, exportFilename);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]);
      setExportShareHint('Image copied. Paste it into a message or document.');
    } catch {
      setExportShareHint('Could not copy image. Use Download instead.');
    }
  }, [exportPreviewUrl, exportFilename]);

  const nativeShareImage = useCallback(async () => {
    if (!exportPreviewUrl || !exportFilename) return;
    try {
      const file = await dataUrlToPngFile(exportPreviewUrl, exportFilename);
      const shareData = { files: [file], title: 'Normalized performance', text: exportShareText };
      if (!navigator.share) {
        setExportShareHint('System share is not available in this browser.');
        return;
      }
      if (typeof navigator.canShare === 'function' && !navigator.canShare(shareData)) {
        setExportShareHint('Sharing this image is not supported here. Try Copy image or Download.');
        return;
      }
      await navigator.share(shareData);
      setExportShareHint('');
    } catch (e) {
      if (e && /** @type {{ name?: string }} */ (e).name === 'AbortError') return;
      setExportShareHint('Share was cancelled or failed.');
    }
  }, [exportPreviewUrl, exportFilename, exportShareText]);

  useEffect(() => {
    const onFsChange = () => {
      const el = cardRef.current;
      /** @type {Document & { webkitFullscreenElement?: Element | null }} */
      const d = document;
      const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement;
      setIsFullscreen(Boolean(el && fsEl === el));
      notifyChartFullscreenLayout();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    onFsChange();
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, []);

  const assignCardRefs = useCallback((node) => {
    cardRef.current = node;
    snapshotExportRef.current = node;
  }, []);

  return (
    <>
      <section ref={assignCardRefs} className="np-card" aria-label="Normalized performance">
      <header className="np-card__head">
        <h2 className="np-card__title">
          Normalized Performance <ChartInfoTip tip={CHART_INFO_TIPS.normalizedPerformance} align="start" />
        </h2>
        <div className="np-card__head-actions">
          <button
            type="button"
            className="np-card__iconbtn"
            onClick={handleOpenExportModal}
            disabled={loading || exportingSnapshot}
            aria-label={exportingSnapshot ? 'Exporting chart' : 'Export chart snapshot'}
            title={exportingSnapshot ? 'Exporting…' : 'Export chart'}
          >
            <Upload size={16} strokeWidth={2} aria-hidden />
          </button>
          <button
            type="button"
            className="np-card__iconbtn"
            aria-label={isFullscreen ? 'Exit chart fullscreen' : 'Enter chart fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onClick={toggleFullscreen}
          >
            <ChartFullscreenToggleIcon isFullscreen={isFullscreen} />
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

        <div className="np-card__chips-row">
          <div className="np-card__chips">
            {activeKeys.map((k) => {
              const s = META_BY_KEY[k];
              if (!s) return null;
              return (
                <div key={s.key} className="np-card__chip">
                  <div className="np-card__chip-main">
                    <span className="np-card__chip-label">{s.label}</span>
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
                  <span className="np-card__chip-bar" style={{ background: s.color }} aria-hidden />
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="np-card__reset"
            onClick={handleResetView}
            disabled={loading}
            title="Restore default series, 6M range, and chart zoom"
            aria-label="Reset chart to default series, timeframe, and zoom"
          >
            Reset
          </button>
        </div>

        <div className="np-chart-wrap">
          {error ? <div className="np-card__status np-card__status--error">{error}</div> : null}
          {loading ? (
            <div className="chart-viz-loading-wrap" style={{ minHeight: 390 }}>
              <TradingChartLoader label="Loading chart…" sublabel="Normalized performance" />
            </div>
          ) : (
            <div className="np-chart-stack">
              <div
                ref={chartHostRef}
                className="np-chart np-chart--interactive"
                role="img"
                aria-label="Normalized performance chart. Drag to pan, wheel or pinch to zoom."
              />
              <div className="np-chart-axis-tags" aria-hidden="true">
                {activeKeys.map((k) => {
                  const s = META_BY_KEY[k];
                  if (!s) return null;
                  const top = axisBadgeTops[k];
                  const bg = s.color;
                  const fg = textColorOnHex(bg);
                  return (
                    <div
                      key={s.key}
                      className="np-chart-axis-badge"
                      style={{
                        top: top == null ? -9999 : top,
                        opacity: top == null ? 0 : 1,
                        background: bg,
                        color: fg
                      }}
                    >
                      <span className="np-chart-axis-badge__tick" style={{ borderRightColor: bg }} />
                      <div className="np-chart-axis-badge__body">
                        <span className="np-chart-axis-badge__sym">{s.key}</span>
                        <span className="np-chart-axis-badge__val">{fmtPct(last[s.key])}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
    </section>

      <ChartSnapshotExportModal
        open={exportModalOpen}
        status={exportModalStatus}
        error={exportModalError}
        previewUrl={exportPreviewUrl}
        onClose={closeExportModal}
        onDownload={downloadFromExportModal}
        titleId="np-export-modal-title"
        previewAlt="Exported normalized performance chart"
      />
    </>
  );
}

