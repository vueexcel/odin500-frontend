import { apiUrl } from '../utils/apiOrigin.js';

const CACHE_VERSION = 'v2';
const CACHE_KEY = 'odin500_api_cache_' + CACHE_VERSION;
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const EXPIRES_AT_KEY = 'auth_expires_at';

/** Refresh access token this many ms before JWT expiry (proactive). */
const PROACTIVE_REFRESH_BUFFER_MS = 5 * 60 * 1000;

const memoryStore = {
  token: '',
  cache: new Map(),
  inFlight: new Map()
};

let refreshInFlight = null;
let proactiveTimerId = null;

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function loadCacheFromSessionStorage() {
  if (typeof window === 'undefined') return;
  const raw = sessionStorage.getItem(CACHE_KEY);
  if (!raw) return;
  const parsed = safeParse(raw, {});
  const entries = Object.entries(parsed);
  for (const [key, value] of entries) {
    if (!value || typeof value !== 'object') continue;
    if (!('ts' in value)) continue;
    memoryStore.cache.set(key, value);
  }
}

function persistCacheToSessionStorage() {
  if (typeof window === 'undefined') return;
  const obj = {};
  for (const [key, value] of memoryStore.cache.entries()) {
    obj[key] = value;
  }
  sessionStorage.setItem(CACHE_KEY, JSON.stringify(obj));
}

function getBodyKey(body) {
  if (body == null) return '';
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

function makeRequestKey(method, path, body) {
  return method.toUpperCase() + '::' + path + '::' + getBodyKey(body);
}

loadCacheFromSessionStorage();

function dispatchAuthUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('odin-auth-updated'));
}

function clearProactiveTimer() {
  if (proactiveTimerId != null && typeof window !== 'undefined') {
    window.clearTimeout(proactiveTimerId);
    proactiveTimerId = null;
  }
}

function getRefreshToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(REFRESH_TOKEN_KEY) || '';
}

/** Supabase session.expires_at is Unix seconds (JWT exp). */
function getExpiresAtSec() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(EXPIRES_AT_KEY) || '';
}

/** Persist full Supabase session from login or refresh. */
export function applyAuthSession(session) {
  if (!session) return;
  const access = session.access_token;
  const refresh = session.refresh_token;
  const expiresAt =
    session.expires_at != null
      ? String(session.expires_at)
      : session.expires_in != null
        ? String(Math.floor(Date.now() / 1000) + Number(session.expires_in))
        : '';

  memoryStore.token = access || '';
  if (typeof window === 'undefined') return;

  if (access) localStorage.setItem(TOKEN_KEY, access);
  else localStorage.removeItem(TOKEN_KEY);

  if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  else localStorage.removeItem(REFRESH_TOKEN_KEY);

  if (expiresAt) localStorage.setItem(EXPIRES_AT_KEY, expiresAt);
  else localStorage.removeItem(EXPIRES_AT_KEY);

  dispatchAuthUpdated();
  scheduleProactiveRefresh();
}

export function scheduleProactiveRefresh() {
  clearProactiveTimer();
  if (typeof window === 'undefined') return;

  const rt = getRefreshToken();
  const expSec = getExpiresAtSec();
  if (!rt || !expSec) return;

  const expMs = Number(expSec) * 1000;
  if (!Number.isFinite(expMs)) return;

  const now = Date.now();
  const fireAt = expMs - PROACTIVE_REFRESH_BUFFER_MS;
  let delay = fireAt - now;
  if (delay < 0) delay = 0;

  proactiveTimerId = window.setTimeout(async () => {
    proactiveTimerId = null;
    const ok = await refreshSessionOnce();
    if (ok) scheduleProactiveRefresh();
  }, delay);
}

/**
 * On app load: if session is near or past proactive window, refresh once; else schedule timer.
 */
export function initAuthSessionOnLoad() {
  if (typeof window === 'undefined') return;

  memoryStore.token = localStorage.getItem(TOKEN_KEY) || '';

  const rt = getRefreshToken();
  const expSec = getExpiresAtSec();
  if (!rt) return;

  const expMs = expSec ? Number(expSec) * 1000 : 0;
  const now = Date.now();
  const shouldRefreshNow =
    !Number.isFinite(expMs) || expMs - PROACTIVE_REFRESH_BUFFER_MS <= now;

  if (shouldRefreshNow) {
    refreshSessionOnce().then((ok) => {
      if (ok) scheduleProactiveRefresh();
    });
  } else {
    scheduleProactiveRefresh();
  }
}

/**
 * Single-flight refresh via backend POST /api/auth/refresh.
 * @returns {Promise<boolean>}
 */
export async function refreshSessionOnce() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const rt = getRefreshToken();
    if (!rt) return false;

    try {
      const response = await fetch(apiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: rt })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.session) {
        clearAuthToken();
        clearApiCache();
        return false;
      }

      applyAuthSession(payload.session);
      return true;
    } catch {
      clearAuthToken();
      clearApiCache();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export function setAuthToken(token) {
  const next = String(token || '');
  memoryStore.token = next;
  if (typeof window === 'undefined') return;
  if (next) localStorage.setItem(TOKEN_KEY, next);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  if (memoryStore.token) return memoryStore.token;
  if (typeof window === 'undefined') return '';
  const token = localStorage.getItem(TOKEN_KEY) || '';
  memoryStore.token = token;
  return token;
}

export function clearAuthToken() {
  clearProactiveTimer();
  memoryStore.token = '';
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
  dispatchAuthUpdated();
}

export function clearApiCache() {
  memoryStore.cache.clear();
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(CACHE_KEY);
  }
}

/**
 * Fetch with Bearer auth; on 401, refresh once and retry.
 */
export async function fetchWithAuth(url, init = {}) {
  const { auth = true, ...rest } = init;
  const exec = async () => {
    const headers = new Headers(rest.headers || {});
    const token = getAuthToken();
    if (auth && token) headers.set('Authorization', 'Bearer ' + token);
    if (
      rest.body &&
      typeof rest.body === 'string' &&
      !headers.has('Content-Type')
    ) {
      headers.set('Content-Type', 'application/json');
    }
    return fetch(url, { ...rest, headers });
  };

  let response = await exec();
  if (response.status === 401 && auth) {
    const refreshed = await refreshSessionOnce();
    if (refreshed) response = await exec();
  }
  return response;
}

/**
 * Ticker search must not use the JSON cache: stale `[]` in sessionStorage was
 * causing permanent "No matches" until TTL expired.
 * @param {string} query trimmed search text (caller sanitizes)
 * @returns {Promise<unknown>} parsed JSON body (usually an array of tickers)
 */
export async function fetchTickerSearchLive(query) {
  const q = String(query || '').trim();
  if (!q) {
    return [];
  }
  const path = '/api/tickers/search?q=' + encodeURIComponent(q);
  const url = apiUrl(path);
  const response = await fetchWithAuth(url, {
    method: 'GET',
    cache: 'no-store'
  });
  const rawText = await response.text();
  let payload;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error('Invalid JSON from ticker search');
  }
  if (!response.ok) {
    throw new Error(
      (payload && (payload.error || payload.message)) ||
        'Ticker search failed (' + response.status + ')'
    );
  }
  return payload;
}

/**
 * Batch-resolve Supabase ticker `id` by exact symbol (watchlist search fallback when GET /search omits id).
 * @param {string[]} symbols uppercased symbols
 * @returns {Promise<Map<string, { id: string, symbol: string, company_name: string }>>}
 */
export async function resolveTickerSymbols(symbols) {
  const unique = [
    ...new Set(symbols.map((s) => String(s || '').trim().toUpperCase()).filter(Boolean))
  ].slice(0, 150);
  if (!unique.length) return new Map();

  const response = await fetchWithAuth(apiUrl('/api/tickers/resolve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: unique }),
    cache: 'no-store'
  });
  const rawText = await response.text();
  let payload;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch {
    throw new Error('Invalid JSON from ticker resolve');
  }
  if (!response.ok) {
    throw new Error(
      (payload && (payload.error || payload.message)) || 'Ticker resolve failed'
    );
  }
  const tickers = Array.isArray(payload?.tickers) ? payload.tickers : [];
  const m = new Map();
  for (const t of tickers) {
    const sym = String(t.symbol || '')
      .trim()
      .toUpperCase();
    if (!sym || t.id == null || t.id === '') continue;
    m.set(sym, {
      id: String(t.id),
      symbol: sym,
      company_name: t.company_name != null ? String(t.company_name) : ''
    });
  }
  return m;
}

/** Normalize various API shapes to a flat list of { id, symbol, company_name }. */
export function normalizeTickerSearchRows(payload) {
  let rows = [];
  if (Array.isArray(payload)) {
    rows = payload;
  } else if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) rows = payload.data;
    else if (Array.isArray(payload.tickers)) rows = payload.tickers;
    else if (Array.isArray(payload.results)) rows = payload.results;
  }
  return rows.map((row) => {
    const id = row.id ?? row.ticker_id ?? row.tickerId;
    return {
      id: id != null && id !== '' ? String(id) : '',
      symbol: String(row.symbol ?? row.Symbol ?? '')
        .trim()
        .toUpperCase(),
      company_name:
        row.company_name != null
          ? String(row.company_name)
          : row.companyName != null
            ? String(row.companyName)
            : ''
    };
  });
}

export async function fetchJsonCached({
  path,
  method = 'GET',
  body,
  ttlMs = 5 * 60 * 1000,
  auth = true,
  force = false
}) {
  const reqKey = makeRequestKey(method, path, body);
  const now = Date.now();

  const skipAppCache =
    method === 'GET' && typeof path === 'string' && path.includes('/api/tickers/search');

  if (!force && !skipAppCache) {
    const cached = memoryStore.cache.get(reqKey);
    if (cached && now - cached.ts < ttlMs) {
      return { data: cached.data, fromCache: true };
    }
  }

  if (memoryStore.inFlight.has(reqKey)) {
    return memoryStore.inFlight.get(reqKey);
  }

  const promise = (async () => {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = getAuthToken();
      if (token) headers.Authorization = 'Bearer ' + token;
    }

    const fetchInit = {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
      /** Avoid browser HTTP 304 + empty body: `response.ok` is false for 304 and `.json()` often fails. */
      cache: 'no-store'
    };

    let response = await fetch(apiUrl(path), fetchInit);

    if (response.status === 401 && auth) {
      const refreshed = await refreshSessionOnce();
      if (refreshed) {
        const token2 = getAuthToken();
        const h2 = { ...headers };
        if (token2) h2.Authorization = 'Bearer ' + token2;
        response = await fetch(apiUrl(path), {
          ...fetchInit,
          headers: h2
        });
      }
    }

    const rawText = await response.text();
    let payload;
    try {
      payload = rawText ? JSON.parse(rawText) : null;
    } catch {
      throw new Error('Invalid JSON from server: ' + path);
    }

    if (!response.ok) {
      throw new Error(
        (payload && (payload.error || payload.message)) ||
          'Request failed (' + response.status + '): ' + path
      );
    }

    if (!skipAppCache) {
      memoryStore.cache.set(reqKey, { ts: Date.now(), data: payload });
      persistCacheToSessionStorage();
    }
    return { data: payload, fromCache: false };
  })();

  memoryStore.inFlight.set(reqKey, promise);

  try {
    return await promise;
  } finally {
    memoryStore.inFlight.delete(reqKey);
  }
}
