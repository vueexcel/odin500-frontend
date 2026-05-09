function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function deriveReturnPct(row) {
  const direct = safeNum(row?.totalReturn);
  const start = safeNum(row?.startPrice ?? row?.startClose);
  const end = safeNum(row?.endPrice ?? row?.endClose);
  const computed =
    start != null && end != null && start !== 0 ? ((end - start) / start) * 100 : null;
  if (direct == null) return computed;
  // Some payloads occasionally emit `totalReturn: 0` while start/end prices imply a move.
  if (
    direct === 0 &&
    computed != null &&
    Number.isFinite(computed) &&
    Math.abs(computed) >= 0.01
  ) {
    return computed;
  }
  return direct;
}

function iso(s) {
  return String(s || '').slice(0, 10);
}

function yearFromPeriod(period, fallbackStart, fallbackEnd) {
  const p = String(period || '');
  const m = p.match(/(\d{4})/);
  if (m) return Number(m[1]);
  const ys = Number(iso(fallbackStart).slice(0, 4));
  if (Number.isFinite(ys)) return ys;
  const ye = Number(iso(fallbackEnd).slice(0, 4));
  if (Number.isFinite(ye)) return ye;
  return null;
}

export function normalizePeriodReturnsRows(rows, mode) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const period = String(r?.period || '').trim();
      const ret = deriveReturnPct(r);
      if (!period || ret == null) return null;
      const startDate = iso(r?.startDate);
      const endDate = iso(r?.endDate);
      const year = yearFromPeriod(period, startDate, endDate);
      return {
        period,
        mode,
        startDate,
        endDate,
        year,
        returnPct: ret
      };
    })
    .filter(Boolean);
}

export function mapWeeklyOhlcToReturns(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const open = safeNum(r?.Open ?? r?.open);
      const close = safeNum(r?.Close ?? r?.close);
      const startDate = iso(r?.start_date ?? r?.week_start ?? r?.Date ?? r?.date);
      const endDate = iso(r?.end_date ?? r?.Date ?? r?.date ?? startDate);
      const period = endDate || startDate;
      if (!period || open == null || close == null || open === 0) return null;
      return {
        period,
        mode: 'weekly',
        startDate,
        endDate,
        year: Number(period.slice(0, 4)),
        returnPct: ((close - open) / open) * 100
      };
    })
    .filter(Boolean);
}

export function mapDailyOhlcToReturns(rows) {
  if (!Array.isArray(rows)) return [];
  const sorted = [...rows].sort((a, b) => iso(a?.Date ?? a?.date).localeCompare(iso(b?.Date ?? b?.date)));
  const out = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const prevClose = safeNum(sorted[i - 1]?.Close ?? sorted[i - 1]?.close);
    const nextClose = safeNum(sorted[i]?.Close ?? sorted[i]?.close);
    const prevDate = iso(sorted[i - 1]?.Date ?? sorted[i - 1]?.date);
    const nextDate = iso(sorted[i]?.Date ?? sorted[i]?.date);
    if (!nextDate || prevClose == null || nextClose == null || prevClose === 0) continue;
    out.push({
      period: nextDate,
      mode: 'daily',
      startDate: prevDate,
      endDate: nextDate,
      year: Number(nextDate.slice(0, 4)),
      returnPct: ((nextClose - prevClose) / prevClose) * 100
    });
  }
  return out;
}

export function alignComparisonRows(tickerRows, benchmarkRows) {
  const bMap = new Map((Array.isArray(benchmarkRows) ? benchmarkRows : []).map((r) => [String(r.period), r]));
  return (Array.isArray(tickerRows) ? tickerRows : [])
    .map((t) => {
      const b = bMap.get(String(t.period));
      if (!b) return null;
      const tRet = safeNum(t.returnPct);
      const bRet = safeNum(b.returnPct);
      if (tRet == null || bRet == null) return null;
      return {
        period: String(t.period),
        year: t.year,
        startDate: t.startDate,
        endDate: t.endDate,
        tickerReturn: tRet,
        benchmarkReturn: bRet,
        excessReturn: tRet - bRet
      };
    })
    .filter(Boolean);
}

export function filterRowsByYearRange(rows, startYear, endYear) {
  const ys = Number(startYear);
  const ye = Number(endYear);
  if (!Number.isFinite(ys) || !Number.isFinite(ye)) return Array.isArray(rows) ? rows : [];
  const lo = Math.min(ys, ye);
  const hi = Math.max(ys, ye);
  return (Array.isArray(rows) ? rows : []).filter((r) => Number.isFinite(r.year) && r.year >= lo && r.year <= hi);
}

export function filterRowsBySingleYear(rows, year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter((r) => Number.isFinite(r.year) && r.year === y);
}

export function filterRowsByDateRange(rows, startDate, endDate) {
  const s = iso(startDate);
  const e = iso(endDate);
  if (!s && !e) return Array.isArray(rows) ? rows : [];
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    const p = iso(r.period);
    if (!p) return false;
    if (s && p < s) return false;
    if (e && p > e) return false;
    return true;
  });
}
