/** Same host as production API; Vite dev proxy forwards `/api` here when `import.meta.env.DEV`. */
export const PRODUCTION_API_ORIGIN = 'https://trading-backend-xlh9.onrender.com';

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

  // Dev: same-origin `/api/...` → Vite proxy → PRODUCTION_API_ORIGIN (vite.config.js)
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    return '';
  }

  return PRODUCTION_API_ORIGIN;
}

export function apiUrl(path) {
  const base = computeDefaultApiOrigin();
  const p = path.startsWith('/') ? path : '/' + path;
  return base ? base + p : p;
}
