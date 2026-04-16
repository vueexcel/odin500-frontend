import { useState, useRef, useCallback, useEffect } from 'react';
import { ControlPanel } from './components/ControlPanel.jsx';
import { ChartPanel } from './components/ChartPanel.jsx';
import { MarketPageFigmaShell } from './components/MarketPageFigmaShell.jsx';
import { useTickerList } from './hooks/useTickerList.js';
import { apiUrl } from './utils/apiOrigin.js';
import { fetchWithAuth, getAuthToken } from './store/apiStore.js';
import { stableStringify, toDateInput } from './utils/misc.js';
import {
  mapRowsToCandles,
  filterMarkersForCandles,
  normalizeTradeMarkers,
  extractOdinMarkersByTicker
} from './utils/chartData.js';

function clampRange(start, end, setEnd) {
  if (!start || !end) return;
  if (start > end) setEnd(start);
}

export default function App() {
  const today = new Date();
  const prior = new Date();
  prior.setDate(today.getDate() - 100);

  const [ticker, setTicker] = useState(() => {
    try {
      return localStorage.getItem('market_api_ticker') || 'AAPL';
    } catch {
      return 'AAPL';
    }
  });
  const [startDate, setStartDate] = useState(() => toDateInput(prior));
  const [endDate, setEndDate] = useState(() => toDateInput(today));
  const [executionMode, setExecutionMode] = useState('T+1');
  const [entryLong, setEntryLong] = useState(['L11']);
  const [exitLong, setExitLong] = useState(['N', 'S11', 'S12', 'S21', 'S22', 'S31', 'S32']);
  const [entryShort, setEntryShort] = useState(['S11']);
  const [exitShort, setExitShort] = useState([]);
  const [status, setStatus] = useState({ message: '', type: '' });
  const [chartLoadBusy, setChartLoadBusy] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const onAuth = () => setAuthVersion((v) => v + 1);
    window.addEventListener('odin-auth-updated', onAuth);
    return () => window.removeEventListener('odin-auth-updated', onAuth);
  }, []);

  const authToken = getAuthToken();
  const isLoggedIn = Boolean(authToken);
  void authVersion;

  const allTickers = useTickerList();

  const chartRef = useRef(null);
  const odinPayloadKeyRef = useRef('');
  const odinTradeMarkersRef = useRef(new Map());
  const lastGoodCandlesRef = useRef(null);
  const lastGoodMarkersRef = useRef(null);
  const chartLoadAbortRef = useRef(null);
  const loadDataRef = useRef(async () => {});

  const setStatusMsg = useCallback((message, type = '') => {
    setStatus({ message, type });
  }, []);

  const invalidateCachedOdinPayload = useCallback(() => {
    odinPayloadKeyRef.current = '';
    odinTradeMarkersRef.current.clear();
  }, []);

  const buildOdinPayload = useCallback(() => {
    const sym = String(ticker || '').trim().toUpperCase();
    return {
      start_date: startDate,
      end_date: endDate,
      tickers: sym ? [sym] : [],
      entry_long_signals: entryLong,
      exit_long_signals: exitLong,
      entry_short_signals: entryShort,
      exit_short_signals: exitShort,
      initial_portfolio: 1000,
      include_neutral_rows: true,
      chunk_size: 30,
      execution_mode: executionMode
    };
  }, [ticker, startDate, endDate, entryLong, exitLong, entryShort, exitShort, executionMode]);

  const fetchAndRenderOhlc = useCallback(
    async (sym, start_date, end_date, signal) => {
      const response = await fetchWithAuth(apiUrl('/api/market/ohlc-signals-indicator'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ticker: sym, start_date, end_date }),
        signal
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || payload.message || 'OHLC request failed');
      }

      const rows = Array.isArray(payload.data) ? payload.data : [];
      const candles = mapRowsToCandles(rows);
      const tradeMarkers = odinTradeMarkersRef.current.get(sym) || [];
      const markers = normalizeTradeMarkers(filterMarkersForCandles(tradeMarkers, candles));

      if (candles.length === 0 && lastGoodCandlesRef.current?.length > 0) {
        setStatusMsg('No OHLC rows in this date range — previous chart kept.', 'warn');
        return;
      }

      const ma200Data = Array.isArray(payload.ma200)
        ? payload.ma200
            .filter((r) => r.date && r.value != null)
            .map((r) => ({ time: r.date, value: r.value }))
            .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
        : [];

      chartRef.current?.setChartData({ candles, markers, ma200: ma200Data });
      lastGoodCandlesRef.current = candles;
      lastGoodMarkersRef.current = markers;

      setStatusMsg(
        `Loaded ${candles.length} candles, ${markers.length} trade markers` +
          (ma200Data.length ? `, MA200 (${ma200Data.length} pts)` : '') +
          '.',
        'ok'
      );
    },
    [setStatusMsg]
  );

  const loadData = useCallback(async () => {
    let s = startDate;
    let e = endDate;
    if (s && e && s > e) e = s;
    const odinPayload = buildOdinPayload();

    if (!s || !e) {
      setStatusMsg('Start date and end date are required.', 'error');
      return;
    }
    if (s > e) {
      setStatusMsg('Start date must be on or before end date.', 'error');
      return;
    }
    if (!odinPayload.tickers.length) {
      setStatusMsg('Provide one ticker in Ticker input.', 'error');
      return;
    }
    if (!getAuthToken()) {
      setStatusMsg('Sign in to load the chart.', 'error');
      return;
    }
    const selectedTicker = String(odinPayload.tickers[0] || '').toUpperCase();
    try {
      localStorage.setItem('market_api_ticker', selectedTicker);
    } catch {
      /* ignore */
    }

    if (chartLoadAbortRef.current) {
      chartLoadAbortRef.current.abort();
    }
    chartLoadAbortRef.current = new AbortController();
    const acSignal = chartLoadAbortRef.current.signal;

    setStatusMsg('Loading data...');
    setChartLoadBusy(true);

    try {
      const payloadKey = stableStringify(odinPayload);
      if (
        odinPayloadKeyRef.current !== payloadKey ||
        odinTradeMarkersRef.current.size === 0
      ) {
        const odinResponse = await fetchWithAuth(apiUrl('/api/analytics/odin-index'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(odinPayload),
          signal: acSignal
        });
        const odinPayloadResp = await odinResponse.json();
        if (!odinResponse.ok || !odinPayloadResp.success) {
          throw new Error(
            (odinPayloadResp && (odinPayloadResp.error || odinPayloadResp.message)) ||
              'Odin index request failed'
          );
        }
        odinTradeMarkersRef.current.clear();
        const extracted = extractOdinMarkersByTicker(odinPayloadResp);
        extracted.forEach((v, k) => {
          odinTradeMarkersRef.current.set(k, v);
        });
        odinPayloadKeyRef.current = payloadKey;
      }

      await fetchAndRenderOhlc(selectedTicker, s, e, acSignal);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (lastGoodCandlesRef.current?.length > 0) {
        setStatusMsg('Load failed — keeping previous chart. ' + err.message, 'error');
      } else {
        setStatusMsg('Failed to load chart: ' + err.message, 'error');
      }
    } finally {
      setChartLoadBusy(false);
    }
  }, [startDate, endDate, buildOdinPayload, fetchAndRenderOhlc, setStatusMsg]);

  loadDataRef.current = loadData;

  useEffect(() => {
    if (!isLoggedIn) return;
    loadDataRef.current();
  }, [isLoggedIn]);

  const onStartDateChange = (v) => {
    setStartDate(v);
    clampRange(v, endDate, setEndDate);
    invalidateCachedOdinPayload();
  };

  const onEndDateChange = (v) => {
    setEndDate(v);
    if (startDate && v && startDate > v) setEndDate(startDate);
    invalidateCachedOdinPayload();
  };

  return (
    <div className="container">
      <MarketPageFigmaShell />
      <h1>OHLC + Signals Indicator Chart</h1>

      <ControlPanel
        ticker={ticker}
        onTickerChange={setTicker}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={onStartDateChange}
        onEndDateChange={onEndDateChange}
        executionMode={executionMode}
        onExecutionModeChange={setExecutionMode}
        onLoad={loadData}
        loadDisabled={!isLoggedIn || chartLoadBusy}
        entryLong={entryLong}
        exitLong={exitLong}
        entryShort={entryShort}
        exitShort={exitShort}
        onEntryLongChange={setEntryLong}
        onExitLongChange={setExitLong}
        onEntryShortChange={setEntryShort}
        onExitShortChange={setExitShort}
        statusMessage={status.message}
        statusType={status.type}
        onInvalidateOdin={invalidateCachedOdinPayload}
        allTickers={allTickers}
      />

      <ChartPanel ref={chartRef} />
    </div>
  );
}
