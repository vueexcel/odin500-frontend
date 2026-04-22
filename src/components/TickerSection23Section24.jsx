import { useEffect, useMemo, useState } from 'react';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import TradingChartLoader from './TradingChartLoader.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';

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
  return (n >= 0 ? '' : '-') + Math.abs(n).toFixed(2) + '%';
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

export function TickerSection23Section24({
  initialTicker = '',
  initialTickerReturns = null,
  initialBenchmarkReturns = null,
  initialSp500Rows = []
}) {
  const [groupId, setGroupId] = useState('sp500');
  const [groupRows, setGroupRows] = useState([]);
  const [ticker, setTicker] = useState(String(initialTicker || '').toUpperCase());
  const [tickerReturns, setTickerReturns] = useState(initialTickerReturns);
  const [benchReturns, setBenchReturns] = useState(initialBenchmarkReturns);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(false);

  const activeGroup = useMemo(() => GROUPS.find((g) => g.id === groupId) || GROUPS[0], [groupId]);

  useEffect(() => {
    let cancelled = false;
    async function loadGroupRows() {
      if (!getAuthToken()) return;
      setLoadingGroup(true);
      try {
        const data =
          activeGroup.id === 'sp500' && Array.isArray(initialSp500Rows) && initialSp500Rows.length
            ? { data: initialSp500Rows }
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
  }, [activeGroup.apiIndex, activeGroup.id, initialSp500Rows]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      initialTickerReturns &&
      String(initialTickerReturns?.ticker || '').toUpperCase() === String(ticker || '').toUpperCase()
    ) {
      setTickerReturns(initialTickerReturns);
    }
  }, [initialTickerReturns, ticker]);

  useEffect(() => {
    if (activeGroup.benchmark === 'SPY' && initialBenchmarkReturns) {
      setBenchReturns(initialBenchmarkReturns);
    }
  }, [activeGroup.benchmark, initialBenchmarkReturns]);

  useEffect(() => {
    let cancelled = false;
    async function loadReturns() {
      if (!getAuthToken() || !ticker) return;
      setLoadingReturns(true);
      try {
        const customEndDate = yesterdayIso();
        const [tRes, bRes] = await Promise.all([
          fetchJsonCached({
            path: '/api/market/ticker-returns',
            method: 'POST',
            body: { ticker, customStartDate: TABLE_ONLY_START_DATE, customEndDate },
            ttlMs: 5 * 60 * 1000
          }),
          fetchJsonCached({
            path: '/api/market/ticker-returns',
            method: 'POST',
            body: { ticker: activeGroup.benchmark, customStartDate: TABLE_ONLY_START_DATE, customEndDate },
            ttlMs: 10 * 60 * 1000
          })
        ]);
        if (cancelled) return;
        setTickerReturns(tRes.data || null);
        setBenchReturns(bRes.data || null);
      } catch {
        if (!cancelled) {
          setTickerReturns(null);
          setBenchReturns(null);
        }
      } finally {
        if (!cancelled) setLoadingReturns(false);
      }
    }
    loadReturns();
    return () => {
      cancelled = true;
    };
  }, [ticker, activeGroup.benchmark, tickerReturns, benchReturns]);

  const rows = useMemo(() => {
    const dynT = tickerReturns?.performance?.dynamicPeriods || [];
    const dynB = benchReturns?.performance?.dynamicPeriods || [];
    return TF_ROWS.map((tf) => {
      const bench = pickDynamic(dynB, tf.period);
      const tick = pickDynamic(dynT, tf.period);
      const diff =
        Number.isFinite(bench) && Number.isFinite(tick)
          ? Number(tick) - Number(bench)
          : null;
      return { tf: tf.key, bench, tick, diff };
    });
  }, [tickerReturns, benchReturns]);

  const axis = useMemo(() => niceAxisBounds(rows), [rows]);

  const chartBars = useMemo(() => {
    const step = 100 / Math.max(1, rows.length);
    return rows.map((r, i) => {
      const x = i * step + step / 2;
      return { ...r, x };
    });
  }, [rows]);

  return (
    <section className="ticker-s23s24">
      <div className="ticker-s23s24__card ticker-s23">
        <div className="ticker-card__h-with-tip">
          <h3 className="ticker-subh ticker-subh--flex">Benchmark vs Ticker Table</h3>
          <ChartInfoTip tip={CHART_INFO_TIPS.tickerCompareBars} align="start" />
        </div>
        <div className="ticker-s23s24__controls">
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="ticker-s23s24__select">
            {GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          <select
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            className="ticker-s23s24__select"
            disabled={!groupRows.length}
          >
            {groupRows.map((r) => {
              const s = String(r.symbol || '').toUpperCase();
              return (
                <option key={s} value={s}>
                  {s}
                </option>
              );
            })}
          </select>
        </div>
        <table className="ticker-s23__table">
          <thead>
            <tr>
              <th  style={{color: 'black'}}> Time</th>
              <th>{activeGroup.benchLabel}</th>
              <th>{ticker || 'Ticker'}</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tf}>
                <th scope="row">{r.tf}</th>
                <td>{fmtPct(r.bench)}</td>
                <td>{fmtPct(r.tick)}</td>
                <td>{fmtPct(r.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ticker-s23s24__card ticker-s24">
        <div className="ticker-card__h-with-tip">
          <h3 className="ticker-subh ticker-subh--flex">Benchmark vs Ticker Bars</h3>
          <ChartInfoTip tip={CHART_INFO_TIPS.tickerCompareBars} align="start" />
        </div>
        <div className="ticker-s24__chart">
          {loadingGroup || loadingReturns ? (
            <div className="chart-viz-loading-wrap ticker-s24__viz-loading">
              <TradingChartLoader
                label="Loading benchmark comparison…"
                sublabel={`${activeGroup.label} vs ${ticker || 'ticker'}`}
              />
            </div>
          ) : (
            <>
          <svg viewBox="0 0 860 320" preserveAspectRatio="none" className="ticker-s24__svg">
            {axis.ticks.map((t) => {
              const y = 270 - ((t - axis.min) / (axis.max - axis.min || 1)) * 220;
              return (
                <g key={t}>
                  <line x1="52" y1={y} x2="840" y2={y} stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
                  <text x="32" y={y + 4} textAnchor="end" fill="#64748b" fontSize="12" fontWeight="600">
                    {t}%
                  </text>
                </g>
              );
            })}
            {chartBars.map((b) => {
              const baseY = 270 - ((0 - axis.min) / (axis.max - axis.min || 1)) * 220;
              const yFor = (v) => 270 - ((v - axis.min) / (axis.max - axis.min || 1)) * 220;
              const bw = 9;
              const tw = 9;
              const xBench = 52 + (b.x / 100) * 788 - 11;
              const xTick = 52 + (b.x / 100) * 788 + 3;
              const benchY = Number.isFinite(b.bench) ? yFor(b.bench) : baseY;
              const tickY = Number.isFinite(b.tick) ? yFor(b.tick) : baseY;
              const benchTop = Math.min(baseY, benchY);
              const tickTop = Math.min(baseY, tickY);
              const benchH = Math.max(1, Math.abs(baseY - benchY));
              const tickH = Math.max(1, Math.abs(baseY - tickY));
              const showLabel = ['1Y', '3Y', '5Y', '10Y', '20Y'].includes(b.tf);
              return (
                <g key={b.tf}>
                  <rect x={xBench} y={benchTop} width={bw} height={benchH} fill="#3b82f6" />
                  <rect x={xTick} y={tickTop} width={tw} height={tickH} fill="#f59e0b" />
                  {showLabel && Number.isFinite(b.bench) ? (
                    <text x={xBench + bw / 2} y={benchY - 5} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700">
                      {Number(b.bench).toFixed(1)}%
                    </text>
                  ) : null}
                  {showLabel && Number.isFinite(b.tick) ? (
                    <text x={xTick + tw / 2} y={tickY - 5} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700">
                      {Number(b.tick).toFixed(1)}%
                    </text>
                  ) : null}
                  <text x={52 + (b.x / 100) * 788 - 1} y={295} textAnchor="end" fill="#64748b" fontSize="11" transform={`rotate(-45 ${52 + (b.x / 100) * 788 - 1} 295)`}>
                    {b.tf}
                  </text>
                </g>
              );
            })}
          </svg>
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

