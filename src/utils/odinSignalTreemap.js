/** Map discrete chart numbers (-3..+3) to Odin signal codes (Figma legend). */
export const CHART_NUM_TO_SIGNAL = {
  '-3': 'S3',
  '-2': 'S2',
  '-1': 'S1',
  '0': 'N',
  '1': 'L1',
  '2': 'L2',
  '3': 'L3'
};

/** Tile area weights: L1/S1 largest → L2/S2 → L3/S3 → N smallest */
export const SIGNAL_TREEMAP_WEIGHT = {
  L1: 100,
  S1: 100,
  L2: 45,
  S2: 45,
  L3: 18,
  S3: 18,
  N: 4
};

function parseNum(v) {
  if (v == null) return NaN;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  const s = String(v).trim();
  if (!s) return NaN;
  const compact = s.replace(/[%\s]/g, '').replace(/,/g, '');
  const n = Number(compact);
  return Number.isFinite(n) ? n : NaN;
}

export function readChangePct(row) {
  const candidates = [
    row.totalReturnPercentage,
    row.total_return_percentage,
    row.changePercent,
    row.change_percentage,
    row.changePct,
    row.percentChange,
    row.pct_change
  ];
  for (const c of candidates) {
    const n = parseNum(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function normalizeSignalCode(sig) {
  const s = String(sig || '').trim().toUpperCase();
  return ['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'N'].includes(s) ? s : '';
}

/**
 * Bucket total return into chart numbers -3 … +3 (maps to S3…L3 labels).
 * `span` is half-range in %-points: [-span, +span] maps to S3…L3.
 */
export function returnToChartNumber(ret, span = 15) {
  const x = Number(ret);
  if (!Number.isFinite(x)) return 0;
  const lo = -Math.abs(span);
  const hi = Math.abs(span);
  if (hi === 0) return 0;
  const u = (x - lo) / (hi - lo);
  const uu = Math.max(0, Math.min(1, u));
  const bin = Math.min(6, Math.floor(uu * 7));
  return bin - 3;
}

export function chartNumberToSignalCode(n) {
  const k = Number(n);
  if (!Number.isFinite(k)) return 'N';
  const clamped = Math.max(-3, Math.min(3, Math.round(k)));
  return CHART_NUM_TO_SIGNAL[String(clamped)] || 'N';
}

/**
 * Prepare rows for treemap: `__tmw` from signal tier, `__chartNum` / `__signalCode` for color & tooltips.
 */
export function resolveOdinSignalTreemapRows(rows, binSpan = 15) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((r) => {
    const ret = readChangePct(r);
    const apiCode = normalizeSignalCode(r.signal);
    const chartNum = returnToChartNumber(ret, binSpan);
    const code = apiCode || chartNumberToSignalCode(chartNum);
    const w = SIGNAL_TREEMAP_WEIGHT[code] ?? SIGNAL_TREEMAP_WEIGHT.N;
    return { ...r, __tmw: Math.max(w, 0.01), __chartNum: chartNum, __signalCode: code };
  });
}

/** Legend rows for footer: chart num, signal code, label for accessibility */
export const ODIN_SIGNAL_LEGEND_ITEMS = [
  { chartNum: -3, code: 'S3', label: 'S3' },
  { chartNum: -2, code: 'S2', label: 'S2' },
  { chartNum: -1, code: 'S1', label: 'S1' },
  { chartNum: 0, code: 'N', label: 'N' },
  { chartNum: 1, code: 'L1', label: 'L1' },
  { chartNum: 2, code: 'L2', label: 'L2' },
  { chartNum: 3, code: 'L3', label: 'L3' }
];

/** Figma reference: exact fills per signal (treemap tiles + legend). */
export const ODIN_FIGMA_SIGNAL_FILL = {
  S1: '#FFC107',
  S2: '#42A5F5',
  S3: '#689F38',
  L1: '#3F51B5',
  L2: '#E67E22',
  L3: '#9E9E9E',
  N: '#2C3E50'
};

/** Legend order + lowercase labels as in Figma (l1, l2, l3, s1, s2, s3, n). */
export const ODIN_FIGMA_LEGEND_ITEMS = [
  { code: 'L1', label: 'l1' },
  { code: 'L2', label: 'l2' },
  { code: 'L3', label: 'l3' },
  { code: 'S1', label: 's1' },
  { code: 'S2', label: 's2' },
  { code: 'S3', label: 's3' },
  { code: 'N', label: 'n' }
];

export function figmaFillForSignal(code) {
  const k = String(code || 'N').toUpperCase();
  return ODIN_FIGMA_SIGNAL_FILL[k] || '#64748b';
}

/** Group tiles in treemap left-to-right / visual order (Figma-style clustering). */
export const ODIN_SIGNAL_GROUP_ORDER = ['S1', 'S3', 'L1', 'N', 'L3', 'S2', 'L2'];
