/**
 * Shared chart loading placeholders — layout mimics real chart cards (shimmer / pulse).
 */

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
          <div className="ticker-annual-figma__actions ticker-annual-figma__actions--skeleton">
            {enableInlineYearDropdowns && (periodMode === 'annual' || periodMode === 'quarterly' || periodMode === 'monthly') ? (
              <div className="ticker-annual-figma__range-controls ticker-annual-figma__skel-inline">
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--sm" />
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--dd" />
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--sm" />
                <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--dd" />
              </div>
            ) : (
              <div className="ticker-annual-figma__external-controls">{toolbarControls}</div>
            )}
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
            {showOpenPeriodPageButton ? <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" /> : null}
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
export function MonthlyReturnsChartSkeleton({ periodMode = 'monthly' }) {
  const title = periodMode === 'weekly' ? 'Weekly returns' : periodMode === 'daily' ? 'Daily returns' : 'Monthly returns';
  const barCount = periodMode === 'daily' ? 16 : 12;
  const heightsPct = [42, 68, 55, 72, 38, 61, 48, 75, 52, 66, 44, 58, 50, 63, 41, 56].slice(0, barCount);

  return (
    <div className="ticker-monthly ticker-monthly--skeleton">
      <div className="ticker-annual-figma__section">
        <div className="ticker-monthly__head">
          <div className="ticker-monthly__title-block">
            <span className="ticker-monthly__title">{title}</span>
          </div>
          <div className="ticker-annual-figma__actions ticker-annual-figma__actions--skeleton">
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--dd" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn-wide" />
            <span className="ticker-annual-figma__skel-pill ticker-annual-figma__skel-pill--btn" />
          </div>
        </div>
        <div className="ticker-annual-figma__chart-card ticker-annual-figma__chart-card--skeleton" style={{ minHeight: 268 }} aria-busy="true" aria-label="Loading chart">
          <div className="ticker-annual-figma__skel-chart" style={{ height: 268 }}>
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
          <span className="ticker-annual-figma__badge">Quarterly returns</span>
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
          <span className="ticker-annual-figma__badge">{badge}</span>
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
  const h = Math.max(200, Number(minHeight) || 360);
  return (
    <div
      className={`lw-chart-skel ${className}`.trim()}
      style={{ minHeight: h }}
      aria-busy="true"
      aria-label="Loading chart"
    >
      <div className="lw-chart-skel__grid" aria-hidden />
      <div className="lw-chart-skel__zero" aria-hidden />
      <svg className="lw-chart-skel__spark" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden>
        <path
          className="lw-chart-skel__path"
          d="M0,85 C40,70 60,95 100,55 S180,40 220,65 S320,25 400,45 L400,120 L0,120 Z"
        />
        <path
          className="lw-chart-skel__stroke"
          d="M0,85 C40,70 60,95 100,55 S180,40 220,65 S320,25 400,45"
          fill="none"
        />
      </svg>
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
