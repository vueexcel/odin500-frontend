function parseHeatNumber(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const s = String(value).trim();
  if (!s) return NaN;
  const compact = s.replace(/[%\s]/g, '').replace(/,/g, '');
  const n = Number(compact);
  return Number.isFinite(n) ? n : NaN;
}

function hexToRgb(hex) {
  const h = String(hex || '').trim();
  const x = h.startsWith('#') ? h.slice(1) : h;
  if (x.length !== 6) return { r: 100, g: 116, b: 139 };
  const n = parseInt(x, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const h = (n) => clamp(n).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const u = Math.max(0, Math.min(1, t));
  return rgbToHex(
    A.r + (B.r - A.r) * u,
    A.g + (B.g - A.g) * u,
    A.b + (B.b - A.b) * u
  );
}

/**
 * Treemap / dense heatmap: discrete red → slate → green (Finviz-style).
 * Used by `SectorTreemap`, `MarketHeatmapPage`, tooltips.
 */
export function returnToHeatColor(pct, scaleMin = -3, scaleMax = 3) {
  const x = parseHeatNumber(pct);
  if (!Number.isFinite(x)) return '#475569';
  const lo = Math.min(scaleMin, scaleMax);
  const hi = Math.max(scaleMin, scaleMax);
  const t = hi === lo ? 0.5 : (x - lo) / (hi - lo);
  const u = Math.max(0, Math.min(1, t));
  if (u <= 0.15) return '#b91c1c';
  if (u <= 0.35) return '#ef4444';
  if (u <= 0.45) return '#fca5a5';
  if (u <= 0.55) return '#64748b';
  if (u <= 0.65) return '#86efac';
  if (u <= 0.85) return '#22c55e';
  return '#15803d';
}

/**
 * Figma "Summary returns" table: orange / salmon → peach → yellow → lime → greens.
 * Stops are in % return space; values are clamped to [scaleMin, scaleMax] then mapped
 * onto the same visual range as [-8, 8] so other scales still use the full ramp.
 */
const SUMMARY_TABLE_STOPS = [
  { p: -8, c: '#C62828' },
  { p: -5, c: '#EF5350' },
  { p: -3, c: '#FFAB91' },
  { p: -2, c: '#FFAB91' },
  { p: -1, c: '#FFCC80' },
  { p: 0, c: '#FFE082' },
  { p: 1, c: '#FFF9C4' },
  { p: 2, c: '#E6EE9C' },
  { p: 3, c: '#D4E157' },
  { p: 4, c: '#C5E1A5' },
  { p: 5, c: '#A5D6A7' },
  { p: 6, c: '#81C784' },
  { p: 7, c: '#66BB6A' },
  { p: 8, c: '#43A047' }
];

function interpolateSummaryStops(p) {
  const s = SUMMARY_TABLE_STOPS;
  if (p <= s[0].p) return s[0].c;
  if (p >= s[s.length - 1].p) return s[s.length - 1].c;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (p <= b.p) {
      const span = b.p - a.p;
      const t = span <= 0 ? 0 : (p - a.p) / span;
      return mixHex(a.c, b.c, t);
    }
  }
  return s[s.length - 1].c;
}

export function returnToSummaryTableHeatColor(pct, scaleMin = -8, scaleMax = 8) {
  const x = parseHeatNumber(pct);
  if (!Number.isFinite(x)) return '#94a3b8';
  const lo = Math.min(scaleMin, scaleMax);
  const hi = Math.max(scaleMin, scaleMax);
  const v = Math.max(lo, Math.min(hi, x));
  const u = hi === lo ? 0.5 : (v - lo) / (hi - lo);
  const pMin = SUMMARY_TABLE_STOPS[0].p;
  const pMax = SUMMARY_TABLE_STOPS[SUMMARY_TABLE_STOPS.length - 1].p;
  const p = pMin + u * (pMax - pMin);
  return interpolateSummaryStops(p);
}

/** WCAG-friendly label on summary heat cells (Figma uses mostly black). */
export function summaryTableTextOnFill(fillHex) {
  const { r, g, b } = hexToRgb(fillHex);
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.52 ? '#0f172a' : '#f8fafc';
}
