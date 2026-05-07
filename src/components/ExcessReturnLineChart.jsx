import { ThemedDropdown } from './ThemedDropdown.jsx';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';

function fmtEx(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n).toFixed(1);
  return n < 0 ? `(${abs}%)` : `${abs}%`;
}

export function ExcessReturnLineChart({
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
  const padL = 50;
  const padR = 18;
  const padT = 16;
  const padB = 48;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const vals = rows.map((r) => Number(r.excessReturn)).filter(Number.isFinite);
  const minV = vals.length ? Math.min(0, ...vals) : -8;
  const maxV = vals.length ? Math.max(0, ...vals) : 8;
  const span = Math.max(1, maxV - minV);
  const yMin = minV - span * 0.1;
  const yMax = maxV + span * 0.1;
  const y = (v) => padT + ((yMax - v) / (yMax - yMin)) * ih;
  const x = (i) => padL + (iw * i) / Math.max(1, rows.length - 1);
  const zeroY = y(0);
  const path = rows
    .map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(r.excessReturn)}`)
    .join(' ');
  const area = rows.length
    ? `${path} L ${x(rows.length - 1)} ${zeroY} L ${x(0)} ${zeroY} Z`
    : '';

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
        <StatsCmpChartSkeleton variant="line" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <>
          <div className="stats-cmp-chart__legend">
            <span><i className="stats-cmp-chart__sw stats-cmp-chart__sw--line" /> Excess ({ticker} - {benchmarkIndex})</span>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="stats-cmp-chart__svg" preserveAspectRatio="xMidYMid meet">
            {[0, 0.25, 0.5, 0.75, 1].map((k) => {
              const t = yMin + (yMax - yMin) * k;
              const yy = y(t);
              return <line key={k} x1={padL} y1={yy} x2={W - padR} y2={yy} className="stats-cmp-chart__grid" />;
            })}
            <line x1={padL} y1={zeroY} x2={W - padR} y2={zeroY} className="stats-cmp-chart__zero" />
            <path d={area} className="stats-cmp-chart__area" />
            <path d={path} className="stats-cmp-chart__line" />
            {rows.map((r, i) => (
              <g key={r.period}>
                <circle cx={x(i)} cy={y(r.excessReturn)} r="3" className="stats-cmp-chart__dot" />
                <text x={x(i)} y={y(r.excessReturn) - 8} textAnchor="middle" className="stats-cmp-chart__line-label">{fmtEx(r.excessReturn)}</text>
                {i % Math.max(1, Math.ceil(rows.length / 12)) === 0 || i === rows.length - 1 ? (
                  <text x={x(i)} y={H - 14} textAnchor="middle" className="stats-cmp-chart__x">{r.period}</text>
                ) : null}
              </g>
            ))}
          </svg>
        </>
      )}
    </section>
  );
}
