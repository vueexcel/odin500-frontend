import { useMemo } from 'react';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';

/** Green / red text for diff column (reuses ticker theme tokens). */
function valueToneClass(v) {
  if (v == null || !Number.isFinite(v)) return '';
  if (v > 0) return 'ticker-num--up';
  if (v < 0) return 'ticker-num--down';
  return '';
}

/** “Nice” step for axis ticks (similar spirit to chart tick heuristics). */
function niceChartStep(span, maxTicks = 7) {
  if (!Number.isFinite(span) || span <= 0) return 0.5;
  const raw = span / Math.max(2, maxTicks - 1);
  const exp = Math.floor(Math.log10(raw));
  const f = raw / 10 ** exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * 10 ** exp;
}

function formatAxisPct(v) {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 100) return `${v.toFixed(0)}%`;
  if (a >= 10) return `${v.toFixed(1)}%`;
  return `${v.toFixed(2)}%`;
}

/** Linear map: axisMax → 0%, axisMin → 100%. */
function yPct(axisMax, axisMin, value) {
  const range = axisMax - axisMin;
  if (!Number.isFinite(range) || range <= 0) return 50;
  return ((axisMax - value) / range) * 100;
}

function buildRelativeStrengthChart(chartRows) {
  if (!chartRows.length) {
    return { ticks: [], bars: [], zeroTopPct: 50, fmtTick: formatAxisPct };
  }

  const vals = chartRows.map((r) => (Number.isFinite(r.value) ? Number(r.value) : null)).filter((v) => v != null);

  if (!vals.length) {
    const bars = chartRows.map((r, i) => ({
      key: `${r.label}-${i}`,
      label: r.label,
      value: null,
      topPct: 50,
      heightPct: 0,
      tone: 'flat'
    }));
    return {
      ticks: [
        { key: 't-1', value: 1, topPct: 0 },
        { key: 't0', value: 0, topPct: 50 },
        { key: 't1', value: -1, topPct: 100 }
      ],
      bars,
      zeroTopPct: 50,
      fmtTick: formatAxisPct
    };
  }

  let rawMax = Math.max(...vals);
  let rawMin = Math.min(...vals);
  if (!Number.isFinite(rawMax) || !Number.isFinite(rawMin)) {
    rawMax = 1;
    rawMin = -1;
  }
  if (rawMax === rawMin) {
    rawMax += 0.5;
    rawMin -= 0.5;
  }

  const span0 = rawMax - rawMin;
  const pad = Math.max(span0 * 0.06, 0.25);
  let axisMax = rawMax + pad;
  let axisMin = rawMin - pad;
  if (rawMin >= 0 && axisMin > 0) axisMin = 0;
  if (rawMax <= 0 && axisMax < 0) axisMax = 0;

  let span = axisMax - axisMin;
  let step = niceChartStep(span);
  if (!Number.isFinite(step) || step <= 0) step = Math.max(span / 6, 0.01);
  let maxTicks = Math.floor(span / step) + 2;
  while (maxTicks > 11 && step < span * 1.0001) {
    step *= 2;
    maxTicks = Math.floor(span / step) + 2;
  }

  const tickStart = Math.ceil((axisMin - 1e-9) / step) * step;
  const tickEnd = Math.floor((axisMax + 1e-9) / step) * step;
  const ticks = [];
  let ti = tickEnd;
  let guard = 0;
  while (ti >= tickStart - 1e-9 && guard++ < 64) {
    const value = Number.parseFloat(Number(ti).toPrecision(12));
    ticks.push({
      key: `y-${ticks.length}-${value}`,
      value,
      topPct: yPct(axisMax, axisMin, value)
    });
    ti -= step;
  }

  if (!ticks.length) {
    ticks.push(
      { key: 'y-max', value: axisMax, topPct: 0 },
      { key: 'y-zero', value: 0, topPct: yPct(axisMax, axisMin, 0) },
      { key: 'y-min', value: axisMin, topPct: 100 }
    );
  }

  const zeroTopPct = yPct(axisMax, axisMin, 0);
  const z = zeroTopPct;

  const bars = chartRows.map((r, i) => {
    const hasValue = Number.isFinite(r.value);
    const v = hasValue ? Number(r.value) : null;
    if (v == null) {
      return { key: `${r.label}-${i}`, label: r.label, value: null, topPct: z, heightPct: 0, tone: 'flat' };
    }
    const yv = yPct(axisMax, axisMin, v);
    if (v > 0) {
      const topPct = yv;
      const heightPct = Math.max(0, z - yv);
      return { key: `${r.label}-${i}`, label: r.label, value: v, topPct, heightPct, tone: 'up' };
    }
    if (v < 0) {
      const topPct = z;
      const heightPct = Math.max(0, yv - z);
      return { key: `${r.label}-${i}`, label: r.label, value: v, topPct, heightPct, tone: 'down' };
    }
    return { key: `${r.label}-${i}`, label: r.label, value: 0, topPct: z, heightPct: 0, tone: 'flat' };
  });

  return { ticks, bars, zeroTopPct, fmtTick: formatAxisPct };
}

/**
 * Figma-like compact table + mini bar section using existing TickerPage returns data.
 * No extra API calls.
 */
export function TickerSection16Section17({
  rows,
  compareRows,
  relativeStrengthTitle = 'Relative Strength (SP500)',
  relativeStrengthHeader = 'Relative Strength (SP500)',
  /** Rendered on the right-hand “bars” card header (e.g. Filters menu with RS dropdowns). */
  chartHeaderExtra = null
}) {
  const displayRows = useMemo(() => (Array.isArray(rows) ? rows.filter((r) => r && r.label) : []), [rows]);
  const chartRows = useMemo(() => {
    if (displayRows.length) return displayRows;
    // Backward-compat fallback if only compare rows are passed.
    return Array.isArray(compareRows)
      ? compareRows
          .filter((r) => r && r.label)
          .map((r) => ({ label: r.label, value: Number.isFinite(r.value) ? Number(r.value) : Number(r.diff) }))
      : [];
  }, [displayRows, compareRows]);

  const chart = useMemo(() => buildRelativeStrengthChart(chartRows), [chartRows]);
  const fmtTick = chart.fmtTick || formatAxisPct;
  const nCols = Math.max(1, chartRows.length);
  const chartGapPx = nCols > 12 ? 4 : nCols > 8 ? 6 : 8;
  const barMaxPx = nCols > 12 ? 12 : nCols > 8 ? 14 : 18;

  return (
    <section className="ticker-s16s17">
      <div className="ticker-s16s17__card ticker-s16">
        <div className="ticker-s16s17__head-row">
          <div className="ticker-card__h-with-tip">
            <div className="flex align-centers">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <g clipPath="url(#clip0_609_23954)">
                  <path
                    d="M7.82031 1.25781V6.17969H12.7422C12.7422 4.87433 12.2236 3.62243 11.3006 2.6994C10.3776 1.77637 9.12567 1.25781 7.82031 1.25781Z"
                    stroke="white"
                    strokeWidth="0.875"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6.17969 2.89844C5.20623 2.89844 4.25464 3.1871 3.44524 3.72792C2.63584 4.26875 2.005 5.03744 1.63247 5.93679C1.25995 6.83615 1.16248 7.82577 1.35239 8.78052C1.5423 9.73527 2.01106 10.6123 2.6994 11.3006C3.38774 11.9889 4.26473 12.4577 5.21948 12.6476C6.17423 12.8375 7.16386 12.7401 8.06321 12.3675C8.96257 11.995 9.73126 11.3642 10.2721 10.5548C10.8129 9.74536 11.1016 8.79377 11.1016 7.82031H6.17969V2.89844Z"
                    stroke="white"
                    strokeWidth="0.875"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_609_23954">
                    <rect width="14" height="14" fill="white" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <h3 className="ticker-subh ticker-subh--flex">{relativeStrengthTitle}</h3>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrength} align="start" />
          </div>
        </div>
        <div className="ticker-s16__body">
          <table className="ticker-s16__table">
            <thead>
              <tr>
                <th scope="col">{relativeStrengthHeader}</th>
                <th scope="col">Diff</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => {
                const v = Number.isFinite(r.value) ? Number(r.value) : null;
                return (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td className={valueToneClass(v)}>
                      {v == null ? '—' : `${v.toFixed(1)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ticker-s16s17__card ticker-s17">
        <div className="ticker-s16s17__head-row">
          <div className="ticker-card__h-with-tip">
            <h3 className="ticker-subh ticker-subh--flex">Relative Strength Bars</h3>
            <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrength} align="start" />
          </div>
          {chartHeaderExtra ? <div className="ticker-s16s17__chart-head-tools">{chartHeaderExtra}</div> : null}
        </div>
        <div
          className="ticker-s17__chart"
          style={{
            '--ticker-s17-cols': String(nCols),
            '--ticker-s17-gap': `${chartGapPx}px`,
            '--ticker-s17-bar-max': `${barMaxPx}px`
          }}
        >
          <div className="ticker-s17__yaxis">
            <div className="ticker-s17__yaxis-area">
              {chart.ticks?.map((t) => (
                <span key={t.key} className="ticker-s17__yval" style={{ top: `${t.topPct}%` }}>
                  {fmtTick(t.value)}
                </span>
              ))}
            </div>
          </div>
          <div className="ticker-s17__plot">
            <div className="ticker-s17__plot-area">
              <div className="ticker-s17__viz">
                {chart.ticks?.map((t) => (
                  <span key={`g-${t.key}`} className="ticker-s17__grid" style={{ top: `${t.topPct}%` }} />
                ))}
                <span className="ticker-s17__zero" style={{ top: `${chart.zeroTopPct ?? 50}%` }} />
                <div className="ticker-s17__bars">
                  {chart.bars?.map((b) => (
                    <div key={b.key} className="ticker-s17__col">
                      <div className="ticker-s17__bar-zone">
                        <div
                          className={'ticker-s17__bar ticker-s17__bar--' + b.tone + (b.value == null ? ' ticker-s17__bar--empty' : '')}
                          style={{ top: `${b.topPct}%`, height: `${b.heightPct}%` }}
                          title={b.value == null ? `${b.label}: no data` : `${b.label}: ${b.value.toFixed(2)}%`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="ticker-s17__xlabels">
                {chart.bars?.map((b) => (
                  <span key={`lab-${b.key}`} className="ticker-s17__lab">
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

