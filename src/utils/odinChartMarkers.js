import { rowDateToTimeKey } from './chartData.js';

/**
 * Maps consolidated Odin indicator signals (L1–L3, S1–S3) to lightweight-charts series markers.
 * Matches Figma-style long = green up-triangles below bar, short = red/orange down above bar.
 */
const ODIN_SIGNAL_STYLES = {
  L1: { position: 'belowBar', shape: 'arrowUp', color: '#14532d' },
  L2: { position: 'belowBar', shape: 'arrowUp', color: '#22c55e' },
  L3: { position: 'belowBar', shape: 'arrowUp', color: '#86efac' },
  S1: { position: 'aboveBar', shape: 'arrowDown', color: '#dc2626' },
  S2: { position: 'aboveBar', shape: 'arrowDown', color: '#9a3412' },
  S3: { position: 'aboveBar', shape: 'arrowDown', color: '#fb923c' }
};

export function mapOhlcRowsToOdinSignalMarkers(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const markers = [];
  for (const row of rows) {
    const time = rowDateToTimeKey(row);
    if (!time) continue;
    const sig = String(row.signal ?? row.Signal ?? '')
      .trim()
      .toUpperCase();
    if (!sig || sig === 'N' || sig === 'NULL') continue;
    const style = ODIN_SIGNAL_STYLES[sig];
    if (!style) continue;
    markers.push({
      time,
      position: style.position,
      shape: style.shape,
      color: style.color,
      text: sig
    });
  }
  return markers;
}
