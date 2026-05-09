import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createChart } from 'lightweight-charts';
import { useSearchParams } from 'react-router-dom';
import { ThemedDropdown } from '../components/ThemedDropdown.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
import { AnnualReturnBarChart } from '../components/AnnualReturnBarChart.jsx';
import { ExcessReturnLineChart } from '../components/ExcessReturnLineChart.jsx';
import { PeriodicReturnBarChart } from '../components/PeriodicReturnBarChart.jsx';
import { fetchWithAuth, getAuthToken } from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { useTickerList } from '../hooks/useTickerList.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';
import { LightweightChartAreaSkeleton } from '../components/ChartSkeletons.jsx';

const INDEX_OPTIONS = ['SPY', 'QQQ', 'DIA', 'IWM'];
const COLOR_BY_SERIES = {
  TICKER: '#3B6BC0',
  INDEX: '#E67E22',
  QQQ: '#A3A3A3',
  DIA: '#F4B400'
};
const MODE_OPTIONS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annually', label: 'Annually' }
];

function toIsoDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseMiddayMs(iso) {
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function toChartTime(ms) {
  return Math.floor(ms / 1000);
}

function normalizeOhlcRows(rows) {
  if (!Array.isArray(rows)) return [];
  // API can return repeated same-day rows; keep the latest close per day.
  const byTime = new Map();
  for (const row of rows) {
    const iso = String(
      row?.Date ?? row?.date ?? row?.TradeDate ?? row?.tradeDate ?? row?.trade_date ?? row?.time ?? ''
    ).slice(0, 10);
    const close = Number(row?.AdjClose ?? row?.adjClose ?? row?.adj_close ?? row?.Close ?? row?.close);
    const t = parseMiddayMs(iso);
    if (!Number.isFinite(t) || !Number.isFinite(close) || close <= 0) continue;
    byTime.set(t, { t, close, iso });
  }
  const out = Array.from(byTime.values());
  out.sort((a, b) => a.t - b.t);
  return out;
}

function periodKey(t, mode) {
  const d = new Date(t);
  if (mode === 'weekly') {
    const first = new Date(d.getFullYear(), 0, 1);
    const dayMs = 86400000;
    const day = Math.floor((d.getTime() - first.getTime()) / dayMs) + 1;
    const week = Math.ceil(day / 7);
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  if (mode === 'monthly') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (mode === 'quarterly') return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
  if (mode === 'annually') return String(d.getFullYear());
  return toIsoDate(d);
}

function aggregateRows(rows, mode) {
  if (mode === 'daily') return rows.map((row) => ({ ...row, period: row.iso }));
  const buckets = new Map();
  for (const row of rows) {
    const key = periodKey(row.t, mode);
    buckets.set(key, { ...row, period: key });
  }
  const out = Array.from(buckets.values());
  out.sort((a, b) => a.t - b.t);
  return out;
}

function makeTableSeries(rows, mode) {
  const grouped = aggregateRows(rows, mode);
  if (!grouped.length || !Number.isFinite(grouped[0].close) || grouped[0].close <= 0) return [];
  const base = grouped[0].close;
  return grouped.map((row, idx) => {
    const prev = idx > 0 ? grouped[idx - 1] : null;
    const dailyRet =
      prev && Number.isFinite(prev.close) && prev.close !== 0 ? ((row.close - prev.close) / prev.close) * 100 : 0;
    const rebased = (row.close / base) * 100;
    const cumulative = rebased - 100;
    return {
      period: row.period,
      t: row.t,
      raw: row.close,
      dailyRet,
      rebased,
      cumulative
    };
  });
}

function fmtPct(v) {
  if (!Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function fmtNum(v) {
  if (!Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso) {
  if (!iso) return '—';
  if (/^\d{4}-W\d{2}$/.test(iso) || /^\d{4}-Q[1-4]$/.test(iso) || /^\d{4}-\d{2}$/.test(iso) || /^\d{4}$/.test(iso)) {
    return iso;
  }
  const t = parseMiddayMs(iso);
  if (!Number.isFinite(t)) return String(iso);
  return new Date(t).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
}

export default function RelativeStrengthTickerPage() {
  const [searchParams] = useSearchParams();
  const tickerFromQuery = sanitizeTickerPageInput(searchParams.get('ticker') || searchParams.get('symbol') || '');
  const tickerOptions = useTickerList();
  const docTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const isLight = docTheme === 'light';
  const chartHostRef = useRef(null);
  const chartRef = useRef(null);
  const lineRefs = useRef([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [indexSymbol, setIndexSymbol] = useState('SPY');
  const [tickerSymbol, setTickerSymbol] = useState(tickerFromQuery || 'AAPL');
  const [mode, setMode] = useState('daily');
  const [seriesData, setSeriesData] = useState({});
  const [dailyStart, setDailyStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 31);
    return toIsoDate(d);
  });
  const [dailyEnd, setDailyEnd] = useState(() => toIsoDate(new Date()));
  const currentYear = new Date().getFullYear();
  const [startYear, setStartYear] = useState(String(currentYear - 5));
  const [endYear, setEndYear] = useState(String(currentYear));

  const yearOptions = useMemo(() => {
    const out = [];
    for (let y = currentYear; y >= 1990; y--) out.push({ id: String(y), label: String(y) });
    return out;
  }, [currentYear]);

  const tickerDropdownOptions = useMemo(() => {
    const items = Array.isArray(tickerOptions) && tickerOptions.length ? tickerOptions : ['AAPL', 'MSFT', 'NVDA', 'AMZN'];
    return items.map((sym) => ({ id: String(sym), label: String(sym) }));
  }, [tickerOptions]);

  useEffect(() => {
    if (!tickerDropdownOptions.some((opt) => opt.id === tickerSymbol)) {
      setTickerSymbol(tickerDropdownOptions[0]?.id || 'AAPL');
    }
  }, [tickerDropdownOptions, tickerSymbol]);

  useEffect(() => {
    if (tickerFromQuery) setTickerSymbol(tickerFromQuery);
  }, [tickerFromQuery]);

  const requestedSymbols = useMemo(() => {
    const out = [tickerSymbol, indexSymbol, 'QQQ', 'DIA'].map((s) => String(s || '').toUpperCase()).filter(Boolean);
    return Array.from(new Set(out));
  }, [tickerSymbol, indexSymbol]);

  const requestRange = useMemo(() => {
    if (mode === 'daily') return { start: dailyStart, end: dailyEnd };
    const y0 = Math.min(Number(startYear) || currentYear, Number(endYear) || currentYear);
    const y1 = Math.max(Number(startYear) || currentYear, Number(endYear) || currentYear);
    return { start: `${y0}-01-01`, end: `${y1}-12-31` };
  }, [mode, dailyStart, dailyEnd, startYear, endYear, currentYear]);

  useEffect(() => {
    let cancelled = false;
    if (!getAuthToken()) {
      setError('Sign in to load relative strength data.');
      setSeriesData({});
      return () => {
        cancelled = true;
      };
    }

    async function loadSeries() {
      setLoading(true);
      setError('');
      try {
        const rows = await Promise.all(
          requestedSymbols.map(async (sym) => {
            const res = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ticker: sym, start_date: requestRange.start, end_date: requestRange.end })
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok || !payload?.success) throw new Error(payload?.error || `Unable to load ${sym}`);
            return [sym, normalizeOhlcRows(payload.data)];
          })
        );
        if (cancelled) return;
        setSeriesData(Object.fromEntries(rows));
      } catch (e) {
        if (cancelled) return;
        setError(e?.message || 'Failed to load chart data.');
        setSeriesData({});
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSeries();
    return () => {
      cancelled = true;
    };
  }, [requestedSymbols, requestRange.start, requestRange.end]);

  const chartSeries = useMemo(() => {
    const toChartPoints = (rows) => {
      const points = makeTableSeries(rows, mode);
      const uniq = new Map();
      for (const p of points) {
        const ts = toChartTime(p.t);
        uniq.set(ts, { time: ts, value: Number(p.cumulative.toFixed(4)), iso: p.period });
      }
      return Array.from(uniq.values()).sort((a, b) => a.time - b.time);
    };
    const ticker = toChartPoints(seriesData[tickerSymbol] || []);
    const selectedIndex = toChartPoints(seriesData[indexSymbol] || []);
    const qqq = toChartPoints(seriesData.QQQ || []);
    const dia = toChartPoints(seriesData.DIA || []);
    return [
      { key: 'TICKER', label: tickerSymbol, color: COLOR_BY_SERIES.TICKER, data: ticker },
      { key: 'INDEX', label: indexSymbol, color: COLOR_BY_SERIES.INDEX, data: selectedIndex },
      { key: 'QQQ', label: 'QQQ', color: COLOR_BY_SERIES.QQQ, data: qqq },
      { key: 'DIA', label: 'DIA', color: COLOR_BY_SERIES.DIA, data: dia }
    ];
  }, [seriesData, tickerSymbol, indexSymbol, mode]);

  const compareSymbols = useMemo(() => {
    return Array.from(new Set([tickerSymbol, indexSymbol, 'QQQ', 'DIA'].map((s) => String(s || '').toUpperCase()).filter(Boolean)));
  }, [tickerSymbol, indexSymbol]);

  const tableRows = useMemo(() => {
    const mapByIso = new Map();
    for (const sym of compareSymbols) {
      const points = makeTableSeries(seriesData[sym] || [], mode);
      for (const point of points) {
        const key = point.period;
        if (!mapByIso.has(key)) mapByIso.set(key, { period: key, bySymbol: {} });
        mapByIso.get(key).bySymbol[sym] = point;
      }
    }
    return Array.from(mapByIso.values()).sort((a, b) => String(b.period).localeCompare(String(a.period)));
  }, [seriesData, mode, compareSymbols]);
  const comparisonRows = useMemo(() => {
    const tickerPoints = makeTableSeries(seriesData[tickerSymbol] || [], mode);
    const benchPoints = makeTableSeries(seriesData[indexSymbol] || [], mode);
    if (!tickerPoints.length || !benchPoints.length) return [];
    const byPeriodBench = new Map(benchPoints.map((r) => [String(r.period), r]));
    const out = [];
    for (const tRow of tickerPoints) {
      const bRow = byPeriodBench.get(String(tRow.period));
      if (!bRow) continue;
      const tickerReturn = Number(tRow.cumulative);
      const benchmarkReturn = Number(bRow.cumulative);
      if (!Number.isFinite(tickerReturn) || !Number.isFinite(benchmarkReturn)) continue;
      out.push({
        period: String(tRow.period),
        tickerReturn,
        benchmarkReturn,
        excessReturn: tickerReturn - benchmarkReturn
      });
    }
    return out;
  }, [seriesData, tickerSymbol, indexSymbol, mode]);
  const modeForCmp = mode === 'annually' ? 'annual' : mode;
  const benchmarkDropdownOptions = useMemo(
    () => INDEX_OPTIONS.map((v) => ({ id: v, label: v })),
    []
  );

  useEffect(() => {
    const host = chartHostRef.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth,
      height: 360,
      layout: {
        background: { color: isLight ? '#f5f5f5' : 'rgba(255,255,255,0.03)' },
        textColor: isLight ? '#4b5563' : '#9ca3af',
        attributionLogo: false
      },
      grid: {
        vertLines: { color: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)' },
        horzLines: { color: isLight ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.12)' }
      },
      leftPriceScale: { visible: true, borderVisible: false },
      rightPriceScale: { visible: false },
      timeScale: { borderVisible: false, timeVisible: mode === 'daily' },
      crosshair: {
        vertLine: { color: isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.3)' },
        horzLine: { color: isLight ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.3)' }
      }
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: host.clientWidth });
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      lineRefs.current = [];
    };
  }, [isLight, mode]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    lineRefs.current.forEach((line) => chart.removeSeries(line));
    lineRefs.current = [];
    for (const s of chartSeries) {
      const line = chart.addLineSeries({
        color: s.color,
        lineWidth: 3,
        priceLineVisible: false,
        lastValueVisible: false
      });
      line.setData(s.data.map((d) => ({ time: d.time, value: d.value })));
      lineRefs.current.push(line);
    }
    chart.timeScale().fitContent();
  }, [chartSeries]);

  const modeDropdownOptions = MODE_OPTIONS;
  const indexDropdownOptions = INDEX_OPTIONS.map((v) => ({ id: v, label: v }));

  return (
    <section className="relative-strength-page">
      <div className="relative-strength-page__head">
        <h1 className="relative-strength-page__title">Relative Strength</h1>
        <p className="relative-strength-page__sub">Compare normalized performance for ticker and market benchmarks.</p>
      </div>

      <div className="relative-strength-page__controls">
        <ThemedDropdown
          className="relative-strength-page__dd"
          value={indexSymbol}
          options={indexDropdownOptions}
          onChange={setIndexSymbol}
          title="Index selection"
          ariaLabelPrefix="Index"
          wideLabel
        />
        <div className="relative-strength-page__ticker-search">
          <TickerSymbolCombobox
            symbol={tickerSymbol}
            onSymbolChange={setTickerSymbol}
            inputId="relative-strength-ticker-symbol"
            placeholder="Search ticker (e.g. AAPL)"
          />
        </div>
        <ThemedDropdown
          className="relative-strength-page__dd"
          value={mode}
          options={modeDropdownOptions}
          onChange={setMode}
          title="Frequency"
          ariaLabelPrefix="Frequency"
          wideLabel
        />
        {mode === 'daily' ? (
          <div className="relative-strength-page__date-row">
            <input
              className="relative-strength-page__date-inp"
              type="date"
              value={dailyStart}
              max={dailyEnd}
              onChange={(e) => setDailyStart(e.target.value)}
              aria-label="Start date"
            />
            <input
              className="relative-strength-page__date-inp"
              type="date"
              value={dailyEnd}
              min={dailyStart}
              onChange={(e) => setDailyEnd(e.target.value)}
              aria-label="End date"
            />
          </div>
        ) : (
          <div className="relative-strength-page__year-row">
            <ThemedDropdown
              className="relative-strength-page__year-dd"
              value={startYear}
              options={yearOptions}
              onChange={setStartYear}
              title="Start year"
              ariaLabelPrefix="Start year"
              size="sm"
              wideLabel
            />
            <ThemedDropdown
              className="relative-strength-page__year-dd"
              value={endYear}
              options={yearOptions}
              onChange={setEndYear}
              title="End year"
              ariaLabelPrefix="End year"
              size="sm"
              wideLabel
            />
          </div>
        )}
      </div>

      <div className="relative-strength-page__chart-card">
        {loading ? (
          <div className="relative-strength-page__chart-skel-overlay">
            <LightweightChartAreaSkeleton minHeight={360} className="relative-strength-page__chart-skel-fill" />
          </div>
        ) : null}
        {!loading && error ? <div className="relative-strength-page__state relative-strength-page__state--error">{error}</div> : null}
        <div
          className={'relative-strength-page__chart-host' + (loading ? ' relative-strength-page__chart-host--loading' : '')}
          ref={chartHostRef}
        />
        <div className="relative-strength-page__legend">
          {chartSeries.map((s) => (
            <span key={s.key} className="relative-strength-page__legend-item">
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <div className="stats-cmp-charts">
        <AnnualReturnBarChart
          mode={modeForCmp}
          ticker={tickerSymbol}
          benchmarkIndex={indexSymbol}
          theme={docTheme}
          rows={comparisonRows}
          benchmarkOptions={benchmarkDropdownOptions}
          onBenchmarkChange={setIndexSymbol}
          loading={loading}
        />
        <ExcessReturnLineChart
          mode={modeForCmp}
          ticker={tickerSymbol}
          benchmarkIndex={indexSymbol}
          theme={docTheme}
          rows={comparisonRows}
          benchmarkOptions={benchmarkDropdownOptions}
          onBenchmarkChange={setIndexSymbol}
          loading={loading}
        />
        <PeriodicReturnBarChart
          mode={modeForCmp}
          ticker={tickerSymbol}
          benchmarkIndex={indexSymbol}
          theme={docTheme}
          rows={comparisonRows}
          benchmarkOptions={benchmarkDropdownOptions}
          onBenchmarkChange={setIndexSymbol}
          loading={loading}
        />
      </div>

      {/* <div className="relative-strength-page__table-card">
        <div className="relative-strength-page__table-head">
          <h2>Comparison table</h2>
          <ThemedDropdown
            className="relative-strength-page__table-dd"
            value={mode}
            options={modeDropdownOptions}
            onChange={setMode}
            title="Table frequency"
            ariaLabelPrefix="Table frequency"
            size="sm"
            wideLabel
          />
        </div>
        <div className="relative-strength-page__table-wrap">
          <table className="relative-strength-page__table">
            <thead>
              <tr>
                <th rowSpan={2}>Period</th>
                <th colSpan={compareSymbols.length}>AdjClose</th>
                <th colSpan={compareSymbols.length}>Daily %</th>
                <th colSpan={compareSymbols.length}>Rebased %</th>
                <th colSpan={compareSymbols.length}>Cumulative %</th>
              </tr>
              <tr>
                {compareSymbols.map((s) => <th key={`h1-${s}`}>{s}</th>)}
                {compareSymbols.map((s) => <th key={`h2-${s}`}>{s}</th>)}
                {compareSymbols.map((s) => <th key={`h3-${s}`}>{s}</th>)}
                {compareSymbols.map((s) => <th key={`h4-${s}`}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {tableRows.slice(0, 60).map((row) => (
                <tr key={row.period}>
                  <td>{fmtDate(row.period)}</td>
                  {compareSymbols.map((s) => <td key={`r1-${row.period}-${s}`}>{fmtNum(row.bySymbol[s]?.raw)}</td>)}
                  {compareSymbols.map((s) => <td key={`r2-${row.period}-${s}`}>{fmtPct(row.bySymbol[s]?.dailyRet)}</td>)}
                  {compareSymbols.map((s) => <td key={`r3-${row.period}-${s}`}>{fmtPct(row.bySymbol[s]?.rebased)}</td>)}
                  {compareSymbols.map((s) => <td key={`r4-${row.period}-${s}`}>{fmtPct(row.bySymbol[s]?.cumulative)}</td>)}
                </tr>
              ))}
              {!tableRows.length ? (
                <tr>
                  <td colSpan={1 + compareSymbols.length * 4} className="relative-strength-page__empty">No data for selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div> */}
    </section>
  );
}
