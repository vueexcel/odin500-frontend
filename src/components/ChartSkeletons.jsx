/**
 * Shared chart loading placeholders — layout mimics real chart cards (shimmer / pulse).
 */

import { useId } from 'react';
import { ReturnsChartClickableTitle } from './ReturnsChartClickableTitle.jsx';
import { periodModeNouns } from '../utils/periodModeNouns.js';

export function badgeLabelForPeriodMode(periodMode) {
  if (periodMode === 'quarterly') return 'Quarterly returns';
  if (periodMode === 'monthly') return 'Monthly returns';
  if (periodMode === 'weekly') return 'Weekly returns';
  if (periodMode === 'daily') return 'Daily returns';
  return 'Annual returns';
}

/** Figma-style annual/quarterly/monthly/weekly/daily combo chart placeholder. */
export function AnnualReturnsFigmaChartSkeleton({
  periodMode,
  plotHeightPx,
  toolbarControls,
  showOpenPeriodPageButton,
  enableInlineYearDropdowns
}) {
  const h = Math.max(200, Math.min(520, Number(plotHeightPx) || 260));
  const barCount = periodMode === 'daily' ? 18 : periodMode === 'weekly' ? 14 : periodMode === 'monthly' ? 12 : 10;
  const heightsPct = [42, 68, 55, 72, 38, 61, 48, 75, 52, 66, 44, 58, 50, 63, 41, 56, 47, 64].slice(0, barCount);

  return (
    <div className="ticker-annual-figma">
      <div className="ticker-annual-figma__section ticker-annual-figma__section--skeleton">
        <div className="ticker-annual-figma__toolbar">
          <span className="ticker-annual-figma__badge">{badgeLabelForPeriodMode(periodMode)}</span>
          <div className="returns-chart-toolbar ticker-annual-figma__actions--skeleton">
            {enableInlineYearDropdowns && (periodMode === 'annual' || periodMode === 'quarterly' || periodMode === 'monthly') ? (
              <div className="returns-chart-toolbar__range ticker-annual-figma__skel-inline">
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--sm" />
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--dd" />
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--sm" />
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--dd" />
              </div>
            ) : (
              <div className="ticker-annual-figma__external-controls">{toolbarControls}</div>
            )}
            <div className="returns-chart-toolbar__actions">
              <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--icon" />
              {showOpenPeriodPageButton ? <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--icon" /> : null}
              <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--icon" />
              <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--icon" />
            </div>
          </div>
        </div>
        <div
          className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--skeleton"
          style={{ minHeight: h }}
          aria-busy="true"
          aria-label="Loading chart"
        >
          <div className="ticker-annual-figma__skel-chart" style={{ height: h }}>
            <div className="ticker-annual-figma__skel-y-axis" aria-hidden>
              {[60, 40, 20, 0, -20].map((t) => (
                <span key={t} className="ticker-annual-figma__skel-y-tick-label">
                  {t}%
                </span>
              ))}
            </div>
            <div className="ticker-annual-figma__skel-plot" aria-hidden>
              <div className="ticker-annual-figma__skel-grid" />
              <div className="ticker-annual-figma__skel-zero" />
              <div className="ticker-annual-figma__skel-bars">
                {heightsPct.map((pct, i) => (
                  <div key={i} className="ticker-annual-figma__skel-bar-wrap">
                    <div
                      className="ticker-annual-figma__skel-bar"
                      style={{ height: `${pct}%`, animationDelay: `${i * 0.05}s` }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="ticker-annual-figma__legend ticker-annual-figma__legend--skeleton" aria-hidden>
          <span className="ticker-annual-figma__skel-legend-item">
            <span className="ticker-annual-figma__skel-swatch" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" />
          </span>
          <span className="ticker-annual-figma__skel-legend-item">
            <span className="ticker-annual-figma__skel-swatch ticker-annual-figma__skel-swatch--line" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Stats dashboard comparison charts (`stats-cmp-chart`). */
export function StatsCmpChartSkeleton({ variant = 'groupedBar' }) {
  const n = variant === 'denseBars' ? 22 : 12;
  const heights = [38, 62, 48, 71, 42, 55, 50, 66, 44, 58, 52, 60, 46, 64, 40, 56, 49, 63, 45, 59, 51, 57].slice(0, n);

  return (
    <div className="stats-cmp-chart__skel" aria-busy="true" aria-label="Loading chart">
      <div className="stats-cmp-chart__skel-legend">
        <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" />
        {variant !== 'line' ? <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" /> : null}
      </div>
      {variant === 'line' ? (
        <div className="stats-cmp-chart__skel-line-area">
          <div className="stats-cmp-chart__skel-line-grid" />
          <div className="stats-cmp-chart__skel-line-zero" />
          <div className="stats-cmp-chart__skel-line-path" />
        </div>
      ) : (
        <div className={'stats-cmp-chart__skel-bars-wrap' + (variant === 'denseBars' ? ' stats-cmp-chart__skel-bars-wrap--dense' : '')}>
          {heights.map((pct, i) => (
            <div key={i} className="stats-cmp-chart__skel-bar-group">
              <div
                className="stats-cmp-chart__skel-bar-pair"
                style={variant === 'denseBars' ? {} : { gap: '4px' }}
              >
                <div
                  className="stats-cmp-chart__skel-mini-bar"
                  style={{ height: `${pct}%`, animationDelay: `${i * 0.04}s` }}
                />
                <div
                  className="stats-cmp-chart__skel-mini-bar stats-cmp-chart__skel-mini-bar--alt"
                  style={{ height: `${100 - pct + 15}%`, animationDelay: `${i * 0.04 + 0.02}s` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="ticker-annual-figma__skel-pill stats-cmp-chart__skel-title-pill" />
      <div className="ticker-annual-figma__skel-pill stats-cmp-chart__skel-caption-pill" />
    </div>
  );
}

/** Positive/negative bucket chart + donut (`TickerAnnualReturnsPosNeg`). */
export function PosNegReturnsChartSkeleton({ periodMode = 'annual' }) {
  const pn = periodModeNouns(periodMode);
  const label = `${badgeLabelForPeriodMode(periodMode)} — positive & negative ${pn.lower}`;
  return (
    <div className="ticker-annual-donut ticker-annual-donut--skeleton">
      <div className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar">
          <span className="ticker-annual-figma__badge">{label}</span>
          <div className="ticker-annual-figma__actions ticker-annual-figma__actions--skeleton">
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn-wide" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
          </div>
        </div>
        <div className="ticker-annual-donut__skel-split" aria-busy="true" aria-label="Loading chart">
          <div className="ticker-annual-donut__skel-left">
            <div className="ticker-annual-donut__skel-donut-ring" />
            <div className="ticker-annual-donut__skel-legend-row">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" style={{ animationDelay: `${i * 0.07}s` }} />
              ))}
            </div>
          </div>
          <div className="ticker-annual-donut__skel-right">
            <div className="ticker-annual-donut__skel-toggle">
              <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
              <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
            </div>
            <div className="ticker-annual-figma__skel-chart" style={{ height: 240 }}>
              <div className="ticker-annual-figma__skel-y-axis" aria-hidden>
                {[40, 20, 0, -20].map((t) => (
                  <span key={t} className="ticker-annual-figma__skel-y-tick-label">
                    {t}%
                  </span>
                ))}
              </div>
              <div className="ticker-annual-figma__skel-plot" aria-hidden>
                <div className="ticker-annual-figma__skel-grid" />
                <div className="ticker-annual-figma__skel-zero" />
                <div className="ticker-annual-figma__skel-bars">
                  {[52, 68, 45, 72, 38, 61, 55, 48, 66, 42].map((pct, i) => (
                    <div key={i} className="ticker-annual-figma__skel-bar-wrap">
                      <div className="ticker-annual-figma__skel-bar" style={{ height: `${pct}%`, animationDelay: `${i * 0.05}s` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** `TickerMonthlyReturnsChart` header + plot. */
export function MonthlyReturnsChartSkeleton({ periodMode = 'monthly', plotHeightPx, resizeEnabled = false }) {
  const title = periodMode === 'weekly' ? 'Weekly returns' : periodMode === 'daily' ? 'Daily returns' : 'Monthly returns';
  const barCount = periodMode === 'daily' ? 16 : 12;
  const heightsPct = [42, 68, 55, 72, 38, 61, 48, 75, 52, 66, 44, 58, 50, 63, 41, 56].slice(0, barCount);
  const h = Math.max(200, Math.min(520, Number(plotHeightPx) || 278));

  return (
    <div className="ticker-monthly ticker-monthly--skeleton">
      <div
        className={
          'ticker-annual-figma__section ticker-annual-figma__section--skeleton' +
          (resizeEnabled ? ' ticker-annual-figma__section--resize' : '')
        }
      >
        <div className="ticker-monthly__head">
          <div className="ticker-monthly__title-block">
            <span className="ticker-monthly__title uppercase">{title}</span>
          </div>
          <div className="ticker-annual-figma__actions ticker-annual-figma__actions--skeleton">
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--dd" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn-wide" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
          </div>
        </div>
        <div
          className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--skeleton"
          style={{ minHeight: h }}
          aria-busy="true"
          aria-label="Loading chart"
        >
          <div className="ticker-annual-figma__skel-chart" style={{ height: h }}>
            <div className="ticker-annual-figma__skel-y-axis" aria-hidden>
              {[25, 10, 0, -10, -15].map((t) => (
                <span key={t} className="ticker-annual-figma__skel-y-tick-label">
                  {t}%
                </span>
              ))}
            </div>
            <div className="ticker-annual-figma__skel-plot" aria-hidden>
              <div className="ticker-annual-figma__skel-grid" />
              <div className="ticker-annual-figma__skel-zero" />
              <div className="ticker-annual-figma__skel-bars">
                {heightsPct.map((pct, i) => (
                  <div key={i} className="ticker-annual-figma__skel-bar-wrap">
                    <div className="ticker-annual-figma__skel-bar" style={{ height: `${pct}%`, animationDelay: `${i * 0.045}s` }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="ticker-annual-figma__legend ticker-annual-figma__legend--skeleton" aria-hidden>
          <span className="ticker-annual-figma__skel-legend-item">
            <span className="ticker-annual-figma__skel-swatch" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" />
          </span>
          <span className="ticker-annual-figma__skel-legend-item">
            <span className="ticker-annual-figma__skel-swatch ticker-annual-figma__skel-swatch--line" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" />
          </span>
        </div>
      </div>
    </div>
  );
}

/** Pie icon + “Quarterly returns” (matches TickerAnnualReturnsFigma toolbar badge). */
export function QuarterlyReturnsToolbarBadge({ onClick } = {}) {
  const clipId = useId().replace(/:/g, '');
  return (
    <div className="inline-flex shrink-0 items-center">
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
        Quarterly returns
      </ReturnsChartClickableTitle>
    </div>
  );
}

/** Two-panel quarterly charts. */
export function QuarterlyDualPanelChartSkeleton({ toolbarControls = null }) {
  const panel = (key) => (
    <div key={key} className="ticker-quarterly__panel ticker-annual-figma__chart-card ticker-annual-figma__chart-card--skeleton">
      <div className="ticker-annual-figma__skel-pill ticker-quarterly__skel-panel-title" />
      <div className="ticker-annual-figma__skel-chart" style={{ height: 220 }}>
        <div className="ticker-annual-figma__skel-y-axis" aria-hidden>
          {[30, 15, 0, -15].map((t) => (
            <span key={t} className="ticker-annual-figma__skel-y-tick-label">
              {t}%
            </span>
          ))}
        </div>
        <div className="ticker-annual-figma__skel-plot" aria-hidden>
          <div className="ticker-annual-figma__skel-grid" />
          <div className="ticker-annual-figma__skel-zero" />
          <div className="ticker-annual-figma__skel-bars">
            {[48, 62, 40, 70, 52, 58, 45, 65].map((pct, i) => (
              <div key={i} className="ticker-annual-figma__skel-bar-wrap">
                <div className="ticker-annual-figma__skel-bar" style={{ height: `${pct}%`, animationDelay: `${i * 0.05}s` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="ticker-quarterly ticker-quarterly--skeleton">
      <div className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar">
          <QuarterlyReturnsToolbarBadge />
          <div className="ticker-annual-figma__actions ticker-annual-figma__actions--skeleton">
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn-wide" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
          </div>
        </div>
        <div className="ticker-annual-figma__toolbar ticker-annual-figma__toolbar--sub">
          <div className="ticker-annual-figma__left">{toolbarControls}</div>
        </div>
        <div className="ticker-quarterly__split" aria-busy="true" aria-label="Loading charts">
          {panel('a')}
          {panel('b')}
        </div>
      </div>
    </div>
  );
}

/** Waterfall + donut advanced monthly block. */
export function WaterfallDonutChartSkeleton({ periodMode = 'monthly' }) {
  const badge =
    periodMode === 'weekly' ? 'Weekly returns — waterfall & week mix' : 'Monthly returns — waterfall & month mix';
  return (
    <div className="ticker-monthly-adv ticker-monthly-adv--skeleton">
      <div className="ticker-annual-figma__section">
        <div className="ticker-annual-figma__toolbar">
          <span className="ticker-annual-figma__badge uppercase">{badge}</span>
          <div className="ticker-annual-figma__actions ticker-annual-figma__actions--skeleton">
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--dd" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn-wide" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
          </div>
        </div>
        <div className="ticker-monthly-adv__skel-split" aria-busy="true" aria-label="Loading chart">
          <div className="ticker-monthly-adv__skel-waterfall ticker-annual-figma__chart-card ticker-annual-figma__chart-card--skeleton">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
              <div
                key={i}
                className="ticker-monthly-adv__skel-step"
                style={{ height: `${22 + ((i * 17) % 40)}px`, animationDelay: `${i * 0.04}s` }}
              />
            ))}
          </div>
          <div className="ticker-monthly-adv__skel-donut-col ticker-annual-figma__chart-card ticker-annual-figma__chart-card--skeleton">
            <div className="ticker-annual-donut__skel-donut-ring ticker-annual-donut__skel-donut-ring--lg" />
            <div className="ticker-annual-donut__skel-legend-row">
              <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" />
              <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--legend" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Line chart area for lightweight-charts hosts (relative strength, etc.). */
export function LightweightChartAreaSkeleton({ minHeight = 360, className = '' }) {
  const uid = useId().replace(/:/g, '');
  const gidA = `lw-skel-fill-a-${uid}`;
  const gidB = `lw-skel-fill-b-${uid}`;
  const h = Math.max(200, Number(minHeight) || 360);
  return (
    <div
      className={`lw-chart-skel ${className}`.trim()}
      style={{ minHeight: h }}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="lw-chart-skel__inner">
        <div className="lw-chart-skel__y-rail" aria-hidden>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="lw-chart-skel__y-tick"
              style={{ animationDelay: `${i * 0.07}s` }}
            />
          ))}
        </div>
        <div className="lw-chart-skel__plot">
          <div className="lw-chart-skel__grid lw-chart-skel__grid--horz" aria-hidden />
          <div className="lw-chart-skel__grid lw-chart-skel__grid--vert" aria-hidden />
          <div className="lw-chart-skel__zero" aria-hidden />
          <div className="lw-chart-skel__glow" aria-hidden />
          <svg
            className="lw-chart-skel__svg"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id={gidA} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="lw-chart-skel__grad-stop lw-chart-skel__grad-stop--a-top" />
                <stop offset="55%" className="lw-chart-skel__grad-stop lw-chart-skel__grad-stop--a-mid" />
                <stop offset="100%" className="lw-chart-skel__grad-stop lw-chart-skel__grad-stop--a-bot" />
              </linearGradient>
              <linearGradient id={gidB} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" className="lw-chart-skel__grad-stop lw-chart-skel__grad-stop--b-top" />
                <stop offset="100%" className="lw-chart-skel__grad-stop lw-chart-skel__grad-stop--b-bot" />
              </linearGradient>
            </defs>
            <path
              className="lw-chart-skel__area lw-chart-skel__area--b"
              fill={`url(#${gidB})`}
              d="M0,118 C48,132 92,96 140,108 S236,72 288,88 S352,62 400,78 L400,200 L0,200 Z"
            />
            <path
              className="lw-chart-skel__area lw-chart-skel__area--a"
              fill={`url(#${gidA})`}
              d="M0,108 C52,78 96,124 148,92 S244,56 304,74 S360,48 400,62 L400,200 L0,200 Z"
            />
            <path
              className="lw-chart-skel__line lw-chart-skel__line--b"
              d="M0,118 C48,132 92,96 140,108 S236,72 288,88 S352,62 400,78"
              fill="none"
            />
            <path
              className="lw-chart-skel__line lw-chart-skel__line--a"
              d="M0,108 C52,78 96,124 148,92 S244,56 304,74 S360,48 400,62"
              fill="none"
            />
          </svg>
          <div className="lw-chart-skel__sweep" aria-hidden />
        </div>
      </div>
      <div className="lw-chart-skel__x-rail" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span
            key={i}
            className="lw-chart-skel__x-tick"
            style={{ animationDelay: `${i * 0.06}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Market movers split bar charts (two panels). */
export function MarketMoversSplitBarsSkeleton() {
  const Panel = ({ side }) => (
    <div className="market-movers-page__bar-frame market-movers-page__bar-frame--skeleton">
      <div className="ticker-annual-figma__skel-pill market-movers-page__skel-bar-title" />
      <div className="market-movers-page__skel-svg" aria-hidden>
        <div className="market-movers-page__skel-bars-col">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className={'market-movers-page__skel-bar ' + (side === 'gain' ? 'market-movers-page__skel-bar--gain' : 'market-movers-page__skel-bar--loss')}
              style={{ height: `${28 + (i * 13) % 55}%`, animationDelay: `${i * 0.05}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
  return (
    <div className="market-movers-page__chart-wrap market-movers-page__chart-wrap--skeleton" aria-busy="true" aria-label="Loading charts">
      <div className="market-movers-page__bars-grid">
        <Panel side="gain" />
        <Panel side="loss" />
      </div>
    </div>
  );
}
