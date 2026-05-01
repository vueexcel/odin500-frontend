export const TF_OPTIONS = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', '10Y'];

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

export function tfRange(tf) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  switch (tf) {
    case '1D':
      start.setDate(end.getDate() - 3);
      break;
    case '5D':
      start.setDate(end.getDate() - 8);
      break;
    case '1M':
      start.setDate(end.getDate() - 31);
      break;
    case '3M':
      start.setDate(end.getDate() - 92);
      break;
    case '6M':
      start.setDate(end.getDate() - 184);
      break;
    case 'YTD':
      start.setMonth(0, 1);
      break;
    case '1Y':
      start.setDate(end.getDate() - 365);
      break;
    case '3Y':
      start.setDate(end.getDate() - 365 * 3);
      break;
    case '5Y':
      start.setDate(end.getDate() - 365 * 5);
      break;
    case '10Y':
      start.setDate(end.getDate() - 365 * 10);
      break;
    default:
      start.setDate(end.getDate() - 184);
  }
  return { start: isoDate(start), end: isoDate(end) };
}

export function parseTimeMs(v) {
  if (!v) return NaN;
  const d = new Date(String(v).slice(0, 10) + 'T12:00:00');
  return Number.isFinite(d.getTime()) ? d.getTime() : NaN;
}

function rowTimeMs(row) {
  return parseTimeMs(
    row?.Date ??
      row?.date ??
      row?.TradeDate ??
      row?.tradeDate ??
      row?.trade_date ??
      row?.dt ??
      row?.time
  );
}

export function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  const out = [];
  for (const r of rows) {
    const t = rowTimeMs(r);
    const c0 = Number(r.Close ?? r.close ?? r.AdjClose ?? r.adjClose ?? r.adj_close);
    if (!Number.isFinite(t) || !Number.isFinite(c0)) continue;
    out.push({ t, c: c0 });
  }
  out.sort((a, b) => a.t - b.t);
  if (!out.length) return [];
  const base = out[0].c;
  if (!Number.isFinite(base) || base === 0) return [];
  return out.map((p) => ({ t: p.t, v: ((p.c / base) - 1) * 100 }));
}

export function calcLatestDelta(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const out = [];
  for (const row of rows) {
    const t = rowTimeMs(row);
    const close = Number(row.Close ?? row.close ?? row.AdjClose ?? row.adjClose ?? row.adj_close);
    if (!Number.isFinite(t) || !Number.isFinite(close)) continue;
    out.push({ t, close });
  }
  if (!out.length) return null;
  out.sort((a, b) => a.t - b.t);
  const last = out[out.length - 1];
  const prev = out.length > 1 ? out[out.length - 2] : null;
  const chg = prev ? last.close - prev.close : 0;
  const chgPct = prev && prev.close !== 0 ? (chg / prev.close) * 100 : 0;
  return { close: last.close, chg, chgPct };
}

export function calcRangeReturnPct(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return 0;
  const out = [];
  for (const row of rows) {
    const t = rowTimeMs(row);
    const close = Number(row.Close ?? row.close ?? row.AdjClose ?? row.adjClose ?? row.adj_close);
    if (!Number.isFinite(t) || !Number.isFinite(close)) continue;
    out.push({ t, close });
  }
  if (out.length < 2) return 0;
  out.sort((a, b) => a.t - b.t);
  const start = out[0].close;
  const end = out[out.length - 1].close;
  return Number.isFinite(start) && Number.isFinite(end) && start !== 0 ? ((end / start) - 1) * 100 : 0;
}

/** Last close, absolute change first→last close, and total return % over the same sorted window as `calcRangeReturnPct`. */
export function calcRangeSnapshot(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const out = [];
  for (const row of rows) {
    const t = rowTimeMs(row);
    const close = Number(row.Close ?? row.close ?? row.AdjClose ?? row.adjClose ?? row.adj_close);
    if (!Number.isFinite(t) || !Number.isFinite(close)) continue;
    out.push({ t, close });
  }
  if (!out.length) return null;
  out.sort((a, b) => a.t - b.t);
  const firstClose = out[0].close;
  const lastClose = out[out.length - 1].close;
  const chgPct =
    out.length >= 2 && Number.isFinite(firstClose) && firstClose !== 0
      ? ((lastClose / firstClose) - 1) * 100
      : 0;
  return { close: lastClose, chg: lastClose - firstClose, chgPct };
}

export function fmtPrice(v) {
  if (!Number.isFinite(Number(v))) return '—';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtAbsSigned(v) {
  if (!Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(2)}`;
}

export function fmtPctSigned(v, digits = 1) {
  if (!Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return `${n >= 0 ? '+' : '-'}${Math.abs(n).toFixed(digits)}%`;
}
