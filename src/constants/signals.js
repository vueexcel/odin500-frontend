export const SIGNAL_GROUPS = [
  {
    label: 'Classic',
    signals: ['L1', 'L2', 'L3', 'S1', 'S2', 'S3', 'N', 'N1', 'N2']
  },
  { label: 'MA200 Dashboard 1', signals: ['L11', 'L21', 'L31', 'S11', 'S21', 'S31'] },
  { label: 'MA200 Dashboard 2', signals: ['L12', 'L22', 'L32', 'S12', 'S22', 'S32'] }
];

export const MS_COLORS = {
  L1: '#4d7c0f',
  L2: '#16a34a',
  L3: '#84cc16',
  S1: '#ef4444',
  S2: '#f97316',
  S3: '#fb923c',
  N: '#6b7280',
  N1: '#78716c',
  N2: '#57534e',
  L11: '#166534',
  L21: '#15803d',
  L31: '#4ade80',
  S11: '#dc2626',
  S21: '#ea580c',
  S31: '#f97316',
  L12: '#14532d',
  L22: '#16a34a',
  L32: '#86efac',
  S12: '#b91c1c',
  S22: '#c2410c',
  S32: '#fb923c'
};

export function msColor(sig) {
  return MS_COLORS[sig] || '#4b5563';
}

export const SIGNAL_COLORS = {
  S1: '#ef4444',
  S2: '#f97316',
  S3: '#fb923c',
  L1: '#4d7c0f',
  L2: '#16a34a',
  L3: '#84cc16',
  S11: '#dc2626',
  S21: '#ea580c',
  S31: '#f97316',
  L11: '#166534',
  L21: '#15803d',
  L31: '#4ade80',
  S12: '#b91c1c',
  S22: '#c2410c',
  S32: '#fb923c',
  L12: '#14532d',
  L22: '#16a34a',
  L32: '#86efac',
  N: '#6b7280',
  N1: '#78716c',
  N2: '#57534e'
};
