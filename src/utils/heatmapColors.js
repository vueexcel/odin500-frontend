function parseHeatNumber(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const s = String(value).trim();
  if (!s) return NaN;
  const compact = s.replace(/[%\s]/g, '').replace(/,/g, '');
  const n = Number(compact);
  return Number.isFinite(n) ? n : NaN;
}

/** Map % return to fill color; clamp to symmetric scale (Figma-style red → grey → green). */
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
