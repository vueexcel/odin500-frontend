/** Same host as production API; Vite dev proxy forwards `/api` here when `import.meta.env.DEV`. */
export const PRODUCTION_API_ORIGIN = 'https://trading-backend-production-b1b2.up.railway.app/';
export const LOCAL_DEV_API_ORIGIN = 'http://localhost:5000';

export function normalizeApiOrigin(url) {
  return String(url || '').replace(/\/$/, '');
}

export function computeDefaultApiOrigin() {
  if (typeof window === 'undefined') return '';

  if (window.TRADING_API_ORIGIN) {
    return normalizeApiOrigin(window.TRADING_API_ORIGIN);
  }
  try {
    const saved = localStorage.getItem('trading_api_origin');
    if (saved) return normalizeApiOrigin(saved);
  } catch {
    /* ignore */
  }

  // Dev default: call local backend directly.
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return LOCAL_DEV_API_ORIGIN;
  }

  return PRODUCTION_API_ORIGIN;
}

export function apiUrl(path) {
  const base = computeDefaultApiOrigin();
  const p = path.startsWith('/') ? path : '/' + path;
  return base ? base + p : p;
}
