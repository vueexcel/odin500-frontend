import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Filter, Hexagon, Settings, Upload, Users } from 'lucide-react';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import TradingChartLoader from '../components/TradingChartLoader.jsx';

/** `apiIndex` matches POST /api/market/ticker-details `index` field (Supabase / BigQuery). */
const INDEX_MENU = [
  { id: 'sp500', apiIndex: 'SP500', label: 'S&P 500 (US Core)' },
  { id: 'dow', apiIndex: 'Dow Jones', label: 'Dow Jones Industrial Average (US)' },
  { id: 'nasdaq', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100 (US Growth)' }
];

/** Leaderboard tables show only this many rows (best gainers / worst losers by 1D %). Full index still loads for the scatter. */
const LEADERBOARD_TOP_N = 20;

/** Return windows — `apiPeriod` is sent to POST /api/market/index-market-movers as `period`. */
const MARKET_MOVERS_INTERVALS = [
  { id: '1d', apiPeriod: 'last-date', label: '1D', chartHeadline: '1-Day Performance vs Relative Volume', axisReturnTitle: '1 Day Return', tooltipReturnLabel: '1D return' },
  { id: '5d', apiPeriod: 'last-5-days', label: '5D', chartHeadline: '5-Day Performance vs Relative Volume', axisReturnTitle: '5 Day Return', tooltipReturnLabel: '5D return' },
  { id: 'mtd', apiPeriod: 'mtd', label: 'MTD', chartHeadline: 'Month-to-Date Performance vs Relative Volume', axisReturnTitle: 'MTD Return', tooltipReturnLabel: 'MTD return' },
  { id: '1m', apiPeriod: 'last-month', label: '1M', chartHeadline: '1-Month Performance vs Relative Volume', axisReturnTitle: '1 Month Return', tooltipReturnLabel: '1M return' },
  { id: 'qtd', apiPeriod: 'qtd', label: 'QTD', chartHeadline: 'Quarter-to-Date Performance vs Relative Volume', axisReturnTitle: 'QTD Return', tooltipReturnLabel: 'QTD return' },
  { id: '3m', apiPeriod: 'last-3-months', label: '3M', chartHeadline: '3-Month Performance vs Relative Volume', axisReturnTitle: '3 Month Return', tooltipReturnLabel: '3M return' },
  { id: '6m', apiPeriod: 'last-6-months', label: '6M', chartHeadline: '6-Month Performance vs Relative Volume', axisReturnTitle: '6 Month Return', tooltipReturnLabel: '6M return' },
  { id: 'ytd', apiPeriod: 'ytd', label: 'YTD', chartHeadline: 'Year-to-Date Performance vs Relative Volume', axisReturnTitle: 'YTD Return', tooltipReturnLabel: 'YTD return' },
  { id: '1y', apiPeriod: 'last-1-year', label: '1Y', chartHeadline: '1-Year Performance vs Relative Volume', axisReturnTitle: '1 Year Return', tooltipReturnLabel: '1Y return' },
  { id: '3y', apiPeriod: 'last-3-years', label: '3Y', chartHeadline: '3-Year Performance vs Relative Volume', axisReturnTitle: '3 Year Return', tooltipReturnLabel: '3Y return' },
  { id: '5y', apiPeriod: 'last-5-years', label: '5Y', chartHeadline: '5-Year Performance vs Relative Volume', axisReturnTitle: '5 Year Return', tooltipReturnLabel: '5Y return' },
  { id: '10y', apiPeriod: 'last-10-years', label: '10Y', chartHeadline: '10-Year Performance vs Relative Volume', axisReturnTitle: '10 Year Return', tooltipReturnLabel: '10Y return' },
  { id: '20y', apiPeriod: 'last-20-years', label: '20Y', chartHeadline: '20-Year Performance vs Relative Volume', axisReturnTitle: '20 Year Return', tooltipReturnLabel: '20Y return' },
  { id: 'all', apiPeriod: 'all-available', label: 'ALL', chartHeadline: 'Full History Performance vs Relative Volume', axisReturnTitle: 'Full Period Return', tooltipReturnLabel: 'Period return' }
];

/** Wide landscape plot: X = relative volume (horizontal). */
const CHART_W = 1180;
const CHART_H = 340;
const PAD = { left: 56, right: 28, top: 32, bottom: 48 };

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/** Stable 0–1 hash for jitter (deterministic per symbol). */
function hashToUnit(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (Math.abs(h) % 10007) / 10007;
}

function normSector(s) {
  return String(s || '').trim();
}

function parsePct(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Trading-style step (1 / 2 / 2.5 / 5 × 10^n) so default views match design grids (e.g. 5% majors). */
function niceStepForSpan(span, targetDivisions = 8) {
  if (!Number.isFinite(span) || span <= 0) return 1;
  const raw = span / targetDivisions;
  const exp = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exp);
  for (const f of [1, 2, 2.5, 5, 10]) {
    const step = f * base;
    if (span / step <= targetDivisions + 1) return step;
  }
  return 10 * Math.pow(10, exp);
}

function buildNicePercentTicks(min, max, targetDivisions = 8) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const span = max - min;
  const step = niceStepForSpan(span, targetDivisions);
  const ticks = [];
  const start = Math.ceil(min / step - 1e-12) * step;
  for (let t = start; t <= max + step * 1e-9; t += step) {
    ticks.push(Math.round(t * 1e9) / 1e9);
  }
  return ticks;
}

/** When the window crosses 0% but the nice grid misses it, insert a zero line. */
function mergeZeroPercentTick(ticks, yMin, yMax) {
  if (yMin >= 0 || yMax <= 0) return ticks;
  const sorted = [...ticks].sort((a, b) => a - b);
  const step =
    sorted.length >= 2
      ? Math.min(...sorted.slice(1).map((t, i) => Math.abs(t - sorted[i])))
      : Math.max((yMax - yMin) / 8, 1e-6);
  if (sorted.some((t) => Math.abs(t) < step * 0.15)) return sorted;
  return [...sorted, 0].sort((a, b) => a - b);
}

/** Prefer ~0.2× majors when zoomed out (Figma); finer steps when zoomed in. */
function niceVolumeStep(span, maxLines = 14) {
  if (!Number.isFinite(span) || span <= 0) return 0.1;
  const minStep = span / maxLines;
  const candidates = [5, 2, 1, 0.5, 0.25, 0.2, 0.1, 0.05, 0.025, 0.02, 0.01, 0.005, 0.0025];
  for (const c of candidates) {
    if (c >= minStep * 0.999) return c;
  }
  return minStep;
}

function buildVolumeTicks(xMin, xMax, maxLines = 14) {
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax <= xMin) return [xMin];
  const span = xMax - xMin;
  const step = niceVolumeStep(span, maxLines);
  const ticks = [];
  const start = Math.ceil(xMin / step - 1e-12) * step;
  for (let t = start; t <= xMax + step * 1e-9; t += step) {
    ticks.push(Math.round(t * 10000) / 10000);
  }
  return ticks;
}

function formatVolumeTickLabel(t) {
  const rounded = Math.round(t * 10) / 10;
  return `${rounded.toFixed(1)}x`;
}

function formatPercentTickLabel(t) {
  return `${t.toFixed(2)}%`;
}

function formatLastPrice(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(2);
  if (abs >= 10) return v.toFixed(2);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

/** Signed dollar change (matches prior close implied by day %). */
function formatSignedChange(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = formatLastPrice(Math.abs(v));
  if (abs === '—') return '—';
  if (v > 0) return `+${abs}`;
  if (v < 0) return `-${abs}`;
  return abs;
}

function formatSignedPctCell(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  if (v > 0) return `+${v.toFixed(2)}%`;
  return `${v.toFixed(2)}%`;
}

function numOrNull(v) {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function MarketMoversLeaderTables({ points }) {
  const { gainers, losers, gainersTotal, losersTotal } = useMemo(() => {
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
    return {
      gainers: g.slice(0, LEADERBOARD_TOP_N),
      losers: l.slice(0, LEADERBOARD_TOP_N),
      gainersTotal: g.length,
      losersTotal: l.length
    };
  }, [points]);

  const renderRow = (p, tone) => {
    const pct = parsePct(p.dayReturnPct);
    const chgClass =
      tone === 'gain'
        ? 'market-movers-page__move market-movers-page__move--gain'
        : 'market-movers-page__move market-movers-page__move--loss';
    const last = numOrNull(p.lastPrice);
    const dChg = numOrNull(p.priceChange);
    return (
      <tr key={p.symbol}>
        <td className="market-movers-page__td-ticker">
          <span className="market-movers-page__ticker-wrap" title={p.symbol}>
            <span className="market-movers-page__ticker-dot" aria-hidden />
            <span className="market-movers-page__ticker-sym">{p.symbol}</span>
          </span>
        </td>
        <td className="market-movers-page__td-name" title={p.companyName || undefined}>
          {p.companyName || '—'}
        </td>
        <td className="market-movers-page__td-num">{formatLastPrice(last)}</td>
        <td className={`market-movers-page__td-num ${chgClass}`}>{formatSignedChange(dChg)}</td>
        <td className={`market-movers-page__td-num ${chgClass}`}>{formatSignedPctCell(pct)}</td>
      </tr>
    );
  };

  return (
    <div className="market-movers-page__leaders">
      <div className="market-movers-page__leaders-shell">
      <div className="market-movers-page__leaders-head">
        {losersTotal === 0 && gainersTotal > 0 ? (
          <div className="market-movers-page__leaders-head-seg market-movers-page__leaders-head-seg--gainers market-movers-page__leaders-head-seg--solo">
            Gainers ({gainersTotal})
          </div>
        ) : gainersTotal === 0 && losersTotal > 0 ? (
          <div class="markitLosershead">
          <div className="market-movers-page__leaders-head-seg market-movers-page__leaders-head-seg--losers market-movers-page__leaders-head-seg--solo">
            
          </div>
          <p>Losers ({losersTotal})</p>
          </div>
        ) : gainersTotal === 0 && losersTotal === 0 ? (
          <div className="market-movers-page__leaders-head-seg market-movers-page__leaders-head-seg--gainers market-movers-page__leaders-head-seg--solo">
            Gainers (0)
          </div>
        ) : (
          <>
            <div
              className="market-movers-page__leaders-head-seg market-movers-page__leaders-head-seg--gainers"
              style={{ flex: `${gainersTotal} 1 0%` }}
            >
              Gainers ({gainersTotal})
            </div>
            <div
              className="market-movers-page__leaders-head-seg market-movers-page__leaders-head-seg--losers"
              style={{ flex: `${losersTotal} 1 0%` }}
            >
              Losers ({losersTotal})
            </div>
          </>
        )}
      </div>
      <div className="market-movers-page__leaders-grid">
        <div className="market-movers-page__leaders-pane market-movers-page__leaders-pane--left">
          <div
            className="market-movers-page__leaders-scroll"
            role="region"
            aria-label={`Top ${LEADERBOARD_TOP_N} gainers by one-day percent of ${gainersTotal} advancing`}
          >
            <table className="market-movers-page__data-table">
              <colgroup>
                <col className="market-movers-page__col-w-ticker" />
                <col className="market-movers-page__col-w-name" />
                <col className="market-movers-page__col-w-num" />
                <col className="market-movers-page__col-w-num" />
                <col className="market-movers-page__col-w-num" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" class="alignone">Ticker</th>
                  <th scope="col" class="alignone">Name</th>
                  <th scope="col" className="market-movers-page__th-num">
                    Last
                  </th>
                  <th scope="col" className="market-movers-page__th-num">
                    Chg
                  </th>
                  <th scope="col" className="market-movers-page__th-num">
                    Chg %
                  </th>
                </tr>
              </thead>
              <tbody>
                {gainersTotal === 0 ? (
                  <tr>
                    <td colSpan={5} className="market-movers-page__td-empty">
                      No gainers in this view
                    </td>
                  </tr>
                ) : (
                  gainers.map((p) => renderRow(p, 'gain'))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="market-movers-page__leaders-pane market-movers-page__leaders-pane--right">
          <div
            className="market-movers-page__leaders-scroll"
            role="region"
            aria-label={`Top ${LEADERBOARD_TOP_N} losers by one-day percent of ${losersTotal} declining`}
          >
            <table className="market-movers-page__data-table">
              <colgroup>
                <col className="market-movers-page__col-w-ticker" />
                <col className="market-movers-page__col-w-name" />
                <col className="market-movers-page__col-w-num" />
                <col className="market-movers-page__col-w-num" />
                <col className="market-movers-page__col-w-num" />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col" class="alignone">Ticker</th>
                  <th scope="col" class="alignone">Name</th>
                  <th scope="col" className="market-movers-page__th-num">
                    Last
                  </th>
                  <th scope="col" className="market-movers-page__th-num">
                    Chg
                  </th>
                  <th scope="col" className="market-movers-page__th-num">
                    Chg %
                  </th>
                </tr>
              </thead>
              <tbody>
                {losersTotal === 0 ? (
                  <tr>
                    <td colSpan={5} className="market-movers-page__td-empty">
                      No losers in this view
                    </td>
                  </tr>
                ) : (
                  losers.map((p) => renderRow(p, 'loss'))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

/**
 * Map API points to plot coordinates: real rel-vol on X when available;
 * when volume is estimated (all 1×), spread along X deterministically so the chart reads horizontally.
 */
function augmentPlotPoints(points) {
  const estimatedSyms = points.filter((p) => p.relativeVolumeIsEstimated).map((p) => p.symbol);
  const sortedEst = [...new Set(estimatedSyms)].sort((a, b) =>
    String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
  );
  const rankMap = new Map(sortedEst.map((sym, i) => [sym, i]));
  const nEst = sortedEst.length;

  return points.map((p) => {
    const y = parsePct(p.dayReturnPct);
    if (y == null || !Number.isFinite(y)) {
      return { raw: p, plotX: null, plotY: null, xIsSpread: false };
    }
    if (!p.relativeVolumeIsEstimated && Number.isFinite(Number(p.relativeVolume10d))) {
      return {
        raw: p,
        plotX: Number(p.relativeVolume10d),
        plotY: y,
        xIsSpread: false
      };
    }
    const idx = rankMap.get(p.symbol) ?? 0;
    const t = nEst <= 1 ? 0.5 : idx / (nEst - 1);
    const spreadMin = 0.58;
    const spreadMax = 1.42;
    const jitter = (hashToUnit(p.symbol) - 0.5) * 0.08;
    const plotX = clamp(spreadMin + (spreadMax - spreadMin) * t + jitter, 0.45, 2.2);
    return { raw: p, plotX, plotY: y, xIsSpread: true };
  });
}

/** Absolute floors (fallback when fit span is tiny). */
const MIN_X_SPAN = 0.04;
const MIN_Y_SPAN = 0.35;

/** Vs full “fit” span: cannot zoom **in** tighter than this ratio (prevents infinite zoom-in). */
const ZOOM_MIN_SPAN_RATIO_X = 0.032;
const ZOOM_MIN_SPAN_RATIO_Y = 0.045;

/** Vs full “fit” span: cannot zoom **out** wider than this multiple (prevents infinite zoom-out). */
const ZOOM_MAX_SPAN_RATIO_X = 6;
const ZOOM_MAX_SPAN_RATIO_Y = 6;

const ZOOM_WHEEL_STEP = 1.1;

/** Wheel target is approached with this blend per animation frame (~smooth zoom). */
const ZOOM_ANIM_ALPHA = 0.22;

function clampViewToLimits(next, fitExt) {
  const fitXs = Math.max(fitExt.xMax - fitExt.xMin, 1e-9);
  const fitYs = Math.max(fitExt.yMax - fitExt.yMin, 1e-9);

  const minSpanX = Math.max(MIN_X_SPAN, fitXs * ZOOM_MIN_SPAN_RATIO_X);
  const maxSpanX = fitXs * ZOOM_MAX_SPAN_RATIO_X;
  const minSpanY = Math.max(MIN_Y_SPAN, fitYs * ZOOM_MIN_SPAN_RATIO_Y);
  const maxSpanY = fitYs * ZOOM_MAX_SPAN_RATIO_Y;

  let xMin = next.xMin;
  let xMax = next.xMax;
  let yMin = next.yMin;
  let yMax = next.yMax;

  let xs = xMax - xMin;
  let ys = yMax - yMin;

  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;

  xs = clamp(xs, minSpanX, maxSpanX);
  ys = clamp(ys, minSpanY, maxSpanY);
  xMin = cx - xs / 2;
  xMax = cx + xs / 2;
  yMin = cy - ys / 2;
  yMax = cy + ys / 2;

  xs = xMax - xMin;
  ys = yMax - yMin;

  const padX = Math.max(fitXs * 0.55, 0.25);
  const padY = Math.max(fitYs * 0.55, 2);

  xMin = clamp(xMin, fitExt.xMin - padX, fitExt.xMax + padX - xs);
  xMax = xMin + xs;
  yMin = clamp(yMin, fitExt.yMin - padY, fitExt.yMax + padY - ys);
  yMax = yMin + ys;

  return { xMin, xMax, yMin, yMax };
}

function lerpView(a, b, t) {
  return {
    xMin: a.xMin + (b.xMin - a.xMin) * t,
    xMax: a.xMax + (b.xMax - a.xMax) * t,
    yMin: a.yMin + (b.yMin - a.yMin) * t,
    yMax: a.yMax + (b.yMax - a.yMax) * t
  };
}

function viewExtentsClose(a, b, epsScale) {
  const e =
    Math.max(Math.abs(a.xMax - a.xMin), Math.abs(a.yMax - a.yMin), Math.abs(b.xMax - b.xMin), 1e-9) *
    epsScale;
  return (
    Math.abs(a.xMin - b.xMin) < e &&
    Math.abs(a.xMax - b.xMax) < e &&
    Math.abs(a.yMin - b.yMin) < e &&
    Math.abs(a.yMax - b.yMax) < e
  );
}

function MarketMoversScatter({ points, volumeNote, axisReturnTitle, tooltipReturnLabel }) {
  const plotClipIdRaw = useId().replace(/:/g, '');
  const plotClipId = `mm-plot-clip-${plotClipIdRaw}`;

  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  const plotAug = useMemo(() => augmentPlotPoints(points), [points]);

  const [tooltip, setTooltip] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const frameRef = useRef(null);
  const svgRef = useRef(null);
  const zoomWrapRef = useRef(null);
  const panRef = useRef(null);
  const zoomTargetRef = useRef(null);
  const zoomRafRef = useRef(null);

  const fitExt = useMemo(() => {
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const row of plotAug) {
      const x = row.plotX;
      const y = row.plotY;
      if (x == null || !Number.isFinite(x)) continue;
      if (y == null || !Number.isFinite(y)) continue;
      xMin = Math.min(xMin, x);
      xMax = Math.max(xMax, x);
      yMin = Math.min(yMin, y);
      yMax = Math.max(yMax, y);
    }
    if (!Number.isFinite(xMin)) {
      xMin = 0;
      xMax = 4;
    }
    if (!Number.isFinite(yMin)) {
      yMin = -10;
      yMax = 10;
    }
    let xSpan = xMax - xMin;
    let ySpan = yMax - yMin;
    if (xSpan < 1e-9) {
      xMin = Math.max(0, xMin - 0.35);
      xMax = xMax + 0.35;
      xSpan = xMax - xMin;
    }
    if (ySpan < 1e-9) {
      yMin -= 0.75;
      yMax += 0.75;
      ySpan = yMax - yMin;
    }
    const xPad = xSpan * 0.06 + 1e-6;
    const yPad = ySpan * 0.08 + 1e-6;
    return {
      xMin: Math.max(0, xMin - xPad),
      xMax: xMax + xPad,
      yMin: yMin - yPad,
      yMax: yMax + yPad
    };
  }, [plotAug]);

  const [viewExt, setViewExt] = useState(fitExt);

  const viewExtRef = useRef(viewExt);
  const fitExtRef = useRef(fitExt);

  useLayoutEffect(() => {
    viewExtRef.current = viewExt;
  }, [viewExt]);

  useLayoutEffect(() => {
    fitExtRef.current = fitExt;
  }, [fitExt]);

  const cancelZoomAnimation = useCallback(() => {
    zoomTargetRef.current = null;
    if (zoomRafRef.current != null) {
      cancelAnimationFrame(zoomRafRef.current);
      zoomRafRef.current = null;
    }
  }, []);

  const zoomAnimationStep = useCallback(() => {
    const target = zoomTargetRef.current;
    const fit = fitExtRef.current;
    const cur = viewExtRef.current;
    if (!target || !fit || !cur) return;

    const next = lerpView(cur, target, ZOOM_ANIM_ALPHA);
    const clamped = clampViewToLimits(next, fit);
    viewExtRef.current = clamped;
    setViewExt(clamped);

    if (viewExtentsClose(clamped, target, 0.002)) {
      zoomTargetRef.current = null;
      zoomRafRef.current = null;
      return;
    }

    zoomRafRef.current = requestAnimationFrame(zoomAnimationStep);
  }, []);

  useEffect(() => {
    cancelZoomAnimation();
    setViewExt(fitExt);
  }, [fitExt, cancelZoomAnimation]);

  useEffect(() => () => cancelZoomAnimation(), [cancelZoomAnimation]);

  const xTicks = useMemo(
    () => buildVolumeTicks(viewExt.xMin, viewExt.xMax, 14),
    [viewExt]
  );

  const yTicks = useMemo(
    () => mergeZeroPercentTick(buildNicePercentTicks(viewExt.yMin, viewExt.yMax, 8), viewExt.yMin, viewExt.yMax),
    [viewExt]
  );

  const xScale = (x) =>
    PAD.left + ((x - viewExt.xMin) / (viewExt.xMax - viewExt.xMin || 1)) * plotW;
  const yScale = (y) =>
    PAD.top + ((viewExt.yMax - y) / (viewExt.yMax - viewExt.yMin || 1)) * plotH;

  const svgClientToViewData = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const M = svg.getScreenCTM();
      if (!M) return null;
      const loc = pt.matrixTransform(M.inverse());
      const mx = loc.x - PAD.left;
      const my = loc.y - PAD.top;
      if (mx < -2 || mx > plotW + 2 || my < -2 || my > plotH + 2) return null;
      const vx =
        viewExt.xMin +
        (clamp(mx, 0, plotW) / plotW) * (viewExt.xMax - viewExt.xMin);
      const vy =
        viewExt.yMax -
        (clamp(my, 0, plotH) / plotH) * (viewExt.yMax - viewExt.yMin);
      return { vx, vy };
    },
    [plotH, plotW, viewExt]
  );

  const onWheelChart = useCallback(
    (e) => {
      if (!svgRef.current) return;
      const pivot = svgClientToViewData(e.clientX, e.clientY);
      if (!pivot) return;
      e.preventDefault();
      e.stopPropagation();
      const cur = viewExtRef.current;
      const fit = fitExtRef.current;
      if (!cur || !fit) return;
      const zoomFactor = e.deltaY < 0 ? ZOOM_WHEEL_STEP : 1 / ZOOM_WHEEL_STEP;
      const xSpan = (cur.xMax - cur.xMin) / zoomFactor;
      const ySpan = (cur.yMax - cur.yMin) / zoomFactor;
      const rx = (pivot.vx - cur.xMin) / (cur.xMax - cur.xMin || 1);
      const ry = (pivot.vy - cur.yMin) / (cur.yMax - cur.yMin || 1);
      const desired = {
        xMin: pivot.vx - rx * xSpan,
        xMax: pivot.vx - rx * xSpan + xSpan,
        yMin: pivot.vy - ry * ySpan,
        yMax: pivot.vy - ry * ySpan + ySpan
      };
      zoomTargetRef.current = clampViewToLimits(desired, fit);
      if (zoomRafRef.current == null) {
        zoomRafRef.current = requestAnimationFrame(zoomAnimationStep);
      }
    },
    [svgClientToViewData, zoomAnimationStep]
  );

  const pointerInPlotArea = useCallback(
    (clientX, clientY) => {
      const svg = svgRef.current;
      if (!svg) return false;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const M = svg.getScreenCTM();
      if (!M) return false;
      const loc = pt.matrixTransform(M.inverse());
      const mx = loc.x - PAD.left;
      const my = loc.y - PAD.top;
      return mx >= 0 && mx <= plotW && my >= 0 && my <= plotH;
    },
    [plotH, plotW]
  );

  const onPanPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      if (!pointerInPlotArea(e.clientX, e.clientY)) return;
      e.preventDefault();
      cancelZoomAnimation();
      setTooltip(null);
      setIsPanning(true);
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        view0: { ...viewExt }
      };
      try {
        svgRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [cancelZoomAnimation, pointerInPlotArea, viewExt]
  );

  const onPanPointerMove = useCallback(
    (e) => {
      const st = panRef.current;
      if (!st) return;
      const totalDx = e.clientX - st.startX;
      const totalDy = e.clientY - st.startY;
      const v0 = st.view0;
      const spanX = v0.xMax - v0.xMin;
      const spanY = v0.yMax - v0.yMin;
      const dxData = (-totalDx / plotW) * spanX;
      const dyData = (totalDy / plotH) * spanY;
      setViewExt(
        clampViewToLimits(
          {
            xMin: v0.xMin + dxData,
            xMax: v0.xMax + dxData,
            yMin: v0.yMin + dyData,
            yMax: v0.yMax + dyData
          },
          fitExt
        )
      );
    },
    [fitExt, plotH, plotW]
  );

  const onPanPointerUp = useCallback((e) => {
    setIsPanning(false);
    panRef.current = null;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const el = zoomWrapRef.current;
    if (!el) return;
    const wheelHandler = (e) => onWheelChart(e);
    el.addEventListener('wheel', wheelHandler, { passive: false });
    return () => el.removeEventListener('wheel', wheelHandler);
  }, [onWheelChart]);

  const resetView = useCallback(() => {
    cancelZoomAnimation();
    setViewExt(fitExt);
  }, [cancelZoomAnimation, fitExt]);

  const labeled = useMemo(() => {
    const scored = plotAug
      .map((row) => {
        const { raw: p, plotX: x, plotY: y } = row;
        if (y == null || x == null || !Number.isFinite(y) || !Number.isFinite(x)) return null;
        const dist = Math.hypot((x - 1) * 4, y);
        return { p, score: dist };
      })
      .filter(Boolean);
    scored.sort((a, b) => b.score - a.score);
    const set = new Set();
    for (const s of scored.slice(0, 42)) set.add(s.p.symbol);
    for (const row of plotAug) {
      const p = row.raw;
      const y = row.plotY;
      const x = row.plotX;
      if (y == null || x == null) continue;
      if (Math.abs(y) >= 4.5) set.add(p.symbol);
      if (x >= 2.4 || x <= 0.4) set.add(p.symbol);
    }
    return set;
  }, [plotAug]);

  const showTooltip = (e, row) => {
    const el = frameRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTooltip({
      symbol: row.raw.symbol,
      companyName: row.raw.companyName,
      sector: row.raw.sector,
      dayReturnPct: row.raw.dayReturnPct,
      relVol: row.raw.relativeVolume10d,
      estimated: !!row.raw.relativeVolumeIsEstimated,
      px: clamp(e.clientX - r.left + 14, 8, r.width - 200),
      py: clamp(e.clientY - r.top + 14, 8, r.height - 140)
    });
  };

  const hideTooltip = () => setTooltip(null);

  return (
    <div className="market-movers-page__chart-wrap">
      <div className="market-movers-page__chart-controls">
        <p className="market-movers-page__chart-hint">
          Scroll to zoom · Drag anywhere on the plot to pan (same idea as Lightweight Charts / candles)
        </p>
        <button type="button" className="market-movers-page__reset-view" onClick={resetView}>
          Reset view
        </button>
      </div>
      <div
        ref={(node) => {
          frameRef.current = node;
          zoomWrapRef.current = node;
        }}
        className="market-movers-page__scatter-frame market-movers-page__scatter-frame--zoom"
        onMouseLeave={() => {
          hideTooltip();
          panRef.current = null;
          setIsPanning(false);
        }}
      >
        <span className="market-movers-page__axis-caption market-movers-page__axis-caption--y">
          <Hexagon size={13} strokeWidth={2} className="market-movers-page__axis-ico market-movers-page__axis-ico--hex" aria-hidden />
          {axisReturnTitle || '1 Day Return'}
        </span>
        <span className="market-movers-page__axis-caption market-movers-page__axis-caption--x">
          Relative Volume (10d)
          <Settings size={13} strokeWidth={2} className="market-movers-page__gear" aria-hidden />
        </span>
        <svg
          ref={svgRef}
          className={
            'market-movers-page__scatter-svg' + (isPanning ? ' market-movers-page__scatter-svg--panning' : '')
          }
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          role="img"
          aria-label={`Scatter of ${axisReturnTitle || 'return'} versus relative volume — scroll to zoom, drag to pan`}
          style={{ touchAction: 'none', cursor: isPanning ? 'grabbing' : 'grab' }}
          onPointerDown={onPanPointerDown}
          onPointerMove={onPanPointerMove}
          onPointerUp={onPanPointerUp}
          onPointerCancel={onPanPointerUp}
        >
          <defs>
            <clipPath id={plotClipId} clipPathUnits="userSpaceOnUse">
              <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
            </clipPath>
          </defs>
          <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} className="market-movers-page__plot-bg" />

          {yTicks.map((t, i) => {
            const yy = yScale(t);
            const isZero = Math.abs(t) < 1e-6;
            return (
              <g key={`gy-${i}`}>
                <line
                  x1={PAD.left}
                  y1={yy}
                  x2={PAD.left + plotW}
                  y2={yy}
                  className={isZero ? 'market-movers-page__grid-zero' : 'market-movers-page__grid-line'}
                />
                <text x={PAD.left - 8} y={yy + 4} textAnchor="end" className="market-movers-page__axis-tick">
                  {formatPercentTickLabel(t)}
                </text>
              </g>
            );
          })}

          {xTicks.map((t, i) => (
            <g key={`gx-${i}`}>
              <line
                x1={xScale(t)}
                y1={PAD.top}
                x2={xScale(t)}
                y2={PAD.top + plotH}
                className="market-movers-page__grid-line"
              />
              <text x={xScale(t)} y={PAD.top + plotH + 22} textAnchor="middle" className="market-movers-page__axis-tick">
                {formatVolumeTickLabel(t)}
              </text>
            </g>
          ))}

          <g clipPath={`url(#${plotClipId})`}>
          {plotAug.map((row) => {
            const p = row.raw;
            const y = row.plotY;
            const x = row.plotX;
            if (y == null || x == null || !Number.isFinite(y) || !Number.isFinite(x)) return null;
            const cx = xScale(x);
            const cy = yScale(y);
            const showLab = labeled.has(p.symbol);
            const jitterY = showLab ? -12 : 0;
            const active = tooltip && tooltip.symbol === p.symbol;
            return (
              <g
                key={p.symbol}
                className={'market-movers-page__dot-group' + (active ? ' market-movers-page__dot-group--active' : '')}
                onMouseEnter={(e) => showTooltip(e, row)}
                onMouseMove={(e) => {
                  const el = frameRef.current;
                  if (!el) return;
                  const r = el.getBoundingClientRect();
                  setTooltip((prev) => {
                    if (!prev || prev.symbol !== p.symbol) return prev;
                    return {
                      ...prev,
                      px: clamp(e.clientX - r.left + 14, 8, r.width - 200),
                      py: clamp(e.clientY - r.top + 14, 8, r.height - 140)
                    };
                  });
                }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={18}
                  className="market-movers-page__hit"
                  fill="transparent"
                  style={{ cursor: 'crosshair' }}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={active ? 6 : 4.5}
                  className={'market-movers-page__dot' + (active ? ' market-movers-page__dot--active' : '')}
                  style={{ pointerEvents: 'none' }}
                />
                {showLab ? (
                  <text
                    x={cx}
                    y={cy + jitterY}
                    textAnchor="middle"
                    className="market-movers-page__dot-label"
                    style={{ pointerEvents: 'none' }}
                  >
                    {p.symbol}
                  </text>
                ) : null}
              </g>
            );
          })}
          </g>

          {/* Plot boundary — drawn above series so dots never paint over axis tick area */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="none"
            className="market-movers-page__plot-outline"
          />
        </svg>
        {tooltip ? (
          <div
            className="market-movers-page__tooltip"
            style={{ left: tooltip.px, top: tooltip.py }}
            role="tooltip"
          >
            <div className="market-movers-page__tooltip-title">
              <strong>{tooltip.symbol}</strong>
              {tooltip.companyName ? (
                <span className="market-movers-page__tooltip-co">{tooltip.companyName}</span>
              ) : null}
            </div>
            {tooltip.sector ? <div className="market-movers-page__tooltip-row muted">{tooltip.sector}</div> : null}
            <div className="market-movers-page__tooltip-row">
              {tooltipReturnLabel || '1D return'}:{' '}
              <strong>
                {parsePct(tooltip.dayReturnPct) == null
                  ? '—'
                  : (parsePct(tooltip.dayReturnPct) >= 0 ? '+' : '') + parsePct(tooltip.dayReturnPct).toFixed(2) + '%'}
              </strong>
            </div>
            <div className="market-movers-page__tooltip-row">
              Rel. volume (10d):{' '}
              <strong>
                {tooltip.relVol == null || !Number.isFinite(Number(tooltip.relVol))
                  ? '—'
                  : Number(tooltip.relVol).toFixed(2) + '×'}
              </strong>
              {tooltip.estimated ? (
                <span className="market-movers-page__tooltip-hint">
                  {' '}
                  · point spread horizontally for visibility (volume not in data)
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {volumeNote ? <p className="market-movers-page__volume-note">{volumeNote}</p> : null}
    </div>
  );
}

export default function MarketMoversPage() {
  const [indexMenuId, setIndexMenuId] = useState('sp500');
  const [sectorFilter, setSectorFilter] = useState('__all__');
  const [sessionTab, setSessionTab] = useState('market');
  const [moverIntervalId, setMoverIntervalId] = useState('1d');
  const [points, setPoints] = useState([]);
  const [meta, setMeta] = useState({ asOfDate: '', volumeNote: '', sessionNote: '', period: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const activeMenu = INDEX_MENU.find((m) => m.id === indexMenuId) || INDEX_MENU[0];

  const activeMoverInterval =
    MARKET_MOVERS_INTERVALS.find((x) => x.id === moverIntervalId) || MARKET_MOVERS_INTERVALS[0];

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!getAuthToken()) {
        setError('Sign in to load market movers.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const { data: payload } = await fetchJsonCached({
          path: '/api/market/index-market-movers',
          method: 'POST',
          body: { index: activeMenu.apiIndex, period: activeMoverInterval.apiPeriod },
          ttlMs: 90 * 1000,
          force: false
        });
        if (cancelled) return;
        const list = Array.isArray(payload?.points) ? payload.points : [];
        setPoints(list);
        setMeta({
          asOfDate: payload?.asOfDate || '',
          volumeNote: payload?.volumeNote || '',
          sessionNote: payload?.sessionNote || '',
          period: payload?.period || ''
        });
        if (!list.length) setError('No data for this index.');
      } catch (e) {
        if (!cancelled) {
          setError(e.message || 'Failed to load market movers');
          setPoints([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [activeMenu.apiIndex, activeMoverInterval.apiPeriod]);

  const sectors = useMemo(() => {
    const s = new Set();
    for (const p of points) {
      const sec = normSector(p.sector);
      if (sec) s.add(sec);
    }
    return [...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [points]);

  const filteredPoints = useMemo(() => {
    if (sectorFilter === '__all__') return points;
    return points.filter((p) => normSector(p.sector) === sectorFilter);
  }, [points, sectorFilter]);

  const exportCsv = useCallback(() => {
    const rows = filteredPoints;
    const header = [
      'symbol',
      'companyName',
      'sector',
      'dayReturnPct',
      'lastPrice',
      'priceChange',
      'volume',
      'relativeVolume10d',
      'relativeVolumeIsEstimated'
    ];
    const lines = [header.join(',')];
    for (const p of rows) {
      const esc = (v) => {
        const s = v == null ? '' : String(v);
        if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
        return s;
      };
      lines.push(
        [
          esc(p.symbol),
          esc(p.companyName),
          esc(p.sector),
          esc(p.dayReturnPct),
          esc(p.lastPrice),
          esc(p.priceChange),
          esc(p.volume),
          esc(p.relativeVolume10d),
          esc(p.relativeVolumeIsEstimated)
        ].join(',')
      );
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-movers-${activeMenu.id}-${moverIntervalId}-${meta.asOfDate || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredPoints, activeMenu.id, meta.asOfDate, moverIntervalId]);

  return (
    <div className="market-movers-page">
      <header className="market-movers-page__header">
        <h1 className="market-movers-page__title">Market Movers</h1>
        <div className="market-movers-page__header-right">
          <label className="market-movers-page__sector-filter">
            <Filter size={16} strokeWidth={2} className="market-movers-page__filter-ico" aria-hidden />
            <span className="market-movers-page__sector-label">Sector Filter</span>
            <select
              className="market-movers-page__select market-movers-page__select--sector"
              value={sectorFilter}
              onChange={(e) => setSectorFilter(e.target.value)}
              aria-label="Sector filter"
            >
              <option value="__all__">All sectors</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <section className="market-movers-page__card">
        <div className="market-movers-page__card-toolbar">
          <div className="market-movers-page__index-dd">
            <Users size={18} strokeWidth={2} className="market-movers-page__users-ico" aria-hidden />
            <div className="market-movers-page__select-shell">
              <select
                className="market-movers-page__select market-movers-page__select--index"
                value={indexMenuId}
                onChange={(e) => setIndexMenuId(e.target.value)}
                aria-label="Index"
              >
                {INDEX_MENU.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={18} strokeWidth={2} className="market-movers-page__chev" aria-hidden />
            </div>
          </div>

          <div className="market-movers-page__sessions" role="tablist" aria-label="Trading session">
            {[
              { id: 'pre', label: 'Pre Market' },
              { id: 'market', label: 'Market' },
              { id: 'post', label: 'Post Market' }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={sessionTab === t.id}
                className={
                  'market-movers-page__session-btn' +
                  (sessionTab === t.id ? ' market-movers-page__session-btn--active' : '')
                }
                onClick={() => setSessionTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="market-movers-page__card-head">
          <h2 className="market-movers-page__card-title">{activeMoverInterval.chartHeadline}</h2>
          <button type="button" className="market-movers-page__export" onClick={exportCsv}>
            <Upload size={16} strokeWidth={2} aria-hidden />
            EXPORT
          </button>
        </div>

        <div className="market-movers-page__interval-row">
          <div className="market-movers-page__interval-tabs" role="tablist" aria-label="Return period">
            {MARKET_MOVERS_INTERVALS.map((it) => (
              <button
                key={it.id}
                type="button"
                role="tab"
                aria-selected={moverIntervalId === it.id}
                className={
                  'market-movers-page__interval-tab' +
                  (moverIntervalId === it.id ? ' market-movers-page__interval-tab--active' : '')
                }
                onClick={() => setMoverIntervalId(it.id)}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>

        {sessionTab !== 'market' ? (
          <p className="market-movers-page__session-hint">
            Chart data uses <strong>end-of-day</strong> closes (same as &quot;Market&quot;). Extended-hours slices are not
            wired yet.
          </p>
        ) : null}

        {meta.asOfDate ? (
          <p className="market-movers-page__meta">
            As of <strong>{meta.asOfDate}</strong>
            {meta.sessionNote ? (
              <>
                {' '}
                · <span className="market-movers-page__meta-muted">{meta.sessionNote}</span>
              </>
            ) : null}
          </p>
        ) : null}

        {loading ? (
          <div className="market-movers-page__viz-loading-wrap">
            <TradingChartLoader
              label="Loading market movers…"
              sublabel={`${activeMoverInterval.label} · ${activeMenu.label}`}
            />
          </div>
        ) : null}
        {error ? <div className="market-movers-page__error">{error}</div> : null}

        {!loading && !error && filteredPoints.length > 0 ? (
          <>
            <MarketMoversScatter
              points={filteredPoints}
              volumeNote={meta.volumeNote}
              axisReturnTitle={activeMoverInterval.axisReturnTitle}
              tooltipReturnLabel={activeMoverInterval.tooltipReturnLabel}
            />
            <MarketMoversLeaderTables points={filteredPoints} />
          </>
        ) : null}

        {!loading && !error && filteredPoints.length === 0 && points.length > 0 ? (
          <div className="market-movers-page__empty">No tickers match this sector filter.</div>
        ) : null}
      </section>
    </div>
  );
}
