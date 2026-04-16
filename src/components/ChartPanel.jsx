import {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
  useSyncExternalStore
} from 'react';
import { createChart } from 'lightweight-charts';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';

function formatChartTime(t) {
  if (t == null) return '—';
  if (typeof t === 'string') return t;
  if (typeof t === 'number') {
    return new Date(t * 1000).toISOString().slice(0, 10);
  }
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

export const ChartPanel = forwardRef(function ChartPanel(_props, ref) {
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const ma200SeriesRef = useRef(null);
  const markersRef = useRef([]);
  const [hoverHtml, setHoverHtml] = useState(null);

  const applyMarkers = useCallback(() => {
    const s = candleSeriesRef.current;
    const m = markersRef.current;
    if (s && m?.length) s.setMarkers(m);
  }, []);

  const applyChartTheme = useCallback((theme) => {
    const chart = chartRef.current;
    if (!chart) return;
    if (theme === 'light') {
      chart.applyOptions({
        layout: { background: { color: '#ffffff' }, textColor: '#334155' },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.22)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.22)' }
        },
        rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.45)' },
        timeScale: { borderColor: 'rgba(148, 163, 184, 0.45)' }
      });
    } else {
      chart.applyOptions({
        layout: { background: { color: '#0b1220' }, textColor: '#d1d5db' },
        grid: {
          vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
          horzLines: { color: 'rgba(148, 163, 184, 0.2)' }
        },
        rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.35)' },
        timeScale: { borderColor: 'rgba(148, 163, 184, 0.35)' }
      });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setChartData({ candles, markers, ma200 }) {
      const candleSeries = candleSeriesRef.current;
      const ma200Series = ma200SeriesRef.current;
      if (!candleSeries || !ma200Series) return;
      candleSeries.setData(candles || []);
      markersRef.current = markers || [];
      candleSeries.setMarkers(markersRef.current);
      ma200Series.setData(ma200 || []);
      chartRef.current?.timeScale().fitContent();
    },
    getMarkers() {
      return markersRef.current;
    },
    applyMarkers
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { color: '#0b1220' },
        textColor: '#d1d5db'
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.2)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.2)' }
      },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.35)' },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.35)' },
      width: el.clientWidth,
      height: 560
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#16a34a',
      downColor: '#dc2626',
      borderVisible: false,
      wickUpColor: '#16a34a',
      wickDownColor: '#dc2626'
    });

    const ma200Series = chart.addLineSeries({
      color: '#3b82f6',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: 'MA200'
    });

    chartRef.current = chart;
    applyChartTheme(chartTheme);

    candleSeriesRef.current = candleSeries;
    ma200SeriesRef.current = ma200Series;

    chart.subscribeCrosshairMove((param) => {
      if (!param || param.time === undefined || param.point === undefined) {
        setHoverHtml(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries);
      if (!bar || bar.open === undefined) {
        setHoverHtml(null);
        return;
      }
      const dateStr = formatChartTime(param.time);
      const lines =
        'O ' +
        formatPrice(bar.open) +
        '\nH ' +
        formatPrice(bar.high) +
        '\nL ' +
        formatPrice(bar.low) +
        '\nC ' +
        formatPrice(bar.close);
      setHoverHtml(
        <>
          <div className="ohlc-muted">{dateStr}</div>
          <span>{lines}</span>
        </>
      );
    });

    const onResize = () => {
      if (!containerRef.current || !chart) return;
      chart.applyOptions({ width: containerRef.current.clientWidth });
      applyMarkers();
    };

    window.addEventListener('resize', onResize);
    chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      applyMarkers();
    });

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      ma200SeriesRef.current = null;
    };
  }, [applyMarkers, applyChartTheme, chartTheme]);

  useEffect(() => {
    applyChartTheme(chartTheme);
  }, [chartTheme, applyChartTheme]);

  return (
    <div className="panel">
      <div className="chart-wrap">
        <div ref={containerRef} className="chart-root" />
        <div className="ohlc-hover" aria-live="polite">
          {hoverHtml == null ? (
            <>
              <div className="ohlc-muted">Crosshair</div>
              <span>Move over the chart…</span>
            </>
          ) : (
            hoverHtml
          )}
        </div>
      </div>
    </div>
  );
});
