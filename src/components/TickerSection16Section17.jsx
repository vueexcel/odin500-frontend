import { useMemo } from 'react';

function pctClass(v) {
  if (v == null || !Number.isFinite(v)) return '';
  if (v > 0) return 'is-up';
  if (v < 0) return 'is-down';
  return '';
}

function cellColor(v) {
  if (v == null || !Number.isFinite(v)) return '#e2e8f0';
  if (v <= -6) return '#ef4444';
  if (v <= -3) return '#fca5a5';
  if (v < 0) return '#ffcc80';
  if (v < 1.5) return '#fff59d';
  if (v < 3.5) return '#dce775';
  if (v < 6) return '#a5d6a7';
  return '#66bb6a';
}

function labelColor(bg) {
  const dark = new Set(['#ef4444', '#66bb6a']);
  return dark.has(bg) ? '#ffffff' : '#0f172a';
}

/**
 * Figma-like compact table + mini bar section using existing TickerPage returns data.
 * No extra API calls.
 */
export function TickerSection16Section17({ rows, compareRows }) {
  const displayRows = useMemo(() => (Array.isArray(rows) ? rows.filter((r) => r && r.label).slice(0, 8) : []), [rows]);
  const chartRows = useMemo(
    () => (Array.isArray(compareRows) ? compareRows.filter((r) => r && r.label).slice(0, 8) : displayRows),
    [compareRows, displayRows]
  );

  const bars = useMemo(() => {
    if (!chartRows.length) return [];
    const vals = chartRows.map((r) => (Number.isFinite(r.diff) ? Number(r.diff) : 0));
    const maxAbs = Math.max(2, ...vals.map((v) => Math.abs(v)));
    return chartRows.map((r, i) => {
      const v = Number.isFinite(r.diff) ? Number(r.diff) : 0;
      return {
        key: r.label + '-' + i,
        label: r.label,
        value: v,
        hPct: Math.min(100, (Math.abs(v) / maxAbs) * 100),
        tone: v > 0 ? 'up' : v < 0 ? 'down' : 'flat'
      };
    });
  }, [chartRows]);

  return (
    <section className="ticker-s16s17">
      <div className="ticker-s16s17__card ticker-s16">
        <table className="ticker-s16__table">
          <thead>
            <tr>
              <th scope="col" >Relative Strength (SP500)</th>
              <th scope="col">1D</th>
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
        <div className="ticker-s17__plot">
          <div className="ticker-s17__zero" />
          {bars.map((b) => (
            <div key={b.key} className="ticker-s17__col">
              <div className="ticker-s17__bar-zone">
                <div
                  className={
                    'ticker-s17__bar ticker-s17__bar--' + b.tone + (b.value >= 0 ? ' ticker-s17__bar--pos' : ' ticker-s17__bar--neg')
                  }
                  style={{ height: `${b.hPct / 2}%` }}
                  title={`${b.label} diff: ${b.value.toFixed(2)}%`}
                />
              </div>
              <span className="ticker-s17__lab">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

