import { returnToHeatColor } from '../utils/heatmapColors.js';

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < String(str || '').length; i++) {
    h = (h << 5) - h + String(str).charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function MiniSparkline({ up, seed, compact }) {
  const w = compact ? 36 : 52;
  const h = compact ? 14 : 22;
  const n = compact ? 14 : 18;
  const step = compact ? 2 : 2.8;
  const pts = [];
  let y = h / 2;
  let s = seed;
  for (let i = 0; i < n; i++) {
    const noise = (s % 11) - 5;
    s = (s * 9301 + 49297) % 233280;
    y += (up ? -0.45 : 0.45) + noise * 0.07;
    y = Math.max(2, Math.min(h - 2, y));
    pts.push(`${2 + i * step},${y.toFixed(1)}`);
  }
  return (
    <svg width={w} height={h} className="heatmap-tooltip__spark-svg" aria-hidden>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="rgba(255,255,255,0.92)"
        strokeWidth={compact ? '1' : '1.25'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatPrice(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPct(pct) {
  if (pct == null || !Number.isFinite(Number(pct))) return '—';
  const v = Number(pct);
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%';
}

export function HeatmapIndustryTooltip({
  left,
  top,
  featured,
  peers,
  scaleMin,
  scaleMax,
  onMouseEnter,
  onMouseLeave
}) {
  if (!featured) return null;
  const crumb =
    featured.__odinSignalCrumb != null
      ? String(featured.__odinSignalCrumb)
      : `${String(featured.sector || '').toUpperCase()} — ${String(featured.industry || '').toUpperCase()}`;
  const heroBg =
    featured.__heatmapFillHex != null
      ? featured.__heatmapFillHex
      : returnToHeatColor(featured.changePct, scaleMin, scaleMax);
  const up = Number(featured.changePct) >= 0;
  const seed = hashSeed(featured.symbol);

  return (
    <div
      className="heatmap-tooltip"
      style={{ left, top }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role="dialog"
      aria-label="Industry detail"
    >
      <div className="heatmap-tooltip__crumb">{crumb}</div>
      <div className="heatmap-tooltip__hero" style={{ background: heroBg }}>
        <div className="heatmap-tooltip__hero-main">
          <div className="heatmap-tooltip__hero-left">
            <div className="heatmap-tooltip__sym">{featured.symbol}</div>
            <div className="heatmap-tooltip__co">{featured.security || '—'}</div>
          </div>
          <MiniSparkline up={up} seed={seed} />
          <div className="heatmap-tooltip__hero-right">
            <div className="heatmap-tooltip__px">{formatPrice(featured.price)}</div>
            <div className="heatmap-tooltip__hero-pct">{formatPct(featured.changePct)}</div>
          </div>
        </div>
      </div>
      <div className="heatmap-tooltip__list">
        <div className="heatmap-tooltip__list-head">
          <span>Symbol</span>
          <span className="heatmap-tooltip__h-spark"> </span>
          <span>Price</span>
          <span>Change</span>
        </div>
        <ul className="heatmap-tooltip__ul">
          {peers.map((p) => {
            const isFeat =
              String(p.symbol || '').toUpperCase() === String(featured.symbol || '').toUpperCase();
            const rowUp = Number(p.changePct) >= 0;
            return (
              <li
                key={p.symbol + '-' + (p.security || '')}
                className={isFeat ? 'heatmap-tooltip__li heatmap-tooltip__li--feat' : 'heatmap-tooltip__li'}
              >
                <span className="heatmap-tooltip__li-sym">{p.symbol}</span>
                <span className="heatmap-tooltip__li-spark">
                  <MiniSparkline up={rowUp} seed={hashSeed(p.symbol + p.changePct)} compact />
                </span>
                <span className="heatmap-tooltip__li-price">{formatPrice(p.price)}</span>
                <span
                  className={
                    'heatmap-tooltip__li-chg' +
                    (rowUp ? ' heatmap-tooltip__li-chg--up' : ' heatmap-tooltip__li-chg--down')
                  }
                >
                  {formatPct(p.changePct)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
