import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemedDropdown } from './ThemedDropdown.jsx';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import TradingChartLoader from './TradingChartLoader.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import {fetchJsonCached, getAuthToken, canFetchProtectedApi} from '../store/apiStore.js';
import { useReturnsChartFiltersMenuMode } from '../context/WatchlistDockContext.jsx';
import { ReturnsChartFiltersMenu } from './ReturnsChartFiltersMenu.jsx';
import { ReturnsChartClickableHeading } from './ReturnsChartClickableTitle.jsx';
import { notifyChartFullscreenLayout } from '../utils/chartFullscreenLayout.js';
import { buildRelativeStrengthTickerHref } from '../utils/relativeStrengthNavigation.js';

const GROUPS = [
  { id: 'sp500', apiIndex: 'SP500', label: 'S&P 500', benchmark: 'SPX', benchLabel: 'S&P 500' },
  { id: 'dow', apiIndex: 'Dow Jones', label: 'Dow Jones', benchmark: 'DJI', benchLabel: 'Dow Jones' },
  { id: 'nasdaq', apiIndex: 'Nasdaq 100', label: 'Nasdaq 100', benchmark: 'IXIC', benchLabel: 'Nasdaq 100' },
  { id: 'etf', apiIndex: 'ETF', label: 'ETF', benchmark: 'QQQ', benchLabel: 'ETF' },
  { id: 'other', apiIndex: 'Other', label: 'Other', benchmark: 'IWM', benchLabel: 'Other' }
];

const TF_ROWS = [
  { key: '1D', period: 'Last date' },
  { key: '5D', period: 'Week' },
  { key: '1M', period: 'Last Month' },
  { key: '3M', period: 'Last 3 months' },
  { key: '6M', period: 'Last 6 months' },
  { key: 'YTD', period: 'Year to Date (YTD)' },
  { key: '1Y', period: 'Last 1 year' },
  { key: '3Y', period: 'Last 3 years' },
  { key: '5Y', period: 'Last 5 years' },
  { key: '10Y', period: 'Last 10 years' },
  { key: '20Y', period: 'Last 20 years' }
];
const TABLE_ONLY_START_DATE = '2005-01-01';

/** Stable empty default — `= []` in params is a new array every render when the prop is omitted. */
const DEFAULT_INITIAL_SP500_ROWS = Object.freeze([]);

/** Dev-only: logs 1D / "Last date" pipeline. For prod builds, temporarily set to `true`. */
const DEBUG_BENCHMARK_TABLE_1D =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) || false;

function yesterdayIso() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickDynamic(dynamicPeriods, periodName) {
  if (!periodName || !Array.isArray(dynamicPeriods)) return null;
  const row = dynamicPeriods.find((r) => r.period === periodName);
  const v = row?.totalReturn;
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function fmtPct(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function signedToneClass(v) {
  if (!Number.isFinite(Number(v))) return '';
  return Number(v) > 0 ? 'app-num--up' : Number(v) < 0 ? 'app-num--down' : '';
}

function pickTickerReturnsFromPayload(payload, tickerSym) {
  const u = String(tickerSym || '').toUpperCase().trim();
  if (!payload || !u) return null;
  if (payload.batch === true && payload.byTicker && payload.byTicker[u] != null) {
    const row = payload.byTicker[u];
    if (row && row.success === false) return null;
    return row;
  }
  if (!payload.batch && String(payload.ticker || '').toUpperCase() === u) return payload;
  return null;
}

function niceAxisBounds(rows) {
  const vals = rows.flatMap((r) => [r.bench, r.tick]).filter((v) => Number.isFinite(v));
  if (!vals.length) return { min: -5, max: 25, ticks: [-5, 0, 5, 10, 15, 20, 25] };
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const spanRaw = Math.max(10, maxV - minV);
  const rough = spanRaw / 6;
  const base = 10 ** Math.floor(Math.log10(Math.max(rough, 1)));
  const ratio = rough / base;
  const niceMult = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10;
  const step = niceMult * base;
  const min = Math.floor((Math.min(-1, minV) - 0.5) / step) * step;
  const max = Math.ceil((Math.max(10, maxV) + 0.5) / step) * step;
  const ticks = [];
  for (let t = min; t <= max + 1e-9; t += step) {
    ticks.push(Math.round(t * 1000) / 1000);
  }
  return { min, max, ticks };
}

/** @param {number} axisMax @param {number} axisMin @param {number} value */
function chartYPct(axisMax, axisMin, value) {
  const range = axisMax - axisMin;
  if (!Number.isFinite(range) || range <= 0) return 50;
  return ((axisMax - value) / range) * 100;
}

function formatS24AxisPct(v) {
  if (!Number.isFinite(v)) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(Number.isInteger(n) ? 0 : 1)}%`;
}

/**
 * @param {number} axisMax
 * @param {number} axisMin
 * @param {unknown} v
 * @returns {{ topPct: number, heightPct: number, empty: boolean, dir: 'up' | 'down' | 'flat' }}
 */
function s24BarGeom(axisMax, axisMin, v) {
  const z = chartYPct(axisMax, axisMin, 0);
  if (v == null || !Number.isFinite(Number(v))) {
    return { topPct: z, heightPct: 0, empty: true, dir: 'flat' };
  }
  const num = Number(v);
  const yv = chartYPct(axisMax, axisMin, num);
  if (num > 0) return { topPct: yv, heightPct: Math.max(0, z - yv), empty: false, dir: 'up' };
  if (num < 0) return { topPct: z, heightPct: Math.max(0, yv - z), empty: false, dir: 'down' };
  return { topPct: z, heightPct: 0, empty: false, dir: 'flat' };
}

export function TickerSection23Section24({
  pageSymbol = '',
  prefetchedLongTickerReturns = null,
  prefetchedLongBenchReturns = null,
  prefetchedLongBenchSymbol = '',
  prefetchedLongBusy = false,
  onSectionBenchmarkSymbolChange,
  initialSp500Rows = DEFAULT_INITIAL_SP500_ROWS,
  onViewMore: onViewMoreProp
}) {
  const navigate = useNavigate();
  const [groupId, setGroupId] = useState('sp500');
  const [groupRows, setGroupRows] = useState([]);
  const [ticker, setTicker] = useState(String(pageSymbol || '').toUpperCase());
  const [localTickerReturns, setLocalTickerReturns] = useState(null);
  const [localBenchReturns, setLocalBenchReturns] = useState(null);
  const [localReturnsBusy, setLocalReturnsBusy] = useState(false);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const coreReturnsCacheRef = useRef(new Map());
  const filtersMenuMode = useReturnsChartFiltersMenuMode();

  const activeGroup = useMemo(() => GROUPS.find((g) => g.id === groupId) || GROUPS[0], [groupId]);

  const onViewMore = useCallback(() => {
    if (typeof onViewMoreProp === 'function') {
      onViewMoreProp();
      return;
    }
    const sym = String(pageSymbol || ticker || '').trim();
    navigate(buildRelativeStrengthTickerHref(sym));
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [navigate, onViewMoreProp, pageSymbol, ticker]);

  /** Avoid effect loops: default prop `initialSp500Rows = []` is a new [] every render when omitted. */
  const initialSp500RowsSig = useMemo(() => {
    const arr = initialSp500Rows;
    if (!Array.isArray(arr) || !arr.length) return '';
    return `${arr.length}:${arr.map((r) => String(r?.symbol || '')).join(',')}`;
  }, [initialSp500Rows]);

  useEffect(() => {
    setTicker(String(pageSymbol || '').toUpperCase());
  }, [pageSymbol]);

  const usePrefetchLong = useMemo(() => {
    const symPage = String(pageSymbol || '').toUpperCase().trim();
    const tick = String(ticker || '').toUpperCase().trim();
    const bench = String(activeGroup.benchmark || '').toUpperCase().trim();
    const prefB = String(prefetchedLongBenchSymbol || '').toUpperCase().trim();
    return tick === symPage && bench === prefB;
  }, [pageSymbol, ticker, activeGroup.benchmark, prefetchedLongBenchSymbol]);

  const tickerReturns = usePrefetchLong ? prefetchedLongTickerReturns : localTickerReturns;
  const benchReturns = usePrefetchLong ? prefetchedLongBenchReturns : localBenchReturns;
  const loadingReturns =
    loadingGroup || (usePrefetchLong ? prefetchedLongBusy : localReturnsBusy);

  useEffect(() => {
    onSectionBenchmarkSymbolChange?.(activeGroup.benchmark);
  }, [groupId, activeGroup.benchmark, onSectionBenchmarkSymbolChange]);

  useEffect(() => {
    let cancelled = false;
    async function loadGroupRows() {
      if (!canFetchProtectedApi()) return;
      setLoadingGroup(true);
      try {
        const rowsFromProp =
          activeGroup.id === 'sp500' && Array.isArray(initialSp500Rows) && initialSp500Rows.length
            ? initialSp500Rows
            : null;
        const data = rowsFromProp
          ? { data: rowsFromProp }
          : (
              await fetchJsonCached({
                path: '/api/market/ticker-details',
                method: 'POST',
                body: { index: activeGroup.apiIndex, period: 'last-1-year' },
                ttlMs: 10 * 60 * 1000
              })
            ).data;
        if (cancelled) return;
        const list = Array.isArray(data?.data) ? data.data : [];
        const sorted = [...list].sort((a, b) =>
          String(a.symbol || '').localeCompare(String(b.symbol || ''), undefined, { sensitivity: 'base' })
        );
        setGroupRows(sorted);
        const syms = new Set(sorted.map((r) => String(r.symbol || '').toUpperCase()));
        if (!syms.has(ticker)) {
          setTicker(sorted[0]?.symbol ? String(sorted[0].symbol).toUpperCase() : '');
        }
      } catch {
        if (!cancelled) setGroupRows([]);
      } finally {
        if (!cancelled) setLoadingGroup(false);
      }
    }
    loadGroupRows();
    return () => {
      cancelled = true;
    };
  }, [activeGroup.apiIndex, activeGroup.id, initialSp500RowsSig]);

  /**
   * When the peer ticker differs from the page symbol, load only missing core payloads.
   * This avoids refetching both symbols when only one dropdown changes.
   */
  useEffect(() => {
    let cancelled = false;
    const symPage = String(pageSymbol || '').toUpperCase().trim();
    const tick = String(ticker || '').toUpperCase().trim();
    const bench = String(activeGroup.benchmark || '').toUpperCase().trim();
    const prefB = String(prefetchedLongBenchSymbol || '').toUpperCase().trim();
    const usePrefetch = tick === symPage && bench === prefB;

    if (!canFetchProtectedApi() || !tick || !bench) {
      setLocalTickerReturns(null);
      setLocalBenchReturns(null);
      setLocalReturnsBusy(false);
      return () => {
        cancelled = true;
      };
    }

    if (usePrefetch) {
      setLocalTickerReturns(null);
      setLocalBenchReturns(null);
      setLocalReturnsBusy(false);
      return () => {
        cancelled = true;
      };
    }

    async function getCoreReturns(sym) {
      const u = String(sym || '').toUpperCase().trim();
      if (!u) return null;
      const key = `${u}|${TABLE_ONLY_START_DATE}|${yesterdayIso()}`;
      if (coreReturnsCacheRef.current.has(key)) {
        return coreReturnsCacheRef.current.get(key);
      }
      const res = await fetchJsonCached({
        path: '/api/market/ticker-core-returns',
        method: 'POST',
        body: {
          ticker: u,
          customStartDate: TABLE_ONLY_START_DATE,
          customEndDate: yesterdayIso()
        },
        ttlMs: 5 * 60 * 1000
      });
      const payload = pickTickerReturnsFromPayload(res.data, u) || (res.data?.ticker ? res.data : null);
      coreReturnsCacheRef.current.set(key, payload);
      return payload;
    }

    (async () => {
      setLocalReturnsBusy(true);
      try {
        const [tickData, benchData] = await Promise.all([getCoreReturns(tick), getCoreReturns(bench)]);
        if (cancelled) return;
        setLocalTickerReturns(tickData);
        setLocalBenchReturns(benchData);
      } catch {
        if (!cancelled) {
          setLocalTickerReturns(null);
          setLocalBenchReturns(null);
        }
      } finally {
        if (!cancelled) setLocalReturnsBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ticker, activeGroup.benchmark, pageSymbol, prefetchedLongBenchSymbol]);

  const rows = useMemo(() => {
    const dynT = tickerReturns?.performance?.dynamicPeriods || [];
    const dynB = benchReturns?.performance?.dynamicPeriods || [];
    return TF_ROWS.map((tf) => {
      const bench = pickDynamic(dynB, tf.period);
      const tick = pickDynamic(dynT, tf.period);
      const diff =
        Number.isFinite(bench) && Number.isFinite(tick)
          ? Number(bench) - Number(tick)
          : null;
      return { tf: tf.key, bench, tick, diff };
    });
  }, [tickerReturns, benchReturns]);

  useEffect(() => {
    if (!DEBUG_BENCHMARK_TABLE_1D || loadingReturns) return;
    const period1d = TF_ROWS[0].period;
    const dynT = tickerReturns?.performance?.dynamicPeriods || [];
    const dynB = benchReturns?.performance?.dynamicPeriods || [];
    const rowT = dynT.find((r) => r.period === period1d);
    const rowB = dynB.find((r) => r.period === period1d);
    const tick = pickDynamic(dynT, period1d);
    const bench = pickDynamic(dynB, period1d);
    const diff =
      Number.isFinite(bench) && Number.isFinite(tick) ? Number(bench) - Number(tick) : null;

    // eslint-disable-next-line no-console -- intentional debug trace for 1D / Last date
    console.groupCollapsed('[TickerSection23Section24:1D / Last date]');
    // eslint-disable-next-line no-console
    console.log('context', {
      ticker,
      benchmark: activeGroup.benchmark,
      benchLabel: activeGroup.benchLabel,
      usePrefetchLong,
      tickerAsOf: tickerReturns?.asOfDate,
      benchAsOf: benchReturns?.asOfDate
    });
    // eslint-disable-next-line no-console
    console.log('period key we match on', JSON.stringify(period1d));
    // eslint-disable-next-line no-console
    console.log('all dynamic period labels (ticker)', dynT.map((r) => r.period));
    // eslint-disable-next-line no-console
    console.log('all dynamic period labels (benchmark)', dynB.map((r) => r.period));
    // eslint-disable-next-line no-console
    console.log('raw row ticker "Last date"', rowT ?? '(no row with exact period match)');
    // eslint-disable-next-line no-console
    console.log('raw row benchmark "Last date"', rowB ?? '(no row with exact period match)');
    // eslint-disable-next-line no-console
    console.log('pickDynamic totals', { tick1d: tick, bench1d: bench, diff1d: diff });
    const row1d = rows.find((r) => r.tf === '1D');
    // eslint-disable-next-line no-console
    console.log('computed table row (1D)', row1d);
    // eslint-disable-next-line no-console
    console.log(
      'why 0%? (same calendar start/end often means one trading bar → ~0% return)',
      {
        tickerSameDay:
          rowT?.startDate && rowT?.endDate ? rowT.startDate === rowT.endDate : null,
        benchSameDay:
          rowB?.startDate && rowB?.endDate ? rowB.startDate === rowB.endDate : null,
        tickerPrices: rowT ? { start: rowT.startPrice, end: rowT.endPrice } : null,
        benchPrices: rowB ? { start: rowB.startPrice, end: rowB.endPrice } : null
      }
    );
    // eslint-disable-next-line no-console
    console.groupEnd();
  }, [
    loadingReturns,
    tickerReturns,
    benchReturns,
    ticker,
    activeGroup.benchmark,
    activeGroup.benchLabel,
    usePrefetchLong,
    rows
  ]);

  const axis = useMemo(() => niceAxisBounds(rows), [rows]);

  const s24Ticks = useMemo(
    () =>
      axis.ticks.map((t) => ({
        key: `s24y-${t}`,
        value: t,
        topPct: chartYPct(axis.max, axis.min, t)
      })),
    [axis]
  );
  const s24ZeroTopPct = useMemo(() => chartYPct(axis.max, axis.min, 0), [axis]);
  const s24Cols = useMemo(
    () =>
      rows.map((r) => ({
        tf: r.tf,
        benchV: r.bench,
        tickV: r.tick,
        bench: s24BarGeom(axis.max, axis.min, r.bench),
        tick: s24BarGeom(axis.max, axis.min, r.tick)
      })),
    [rows, axis]
  );
  const s24NCols = Math.max(1, rows.length);
  const s24GapPx = s24NCols > 12 ? 4 : s24NCols > 8 ? 6 : 8;
  const s24BarMaxPx = s24NCols > 12 ? 9 : s24NCols > 8 ? 11 : 13;

  const s24FsRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const [s24Fs, setS24Fs] = useState(false);

  useEffect(() => {
    const sync = () => {
      const el = s24FsRef.current;
      const d = /** @type {Document & { webkitFullscreenElement?: Element | null }} */ (document);
      setS24Fs(!!el && (document.fullscreenElement === el || d.webkitFullscreenElement === el));
      notifyChartFullscreenLayout();
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    sync();
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  const toggleS24Fullscreen = useCallback(async () => {
    const el = s24FsRef.current;
    if (!el) return;
    const d = /** @type {Document & { exitFullscreen?: () => Promise<void>; webkitExitFullscreen?: () => void; webkitFullscreenElement?: Element | null }} */ (
      document
    );
    const fsEl = d.fullscreenElement ?? d.webkitFullscreenElement;
    try {
      if (fsEl === el) {
        if (d.exitFullscreen) await d.exitFullscreen();
        else d.webkitExitFullscreen?.();
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else {
        /** @type {{ webkitRequestFullscreen?: () => void }} */ (el).webkitRequestFullscreen?.();
      }
    } catch {
      /* ignore */
    }
    notifyChartFullscreenLayout();
  }, []);

  const benchmarkControls = (
    <div className="ticker-s23s24__controls">
      <ThemedDropdown
        className="ticker-s23s24__select-dd"
        style={{ width: '100%' }}
        size="sm"
        wideLabel
        value={ticker}
        options={groupRows.map((r) => {
          const s = String(r.symbol || '').toUpperCase();
          return { id: s, label: s };
        })}
        onChange={setTicker}
        title="Ticker"
        ariaLabelPrefix="Ticker"
        disabled={!groupRows.length}
        labelFallback="—"
      />
      <ThemedDropdown
        className="ticker-s23s24__select-dd"
        style={{ width: '100%' }}
        size="sm"
        wideLabel
        value={groupId}
        options={GROUPS.map((g) => ({ id: g.id, label: g.label }))}
        onChange={setGroupId}
        title="Index group"
        ariaLabelPrefix="Group"
      />
    </div>
  );

  return (
    <section className="ticker-s23s24">
      <div className="ticker-s23s24__card ticker-s23">
        <div className="ticker-s23s24__head-row ticker-s23s24__head-row--title-only">
          <div className="ticker-card__h-with-tip">
            <ReturnsChartClickableHeading className="ticker-subh ticker-subh--flex uppercase" onClick={onViewMore}>
              Relative Strength
            </ReturnsChartClickableHeading>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerCompareBars} align="start" />
          </div>
        </div>
        <div className="ticker-s23__body">
          <table className="ticker-s23__table">
            <thead>
              <tr>
                <th> Time</th>
                <th>{ticker || 'Ticker'}</th>
                <th>{activeGroup.benchLabel}</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tf}>
                  <th scope="row">{r.tf}</th>
                  <td className={signedToneClass(r.bench)}>{fmtPct(r.bench)}</td>
                  <td className={signedToneClass(r.tick)}>{fmtPct(r.tick)}</td>
                  <td className={signedToneClass(r.diff)}>{fmtPct(r.diff)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ticker-s23s24__card ticker-s24">
        <div className="ticker-s24__title-row">
          <div className="ticker-card__h-with-tip">
            <ReturnsChartClickableHeading className="ticker-subh ticker-subh--flex" onClick={onViewMore}>
              Benchmark vs Ticker Bars
            </ReturnsChartClickableHeading>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerCompareBars} align="start" />
          </div>
          <div className="ticker-s24__title-actions">
            <button
              type="button"
              className="ticker-s24__fs-btn"
              onClick={toggleS24Fullscreen}
              aria-pressed={s24Fs}
              aria-label={s24Fs ? 'Exit chart fullscreen' : 'Enter chart fullscreen'}
              title={s24Fs ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <span className={'ticker-s24__fs-ico' + (s24Fs ? ' ticker-s24__fs-ico--exit' : '')} aria-hidden>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M18 11l-6-6-6 6" />
                </svg>
              </span>
            </button>
            
          </div>
        </div>
        {!filtersMenuMode ? benchmarkControls : null}
        <div ref={s24FsRef} className="ticker-s24__chart-shell">
          {loadingReturns ? (
            <div className="chart-viz-loading-wrap ticker-s24__viz-loading">
              <TradingChartLoader
                label="Loading benchmark comparison…"
                sublabel={`${activeGroup.label} vs ${ticker || 'ticker'}`}
              />
            </div>
          ) : (
            <>
              <div
                className="ticker-s24__chart ticker-s17__chart"
                style={{
                  '--ticker-s17-cols': String(s24NCols),
                  '--ticker-s17-gap': `${s24GapPx}px`,
                  '--ticker-s17-bar-max': `${s24BarMaxPx}px`
                }}
              >
                <div className="ticker-s17__yaxis">
                  <div className="ticker-s17__yaxis-area">
                    {s24Ticks.map((t) => (
                      <span key={t.key} className="ticker-s17__yval" style={{ top: `${t.topPct}%` }}>
                        {formatS24AxisPct(t.value)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="ticker-s17__plot">
                  <div className="ticker-s17__plot-area">
                    <div className="ticker-s17__viz">
                      {s24Ticks.map((t) => (
                        <span key={`g-${t.key}`} className="ticker-s17__grid" style={{ top: `${t.topPct}%` }} />
                      ))}
                      <span className="ticker-s17__zero" style={{ top: `${s24ZeroTopPct}%` }} />
                      <div className="ticker-s17__bars">
                        {s24Cols.map((c) => (
                          <div key={c.tf} className="ticker-s17__col">
                            <div className="ticker-s24__pair-zones">
                              <div className="ticker-s17__bar-zone ticker-s24__bar-zone--twin">
                                <div
                                  className={
                                    'ticker-s24__pillar ticker-s24__pillar--bench ticker-s24__pillar--' +
                                    c.bench.dir +
                                    (c.bench.empty ? ' ticker-s24__pillar--empty' : '')
                                  }
                                  style={{ top: `${c.bench.topPct}%`, height: `${c.bench.heightPct}%` }}
                                  title={
                                    c.bench.empty
                                      ? `${activeGroup.benchLabel}: —`
                                      : `${activeGroup.benchLabel}: ${fmtPct(c.benchV)}`
                                  }
                                />
                              </div>
                              <div className="ticker-s17__bar-zone ticker-s24__bar-zone--twin">
                                <div
                                  className={
                                    'ticker-s24__pillar ticker-s24__pillar--tick ticker-s24__pillar--' +
                                    c.tick.dir +
                                    (c.tick.empty ? ' ticker-s24__pillar--empty' : '')
                                  }
                                  style={{ top: `${c.tick.topPct}%`, height: `${c.tick.heightPct}%` }}
                                  title={
                                    c.tick.empty ? `${ticker || 'Ticker'}: —` : `${ticker || 'Ticker'}: ${fmtPct(c.tickV)}`
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="ticker-s17__xlabels">
                      {s24Cols.map((c) => (
                        <span key={`lab-${c.tf}`} className="ticker-s17__lab">
                          {c.tf}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="ticker-s24__legend">
                <span>
                  <i className="ticker-s24__dot ticker-s24__dot--bench" />
                  {activeGroup.benchLabel}
                </span>
                <span>
                  <i className="ticker-s24__dot ticker-s24__dot--tick" />
                  {ticker || 'Ticker'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

