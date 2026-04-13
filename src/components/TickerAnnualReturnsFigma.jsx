import { useCallback, useMemo, useState } from 'react';

/** Match `TickerLightweightChart` / dark ticker cards. */
const COL_BAR = '#2563eb';
const COL_ORANGE = '#f97316';
const COL_GRID = 'rgba(148, 163, 184, 0.14)';
const COL_GRID_ZERO = 'rgba(148, 163, 184, 0.35)';
const COL_AXIS = '#94a3b8';
const COL_LABEL = '#e2e8f0';
const Y_AXIS_MIN = -20;
const Y_AXIS_MAX = 60;

function parseYear(period) {
  const m = String(period || '').match(/(\d{4})/);
  const y = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(y) ? y : NaN;
}

function median(nums) {
  const arr = nums.filter((n) => Number.isFinite(n));
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function clampY(v) {
  if (!Number.isFinite(v)) return Y_AXIS_MIN;
  return Math.min(Y_AXIS_MAX, Math.max(Y_AXIS_MIN, v));
}

/** Map return % to SVG y (top = Y_AXIS_MAX). */
function yForValue(v, innerTop, innerH) {
  const c = clampY(v);
  return innerTop + ((Y_AXIS_MAX - c) / (Y_AXIS_MAX - Y_AXIS_MIN)) * innerH;
}

function donutSegPath(r0, r1, deg0, deg1) {
  const rad = Math.PI / 180;
  const x1 = r1 * Math.cos(deg0 * rad);
  const y1 = r1 * Math.sin(deg0 * rad);
  const x2 = r1 * Math.cos(deg1 * rad);
  const y2 = r1 * Math.sin(deg1 * rad);
  const x3 = r0 * Math.cos(deg1 * rad);
  const y3 = r0 * Math.sin(deg1 * rad);
  const x4 = r0 * Math.cos(deg0 * rad);
  const y4 = r0 * Math.sin(deg0 * rad);
  const large = Math.abs(deg1 - deg0) > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r1} ${r1} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r0} ${r0} 0 ${large} 0 ${x4} ${y4} Z`;
}

function labelOnDonut(r, degMid) {
  const rad = Math.PI / 180;
  return { x: r * Math.cos(degMid * rad), y: r * Math.sin(degMid * rad) };
}

function IcoTable() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M4 9h16M4 14h16M12 9v11" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IcoDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v10m0 0l4-4m-4 4L8 10M6 18h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

/**
 * Figma-style annual returns + stats (uses `performance.annualReturns` from ticker-returns API).
 * @param {{ symbol: string, annualReturns?: unknown[], asOfDate?: string }} props
 */
export function TickerAnnualReturnsFigma({ symbol, annualReturns, asOfDate }) {
  const [showTable, setShowTable] = useState(false);

  const rows = useMemo(() => {
    if (!Array.isArray(annualReturns)) return [];
    return [...annualReturns]
      .map((r) => ({
        period: r.period,
        startDate: r.startDate,
        endDate: r.endDate,
        startPrice: r.startPrice,
        endPrice: r.endPrice,
        totalReturn: Number(r.totalReturn),
        year: parseYear(r.period)
      }))
      .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.totalReturn))
      .sort((a, b) => a.year - b.year);
  }, [annualReturns]);

  const stats = useMemo(() => {
    if (!rows.length) return null;
    const rets = rows.map((r) => r.totalReturn);
    const pos = rows.filter((r) => r.totalReturn > 0).length;
    const neg = rows.filter((r) => r.totalReturn < 0).length;
    const avg = rets.reduce((a, b) => a + b, 0) / rets.length;
    return {
      pos,
      neg,
      avg,
      max: Math.max(...rets),
      min: Math.min(...rets),
      med: median(rets)
    };
  }, [rows]);

  const onDownloadCsv = useCallback(() => {
    if (!rows.length) return;
    const headers = ['period', 'year', 'startDate', 'endDate', 'totalReturn', 'startPrice', 'endPrice'];
    const lines = [
      headers.join(','),
      ...rows.map((r) =>
        [
          csvEscape(r.period),
          r.year,
          csvEscape(r.startDate),
          csvEscape(r.endDate),
          r.totalReturn,
          r.startPrice ?? '',
          r.endPrice ?? ''
        ].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(symbol || 'ticker').toUpperCase()}-annual-returns.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, symbol]);

  const comboSvg = useMemo(() => {
    if (!rows.length || !stats) return null;
    const W = 880;
    const H = 260;
    const padL = 52;
    const padR = 20;
    const padT = 16;
    const padB = 56;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = rows.length;
    const gap = 0.15;
    const bw = (iw / n) * (1 - gap);
    const step = iw / n;

    const yTicks = [-20, -10, 0, 10, 20, 30, 40, 50, 60];
    const gridLines = yTicks.map((t) => {
      const y = yForValue(t, padT, ih);
      return (
        <g key={t}>
          <line
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke={t === 0 ? COL_GRID_ZERO : COL_GRID}
            strokeWidth={t === 0 ? 1.35 : 1}
          />
          <text x={padL - 8} y={y + 4} textAnchor="end" fill={COL_AXIS} fontSize="11" fontWeight="600">
            {t}%
          </text>
        </g>
      );
    });

    const bars = rows.map((r, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValue(0, padT, ih);
      const y1 = yForValue(r.totalReturn, padT, ih);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      const labY = r.totalReturn >= 0 ? top - 6 : top + h + 14;
      return (
        <g key={r.year}>
          <rect x={x} y={top} width={bw} height={Math.max(h, 1)} rx={2} fill={COL_BAR} />
          <text x={x + bw / 2} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="11" fontWeight="700">
            {r.totalReturn >= 0 ? '+' : ''}
            {r.totalReturn.toFixed(0)}%
          </text>
        </g>
      );
    });

    const avgY = yForValue(stats.avg, padT, ih);

    const xLabels = rows.map((r, i) => {
      const cx = padL + i * step + step / 2;
      return (
        <text key={r.year} x={cx} y={H - 28} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="600">
          {r.year}
        </text>
      );
    });

    return (
      <svg className="ticker-annual-figma__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {gridLines}
        <line x1={padL} y1={avgY} x2={W - padR} y2={avgY} stroke={COL_ORANGE} strokeWidth={2.5} />
        {bars}
        {xLabels}
      </svg>
    );
  }, [rows, stats]);

  const summaryBars = useMemo(() => {
    if (!stats) return null;
    const items = [
      { key: 'max', label: 'Max', v: stats.max },
      { key: 'min', label: 'Min', v: stats.min },
      { key: 'avg', label: 'Average', v: stats.avg },
      { key: 'med', label: 'Median', v: stats.med }
    ];
    const W = 420;
    const H = 240;
    const padL = 48;
    const padR = 16;
    const padT = 12;
    const padB = 48;
    const iw = W - padL - padR;
    const ih = H - padT - padB;
    const n = 4;
    const gap = 0.2;
    const bw = (iw / n) * (1 - gap);
    const step = iw / n;

    const yTicks = [-20, -10, 0, 10, 20, 30, 40, 50, 60];
    const gridLines = yTicks.map((t) => {
      const y = yForValue(t, padT, ih);
      return (
        <g key={t}>
          <line
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke={t === 0 ? COL_GRID_ZERO : COL_GRID}
            strokeWidth={t === 0 ? 1.35 : 1}
          />
          <text x={padL - 8} y={y + 4} textAnchor="end" fill={COL_AXIS} fontSize="11" fontWeight="600">
            {t}%
          </text>
        </g>
      );
    });

    const bars = items.map((it, i) => {
      const x = padL + i * step + (step - bw) / 2;
      const y0 = yForValue(0, padT, ih);
      const y1 = yForValue(it.v, padT, ih);
      const top = Math.min(y0, y1);
      const h = Math.abs(y1 - y0);
      const labY = it.v >= 0 ? top - 5 : top + h + 14;
      return (
        <g key={it.key}>
          <rect x={x} y={top} width={bw} height={Math.max(h, 1)} rx={2} fill={COL_BAR} />
          <text x={x + bw / 2} y={labY} textAnchor="middle" fill={COL_LABEL} fontSize="11" fontWeight="700">
            {it.v >= 0 ? '+' : ''}
            {Number(it.v).toFixed(0)}%
          </text>
          <text x={x + bw / 2} y={H - 18} textAnchor="middle" fill={COL_AXIS} fontSize="11" fontWeight="700">
            {it.label}
          </text>
        </g>
      );
    });

    return (
      <svg className="ticker-annual-figma__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {gridLines}
        {bars}
      </svg>
    );
  }, [stats]);

  const donut = useMemo(() => {
    if (!stats) return null;
    const total = stats.pos + stats.neg;
    const cx = 100;
    const cy = 100;
    const r0 = 52;
    const r1 = 82;
    if (total === 0) {
      return (
        <svg className="ticker-annual-figma__donut-svg" viewBox="0 0 200 200">
          <text x="100" y="104" textAnchor="middle" fill="#94a3b8" fontSize="12" fontWeight="600">
            No data
          </text>
        </svg>
      );
    }
    const start = -90;
    const endFull = start + 360;
    let paths;
    let labels;
    if (stats.neg === 0) {
      const d = donutSegPath(r0, r1, start, endFull);
      const lp = labelOnDonut((r0 + r1) / 2, start + 180);
      paths = <path d={d} fill={COL_BAR} />;
      labels = (
        <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
          {stats.pos}
        </text>
      );
    } else if (stats.pos === 0) {
      const d = donutSegPath(r0, r1, start, endFull);
      const lp = labelOnDonut((r0 + r1) / 2, start + 180);
      paths = <path d={d} fill={COL_ORANGE} />;
      labels = (
        <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
          {stats.neg}
        </text>
      );
    } else {
      const spanPos = (stats.pos / total) * 360;
      const endPos = start + spanPos;
      const pPos = donutSegPath(r0, r1, start, endPos);
      const pNeg = donutSegPath(r0, r1, endPos, endFull);
      const midPos = start + spanPos / 2;
      const midNeg = endPos + (endFull - endPos) / 2;
      const lp = labelOnDonut((r0 + r1) / 2, midPos);
      const ln = labelOnDonut((r0 + r1) / 2, midNeg);
      paths = (
        <>
          <path d={pPos} fill={COL_BAR} />
          <path d={pNeg} fill={COL_ORANGE} />
        </>
      );
      labels = (
        <>
          <text x={lp.x} y={lp.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            {stats.pos}
          </text>
          <text x={ln.x} y={ln.y + 5} textAnchor="middle" fill="#fff" fontSize="16" fontWeight="800">
            {stats.neg}
          </text>
        </>
      );
    }
    return (
      <svg className="ticker-annual-figma__donut-svg" viewBox="0 0 200 200">
        <g transform={`translate(${cx},${cy})`}>
          {paths}
          {labels}
        </g>
      </svg>
    );
  }, [stats]);

  if (!rows.length) {
    return (
      <div className="ticker-annual-figma">
        <div className="ticker-annual-figma__section">
          <div className="ticker-annual-figma__toolbar">
            <span className="ticker-annual-figma__badge">Annual returns</span>
          </div>
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
            <p className="ticker-annual-figma__empty">
              No annual return series yet. Load completes after <strong>ticker-returns</strong> returns{' '}
              <code className="ticker-annual-figma__code">performance.annualReturns</code> for {String(symbol).toUpperCase()}.
            </p>
            {asOfDate ? (
              <p className="ticker-annual-figma__empty-sub">As of {asOfDate} from returns payload.</p>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-annual-figma">
      <div className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar">
          <span className="ticker-annual-figma__badge">Annual returns</span>
          <div className="ticker-annual-figma__actions">
            <button
              type="button"
              className="ticker-annual-figma__btn ticker-annual-figma__btn--primary"
              onClick={() => setShowTable((v) => !v)}
            >
              <IcoTable /> Show data tables
            </button>
            <button type="button" className="ticker-annual-figma__btn ticker-annual-figma__btn--outline" onClick={onDownloadCsv}>
              <IcoDownload /> Download CSV
            </button>
          </div>
        </div>
        <div className="ticker-annual-figma__chart-card">{comboSvg}</div>
        <div className="ticker-annual-figma__legend">
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden />
            Annual return (%)
          </span>
          <span className="ticker-annual-figma__legend-item">
            <span className="ticker-annual-figma__swatch-line" aria-hidden />
            Av. return (%)
          </span>
        </div>
        {showTable ? (
          <div className="ticker-annual-figma__table-wrap">
            <table className="ticker-annual-figma__table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Total return %</th>
                  <th>Start price</th>
                  <th>End price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td>{r.startDate ?? '—'}</td>
                    <td>{r.endDate ?? '—'}</td>
                    <td>{r.totalReturn.toFixed(2)}</td>
                    <td>{r.startPrice != null ? Number(r.startPrice).toFixed(2) : '—'}</td>
                    <td>{r.endPrice != null ? Number(r.endPrice).toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      <div className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar ticker-annual-figma__toolbar--stack">
          <span className="ticker-annual-figma__badge">Annual stats — positive / negative, min max</span>
        </div>
        <div className="ticker-annual-figma__split">
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--donut">
            {donut}
            <div className="ticker-annual-figma__legend ticker-annual-figma__legend--donut">
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--blue" aria-hidden /># positive years
              </span>
              <span className="ticker-annual-figma__legend-item">
                <span className="ticker-annual-figma__swatch ticker-annual-figma__swatch--orange" aria-hidden /># negative years
              </span>
            </div>
          </div>
          <div className="ticker-annual-figma__chart-card">{summaryBars}</div>
        </div>
      </div>
    </div>
  );
}
