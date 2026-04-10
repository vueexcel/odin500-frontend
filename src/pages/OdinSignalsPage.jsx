import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChartPanel } from '../components/ChartPanel.jsx';
import { TickerSymbolCombobox } from '../components/TickerSymbolCombobox.jsx';
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

function subtractYearsFromIsoEnd(endIso, years) {
  const d = new Date(endIso + 'T12:00:00');
  d.setFullYear(d.getFullYear() - years);
  return toDateInput(d);
}

export default function OdinSignalsPage() {
  const chartRef = useRef(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const symbol = useMemo(() => resolveTickersPageSymbol(searchParams), [searchParams]);
  const [rangeKey, setRangeKey] = useState('3y');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState({ rowCount: 0, signalCount: 0, maPoints: 0 });

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

  return (
    <div className="odin-signals-page">
      <div className="odin-signals-page__toolbar">
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
      </div>

      {error ? <div className="odin-signals-page__error">{error}</div> : null}
      {loading ? <div className="odin-signals-page__loading">Loading…</div> : null}

      <div className="odin-signals-page__meta">
        {symbol} · {startDate} → {endDate} · {meta.rowCount} bars · {meta.signalCount} signals · MA200{' '}
        {meta.maPoints} pts
      </div>

      <div className="odin-signals-legend" aria-label="Signal legend">
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
      </div>

      <ChartPanel ref={chartRef} />
    </div>
  );
}
