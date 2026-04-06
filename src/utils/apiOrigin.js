const PRODUCTION_API_ORIGIN = 'https://trading-backend-xlh9.onrender.com';

export function normalizeApiOrigin(url) {
  return String(url || '').replace(/\/$/, '');
}

function isPrivateLanHost(hostname) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  return /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
}

/**
 * In dev (Vite), use same origin so /api proxies to backend.
 * In production static hosting, mirror HTML logic for file:// and deployed hosts.
 */
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

  const loc = window.location;
  if (loc.protocol === 'file:') {
    return PRODUCTION_API_ORIGIN;
  }

  const host = loc.hostname;
  const port = loc.port || '';

  if (host === 'trading-backend-xlh9.onrender.com') {
    return loc.origin;
  }

  if (port === '5000' && (host === 'localhost' || host === '127.0.0.1')) {
    return loc.origin;
  }

  if (host === 'localhost' || host === '127.0.0.1') {
    if (port && port !== '5000') {
      return 'http://localhost:5000';
    }
  }

  if (port && port !== '5000' && isPrivateLanHost(host)) {
    return normalizeApiOrigin(loc.protocol + '//' + host + ':5000');
  }

  // Vite dev: use empty string / same origin — requests go to /api and proxy
  if (port === '5173' || port === '4173') {
    return '';
  }

  return PRODUCTION_API_ORIGIN;
}

export function apiUrl(path) {
  const base = computeDefaultApiOrigin();
  const p = path.startsWith('/') ? path : '/' + path;
  return base ? base + p : p;
}
