import { useEffect, useSyncExternalStore } from 'react';
import { fetchJsonCached } from '../store/apiStore.js';

const store = {
  items: [],
  busy: false,
  error: '',
  loaded: false
};
let snapshot = {
  items: store.items,
  busy: store.busy,
  error: store.error,
  loaded: store.loaded
};
const listeners = new Set();

function emit() {
  snapshot = {
    items: store.items,
    busy: store.busy,
    error: store.error,
    loaded: store.loaded
  };
  listeners.forEach((l) => l());
}

async function loadDefaults(ttlMs = 2 * 60 * 1000) {
  if (store.busy) return;
  store.busy = true;
  emit();
  try {
    const res = await fetchJsonCached({ path: '/api/watchlists/defaults', auth: false, ttlMs });
    const groups = Array.isArray(res?.data) ? res.data : [];
    const first = Array.isArray(groups[0]?.items) ? groups[0].items : [];
    store.items = first.slice(0, 80);
    store.error = '';
    store.loaded = true;
  } catch (e) {
    store.error = e?.message || 'Failed to load watchlist defaults';
    store.loaded = true;
  } finally {
    store.busy = false;
    emit();
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function warmWatchlistDefaults(ttlMs = 2 * 60 * 1000) {
  return loadDefaults(ttlMs);
}

export function useWatchlistDefaults(ttlMs = 2 * 60 * 1000, refreshMs = 0) {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    if (!store.loaded && !store.busy) {
      void loadDefaults(ttlMs);
    }
    if (refreshMs > 0) {
      const t = window.setInterval(() => {
        void loadDefaults(ttlMs);
      }, refreshMs);
      return () => window.clearInterval(t);
    }
    return undefined;
  }, [ttlMs, refreshMs]);
  return snap;
}

