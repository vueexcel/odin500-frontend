import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { createChart } from 'lightweight-charts';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { mapRowsToCandles, rowDateToTimeKey } from '../utils/chartData.js';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import {
  DEFAULT_TICKERS_PAGE_SYMBOL,
  resolveTickersPageSymbol,
  sanitizeTickerPageInput
} from '../utils/tickerUrlSync.js';

function toCsv(rows) {
  if (!rows.length) return '';
  const normalizedRows = rows.map((row) => {
    const normalizedDate = rowDateToTimeKey(row);
    return {
      ...row,
      Date: normalizedDate || row.Date || row.date || '',
      date: normalizedDate || row.date || row.Date || ''
    };
  });
  const keys = Object.keys(normalizedRows[0]);
  const header = keys.join(',');
  const body = normalizedRows
    .map((row) =>
      keys
        .map((k) => {
          const raw = row[k] == null ? '' : String(row[k]);
          const escaped = raw.replaceAll('"', '""');
          return `"${escaped}"`;
        })
        .join(',')
    )
    .join('\n');
  return header + '\n' + body;
}

function mapVolume(rows) {
  const out = [];
  for (const row of rows) {
    const time = rowDateToTimeKey(row);
    if (!time) continue;
    const close = Number(row.Close ?? row.close);
    const open = Number(row.Open ?? row.open);
    const volume = Number(row.Volume ?? row.volume ?? row.VOLUME);
    if (Number.isNaN(volume) || volume <= 0) continue;
    out.push({
      time,
      value: volume,
      color: close >= open ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'
    });
  }
  return out;
}

function parsePeriodDate(period) {
  const p = String(period || '');
  if (/^\d{4}-\d{2}$/.test(p)) return p + '-01';
  if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  return null;
}

function saveCsv(rows, fileName) {
  if (!rows.length) return;
  const csv = toCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Figma-style percentage with comma decimals (e.g. 2,5%). */
function formatPctEu(value) {
  if (value == null || !Number.isFinite(value)) return '—';
  const n = Math.round(value * 10) / 10;
  return n.toFixed(1).replace('.', ',') + '%';
}

function formatAsOfFromOhlc(rows) {
  const fallback = () =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    }).format(new Date());
  if (!rows?.length) return fallback();
  const iso = rowDateToTimeKey(rows[rows.length - 1]);
  if (!iso) return fallback();
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return fallback();
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(d);
}

function pickDynamicReturn(dynamicPeriods, name) {
  if (!Array.isArray(dynamicPeriods)) return null;
  const row = dynamicPeriods.find((r) => r.period === name);
  if (!row || row.totalReturn == null) return null;
  const v = Number(row.totalReturn);
  return Number.isFinite(v) ? v : null;
}

const ODIN_LADDER_STEPS = [
  { key: 'L1', label: 'L1', bg: '#348548', arrow: null },
  { key: 'L2', label: 'L2', bg: '#2DB14E', arrow: null },
  { key: 'L3', label: 'L3', bg: '#4CDA6F', active: true, arrow: 'up' },
  { key: 'S1', label: 'S1', bg: '#F78014', arrow: 'down' },
  { key: 'S2', label: 'S2', bg: '#FBA937', arrow: null },
  { key: 'S3', label: 'S3', bg: '#FCCE00', arrow: null },
  { key: 'N', label: 'N', bg: '#A5B4C6', arrow: null }
];

function IconInfoSmall() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
<path d="M7.29167 9.95833V7.29167M7.29167 4.625H7.29833M13.9583 7.29167C13.9583 10.9736 10.9736 13.9583 7.29167 13.9583C3.60977 13.9583 0.625 10.9736 0.625 7.29167C0.625 3.60977 3.60977 0.625 7.29167 0.625C10.9736 0.625 13.9583 3.60977 13.9583 7.29167Z" stroke="#A5B4C6" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}

function IconOdinTarget() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
<path d="M7.99992 14.6663C11.6818 14.6663 14.6666 11.6816 14.6666 7.99967C14.6666 4.31778 11.6818 1.33301 7.99992 1.33301C4.31802 1.33301 1.33325 4.31778 1.33325 7.99967C1.33325 11.6816 4.31802 14.6663 7.99992 14.6663Z" stroke="#F78014" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7.99992 11.9997C10.2091 11.9997 11.9999 10.2088 11.9999 7.99967C11.9999 5.79054 10.2091 3.99967 7.99992 3.99967C5.79078 3.99967 3.99992 5.79054 3.99992 7.99967C3.99992 10.2088 5.79078 11.9997 7.99992 11.9997Z" stroke="#F78014" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M7.99992 9.33301C8.7363 9.33301 9.33325 8.73605 9.33325 7.99967C9.33325 7.26329 8.7363 6.66634 7.99992 6.66634C7.26354 6.66634 6.66658 7.26329 6.66658 7.99967C6.66658 8.73605 7.26354 9.33301 7.99992 9.33301Z" stroke="#F78014" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}

function IconReturnsChart() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
<path d="M11.3333 6L7.71046 9.62288C7.57845 9.75488 7.51245 9.82088 7.43634 9.84561C7.36939 9.86737 7.29728 9.86737 7.23033 9.84561C7.15422 9.82088 7.08822 9.75488 6.95621 9.62288L5.71046 8.37712C5.57845 8.24512 5.51245 8.17912 5.43634 8.15439C5.36939 8.13263 5.29728 8.13263 5.23033 8.15439C5.15422 8.17912 5.08822 8.24512 4.95621 8.37712L2 11.3333M11.3333 6H8.66667M11.3333 6V8.66667M5.2 14H10.8C11.9201 14 12.4802 14 12.908 13.782C13.2843 13.5903 13.5903 13.2843 13.782 12.908C14 12.4802 14 11.9201 14 10.8V5.2C14 4.0799 14 3.51984 13.782 3.09202C13.5903 2.71569 13.2843 2.40973 12.908 2.21799C12.4802 2 11.9201 2 10.8 2H5.2C4.0799 2 3.51984 2 3.09202 2.21799C2.71569 2.40973 2.40973 2.71569 2.21799 3.09202C2 3.51984 2 4.0799 2 5.2V10.8C2 11.9201 2 12.4802 2.21799 12.908C2.40973 13.2843 2.71569 13.5903 3.09202 13.782C3.51984 14 4.0799 14 5.2 14Z" stroke="#4CDA6F" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}

function IconOdinSun() {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
<path d="M7.99984 2.66699V13.3337M11.9998 4.00033L3.99984 12.0003M13.3332 8.00033H2.6665M11.9998 12.0003L3.99984 4.00033" stroke="#FED02C" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
  );
}

function ArrowTrend({ tone }) {
  const green = tone === 'green';
  if (green) {
    return (
      <svg
        className="odin-ladder__arrow odin-ladder__arrow--up"
        xmlns="http://www.w3.org/2000/svg"
        width="19"
        height="10"
        viewBox="0 0 19 10"
        fill="none"
        aria-hidden
      >
        <path
          d="M17.4167 0.75L10.8595 7.30719C10.5295 7.63721 10.3645 7.80221 10.1742 7.86404C10.0068 7.91842 9.82652 7.91842 9.65915 7.86404C9.46888 7.80221 9.30387 7.6372 8.97386 7.30719L6.69281 5.02614C6.36279 4.69613 6.19779 4.53112 6.00751 4.4693C5.84014 4.41492 5.65986 4.41492 5.49249 4.4693C5.30221 4.53112 5.1372 4.69613 4.80719 5.02614L0.75 9.08333M17.4167 0.75H11.5833M17.4167 0.75V6.58333"
          stroke="#38C35B"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg className="odin-ladder__arrow odin-ladder__arrow--down" xmlns="http://www.w3.org/2000/svg" width="19" height="10" viewBox="0 0 19 10" fill="none">
    <path
      d="M17.4167 9.08333L10.8595 2.52614C10.5295 2.19613 10.3645 2.03112 10.1742 1.9693C10.0068 1.91492 9.82652 1.91492 9.65915 1.9693C9.46888 2.03112 9.30387 2.19613 8.97386 2.52614L6.69281 4.80719C6.36279 5.13721 6.19779 5.30221 6.00751 5.36404C5.84014 5.41842 5.65986 5.41842 5.49249 5.36404C5.30221 5.30221 5.1372 5.1372 4.80719 4.80719L0.75 0.75M17.4167 9.08333H11.5833M17.4167 9.08333V3.25"
      stroke="#FA4C60"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    </svg>
  );
}

function OhlcChart({ rows }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  const candles = useMemo(() => mapRowsToCandles(rows), [rows]);
  const volume = useMemo(() => mapVolume(rows), [rows]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: { background: { color: '#ffffff' }, textColor: '#64748b' },
      grid: {
        vertLines: { color: '#edf2f7' },
        horzLines: { color: '#edf2f7' }
      },
      rightPriceScale: { borderColor: '#e2e8f0' },
      timeScale: { borderColor: '#e2e8f0' },
      width: container.clientWidth,
      height: 430
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      borderVisible: false
    });
    candleSeries.setData(candles);

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      base: 0
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 }
    });
    volumeSeries.setData(volume);

    chart.timeScale().fitContent();
    chartRef.current = chart;

    const onResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, volume]);

  return <div ref={chartContainerRef} className="trading-chart-root" />;
}

function ReturnsBarLineChart({ rows }) {
  const chartContainerRef = useRef(null);

  const chartData = useMemo(() => {
    const cleaned = rows
      .map((row) => {
        const period = String(row.period || '').slice(0, 4);
        const value = Number(row.totalReturn ?? row.simpleAnnualReturn ?? row.cagrPercent);
        return { period, value };
      })
      .filter((x) => /^\d{4}$/.test(x.period) && Number.isFinite(x.value))
      .slice(-12);
    const avg =
      cleaned.reduce((sum, x) => sum + x.value, 0) / (cleaned.length > 0 ? cleaned.length : 1);
    return {
      bars: cleaned.map((x) => ({ time: x.period + '-01-01', value: x.value, color: '#2d9cff' })),
      avgLine: cleaned.map((x) => ({ time: x.period + '-01-01', value: avg }))
    };
  }, [rows]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      layout: { background: { color: '#ffffff' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#eef3f8' }, horzLines: { color: '#eef3f8' } },
      rightPriceScale: { borderColor: '#e2e8f0' },
      timeScale: { borderColor: '#e2e8f0' },
      width: container.clientWidth,
      height: 190
    });
    const bars = chart.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
    const avgLine = chart.addLineSeries({
      color: '#ff4d6d',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false
    });
    bars.setData(chartData.bars);
    avgLine.setData(chartData.avgLine);
    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
  }, [chartData]);

  return <div ref={chartContainerRef} className="returns-chart-root" />;
}

function ReturnsLineChart({ rows }) {
  const chartContainerRef = useRef(null);
  const lineData = useMemo(
    () =>
      rows
        .map((row) => ({
          time: parsePeriodDate(row.period),
          value: Number(row.totalReturn ?? row.simpleAnnualReturn ?? row.cagrPercent)
        }))
        .filter((x) => x.time && Number.isFinite(x.value))
        .slice(-12),
    [rows]
  );

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;
    const chart = createChart(container, {
      layout: { background: { color: '#ffffff' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#eef3f8' }, horzLines: { color: '#eef3f8' } },
      rightPriceScale: { borderColor: '#e2e8f0' },
      timeScale: { borderColor: '#e2e8f0' },
      width: container.clientWidth,
      height: 190
    });
    const line = chart.addLineSeries({
      color: '#4ea5ff',
      lineWidth: 3,
      priceLineVisible: false
    });
    line.setData(lineData);
    chart.timeScale().fitContent();
    const onResize = () => chart.applyOptions({ width: container.clientWidth });
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
  }, [lineData]);

  return <div ref={chartContainerRef} className="returns-chart-root" />;
}

function GroupedBarsChart({ rows }) {
  const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const series = useMemo(() => {
    const parsed = rows
      .map((row) => {
        const period = String(row.period || '');
        const m = period.match(/^(\d{4})-(\d{2})$/);
        if (!m) return null;
        const year = m[1];
        const month = Number(m[2]);
        const value = Number(row.totalReturn ?? row.simpleAnnualReturn ?? row.cagrPercent);
        if (!Number.isFinite(value)) return null;
        return { year, month, value };
      })
      .filter(Boolean);

    const years = Array.from(new Set(parsed.map((x) => x.year))).sort().slice(-3);
    const colors = ['#2d9cff', '#22c55e', '#facc15'];
    return years.map((year, idx) => ({
      year,
      color: colors[idx] || '#94a3b8',
      points: monthLabels.map((_, mIdx) => {
        const item = parsed.find((x) => x.year === year && x.month === mIdx + 1);
        return item ? item.value : 0;
      })
    }));
  }, [rows]);

  const maxAbs = Math.max(
    10,
    ...series.flatMap((s) => s.points.map((v) => Math.abs(v)))
  );
  const height = 180;
  const baseline = height / 2;
  const colW = 100 / 12;
  const barW = colW / (series.length + 1);

  return (
    <div className="grouped-bars-wrap">
      <svg viewBox="0 0 1200 220" className="grouped-bars-svg" preserveAspectRatio="none">
        {Array.from({ length: 6 }).map((_, i) => {
          const y = 20 + i * 30;
          return <line key={y} x1="0" y1={y} x2="1200" y2={y} className="grid-line" />;
        })}
        <line x1="0" y1={20 + baseline} x2="1200" y2={20 + baseline} className="axis-line" />
        {series.map((s, sIdx) =>
          s.points.map((value, mIdx) => {
            const xPct = mIdx * colW + sIdx * barW + 2;
            const x = (xPct / 100) * 1200;
            const h = (Math.abs(value) / maxAbs) * (height / 2 - 8);
            const y = value >= 0 ? 20 + baseline - h : 20 + baseline;
            return (
              <rect
                key={s.year + '-' + mIdx}
                x={x}
                y={y}
                width={(barW / 100) * 1200 - 3}
                height={h}
                fill={s.color}
                rx="1"
              />
            );
          })
        )}
      </svg>
      <div className="month-labels">
        {monthLabels.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
      <div className="mini-chart-legend">
        {series.map((s) => (
          <span key={s.year} className="year-chip">
            <i style={{ background: s.color }} />
            {s.year}
          </span>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ segments, size = 180, stroke = 16, centerText, showBadges = false }) {
  const cleanSegments = segments.filter((s) => Math.max(0, Number(s.value) || 0) > 0);
  const total = Math.max(
    1,
    cleanSegments.reduce((sum, s) => sum + Math.max(0, Number(s.value) || 0), 0)
  );
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let acc = 0;
  let runningPct = 0;
  return (
    <svg width={size*2} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
      <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
        {cleanSegments.map((seg) => {
          const value = Math.max(0, Number(seg.value) || 0);
          const arc = (value / total) * circumference;
          const dasharray = `${arc} ${circumference - arc}`;
          const dashoffset = -acc;
          acc += arc;
          return (
            <circle
              key={seg.label}
              cx="0"
              cy="0"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={stroke}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </g>
      <circle cx={size / 2} cy={size / 2} r={radius - stroke / 2} fill="#fff" />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="donut-center-text">
        {centerText}
      </text>
      {showBadges
        ? cleanSegments.map((seg) => {
            const pct = (Math.max(0, Number(seg.value) || 0) / total) * 100;
            const mid = runningPct + pct / 2;
            runningPct += pct;
            const angle = (mid / 100) * Math.PI * 2 - Math.PI / 2;
            const r = radius + 10;
            const x = size / 2 + Math.cos(angle) * r;
            const y = size / 2 + Math.sin(angle) * r;
            return (
              <g key={seg.label + '-badge'}>
                <circle cx={x} cy={y} r="14" fill="#fff" stroke="#e2e8f0" />
                <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle" className="donut-badge-text">
                  {Math.round(pct)}%
                </text>
              </g>
            );
          })
        : null}
    </svg>
  );
}

function AnnualBarsChart({ values }) {
  const ticks = [50, 38, 25, 13, 0, -13, -25];
  const minTick = -25;
  const maxTick = 50;
  const plotTop = 18;
  const plotBottom = 188;
  const plotHeight = plotBottom - plotTop;
  const yFor = (v) => plotTop + ((maxTick - v) / (maxTick - minTick)) * plotHeight;
  const zeroY = yFor(0);
  return (
    <div className="annual-bars-wrap">
      <svg viewBox="0 0 420 220" className="annual-bars-svg" preserveAspectRatio="none">
        {ticks.map((t) => {
          const y = yFor(t);
          return (
            <g key={t}>
              <line x1="36" y1={y} x2="410" y2={y} className="grid-line dashed" />
              <text x="6" y={y + 3} className="annual-y-label">
                {t === 0 ? '0' : `${t}%`}
              </text>
            </g>
          );
        })}
        <line x1="36" y1={zeroY} x2="410" y2={zeroY} className="axis-line" />
        {values.map((v, idx) => {
          const x = 96 + idx * 116;
          const clamped = Math.max(minTick, Math.min(maxTick, Number(v.value) || 0));
          const yValue = yFor(clamped);
          const h = Math.abs(zeroY - yValue);
          const y = clamped >= 0 ? yValue : zeroY;
          return (
            <rect key={v.label} x={x} y={y} width="34" height={h} fill="#2d9cff" rx="1.5" />
          );
        })}
      </svg>
      <div className="annual-bars-labels">
        {values.map((v) => (
          <span key={v.label}>{v.label}</span>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, onShowDataTable, onDownloadCsv, downloadLabel = 'Download CSV' }) {
  return (
    <div className="tickers-section-head">
      <h2>{title}</h2>
      <div className="tickers-head-actions">
        <button type="button" onClick={onShowDataTable} disabled={!onShowDataTable}>
          Show Data Table
        </button>
        <button type="button" className="btn-secondary" onClick={onDownloadCsv} disabled={!onDownloadCsv}>
          {downloadLabel}
        </button>
      </div>
    </div>
  );
}

function MiniChartCard({ title }) {
  return (
    <div className="mini-chart-card">
      <div className="mini-chart-title">{title}</div>
      <div className="mini-chart" />
      <div className="mini-chart-legend">
        <span className="blue-dot">2019</span>
        <span className="yellow-dot">2020</span>
        <span className="teal-dot">2025</span>
      </div>
    </div>
  );
}

export default function TickersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const symbol = useMemo(() => resolveTickersPageSymbol(searchParams), [searchParams]);

  const setSymbolInUrl = useCallback(
    (sym) => {
      const clean =
        sanitizeTickerPageInput(sym) || DEFAULT_TICKERS_PAGE_SYMBOL;
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

  const [ohlcRows, setOhlcRows] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [showReturnsTable, setShowReturnsTable] = useState(false);
  const [showNewChartTable, setShowNewChartTable] = useState(false);
  const [breakdownFilter, setBreakdownFilter] = useState('all');
  const [chartError, setChartError] = useState('');
  const [loadingChart, setLoadingChart] = useState(true);
  const [returnsData, setReturnsData] = useState({
    annualReturns: [],
    monthlyReturns: [],
    quarterlyReturns: [],
    dynamicPeriods: []
  });
  const [topTickers, setTopTickers] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadChart() {
      const token = getAuthToken();
      if (!token) {
        if (!cancelled) {
          setChartError('Missing auth token. Please login again.');
          setLoadingChart(false);
        }
        return;
      }
      try {
        setLoadingChart((prev) => (ohlcRows.length ? false : prev || true));
        setChartError('');
        const { data: payload } = await fetchJsonCached({
          path: '/api/market/ohlc?symbol=' + encodeURIComponent(symbol),
          method: 'GET',
          ttlMs: 10 * 60 * 1000
        });
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload.data) ? payload.data : [];
        if (!cancelled) setOhlcRows(rows);
      } catch (err) {
        if (!cancelled) setChartError(err.message || 'Failed to load chart');
      } finally {
        if (!cancelled) setLoadingChart(false);
      }
    }

    loadChart();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;
    async function loadTopTickers() {
      const token = getAuthToken();
      if (!token) return;
      try {
        const { data: payload } = await fetchJsonCached({
          path: '/api/market/ticker-details',
          method: 'POST',
          body: { index: 'sp500', period: 'last-1-year' },
          ttlMs: 15 * 60 * 1000
        });
        const data = Array.isArray(payload?.data) ? payload.data.slice(0, 5) : [];
        if (!cancelled) setTopTickers(data);
      } catch {
        if (!cancelled) setTopTickers([]);
      }
    }
    loadTopTickers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadReturns() {
      const token = getAuthToken();
      if (!token) return;
      try {
        const { data: payload } = await fetchJsonCached({
          path: '/api/market/ticker-returns',
          method: 'POST',
          body: { ticker: symbol },
          ttlMs: 10 * 60 * 1000
        });
        const perf = payload?.performance || {};
        if (!cancelled) {
          setReturnsData({
            annualReturns: Array.isArray(perf.annualReturns) ? perf.annualReturns : [],
            monthlyReturns: Array.isArray(perf.monthlyReturns) ? perf.monthlyReturns : [],
            quarterlyReturns: Array.isArray(perf.quarterlyReturns) ? perf.quarterlyReturns : [],
            dynamicPeriods: Array.isArray(perf.dynamicPeriods) ? perf.dynamicPeriods : []
          });
        }
      } catch {
        if (!cancelled) {
          setReturnsData({
            annualReturns: [],
            monthlyReturns: [],
            quarterlyReturns: [],
            dynamicPeriods: []
          });
        }
      }
    }
    loadReturns();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const handleDownloadCsv = () => {
    saveCsv(ohlcRows, symbol + '-ohlc.csv');
  };

  const annual = returnsData.annualReturns;
  const monthly = returnsData.monthlyReturns;
  const positiveYears = annual.filter((x) => Number(x.totalReturn) > 0).length;
  const neutralYears = annual.filter((x) => Number(x.totalReturn) === 0).length;
  const negativeYears = annual.filter((x) => Number(x.totalReturn) < 0).length;
  const avgAnnual =
    annual.reduce((s, x) => s + (Number(x.totalReturn) || 0), 0) / (annual.length || 1);
  const avgPos =
    annual
      .filter((x) => Number(x.totalReturn) > 0)
      .reduce((s, x) => s + (Number(x.totalReturn) || 0), 0) / (positiveYears || 1);
  const avgNeg =
    annual
      .filter((x) => Number(x.totalReturn) <= 0)
      .reduce((s, x) => s + (Number(x.totalReturn) || 0), 0) / (negativeYears || 1);
  const maxAnnual = Math.max(...annual.map((x) => Number(x.totalReturn) || 0), 0);
  const minAnnual = Math.min(...annual.map((x) => Number(x.totalReturn) || 0), 0);

  const bucketDefs = [
    { key: '0-1', label: '0 - 1%', min: 0, max: 1, color: '#ff4d6d' },
    { key: '1-2.5', label: '1 - 2.5%', min: 1, max: 2.5, color: '#f59e0b' },
    { key: '2.5-5', label: '2.5 - 5%', min: 2.5, max: 5, color: '#facc15' },
    { key: '5-10', label: '5 - 10%', min: 5, max: 10, color: '#22c55e' },
    { key: '10+', label: '> 10%', min: 10, max: Infinity, color: '#2d9cff' }
  ];

  const filteredMonthly = monthly.filter((m) => {
    const v = Number(m.totalReturn) || 0;
    if (breakdownFilter === 'positive') return v > 0;
    if (breakdownFilter === 'negative') return v <= 0;
    return true;
  });

  const bucketStats = bucketDefs.map((b) => {
    const inBucket = filteredMonthly.filter((m) => {
      const v = Math.abs(Number(m.totalReturn) || 0);
      return v >= b.min && v < b.max;
    });
    const profit = inBucket.filter((m) => Number(m.totalReturn) > 0).length;
    const loss = inBucket.length - profit;
    return {
      ...b,
      total: inBucket.length,
      profit,
      loss
    };
  });

  const dyn = returnsData.dynamicPeriods;
  const summaryY1 = pickDynamicReturn(dyn, 'Last 1 year');
  const summaryY3 = pickDynamicReturn(dyn, 'Last 3 years');
  const summaryY10 = pickDynamicReturn(dyn, 'Last 10 years');
  const ret1 = summaryY1 ?? 5;
  const ret3 = summaryY3 ?? 2.5;
  const ret10 = summaryY10 ?? 4.2;
  const signalAsOf = formatAsOfFromOhlc(ohlcRows);
  const signalDateIso =
    ohlcRows?.length > 0 ? rowDateToTimeKey(ohlcRows[ohlcRows.length - 1]) : '';

  return (
    <div className="tickers-page-wrap">
      <div className="tickers-page">
        <TickerSymbolCombobox symbol={symbol} onSymbolChange={setSymbolInUrl} />

        <div className="signal-cards">
          <div className="signal-card signal-card--odin">
            <div className="signal-card__head">
              <div className="signal-card__head-left">
                <IconOdinTarget />
                <span className="signal-card__title">Odin Signal</span>
                <button type="button" className="signal-card__info-btn" aria-label="About Odin Signal">
                  <IconInfoSmall />
                </button>
              </div>
              <time className="signal-card__date" dateTime={signalDateIso || undefined}>
                {signalAsOf}
              </time>
            </div>
            <div className="odin-ladder" role="list">
              {ODIN_LADDER_STEPS.map((step) => (
                <div key={step.key} className="odin-ladder__col" role="listitem">
                  <div
                    className={
                      'odin-ladder__cell' + (step.active ? ' odin-ladder__cell--active' : '')
                    }
                    style={{ background: step.bg }}
                  >
                    {step.label}
                  </div>
                  <div className="odin-ladder__arrow-slot">
                    {step.arrow === 'up' ? <ArrowTrend tone="green" /> : null}
                    {step.arrow === 'down' ? <ArrowTrend tone="down" /> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="signal-card signal-card--metrics">
            <div className="signal-card__head signal-card__head--simple">
              <div className="signal-card__head-left">
                <IconReturnsChart />
                <span className="signal-card__title">Returns</span>
              </div>
            </div>
            <div className="signal-metrics">
              <div className="signal-metric">
                <span className="signal-metric__label">Last year</span>
                <span className="signal-metric__value">{formatPctEu(ret1)}</span>
              </div>
              <div className="signal-metric">
                <span className="signal-metric__label">3 years</span>
                <span className="signal-metric__value">{formatPctEu(ret3)}</span>
              </div>
              <div className="signal-metric">
                <span className="signal-metric__label">10 years</span>
                <span className="signal-metric__value">{formatPctEu(ret10)}</span>
              </div>
            </div>
          </div>

          <div className="signal-card signal-card--metrics">
            <div className="signal-card__head signal-card__head--simple">
              <div className="signal-card__head-left">
                <IconOdinSun />
                <span className="signal-card__title">Odin Index</span>
                <button type="button" className="signal-card__info-btn" aria-label="About Odin Index">
                  <IconInfoSmall />
                </button>
              </div>
            </div>
            <div className="signal-metrics">
              <div className="signal-metric">
                <span className="signal-metric__label">1 year</span>
                <span className="signal-metric__value">{formatPctEu(ret1)}</span>
              </div>
              <div className="signal-metric">
                <span className="signal-metric__label">3 years</span>
                <span className="signal-metric__value">{formatPctEu(ret3)}</span>
              </div>
              <div className="signal-metric">
                <span className="signal-metric__label">10 years</span>
                <span className="signal-metric__value">{formatPctEu(ret10)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="odin-info">
          <h3>What is Odin Signal</h3>
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
            incididunt ut labore et dolore magna aliqua.
          </p>
        </div>

        <section className="ticker-section">
          <SectionHeader
            title="Charts"
            onShowDataTable={() => setShowTable((v) => !v)}
            onDownloadCsv={handleDownloadCsv}
          />
          <div className="chart-preview-large">
            {loadingChart ? <div className="chart-state">Loading chart...</div> : null}
            {!loadingChart && chartError ? <div className="chart-state error">{chartError}</div> : null}
            {!loadingChart && !chartError ? <OhlcChart rows={ohlcRows} /> : null}
          </div>
          {showTable ? (
            <div className="table-card chart-table-wrap">
              <div className="table-title">OHLC data ({ohlcRows.length} rows)</div>
              <div className="chart-table-scroll">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Open</th>
                      <th>High</th>
                      <th>Low</th>
                      <th>Close</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ohlcRows.slice(0, 150).map((row, idx) => (
                      <tr key={String(row.Date || row.date || idx)}>
                        <td>{rowDateToTimeKey(row) || String(row.Date || row.date || '').slice(0, 10)}</td>
                        <td>{row.Open ?? row.open}</td>
                        <td>{row.High ?? row.high}</td>
                        <td>{row.Low ?? row.low}</td>
                        <td>{row.Close ?? row.close}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="ticker-section">
          <SectionHeader
            title="Returns"
            onShowDataTable={() => setShowReturnsTable((v) => !v)}
            onDownloadCsv={() =>
              saveCsv(
                returnsData.monthlyReturns.map((r) => ({ ...r, source: 'monthly' })),
                symbol + '-returns.csv'
              )
            }
          />
          <div className="returns-grid">
            <div className="table-card">
              <div className="table-title">Table Name</div>
              <ReturnsBarLineChart rows={returnsData.annualReturns} />
            </div>
            <div className="table-card">
              <div className="table-title">Table Name</div>
              <ReturnsLineChart rows={returnsData.monthlyReturns} />
            </div>
          </div>
          {showReturnsTable ? (
            <div className="table-card chart-table-wrap">
              <div className="table-title">Monthly returns ({returnsData.monthlyReturns.length} rows)</div>
              <div className="chart-table-scroll">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Total Return</th>
                      <th>CAGR %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnsData.monthlyReturns.map((row, idx) => (
                      <tr key={String(row.period || idx)}>
                        <td>{row.period}</td>
                        <td>{row.startDate}</td>
                        <td>{row.endDate}</td>
                        <td>{row.totalReturn}</td>
                        <td>{row.cagrPercent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="ticker-section">
          <SectionHeader
            title="New Chart"
            onShowDataTable={() => setShowNewChartTable((v) => !v)}
            onDownloadCsv={() => saveCsv(returnsData.monthlyReturns, symbol + '-new-chart.csv')}
          />
          <div className="table-card">
            <div className="table-title center">Table Name</div>
            <GroupedBarsChart rows={returnsData.monthlyReturns} />
          </div>
          {showNewChartTable ? (
            <div className="table-card chart-table-wrap">
              <div className="table-title">Quarterly returns ({returnsData.quarterlyReturns.length} rows)</div>
              <div className="chart-table-scroll">
                <table className="chart-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Start Date</th>
                      <th>End Date</th>
                      <th>Total Return</th>
                      <th>CAGR %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnsData.quarterlyReturns.map((row, idx) => (
                      <tr key={String(row.period || idx)}>
                        <td>{row.period}</td>
                        <td>{row.startDate}</td>
                        <td>{row.endDate}</td>
                        <td>{row.totalReturn}</td>
                        <td>{row.cagrPercent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </section>

        <section className="ticker-section">
          <SectionHeader title="Odin Index" />
          <div className="returns-grid">
            <MiniChartCard title="AAPL" />
            <MiniChartCard title="AAPL_1" />
          </div>
        </section>

        <section className="ticker-section">
          <div className="tickers-section-head">
            <h2>Stats</h2>
            <div className="tickers-head-actions">
              <button type="button">Show Data Tables</button>
            </div>
          </div>
          <div className="returns-grid">
            <div className="table-card stats-card">
              <div className="table-title center">Annual Statistics, years</div>
              <div className="stats-flex mt-[30px]">
                <DonutChart
                  centerText=""
                  segments={[
                    { label: 'positive years', value: positiveYears, color: '#2d9cff' },
                    { label: 'neutral years', value: neutralYears, color: '#facc15' },
                    { label: 'negative years', value: negativeYears, color: '#ff4d6d' }
                  ]}
                  showBadges
                />
                <div className="stats-legend -ml-[30px]">
                  <span><i style={{ background: '#2d9cff' }} /> positive years</span>
                  <span><i style={{ background: '#ff4d6d' }} /> negative years</span>
                </div>
              </div>
            </div>
            <div className="table-card stats-card">
              <div className="table-title center">Annual Statistics, %</div>
              <AnnualBarsChart
                values={[
                  { label: 'Max', value: maxAnnual || 0 },
                  { label: 'Min', value: minAnnual || 0 },
                  { label: 'Average', value: avgAnnual || 0 }
                ]}
              />
            </div>
          </div>
        </section>

        <section className="ticker-section">
          <div className="tickers-section-head">
            <h2>New Chart</h2>
          </div>
          <div className="table-card">
            <div className="justify-between items-center flex flex-col sm:flex-row">
              <DonutChart
                centerText=""
                segments={bucketStats.map((b) => ({ label: b.label, value: b.total, color: b.color }))}
                showBadges
              />
              <div className="ticker-list max-w-60% sm:max-w-full">
                {topTickers.map((t, idx) => (
                  <div className="ticker-list-row" key={t.symbol}>
                    <div className="ticker-main">
                      <span className="ticker-dot" style={{ background: bucketDefs[idx % bucketDefs.length].color }} />
                      <span className="ticker-symbol">{t.symbol}</span>
                      <span className="ticker-name">{t.security}</span>
                    </div>
                    <span className="ticker-return">{Number(t.totalReturnPercentage || 0).toFixed(0)}%</span>
                    <span className="ticker-price">(${Number(t.price || 0).toFixed(2)})</span>
                    <div
                      className="ticker-row-line"
                      style={{
                        width: `${Math.min(100, Math.max(12, Math.abs(Number(t.totalReturnPercentage || 0))))}%`,
                        background: bucketDefs[idx % bucketDefs.length].color
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ticker-section">
          <div className="tickers-section-head">
            <h2>Returns Breakdown</h2>
          </div>
          <div className="breakdown-tabs">
            <button
              type="button"
              className={breakdownFilter === 'all' ? 'active' : ''}
              onClick={() => setBreakdownFilter('all')}
            >
              All Years
            </button>
            <button
              type="button"
              className={breakdownFilter === 'positive' ? 'active' : ''}
              onClick={() => setBreakdownFilter('positive')}
            >
              Positive Years
            </button>
            <button
              type="button"
              className={breakdownFilter === 'negative' ? 'active' : ''}
              onClick={() => setBreakdownFilter('negative')}
            >
              Negative Years
            </button>
          </div>
          <div className="returns-grid">
            <div className="table-card stats-card">
              <div className="table-title center">Years, total</div>
              <div className="stats-flex">
                <DonutChart
                  centerText={String(filteredMonthly.length)}
                  segments={bucketStats.map((b) => ({ label: b.label, value: b.total, color: b.color }))}
                />
                <div className="stats-legend">
                  {bucketStats.map((b) => (
                    <span key={b.key}>
                      <i style={{ background: b.color }} /> {b.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="table-card">
              <table className="chart-table">
                <thead>
                  <tr>
                    <th>Bucket</th>
                    <th>[A] Total</th>
                    <th>[A] Profit</th>
                    <th>[A] Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {bucketStats.map((b) => (
                    <tr key={b.key}>
                      <td>{b.label}</td>
                      <td>{b.total}</td>
                      <td>{b.profit}</td>
                      <td>{b.loss}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>Subtotal</strong></td>
                    <td><strong>{bucketStats.reduce((s, b) => s + b.total, 0)}</strong></td>
                    <td><strong>{bucketStats.reduce((s, b) => s + b.profit, 0)}</strong></td>
                    <td><strong>{bucketStats.reduce((s, b) => s + b.loss, 0)}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
