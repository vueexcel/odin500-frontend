import { ThemedDropdown } from './ThemedDropdown.jsx';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function PeriodicReturnBarChart({
  mode,
  ticker,
  benchmarkIndex,
  startYear,
  endYear,
  selectedYear,
  startDate,
  endDate,
  theme = 'dark',
  rows = [],
  benchmarkOptions = [],
  onBenchmarkChange = () => {},
  controls = null,
  loading = false
}) {
  const W = 1020;
  const H = 300;
  const padL = 52;
  const padR = 18;
  const padT = 16;
  const padB = 48;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const vals = rows.flatMap((r) => [Number(r.tickerReturn), Number(r.benchmarkReturn)]).filter(Number.isFinite);
  const minV = vals.length ? Math.min(0, ...vals) : -8;
  const maxV = vals.length ? Math.max(0, ...vals) : 8;
  const span = Math.max(1, maxV - minV);
  const yMin = minV - span * 0.08;
  const yMax = maxV + span * 0.08;
  const y = (v) => padT + ((yMax - v) / (yMax - yMin)) * ih;
  const zeroY = y(0);
  const n = Math.max(1, rows.length);
  const groupW = iw / n;
  const barW = Math.max(4, Math.min(16, groupW * 0.32));

  return (
    <section className="stats-cmp-chart">
      <div className="stats-cmp-chart__head">
        <div className="stats-cmp-chart__controls">{controls}</div>
        <ThemedDropdown
          size="sm"
          className="stats-cmp-chart__benchmark-dd"
          value={benchmarkIndex}
          options={benchmarkOptions}
          onChange={onBenchmarkChange}
          title="Benchmark"
          ariaLabelPrefix="Benchmark"
          labelFallback={benchmarkIndex}
          wideLabel
        />
      </div>
      {loading ? (
        <StatsCmpChartSkeleton variant="denseBars" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <>
          <div className="stats-cmp-chart__legend">
            <span><i className="stats-cmp-chart__sw stats-cmp-chart__sw--ticker" /> {ticker}</span>
            <span><i className="stats-cmp-chart__sw stats-cmp-chart__sw--bench2" /> {benchmarkIndex}</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="stats-cmp-chart__svg" preserveAspectRatio="xMidYMid meet">
            {[0, 0.25, 0.5, 0.75, 1].map((k) => {
              const t = yMin + (yMax - yMin) * k;
              const yy = y(t);
              return <line key={k} x1={padL} y1={yy} x2={W - padR} y2={yy} className="stats-cmp-chart__grid" />;
            })}
            <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} className="stats-cmp-chart__zero" />
            {rows.map((r, i) => {
              const cx = padL + i * groupW + groupW / 2;
              const tY = y(r.tickerReturn);
              const bY = y(r.benchmarkReturn);
              return (
                <g key={r.period}>
                  <rect x={cx - barW - 1} y={Math.min(tY, zeroY)} width={barW} height={Math.max(1, Math.abs(zeroY - tY))} className="stats-cmp-chart__bar stats-cmp-chart__bar--ticker" />
                  <rect x={cx + 1} y={Math.min(bY, zeroY)} width={barW} height={Math.max(1, Math.abs(zeroY - bY))} className="stats-cmp-chart__bar stats-cmp-chart__bar--bench2" />
                  <text x={cx - barW / 2 - 1} y={tY < zeroY ? tY - 6 : tY + 12} textAnchor="middle" className="stats-cmp-chart__bar-label">{fmtPct(r.tickerReturn)}</text>
                  <text x={cx + barW / 2 + 1} y={bY < zeroY ? bY - 6 : bY + 12} textAnchor="middle" className="stats-cmp-chart__bar-label">{fmtPct(r.benchmarkReturn)}</text>
                  {i % Math.max(1, Math.ceil(rows.length / 12)) === 0 || i === rows.length - 1 ? (
                    <text x={cx} y={H - 14} textAnchor="middle" className="stats-cmp-chart__x">{r.period}</text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        </>
      )}
    </section>
  );
}
