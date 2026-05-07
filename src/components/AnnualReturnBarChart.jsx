import { ThemedDropdown } from './ThemedDropdown.jsx';
import { StatsCmpChartSkeleton } from './ChartSkeletons.jsx';

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

export function AnnualReturnBarChart({
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
  const H = 330;
  const padL = 56;
  const padR = 18;
  const padT = 16;
  const padB = 62;
  const iw = W - padL - padR;
  const ih = H - padT - padB;
  const vals = rows.flatMap((r) => [Number(r.tickerReturn), Number(r.benchmarkReturn)]).filter(Number.isFinite);
  const minV = vals.length ? Math.min(0, ...vals) : -10;
  const maxV = vals.length ? Math.max(0, ...vals) : 20;
  const span = Math.max(1, maxV - minV);
  const yMin = minV - span * 0.08;
  const yMax = maxV + span * 0.08;
  const y = (v) => padT + ((yMax - v) / (yMax - yMin)) * ih;
  const zeroY = y(0);
  const n = Math.max(1, rows.length);
  const groupW = iw / n;
  const barW = Math.max(6, Math.min(28, groupW * 0.28));

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
        <StatsCmpChartSkeleton variant="groupedBar" />
      ) : !rows.length ? (
        <div className="stats-cmp-chart__state">No data available for selected range.</div>
      ) : (
        <>
          <div className="stats-cmp-chart__legend">
            <span><i className="stats-cmp-chart__sw stats-cmp-chart__sw--ticker" /> {ticker}</span>
            <span><i className="stats-cmp-chart__sw stats-cmp-chart__sw--bench1" /> {benchmarkIndex}</span>
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
              const tH = Math.abs(zeroY - tY);
              const bH = Math.abs(zeroY - bY);
              return (
                <g key={r.period}>
                  <rect x={cx - barW - 2} y={Math.min(tY, zeroY)} width={barW} height={Math.max(1, tH)} className="stats-cmp-chart__bar stats-cmp-chart__bar--ticker" />
                  <rect x={cx + 2} y={Math.min(bY, zeroY)} width={barW} height={Math.max(1, bH)} className="stats-cmp-chart__bar stats-cmp-chart__bar--bench1" />
                  <text x={cx - barW / 2 - 2} y={tY < zeroY ? tY + 12 : tY - 5} textAnchor="middle" className="stats-cmp-chart__bar-label">{fmtPct(r.tickerReturn)}</text>
                  <text x={cx + barW / 2 + 2} y={bY < zeroY ? bY + 12 : bY - 5} textAnchor="middle" className="stats-cmp-chart__bar-label">{fmtPct(r.benchmarkReturn)}</text>
                  <text x={cx} y={H - 14} textAnchor="middle" className="stats-cmp-chart__x">{r.period}</text>
                </g>
              );
            })}
          </svg>
          <div className="stats-cmp-chart__titlebox">{ticker} vs {benchmarkIndex} — {mode} Returns</div>
          <div className="stats-cmp-chart__caption">
            {ticker} versus {benchmarkIndex} calendar-{mode} returns.
          </div>
        </>
      )}
    </section>
  );
}
