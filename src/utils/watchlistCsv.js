import { resolveTickerSymbols } from '../store/apiStore.js';
import { sanitizeTickerPageInput } from './tickerUrlSync.js';

/** Split one CSV line on commas, respecting double-quoted fields. */
export function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  const s = String(line || '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && ch === ',') {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((cell) => String(cell || '').trim().replace(/^"|"$/g, ''));
}

const HEADER_FIRST = new Set(['SYMBOL', 'TICKER', 'SYM']);

/**
 * Extract ordered unique ticker symbols from CSV text (first column per row and/or extra comma-separated cells).
 * @param {string} raw
 * @returns {string[]} uppercase symbols
 */
export function parseTickerSymbolsFromCsvText(raw) {
  const text = String(raw || '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const firstCells = splitCsvLine(lines[0]);
  const firstTok = sanitizeTickerPageInput(firstCells[0] || '');
  let start = 0;
  if (HEADER_FIRST.has(firstTok)) start = 1;

  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (let i = start; i < lines.length; i++) {
    for (const cell of splitCsvLine(lines[i])) {
      const sym = sanitizeTickerPageInput(cell);
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      out.push(sym);
    }
  }
  return out;
}

/**
 * Resolve many symbols in chunks of 150 (API limit in {@link resolveTickerSymbols}).
 * @param {string[]} symbols
 * @returns {Promise<Map<string, { id: string, symbol: string, company_name: string }>>}
 */
export async function resolveTickerSymbolsBatched(symbols) {
  const u = [...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))];
  const m = new Map();
  for (let i = 0; i < u.length; i += 150) {
    const part = await resolveTickerSymbols(u.slice(i, i + 150));
    for (const [k, v] of part) m.set(k, v);
  }
  return m;
}

/**
 * Merge resolved symbols into existing multiselect picks (dedupe by id).
 * @param {{ id: string, symbol: string, company_name?: string }[]} prev
 * @param {string[]} symsOrdered order preserved for missing list
 * @param {Map<string, { id: string, symbol: string, company_name: string }>} resolved
 * @returns {{ next: typeof prev, missing: string[], added: number }}
 */
export function mergeResolvedSymbolsIntoPicks(prev, symsOrdered, resolved) {
  const byId = new Map(prev.map((t) => [String(t.id), t]));
  let added = 0;
  /** @type {string[]} */
  const missing = [];
  for (const sym of symsOrdered) {
    const hit = resolved.get(sym);
    if (hit?.id) {
      const id = String(hit.id);
      if (!byId.has(id)) {
        added += 1;
        byId.set(id, {
          id,
          symbol: hit.symbol,
          company_name: hit.company_name || ''
        });
      }
    } else {
      missing.push(sym);
    }
  }
  return {
    next: Array.from(byId.values()),
    missing: [...new Set(missing)],
    added
  };
}
