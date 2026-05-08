import { useMemo } from 'react';
import { ChartInfoTip } from './ChartInfoTip.jsx';
import { CHART_INFO_TIPS } from './chartInfoTips.js';

function pctClass(v) {
  if (v == null || !Number.isFinite(v)) return '';
  if (v > 0) return 'is-up';
  if (v < 0) return 'is-down';
  return '';
}

function cellColor(v) {
  if (v == null || !Number.isFinite(v)) return '#475569';
if (v <= -6) return '#7c2d12';   // deep burnt orange
if (v <= -3) return '#c2410c';   // burnt sienna
if (v < 0)   return '#ea580c';   // amber-orange
if (v < 1.5) return '#4d7c0f';   // olive-lime
if (v < 3.5) return '#3f6212';   // sage green
if (v < 6)   return '#365314';   // deep sage
return        '#1a2e05';         // forest sage
}
function labelColor(bg) {
  const dark = new Set(['#ef4444', '#66bb6a']);
  return dark.has(bg) ? '#ffffff' : '#0f172a';
}

/**
 * Figma-like compact table + mini bar section using existing TickerPage returns data.
 * No extra API calls.
 */
export function TickerSection16Section17({
  rows,
  compareRows,
  relativeStrengthTitle = 'Relative Strength (SP500)',
  relativeStrengthHeader = 'Relative Strength (SP500)'
}) {
  const displayRows = useMemo(() => (Array.isArray(rows) ? rows.filter((r) => r && r.label).slice(0, 8) : []), [rows]);
  const chartRows = useMemo(() => {
    if (displayRows.length) return displayRows;
    // Backward-compat fallback if only compare rows are passed.
    return Array.isArray(compareRows)
      ? compareRows
          .filter((r) => r && r.label)
          .slice(0, 8)
          .map((r) => ({ label: r.label, value: Number.isFinite(r.value) ? Number(r.value) : Number(r.diff) }))
      : [];
  }, [displayRows, compareRows]);

  const chart = useMemo(() => {
    if (!chartRows.length) return [];
    const vals = chartRows
      .map((r) => (Number.isFinite(r.value) ? Number(r.value) : null))
      .filter((v) => v != null);
    const step = 0.5;
    const rawMax = vals.length ? Math.max(...vals) : 0;
    const rawMin = vals.length ? Math.min(...vals) : 0;
    const axisMax = Math.max(step, Math.ceil((rawMax + step) / step) * step);
    const axisMin = Math.min(-step, Math.floor((rawMin - step) / step) * step);
    const range = Math.max(step * 2, axisMax - axisMin);
    const zeroTopPct = ((axisMax - 0) / range) * 100;

    const ticks = [];
    for (let t = axisMax; t >= axisMin - 0.0001; t -= step) {
      const v = Number(t.toFixed(1));
      ticks.push({
        value: v,
        topPct: ((axisMax - v) / range) * 100
      });
    }

    const bars = chartRows.map((r, i) => {
      const hasValue = Number.isFinite(r.value);
      const v = hasValue ? Number(r.value) : null;
      const topPct = v == null ? zeroTopPct : v >= 0 ? ((axisMax - v) / range) * 100 : zeroTopPct;
      const heightPct = v == null ? 0 : (Math.abs(v) / range) * 100;
      return {
        key: r.label + '-' + i,
        label: r.label,
        value: v,
        topPct,
        heightPct,
        tone: v > 0 ? 'up' : v < 0 ? 'down' : 'flat'
      };
    });
    return { ticks, bars, zeroTopPct };
  }, [chartRows]);

  return (
    <section className="ticker-s16s17">
      <div className="ticker-s16s17__card ticker-s16">
        <div className="ticker-card__h-with-tip">
        <div className="flex align-centers"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
<g clip-path="url(#clip0_609_23954)">
<path d="M7.82031 1.25781V6.17969H12.7422C12.7422 4.87433 12.2236 3.62243 11.3006 2.6994C10.3776 1.77637 9.12567 1.25781 7.82031 1.25781Z" stroke="white" stroke-width="0.875" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M6.17969 2.89844C5.20623 2.89844 4.25464 3.1871 3.44524 3.72792C2.63584 4.26875 2.005 5.03744 1.63247 5.93679C1.25995 6.83615 1.16248 7.82577 1.35239 8.78052C1.5423 9.73527 2.01106 10.6123 2.6994 11.3006C3.38774 11.9889 4.26473 12.4577 5.21948 12.6476C6.17423 12.8375 7.16386 12.7401 8.06321 12.3675C8.96257 11.995 9.73126 11.3642 10.2721 10.5548C10.8129 9.74536 11.1016 8.79377 11.1016 7.82031H6.17969V2.89844Z" stroke="white" stroke-width="0.875" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<defs>
<clipPath id="clip0_609_23954">
<rect width="14" height="14" fill="white"/>
</clipPath>
</defs>
</svg>
</div>
          <h3 className="ticker-subh ticker-subh--flex">{relativeStrengthTitle}</h3>
          <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrength} align="start" />
        </div>
        <table className="ticker-s16__table">
          <thead>
            <tr>
              <th scope="col" >{relativeStrengthHeader}</th>
              <th scope="col">Diff</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((r) => {
              const v = Number.isFinite(r.value) ? Number(r.value) : null;
              const bg = cellColor(v);
              return (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  <td style={{ background: bg, color: labelColor(bg) }} className={pctClass(v)}>
                    {v == null ? '—' : `${v.toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ticker-s16s17__card ticker-s17">
        <div className="ticker-card__h-with-tip">
          <h3 className="ticker-subh ticker-subh--flex">Relative Strength Bars</h3>
          <ChartInfoTip tip={CHART_INFO_TIPS.tickerRelativeStrength} align="start" />
        </div>
        <div className="ticker-s17__chart">
          <div className="ticker-s17__yaxis">
            <div className="ticker-s17__yaxis-area">
              {chart.ticks?.map((t) => (
                <span key={`y-${t.value}`} className="ticker-s17__yval" style={{ top: `${t.topPct}%` }}>
                  {t.value.toFixed(1)}%
                </span>
              ))}
            </div>
          </div>
          <div className="ticker-s17__plot">
            <div className="ticker-s17__plot-area">
              {chart.ticks?.map((t) => (
                <span key={`g-${t.value}`} className="ticker-s17__grid" style={{ top: `${t.topPct}%` }} />
              ))}
              <span className="ticker-s17__zero" style={{ top: `${chart.zeroTopPct || 50}%` }} />
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

