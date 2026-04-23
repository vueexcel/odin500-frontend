import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ChartDateApplyRow } from './ChartDateApplyRow.jsx';
import { DataInfoTip } from './DataInfoTip.jsx';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';

const BUCKETS_DARK = [
  { key: 'b01', legend: '0-1%', color: '#38bdf8' },
  { key: 'b25', legend: '1-2.5%', color: '#f97316' },
  { key: 'b5', legend: '2.5-5%', color: '#64748b' },
  { key: 'b10', legend: '5-10%', color: '#eab308' },
  { key: 'bgt', legend: '>10%', color: '#172554' }
];

/** Slightly deeper hues so dark labels read on light backgrounds. */
const BUCKETS_LIGHT = [
  { key: 'b01', legend: '0-1%', color: '#0284c7' },
  { key: 'b25', legend: '1-2.5%', color: '#ea580c' },
  { key: 'b5', legend: '2.5-5%', color: '#475569' },
  { key: 'b10', legend: '5-10%', color: '#ca8a04' },
  { key: 'bgt', legend: '>10%', color: '#2563eb' }
];

function bucketsForTheme(theme) {
  return theme === 'light' ? BUCKETS_LIGHT : BUCKETS_DARK;
}

const DONUT_GAP_DEG = 2.35;
const R0 = 56;
const R1 = 90;
const LABEL_R = (R0 + R1) / 2 + 6;

function parseYear(period) {
  const m = String(period || '').match(/(\d{4})/);
  const y = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(y) ? y : NaN;
}

/** All years: classify by absolute return magnitude (%). */
function bucketAllYears(tr) {
  const v = Math.abs(Number(tr));
  if (v <= 1) return 0;
  if (v <= 2.5) return 1;
  if (v <= 5) return 2;
  if (v <= 10) return 3;
  return 4;
}

/** Positive years only: signed return % in (0, ∞) mapped to band. */
function bucketPositive(tr) {
  const v = Number(tr);
  if (v <= 0) return -1;
  if (v <= 1) return 0;
  if (v <= 2.5) return 1;
  if (v <= 5) return 2;
  if (v <= 10) return 3;
  return 4;
}

/** Negative years only: magnitude of loss. */
function bucketNegativeMag(tr) {
  const v = Number(tr);
  if (v >= 0) return -1;
  const m = Math.abs(v);
  if (m <= 1) return 0;
  if (m <= 2.5) return 1;
  if (m <= 5) return 2;
  if (m <= 10) return 3;
  return 4;
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

function buildCounts(rows, mode) {
  const c = [0, 0, 0, 0, 0];
  for (const r of rows) {
    let b;
    if (mode === 'all') b = bucketAllYears(r.totalReturn);
    else if (mode === 'pos') b = bucketPositive(r.totalReturn);
    else b = bucketNegativeMag(r.totalReturn);
    if (b >= 0 && b <= 4) c[b] += 1;
  }
  return c;
}

function BucketDonut({ counts, buckets, theme, plotHeight }) {
  const light = theme === 'light';
  const ringStroke = light ? '#e2e8f0' : '#0d1520';
  const labelFill = light ? '#0f172a' : '#f8fafc';
  const labelShadow = light ? 'none' : '0 1px 3px rgba(0,0,0,0.85)';

  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <div className="ticker-annual-donut__donut-empty">
        <p className="ticker-annual-donut__donut-empty-txt">No years in these buckets.</p>
      </div>
    );
  }
  const drawn = counts.filter((n) => n > 0).length;
  const avail = 360 - DONUT_GAP_DEG * drawn;
  let theta = -90;
  const segs = [];
  for (let i = 0; i < 5; i++) {
    const n = counts[i];
    if (n <= 0) continue;
    const sweep = (n / total) * avail;
    const d0 = theta;
    const d1 = theta + sweep;
    const mid = (d0 + d1) / 2;
    const lp = labelOnDonut(LABEL_R, mid);
    const meta = buckets[i];
    segs.push(
      <g key={meta.key}>
        <path
          d={donutSegPath(R0, R1, d0, d1)}
          fill={meta.color}
          stroke={ringStroke}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <text
          x={lp.x}
          y={lp.y + 4}
          textAnchor="middle"
          fill={labelFill}
          fontSize="11"
          fontWeight="700"
          style={{ textShadow: labelShadow }}
        >
          {meta.legend}, {n}
        </text>
      </g>
    );
    theta = d1 + DONUT_GAP_DEG;
  }
  const h = plotHeight != null ? Math.min(320, plotHeight) : null;
  return (
    <svg
      className="ticker-annual-donut__svg"
      viewBox="-110 -110 220 220"
      aria-hidden
      style={tickerSvgPlotStyle(h)}
    >
      <g>{segs}</g>
    </svg>
  );
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
 * Figma-style bucketed donuts + center toggle (uses `performance.annualReturns`).
 * @param {{ symbol: string, annualReturns?: unknown[], asOfDate?: string, plotHeight?: number }} props
 */
export function TickerAnnualReturnsPosNeg({ symbol, annualReturns, asOfDate, plotHeight }) {
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const buckets = useMemo(() => bucketsForTheme(chartTheme), [chartTheme]);
  const [rightMode, setRightMode] = useState('positive');
  const [showTable, setShowTable] = useState(false);
  const [rangeApplied, setRangeApplied] = useState({ start: '', end: '' });

  const rows = useMemo(() => {
    if (!Array.isArray(annualReturns)) return [];
    return [...annualReturns]
      .map((r) => ({
        period: r.period,
        startDate: r.startDate,
        endDate: r.endDate,
        totalReturn: Number(r.totalReturn),
        year: parseYear(r.period)
      }))
      .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.totalReturn))
      .sort((a, b) => a.year - b.year);
  }, [annualReturns]);

  const filteredRows = useMemo(
    () => filterReturnsRows(rows, rangeApplied.start, rangeApplied.end),
    [rows, rangeApplied.start, rangeApplied.end]
  );

  const countsTotal = useMemo(() => buildCounts(filteredRows, 'all'), [filteredRows]);
  const countsRight = useMemo(
    () => (rightMode === 'positive' ? buildCounts(filteredRows, 'pos') : buildCounts(filteredRows, 'neg')),
    [filteredRows, rightMode]
  );

  const onDownloadCsv = useCallback(() => {
    if (!filteredRows.length) return;
    const headers = ['period', 'year', 'startDate', 'endDate', 'totalReturn'];
    const lines = [
      headers.join(','),
      ...filteredRows.map((r) =>
        [csvEscape(r.period), r.year, csvEscape(r.startDate), csvEscape(r.endDate), r.totalReturn].join(',')
      )
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(symbol || 'ticker').toUpperCase()}-annual-posneg.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, symbol]);

  const symU = String(symbol || 'ticker').toUpperCase();
  const asOfLine = asOfDate ? (
    <p className="ticker-data-tip__p">
      Returns as of <strong>{asOfDate}</strong> on the ticker-returns payload.
    </p>
  ) : null;

  if (!rows.length) {
    return (
      <div className="ticker-annual-donut">
        <div className="ticker-annual-figma__section">
          <div className="ticker-annual-figma__toolbar">
            <span className="ticker-annual-figma__badge">Annual returns — positive &amp; negative years</span>
          </div>
          <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
            <p className="ticker-annual-figma__empty">
              No annual return series for <strong>{symU}</strong>. Uses{' '}
              <code className="ticker-annual-figma__code">performance.annualReturns</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const rightTitle = rightMode === 'positive' ? 'Positive years' : 'Negative years';

  return (
    <div className="ticker-annual-donut">
      <div className="ticker-annual-figma__section ticker-annual-donut__section">
        <div className="ticker-annual-figma__toolbar">
          <span className="ticker-annual-figma__badge">Annual returns — positive &amp; negative years</span>
        </div>
        <ChartDateApplyRow
          idPrefix="annual-posneg"
          maxDate={asOfDate}
          mode="year"
          minYear={1980}
          maxYear={2026}
          initialStart="2018"
          initialEnd={String(asOfDate || '').slice(0, 4)}
          onApply={({ start, end }) => setRangeApplied({ start, end })}
        />
        <div className="ticker-annual-figma__toolbar ticker-annual-figma__toolbar--sub">
          <div className="ticker-annual-figma__left" />
          <div className="ticker-annual-figma__right">
            <button
              type="button"
              className="ticker-annual-figma__btn"
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
            >
              <IcoTable /> {showTable ? 'Hide data table' : 'Show data table'}
            </button>
            <button type="button" className="ticker-annual-figma__btn ticker-annual-figma__btn--outline" onClick={onDownloadCsv}>
              <IcoDownload /> Download CSV
            </button>
          </div>
        </div>

        <div className="ticker-annual-donut__stage">
          <div className="ticker-annual-donut__toggle-wrap" aria-label="Right panel mode">
            <div className="ticker-annual-donut__toggle" role="tablist">
              <button
                type="button"
                role="tab"
                className={
                  'ticker-annual-donut__toggle-btn' +
                  (rightMode === 'positive' ? ' ticker-annual-donut__toggle-btn--active' : '')
                }
                aria-selected={rightMode === 'positive'}
                onClick={() => setRightMode('positive')}
              >
                Positive Years
              </button>
              <button
                type="button"
                role="tab"
                className={
                  'ticker-annual-donut__toggle-btn' +
                  (rightMode === 'negative' ? ' ticker-annual-donut__toggle-btn--active' : '')
                }
                aria-selected={rightMode === 'negative'}
                onClick={() => setRightMode('negative')}
              >
                Negative Years
              </button>
            </div>
          </div>

          <div className="ticker-annual-donut__split">
            <div className="ticker-annual-donut__panel ticker-annual-figma__chart-card">
              <div className="ticker-annual-donut__panel-head">
                <span className="ticker-annual-donut__panel-spacer" aria-hidden />
                <h3 className="ticker-annual-donut__panel-title">Years, total</h3>
                <div className="ticker-annual-donut__panel-tip">
                  <DataInfoTip align="end">
                    <p className="ticker-data-tip__p">
                      <strong>Years, total</strong>: every row in{' '}
                      <code className="ticker-data-tip__code">performance.annualReturns</code> is counted once. Each year
                      is placed in a <strong>return magnitude</strong> band using <strong>|totalReturn|</strong> (absolute
                      %): 0–1%, 1–2.5%, 2.5–5%, 5–10%, or &gt;10%.
                    </p>
                    <p className="ticker-data-tip__p">
                      Gains and losses both contribute to the same magnitude buckets on this chart so you can see how
                      often the name moves a little vs a lot in either direction.
                    </p>
                    <p className="ticker-data-tip__p">
                      Symbol <strong>{symU}</strong>.
                    </p>
                    {asOfLine}
                  </DataInfoTip>
                </div>
              </div>
              <div className="ticker-annual-donut__donut-wrap">
                <BucketDonut counts={countsTotal} buckets={buckets} theme={chartTheme} plotHeight={plotHeight} />
              </div>
              <div className="ticker-annual-donut__legend">
                {buckets.map((b) => (
                  <span key={b.key} className="ticker-annual-donut__legend-item">
                    <span className="ticker-annual-donut__swatch" style={{ background: b.color }} aria-hidden />
                    {b.legend}
                  </span>
                ))}
              </div>
            </div>

            <div className="ticker-annual-donut__panel ticker-annual-figma__chart-card">
              <div className="ticker-annual-donut__panel-head">
                <span className="ticker-annual-donut__panel-spacer" aria-hidden />
                <h3 className="ticker-annual-donut__panel-title">{rightTitle}</h3>
                <div className="ticker-annual-donut__panel-tip">
                  <DataInfoTip align="end">
                    {rightMode === 'positive' ? (
                      <>
                        <p className="ticker-data-tip__p">
                          <strong>Positive years</strong> only: years with <strong>totalReturn &gt; 0</strong>. Each is
                          bucketed by the <strong>actual</strong> positive return into the same five bands (0–1% through
                          &gt;10%).
                        </p>
                        <p className="ticker-data-tip__p">
                          Counts sum to the number of up years in the series, not the total number of years.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="ticker-data-tip__p">
                          <strong>Negative years</strong> only: years with <strong>totalReturn &lt; 0</strong>. Each is
                          bucketed by <strong>loss magnitude</strong> (absolute value of the negative return) into 0–1%,
                          1–2.5%, 2.5–5%, 5–10%, or &gt;10%.
                        </p>
                        <p className="ticker-data-tip__p">
                          Legend labels describe the size of the decline, not a positive gain.
                        </p>
                      </>
                    )}
                    <p className="ticker-data-tip__p">
                      Use the <strong>Positive Years</strong> / <strong>Negative Years</strong> control above to switch
                      this panel. Symbol <strong>{symU}</strong>.
                    </p>
                    {asOfLine}
                  </DataInfoTip>
                </div>
              </div>
              <div className="ticker-annual-donut__donut-wrap">
                <BucketDonut counts={countsRight} buckets={buckets} theme={chartTheme} plotHeight={plotHeight} />
              </div>
              <div className="ticker-annual-donut__legend">
                {buckets.map((b) => (
                  <span key={b.key} className="ticker-annual-donut__legend-item">
                    <span className="ticker-annual-donut__swatch" style={{ background: b.color }} aria-hidden />
                    {b.legend}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        {showTable ? (
          <div className="ticker-annual-figma__table-wrap">
            <table className="ticker-annual-figma__table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Total Return</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr key={`apn-row-${r.period}`}>
                    <td>{r.period}</td>
                    <td>{r.startDate || '—'}</td>
                    <td>{r.endDate || '—'}</td>
                    <td className={r.totalReturn >= 0 ? 'ticker-num--up' : 'ticker-num--down'}>
                      {r.totalReturn >= 0 ? '+' : ''}
                      {r.totalReturn.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
