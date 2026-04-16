import { useSyncExternalStore } from 'react';

const FINNHUB_NEWS_REST_URL = 'https://finnhub.io/api/v1/news';
const FINNHUB_NEWS_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FINNHUB_TOKEN) || '';
const MAX_ITEMS = 200;

const state = {
  busy: false,
  error: '',
  items: [],
  minId: 0,
  timer: null,
  running: false
};
let snapshot = {
  busy: state.busy,
  error: state.error,
  items: state.items
};
const listeners = new Set();

function emit() {
  snapshot = {
    busy: state.busy,
    error: state.error,
    items: state.items
  };
  listeners.forEach((l) => l());
}

function fmtNewsTime(unixSec) {
  const ts = Number(unixSec);
  if (!Number.isFinite(ts)) return '';
  const d = new Date(ts * 1000);
  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function mapFinnhubNewsItem(row) {
  if (!row || typeof row !== 'object') return null;
  const id = row.id != null ? String(row.id) : row.url || row.headline;
  const title = String(row.headline || '').trim();
  if (!id || !title) return null;
  const url = String(row.url || '').trim();
  return {
    id,
    title,
    headline: title,
    source: String(row.source || 'Finnhub').trim() || 'Finnhub',
    time: fmtNewsTime(row.datetime),
    url
  };
}

async function pollOnce() {
  if (!FINNHUB_NEWS_TOKEN) {
    state.busy = false;
    state.error = 'Finnhub token is missing.';
    emit();
    return;
  }
  state.busy = true;
  emit();
  try {
    const qs = new URLSearchParams({ category: 'general', token: FINNHUB_NEWS_TOKEN });
    if (state.minId > 0) qs.set('minId', String(state.minId));
    const res = await fetch(`${FINNHUB_NEWS_REST_URL}?${qs.toString()}`);
    if (!res.ok) throw new Error(`News request failed (${res.status})`);
    const payload = await res.json();
    const rows = Array.isArray(payload) ? payload : [];
    const mapped = rows.map(mapFinnhubNewsItem).filter(Boolean);
    if (mapped.length) {
      const maxSeen = rows.reduce((mx, r) => Math.max(mx, Number(r?.id) || 0), state.minId);
      state.minId = Math.max(state.minId, maxSeen);
      const seen = new Set(state.items.map((n) => n.id));
      state.items = [...mapped.filter((n) => !seen.has(n.id)), ...state.items].slice(0, MAX_ITEMS);
    }
    state.error = '';
  } catch (e) {
    state.error = e.message || 'Failed to load general trading news.';
  } finally {
    state.busy = false;
    emit();
  }
}

function startPolling() {
  if (state.running) return;
  state.running = true;
  pollOnce();
  state.timer = window.setInterval(pollOnce, 30000);
}

function stopPolling() {
  if (!state.running) return;
  state.running = false;
  if (state.timer) window.clearInterval(state.timer);
  state.timer = null;
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) startPolling();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopPolling();
  };
}

function getSnapshot() {
  return snapshot;
}

export function useGeneralNewsFeed() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return snap;
}

