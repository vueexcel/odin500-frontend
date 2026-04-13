import { useEffect, useRef, useState, useMemo, useCallback, useSyncExternalStore } from 'react';
import { createChart, CrosshairMode } from 'lightweight-charts';
import { mapRowsToCandles, rowDateToTimeKey } from '../utils/chartData.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';

function chartOptionsForTheme(theme, height) {
  if (theme === 'light') {
    return {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#475569'
      },
      grid: {
        vertLines: { color: 'rgba(15, 23, 42, 0.08)' },
        horzLines: { color: 'rgba(15, 23, 42, 0.08)' }
      },
      rightPriceScale: { borderColor: 'rgba(15, 23, 42, 0.12)' },
      timeScale: {
        borderColor: 'rgba(15, 23, 42, 0.12)',
        rightOffset: 4,
        barSpacing: 8,
        fixLeftEdge: false,
        fixRightEdge: false
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(37, 99, 235, 0.35)', width: 1, style: 2 },
        horzLine: { color: 'rgba(37, 99, 235, 0.35)', width: 1, style: 2 }
      },
      height
    };
  }
  return {
    layout: {
      background: { color: '#0d1520' },
      textColor: '#94a3b8'
    },
    grid: {
      vertLines: { color: 'rgba(148, 163, 184, 0.12)' },
      horzLines: { color: 'rgba(148, 163, 184, 0.12)' }
    },
    rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.25)' },
    timeScale: {
      borderColor: 'rgba(148, 163, 184, 0.25)',
      rightOffset: 4,
      barSpacing: 8,
      fixLeftEdge: false,
      fixRightEdge: false
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: { color: 'rgba(148, 163, 184, 0.45)', width: 1, style: 2 },
      horzLine: { color: 'rgba(148, 163, 184, 0.45)', width: 1, style: 2 }
    },
    height
  };
}

/** @typedef {'line' | 'area' | 'candles' | 'bars'} TickerChartType */

export const TICKER_CHART_TYPE_OPTIONS = [
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'candles', label: 'Candles' },
  { id: 'bars', label: 'Bars' }
];

function timeKeyFromCrosshair(t) {
  if (t == null) return '';
  if (typeof t === 'string') return t.slice(0, 10);
  if (typeof t === 'number') return new Date(t * 1000).toISOString().slice(0, 10);
  if (typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
    const m = String(t.month).padStart(2, '0');
    const d = String(t.day).padStart(2, '0');
    return t.year + '-' + m + '-' + d;
  }
  return String(t);
}

function pickNum(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      const n = Number(row[key]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return null;
}

function formatChartTime(t) {
  if (t == null) return '—';
  if (typeof t === 'string') return t;
  if (typeof t === 'number') return new Date(t * 1000).toISOString().slice(0, 10);
  if (typeof t === 'object' && 'year' in t && 'month' in t && 'day' in t) {
    const m = String(t.month).padStart(2, '0');
    const d = String(t.day).padStart(2, '0');
    return t.year + '-' + m + '-' + d;
  }
  return String(t);
}

function formatPrice(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  const x = Number(n);
  const abs = Math.abs(x);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
  return x.toFixed(digits);
}

/** Rising trend icon (dropdown trigger), stroke uses `currentColor`. */
export function IconChartTypeDropdown({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden>
      <path
        d="M4 17 L8 13 L11 15 L15 9 L17 11 L19 7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 7h4v4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ohlcFromMainPoint(chartType, md) {
  if (chartType === 'line' || chartType === 'area') {
    if (!md || md.value === undefined) return null;
    return { close: md.value };
  }
  if (!md || md.close === undefined) return null;
  return {
    open: md.open,
    high: md.high,
    low: md.low,
    close: md.close
  };
}

/**
 * TradingView **Lightweight Charts™** — main series type controlled by parent (line, area, candles, bars) + volume.
 * @param {{ rows: unknown[], height?: number, chartType?: TickerChartType }} props
 */
export function TickerLightweightChart({ rows, height = 320, chartType = 'line' }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const mainSeriesRef = useRef(null);
  const volRef = useRef(null);
  const rowByTimeRef = useRef(new Map());
  const chartTypeRef = useRef(chartType);
  const [crosshairHtml, setCrosshairHtml] = useState(null);

  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');

  const { linePoints, candles, volumes, rowByTime } = useMemo(() => {
    const sorted = [...(rows || [])].sort((a, b) => {
      const ta = rowDateToTimeKey(a);
      const tb = rowDateToTimeKey(b);
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    const candles0 = mapRowsToCandles(sorted);
    const byTime = new Map();
    for (const row of sorted) {
      const t = rowDateToTimeKey(row);
      if (t) byTime.set(t, row);
    }
    const linePts = candles0.map((c) => ({ time: c.time, value: c.close }));
    const upCol = chartTheme === 'light' ? 'rgba(22, 163, 74, 0.5)' : 'rgba(34, 197, 94, 0.45)';
    const downCol = chartTheme === 'light' ? 'rgba(220, 38, 38, 0.5)' : 'rgba(239, 68, 68, 0.45)';
    const volumes0 = candles0.map((c) => {
      const row = byTime.get(c.time);
      const v = row ? pickNum(row, ['Volume', 'volume', 'VOLUME']) : null;
      const val = v != null && Number.isFinite(v) && v > 0 ? v : 0;
      const up = c.close >= c.open;
      return {
        time: c.time,
        value: val,
        color: up ? upCol : downCol
      };
    });
    return { linePoints: linePts, candles: candles0, volumes: volumes0, rowByTime: byTime };
  }, [rows, chartTheme]);

  useEffect(() => {
    rowByTimeRef.current = rowByTime;
  }, [rowByTime]);

  useEffect(() => {
    chartTypeRef.current = chartType;
  }, [chartType]);

  const addMainSeries = useCallback((chart, type, theme) => {
    const ohlcStyle =
      theme === 'light'
        ? {
            upColor: '#16a34a',
            downColor: '#dc2626',
            borderVisible: false,
            wickUpColor: '#16a34a',
            wickDownColor: '#dc2626',
            priceScaleId: 'right'
          }
        : {
            upColor: '#22c55e',
            downColor: '#ef4444',
            borderVisible: false,
            wickUpColor: '#22c55e',
            wickDownColor: '#ef4444',
            priceScaleId: 'right'
          };
    const lineColor = theme === 'light' ? '#0284c7' : '#38bdf8';
    switch (type) {
      case 'line':
        return chart.addLineSeries({
          color: lineColor,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          priceScaleId: 'right'
        });
      case 'area':
        return chart.addAreaSeries({
          lineColor,
          topColor: theme === 'light' ? 'rgba(2, 132, 199, 0.35)' : 'rgba(56, 189, 248, 0.45)',
          bottomColor: theme === 'light' ? 'rgba(2, 132, 199, 0.04)' : 'rgba(56, 189, 248, 0.02)',
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          priceScaleId: 'right'
        });
      case 'candles':
        return chart.addCandlestickSeries(ohlcStyle);
      case 'bars':
        return chart.addBarSeries(ohlcStyle);
      default:
        return chart.addLineSeries({
          color: lineColor,
          lineWidth: 2,
          priceLineVisible: true,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          priceScaleId: 'right'
        });
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const appearance = chartOptionsForTheme(chartTheme, height);
    const chart = createChart(el, {
      ...appearance,
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
      },
      width: el.clientWidth
    });

    const mainSeries = addMainSeries(chart, chartType, chartTheme);
    const volSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: ''
    });

    mainSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.24 }
    });
    chart.priceScale('').applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 }
    });

    chartRef.current = chart;
    mainSeriesRef.current = mainSeries;
    volRef.current = volSeries;

    chart.subscribeCrosshairMove((param) => {
      if (!param || param.time === undefined || param.point === undefined) {
        setCrosshairHtml(null);
        return;
      }
      const ct = chartTypeRef.current;
      const md = param.seriesData.get(mainSeries);
      const ohlc = ohlcFromMainPoint(ct, md);
      if (!ohlc) {
        setCrosshairHtml(null);
        return;
      }
      const tKey = timeKeyFromCrosshair(param.time);
      const dateStr = formatChartTime(param.time);
      const row = rowByTimeRef.current.get(tKey);
      const v = param.seriesData.get(volSeries);
      const volLine =
        v && typeof v.value === 'number' && v.value > 0
          ? '\nVol ' + Math.round(v.value).toLocaleString('en-US')
          : '';
      let body;
      if (ct === 'line' || ct === 'area') {
        const o = row ? pickNum(row, ['Open', 'open']) : null;
        const h = row ? pickNum(row, ['High', 'high']) : null;
        const l = row ? pickNum(row, ['Low', 'low']) : null;
        const c = ohlc.close;
        body =
          o != null && h != null && l != null
            ? 'O ' +
              formatPrice(o) +
              '\nH ' +
              formatPrice(h) +
              '\nL ' +
              formatPrice(l) +
              '\nC ' +
              formatPrice(c)
            : 'Close ' + formatPrice(c);
      } else {
        body =
          'O ' +
          formatPrice(ohlc.open) +
          '\nH ' +
          formatPrice(ohlc.high) +
          '\nL ' +
          formatPrice(ohlc.low) +
          '\nC ' +
          formatPrice(ohlc.close);
      }
      setCrosshairHtml(
        <>
          <div className="ticker-lw-chart__ohlc-muted">{dateStr}</div>
          <span>
            {body}
            {volLine}
          </span>
        </>
      );
    });

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    });
    ro.observe(el);

    const onWinResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener('resize', onWinResize);

    return () => {
      ro.disconnect();
      window.removeEventListener('resize', onWinResize);
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volRef.current = null;
    };
  }, [height, chartType, addMainSeries, chartTheme]);

  useEffect(() => {
    const chart = chartRef.current;
    const main = mainSeriesRef.current;
    const volSeries = volRef.current;
    if (!chart || !main || !volSeries) return;

    if (chartType === 'line' || chartType === 'area') {
      main.setData(linePoints);
    } else {
      main.setData(candles);
    }
    volSeries.setData(volumes);
    chart.timeScale().fitContent();
  }, [linePoints, candles, volumes, chartType]);

  const hintLine =
    chartType === 'line' || chartType === 'area'
      ? 'hover for OHLC (line = Close)'
      : 'hover for OHLC on each bar';

  return (
    <div className="ticker-lw-chart">
      <div ref={containerRef} className="ticker-lw-chart__root" />
      <div
        className={
          'ticker-lw-chart__hover' + (chartTheme === 'light' ? ' ticker-lw-chart__hover--light' : '')
        }
        aria-live="polite"
      >
        {crosshairHtml == null ? (
          <>
            <div className="ticker-lw-chart__ohlc-muted">Crosshair</div>
            <span>Drag to pan · wheel / pinch to zoom · {hintLine}</span>
          </>
        ) : (
          crosshairHtml
        )}
      </div>
    </div>
  );
}
