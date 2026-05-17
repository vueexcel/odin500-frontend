import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChartDateApplyRow } from './ChartDateApplyRow.jsx';
import { DataInfoTip } from './DataInfoTip.jsx';
import { periodModeNouns } from '../utils/periodModeNouns.js';
import { filterReturnsRows } from '../utils/returnsDateRange.js';
import { tickerSvgPlotStyle } from '../utils/tickerChartResize.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { PosNegReturnsChartSkeleton } from './ChartSkeletons.jsx';
import { ReturnsChartToolbar } from './ReturnsChartToolbar.jsx';
import { ReturnsChartClickableTitle } from './ReturnsChartClickableTitle.jsx';
import { getReturnsChartViewMoreHref } from '../utils/returnsViewMoreNavigation.js';
import { ChartSectionIconActions } from './ChartSectionIconActions.jsx';
import { buildTickerChartExportFilename } from '../utils/chartExportFilename.js';

const BUCKETS_DARK = [
  { key: 'b01', legend: '0-1%', color: '#38bdf8' },
  { key: 'b25', legend: '1-2.5%', color: '#f97316' },
  { key: 'b5', legend: '2.5-5%', color: '#64748b' },
  { key: 'b10', legend: '5-10%', color: '#eab308' },
  { key: 'bgt', legend: '>10%', color: '#2563eb' }
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

/** Angular gap between donut slices (deg). 0 = segments meet with no visible gap. */
const DONUT_GAP_DEG = 0;
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

function BucketDonut({ counts, buckets, theme, plotHeight, emptyPeriodLower = 'years' }) {
  const light = theme === 'light';
  const ringStroke = light ? '#e2e8f0' : '#0d1520';
  const labelFill = light ? '#0f172a' : '#f8fafc';
  const labelShadow = light ? 'none' : '0 1px 3px rgba(0,0,0,0.85)';

  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) {
    return (
      <div className="ticker-annual-donut__donut-empty">
        <p className="ticker-annual-donut__donut-empty-txt">No {emptyPeriodLower} in these buckets.</p>
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
          strokeWidth="0"
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

function csvEscape(s) {
  const t = String(s ?? '');
  if (/[",\n]/.test(t)) return '"' + t.replace(/"/g, '""') + '"';
  return t;
}

/** Pie icon + period returns badge (layout: Tailwind only). */
function PosNegToolbarBadgeWithIcon({ periodMode, pn, onClick }) {
  const clipId = useId().replace(/:/g, '');
  return (
    <div className="inline-flex min-w-0 shrink-0 items-center ">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        className="shrink-0"
        aria-hidden
      >
        <g clipPath={`url(#${clipId})`}>
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
          <clipPath id={clipId}>
            <rect width="14" height="14" fill="white" />
          </clipPath>
        </defs>
      </svg>
      <ReturnsChartClickableTitle className="ticker-annual-figma__badge uppercase" onClick={onClick}>
        {`${periodMode === 'quarterly' ? 'Quarterly statistics' : periodMode === 'monthly' ? 'Monthly statistics' : periodMode === 'weekly' ? 'Weekly statistics' : periodMode === 'daily' ? 'Daily statistics' : 'Annual statistics'} — positive & negative ${pn.lower}`}
      </ReturnsChartClickableTitle>
    </div>
  );
}

/**
 * Figma-style bucketed donuts + center toggle (uses annual/quarterly returns payload rows).
 * @param {{ symbol: string, annualReturns?: unknown[], asOfDate?: string, plotHeight?: number, periodMode?: 'annual' | 'quarterly' | 'monthly' | 'weekly' | 'daily', suppressChartDateFilter?: boolean }} props
 */
export function TickerAnnualReturnsPosNeg({
  symbol,
  annualReturns,
  asOfDate,
  plotHeight,
  periodMode = 'annual',
  suppressChartDateFilter = false,
  loading = false
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const chartTheme = useSyncExternalStore(subscribeDocumentTheme, getDocumentTheme, () => 'dark');
  const sectionRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartFsShellRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const chartCardRef = useRef(/** @type {HTMLDivElement | null} */ (null));
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
    () => (suppressChartDateFilter ? rows : filterReturnsRows(rows, rangeApplied.start, rangeApplied.end)),
    [rows, rangeApplied.start, rangeApplied.end, suppressChartDateFilter]
  );

  const countsTotal = useMemo(() => buildCounts(filteredRows, 'all'), [filteredRows]);
  const countsRight = useMemo(
    () => (rightMode === 'positive' ? buildCounts(filteredRows, 'pos') : buildCounts(filteredRows, 'neg')),
    [filteredRows, rightMode]
  );
  const totalYears = useMemo(() => {
    const ys = new Set(filteredRows.map((r) => Number(r.year)).filter((y) => Number.isFinite(y)));
    return ys.size;
  }, [filteredRows]);
  const rightTotalCount = useMemo(
    () =>
      rightMode === 'positive'
        ? filteredRows.filter((r) => Number(r.totalReturn) > 0).length
        : filteredRows.filter((r) => Number(r.totalReturn) < 0).length,
    [filteredRows, rightMode]
  );

  const pn = useMemo(() => periodModeNouns(periodMode), [periodMode]);
  const panelTotalTitle = `${pn.title}, total`;
  const positiveTabLabel = `Positive ${pn.title}`;
  const negativeTabLabel = `Negative ${pn.title}`;
  const rightTitle = rightMode === 'positive' ? `Positive ${pn.lower}` : `Negative ${pn.lower}`;

  const onViewMore = useCallback(() => {
    const to = getReturnsChartViewMoreHref({
      pathname: location.pathname,
      search: location.search,
      periodMode,
      symbol
    });
    navigate(to);
    queueMicrotask(() => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
  }, [navigate, location.pathname, location.search, periodMode, symbol]);

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
    a.download = `${String(symbol || 'ticker').toUpperCase()}-${periodMode === 'quarterly' ? 'quarterly' : periodMode === 'monthly' ? 'monthly' : periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'annual'}-posneg.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredRows, symbol, periodMode]);

  const symU = String(symbol || 'ticker').toUpperCase();

  const buildExportFilename = useCallback(
    () => buildTickerChartExportFilename(`${periodMode}-posneg-returns`, symbol),
    [periodMode, symbol]
  );
  const chartExportDisabled = loading || !filteredRows.length;

  const posNegRangeControls = !suppressChartDateFilter ? (
    <div className="ticker-annual-posneg__range-inline">
      <ChartDateApplyRow
        idPrefix="annual-posneg"
        maxDate={asOfDate}
        mode={periodMode === 'daily' ? 'date' : 'year'}
        minYear={1980}
        maxYear={2026}
        initialStart={periodMode === 'daily' ? '' : '2018'}
        initialEnd={periodMode === 'daily' ? '' : String(asOfDate || '').slice(0, 4)}
        onApply={({ start, end }) => setRangeApplied({ start, end })}
      />
    </div>
  ) : null;

  const posNegModeToggleButtons = (
    <>
      <button
        type="button"
        role="tab"
        className={
          'ticker-annual-donut__toggle-btn' + (rightMode === 'positive' ? ' ticker-annual-donut__toggle-btn--active' : '')
        }
        aria-selected={rightMode === 'positive'}
        onClick={() => setRightMode('positive')}
      >
        {positiveTabLabel}
      </button>
      <button
        type="button"
        role="tab"
        className={
          'ticker-annual-donut__toggle-btn' + (rightMode === 'negative' ? ' ticker-annual-donut__toggle-btn--active' : '')
        }
        aria-selected={rightMode === 'negative'}
        onClick={() => setRightMode('negative')}
      >
        {negativeTabLabel}
      </button>
    </>
  );

  const posNegModeToggleForSubrow = <div className="ticker-annual-donut__toggle">{posNegModeToggleButtons}</div>;

  const asOfLine = asOfDate ? (
    <p className="ticker-data-tip__p">
      Returns as of <strong>{asOfDate}</strong> on the ticker-returns payload.
    </p>
  ) : null;

  if (!rows.length) {
    if (loading) {
      return <PosNegReturnsChartSkeleton periodMode={periodMode} />;
    }
    return (
      <div className="ticker-annual-donut">
        <div ref={sectionRef} className="ticker-annual-figma__section">
          <div className="ticker-annual-figma__toolbar">
            <PosNegToolbarBadgeWithIcon periodMode={periodMode} pn={pn} onClick={onViewMore} />
            <ChartSectionIconActions
              snapshotRootRef={sectionRef}
              plotHostRef={chartCardRef}
              fullscreenTargetRef={chartFsShellRef}
              buildFilename={buildExportFilename}
              disabled
              exportPreviewAlt={`${pn.title} pos/neg for ${symU}`}
            />
          </div>
          <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
            <div ref={chartCardRef} className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--empty">
              <p className="ticker-annual-figma__empty">
                No {periodMode === 'quarterly' ? 'quarterly' : periodMode === 'monthly' ? 'monthly' : periodMode === 'weekly' ? 'weekly' : periodMode === 'daily' ? 'daily' : 'annual'} return data for <strong>{symU}</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-annual-donut">
      <div ref={sectionRef} className="ticker-annual-figma__section ticker-annual-donut__section">
        <div className="ticker-annual-figma__toolbar">
          <PosNegToolbarBadgeWithIcon periodMode={periodMode} pn={pn} onClick={onViewMore} />
          <div className="ticker-annual-figma__toolbar-end">
            <ReturnsChartToolbar
              className="ticker-annual-posneg__toolbar min-w-0"
              rangeControls={posNegRangeControls}
              showViewMore={false}
              onToggleTable={() => setShowTable((v) => !v)}
              showTable={showTable}
              onDownload={onDownloadCsv}
              downloadDisabled={!filteredRows.length}
            />
            <ChartSectionIconActions
              snapshotRootRef={sectionRef}
              plotHostRef={chartCardRef}
              fullscreenTargetRef={chartFsShellRef}
              buildFilename={buildExportFilename}
              disabled={chartExportDisabled}
              exportPreviewAlt={`${pn.title} pos/neg chart for ${symU}`}
            />
          </div>
        </div>
        <div className="ticker-annual-figma__toolbar ticker-annual-figma__toolbar--sub">
          <div className="ticker-annual-figma__left" />
          {posNegModeToggleForSubrow}
        </div>

        <div className="ticker-annual-donut__stage">
          <div ref={chartFsShellRef} className="ticker-chart-fs-shell">
          <div ref={chartCardRef} className="ticker-annual-donut__split">
            <div className="ticker-annual-donut__panel ticker-annual-figma__chart-card">
              <div className="ticker-annual-donut__panel-head">
                <span className="ticker-annual-donut__panel-spacer" aria-hidden />
                <h3 className="ticker-annual-donut__panel-title">{panelTotalTitle}</h3>
                <div className="ticker-annual-donut__panel-tip">
                  <DataInfoTip align="end">
                    <p className="ticker-data-tip__p">
                        <strong>{panelTotalTitle}</strong>: every row in{' '}
                        <code className="ticker-data-tip__code">
                          performance.{periodMode === 'quarterly' ? 'quarterlyReturns' : periodMode === 'monthly' ? 'monthlyReturns' : periodMode === 'weekly' ? 'weeklyReturns' : periodMode === 'daily' ? 'dailyReturns' : 'annualReturns'}
                        </code>{' '}
                        is counted once. Each period
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
                <BucketDonut
                  counts={countsTotal}
                  buckets={buckets}
                  theme={chartTheme}
                  plotHeight={plotHeight}
                  emptyPeriodLower={pn.lower}
                />
              </div>
              <div className="ticker-annual-donut__panel-total">
                Total {pn.lower}: {totalYears}
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
                          <strong>Positive {pn.lower}</strong> only: {pn.lower} with <strong>totalReturn &gt; 0</strong>. Each is
                          bucketed by the <strong>actual</strong> positive return into the same five bands (0–1% through
                          &gt;10%).
                        </p>
                        <p className="ticker-data-tip__p">
                          Counts sum to the number of up {pn.lower} in the series, not the total count of {pn.lower}.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="ticker-data-tip__p">
                          <strong>Negative {pn.lower}</strong> only: {pn.lower} with <strong>totalReturn &lt; 0</strong>. Each is
                          bucketed by <strong>loss magnitude</strong> (absolute value of the negative return) into 0–1%,
                          1–2.5%, 2.5–5%, 5–10%, or &gt;10%.
                        </p>
                        <p className="ticker-data-tip__p">
                          Legend labels describe the size of the decline, not a positive gain.
                        </p>
                      </>
                    )}
                    <p className="ticker-data-tip__p">
                      Use the <strong>{positiveTabLabel}</strong> / <strong>{negativeTabLabel}</strong> control above to switch
                      this panel. Symbol <strong>{symU}</strong>.
                    </p>
                    {asOfLine}
                  </DataInfoTip>
                </div>
              </div>
              <div className="ticker-annual-donut__donut-wrap">
                <BucketDonut
                  counts={countsRight}
                  buckets={buckets}
                  theme={chartTheme}
                  plotHeight={plotHeight}
                  emptyPeriodLower={pn.lower}
                />
              </div>
              <div className="ticker-annual-donut__panel-total">
                Total {rightMode === 'positive' ? 'positive' : 'negative'} {pn.lower}: {rightTotalCount}
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
                {[...filteredRows].reverse().map((r) => (
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
