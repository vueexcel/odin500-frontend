import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { fetchJsonCached, fetchWithAuth, peekJsonCached, resolveTickerSymbols } from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
import {
  mergeResolvedSymbolsIntoPicks,
  parseTickerSymbolsFromCsvText,
  resolveTickerSymbolsBatched
} from '../utils/watchlistCsv.js';
import { WatchlistTickerMultiselect } from './WatchlistTickerMultiselect.jsx';

/**
 * @typedef {{ symbol: string, companyName: string, last: number | null, pctFraction: number | null, tickerId?: string }} WatchlistTickerRow
 * @typedef {{ key: string, name: string, kind: 'user' | 'default', watchlistId?: string, tickers: WatchlistTickerRow[] }} WatchlistOption
 */

/** @param {string} path @param {{ method?: string, body?: unknown }} [opts] */
async function apiJsonAuth(path, opts = {}) {
  const { method = 'GET', body } = opts;
  const res = await fetchWithAuth(apiUrl(path), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.error || payload?.message || 'Request failed');
  }
  return payload;
}

function IcoUserWatchlistSmall({ className }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M5.5 19c.55-1.65 1.85-2.75 3.5-2.75s2.95 1.1 3.5 2.75"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
      <rect x="13" y="5" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.65" />
      <path
        d="M15 14l2-3 2 2 2-4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IcoChevronDown({ className }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcoSortChevron({ className }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 6l4 5H8l4-5z" fill="currentColor" />
    </svg>
  );
}

function IcoPlus({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IcoGear({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IcoClose({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IcoTrash({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function mapDefaultItems(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((r) => ({
    symbol: String(r.symbol || '')
      .trim()
      .toUpperCase(),
    companyName: String(r.company_name || '').trim(),
    last: r.close != null && Number.isFinite(Number(r.close)) ? Number(r.close) : null,
    pctFraction: r.change_pct != null && Number.isFinite(Number(r.change_pct)) ? Number(r.change_pct) : null
  }));
}

function mapUserTickers(tickers) {
  const arr = Array.isArray(tickers) ? tickers : [];
  return arr.map((t) => ({
    tickerId: t.id != null ? String(t.id) : '',
    symbol: String(t.symbol || '')
      .trim()
      .toUpperCase(),
    companyName: String(t.company_name || '').trim(),
    last: t.close != null && Number.isFinite(Number(t.close)) ? Number(t.close) : null,
    pctFraction: t.change_pct != null && Number.isFinite(Number(t.change_pct)) ? Number(t.change_pct) : null
  }));
}

/** Build flyout options from API payloads; pass `undefined` for a branch that is not loaded yet. */
function optionsFromApiArrays(defaultsRaw, mineRaw) {
  const built = [];
  if (defaultsRaw != null) {
    const defaults = Array.isArray(defaultsRaw) ? defaultsRaw : [];
    for (const d of defaults) {
      const g = String(d.group || '').trim() || 'Default';
      built.push({
        key: 'def:' + g,
        name: g,
        kind: /** @type {'default'} */ ('default'),
        tickers: mapDefaultItems(d.items)
      });
    }
  }
  /** @type {WatchlistOption[]} */
  const userOpts = [];
  if (mineRaw != null) {
    const mine = Array.isArray(mineRaw) ? mineRaw : [];
    for (const wl of mine) {
      userOpts.push({
        key: 'usr:' + wl.id,
        watchlistId: String(wl.id),
        name: String(wl.name || 'Untitled').trim() || 'Untitled',
        kind: /** @type {'user'} */ ('user'),
        tickers: mapUserTickers(wl.tickers)
      });
    }
  }
  return [...userOpts, ...built];
}

function pickSelectedKeyForMerged(merged, prevKey) {
  if (prevKey && merged.some((o) => o.key === prevKey)) return prevKey;
  const firstUser = merged.find((o) => o.kind === 'user');
  if (firstUser) return firstUser.key;
  return merged[0]?.key || '';
}

function formatLast(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : 4;
  return n.toFixed(digits);
}

function formatPctDisplay(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  const pct = fraction * 100;
  const s = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
  return s;
}

function pctTone(fraction) {
  if (fraction == null || !Number.isFinite(fraction)) return 'wl-flyout__pct--na';
  if (fraction > 0) return 'wl-flyout__pct--up';
  if (fraction < 0) return 'wl-flyout__pct--down';
  return 'wl-flyout__pct--flat';
}

/**
 * @param {{ open: boolean, onClose: () => void, docked?: boolean }} props
 */
export function WatchlistRailFlyout({ open, onClose, docked = false }) {
  /** True only when we have no rows to show yet (first paint / cold cache). */
  const [loading, setLoading] = useState(false);
  /** True while a network refresh is in flight (may already be showing cached/partial rows). */
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(/** @type {WatchlistOption[]} */ ([]));
  const optionsRef = useRef(options);
  const loadGenRef = useRef(0);
  const [selectedKey, setSelectedKey] = useState('');
  const [sortCol, setSortCol] = useState(/** @type {'security' | 'last' | 'pct'} */ ('pct'));
  const [sortDesc, setSortDesc] = useState(true);
  const [ddOpen, setDdOpen] = useState(false);
  const ddRef = useRef(null);
  const settingsRef = useRef(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [managePanel, setManagePanel] = useState(/** @type {null | 'create' | 'delete' | 'update-pick' | 'update-edit'} */ (null));
  const [createName, setCreateName] = useState('');
  const [createTickers, setCreateTickers] = useState(/** @type {{ id: string, symbol: string, company_name?: string }[]} */ ([]));
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState('');
  /** When true, create modal was opened via Copy Watchlist (different title only). */
  const [createFromCopy, setCreateFromCopy] = useState(false);
  const [updateEditId, setUpdateEditId] = useState('');
  const [updateEditName, setUpdateEditName] = useState('');
  const [updateEditTickers, setUpdateEditTickers] = useState([]);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateErr, setUpdateErr] = useState('');
  const [deleteBusyId, setDeleteBusyId] = useState('');
  const [quickAddBusyId, setQuickAddBusyId] = useState('');
  const [updatePickErr, setUpdatePickErr] = useState('');
  const [pendingAddSymbol, setPendingAddSymbol] = useState('');
  const [createCsvBusy, setCreateCsvBusy] = useState(false);
  const [createCsvMsg, setCreateCsvMsg] = useState('');
  const [updateCsvBusy, setUpdateCsvBusy] = useState(false);
  const [updateCsvMsg, setUpdateCsvMsg] = useState('');
  const createCsvInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));
  const updateCsvInputRef = useRef(/** @type {HTMLInputElement | null} */ (null));

  const createTickersRef = useRef(createTickers);
  createTickersRef.current = createTickers;
  const updateEditTickersRef = useRef(updateEditTickers);
  updateEditTickersRef.current = updateEditTickers;

  const clearPendingAddFlow = useCallback(() => {
    setPendingAddSymbol('');
    try {
      sessionStorage.removeItem('watchlist_add_symbol');
    } catch {
      /* ignore */
    }
  }, []);

  const closeManageUi = useCallback(() => {
    setManagePanel(null);
    setSettingsOpen(false);
    setCreateErr('');
    setUpdateErr('');
    setUpdatePickErr('');
    setCreateBusy(false);
    setUpdateBusy(false);
    setQuickAddBusyId('');
    setDeleteBusyId('');
    setCreateFromCopy(false);
    setCreateCsvMsg('');
    setUpdateCsvMsg('');
    setCreateCsvBusy(false);
    setUpdateCsvBusy(false);
    clearPendingAddFlow();
  }, [clearPendingAddFlow]);

  const primePendingAddSymbol = useCallback((raw) => {
    const sym = String(raw || '').trim().toUpperCase();
    if (!sym) return;
    setPendingAddSymbol(sym);
    setUpdatePickErr('');
    setSettingsOpen(false);
    setManagePanel('update-pick');
    try {
      sessionStorage.removeItem('watchlist_add_symbol');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    return () => {
      loadGenRef.current += 1;
    };
  }, []);

  const load = useCallback(async (opts = {}) => {
    const forceMine = opts.forceMine === true;
    const gen = ++loadGenRef.current;
    const hadOptions = optionsRef.current.length > 0;

    setError('');
    setRefreshing(true);
    if (!hadOptions) setLoading(true);

    const defaultsSlot = { done: false, ok: false, built: /** @type {WatchlistOption[]} */ ([]), err: /** @type {unknown} */ (null) };
    const mineSlot = { done: false, ok: false, raw: /** @type {unknown} */ (null) };

    const merge = () => {
      if (gen !== loadGenRef.current) return;

      const prev = optionsRef.current;
      const built = defaultsSlot.done ? defaultsSlot.built : [];
      const fromPrevUser = prev.filter((o) => o.kind === 'user');
      let userOpts;
      if (!mineSlot.done) {
        userOpts = fromPrevUser;
      } else if (mineSlot.ok && Array.isArray(mineSlot.raw)) {
        const mine = mineSlot.raw;
        userOpts = mine.map((wl) => ({
          key: 'usr:' + wl.id,
          watchlistId: String(wl.id),
          name: String(wl.name || 'Untitled').trim() || 'Untitled',
          kind: /** @type {'user'} */ ('user'),
          tickers: mapUserTickers(wl.tickers)
        }));
      } else {
        userOpts = [];
      }

      const merged = [...userOpts, ...built];
      setOptions(merged);
      optionsRef.current = merged;

      if (merged.length > 0) setError('');

      setSelectedKey((prevKey) => pickSelectedKeyForMerged(merged, prevKey));
    };

    const finish = () => {
      if (gen !== loadGenRef.current) return;
      setLoading(false);
      setRefreshing(false);
    };

    return await new Promise((resolve) => {
      let pending = 2;
      const doneOne = () => {
        pending -= 1;
        if (pending <= 0) {
          finish();
          resolve(optionsRef.current);
        }
      };

      fetchJsonCached({
        path: '/api/watchlists/defaults',
        auth: false,
        ttlMs: 2 * 60 * 1000
      })
        .then((r) => {
          if (gen !== loadGenRef.current) return;
          const defaults = Array.isArray(r.data) ? r.data : [];
          const built = /** @type {WatchlistOption[]} */ ([]);
          for (const d of defaults) {
            const g = String(d.group || '').trim() || 'Default';
            built.push({
              key: 'def:' + g,
              name: g,
              kind: 'default',
              tickers: mapDefaultItems(d.items)
            });
          }
          defaultsSlot.done = true;
          defaultsSlot.ok = true;
          defaultsSlot.built = built;
          merge();
        })
        .catch((err) => {
          if (gen !== loadGenRef.current) return;
          setError(err?.message || 'Could not load default watchlists');
          defaultsSlot.done = true;
          defaultsSlot.ok = false;
          defaultsSlot.built = [];
          defaultsSlot.err = err;
          merge();
        })
        .finally(doneOne);

      fetchJsonCached({
        path: '/api/watchlists',
        auth: true,
        ttlMs: 2 * 60 * 1000,
        force: forceMine
      })
        .then((r) => {
          if (gen !== loadGenRef.current) return;
          mineSlot.done = true;
          mineSlot.ok = true;
          mineSlot.raw = r.data;
          merge();
        })
        .catch(() => {
          if (gen !== loadGenRef.current) return;
          mineSlot.done = true;
          mineSlot.ok = false;
          mineSlot.raw = null;
          merge();
        })
        .finally(doneOne);
    });
  }, []);

  const userWatchlists = useMemo(() => options.filter((o) => o.kind === 'user'), [options]);

  const openCreatePanel = () => {
    setSettingsOpen(false);
    setCreateFromCopy(false);
    setCreateName('');
    setCreateTickers([]);
    setCreateErr('');
    setCreateCsvMsg('');
    setManagePanel('create');
  };

  const openDeletePanel = () => {
    setSettingsOpen(false);
    setManagePanel('delete');
  };

  const openUpdatePickPanel = () => {
    setSettingsOpen(false);
    setManagePanel('update-pick');
  };

  const beginUpdateEdit = (opt) => {
    if (!opt.watchlistId) return;
    setUpdateEditId(opt.watchlistId);
    setUpdateEditName(opt.name);
    const picks = opt.tickers
      .filter((t) => t.tickerId)
      .map((t) => ({
        id: t.tickerId,
        symbol: t.symbol,
        company_name: t.companyName || ''
      }));
    setUpdateEditTickers(picks);
    setUpdateErr('');
    setUpdateCsvMsg('');
    setManagePanel('update-edit');
  };

  const openUpdateForSelectedUserList = () => {
    if (!selected || selected.kind !== 'user' || !selected.watchlistId) return;
    setSettingsOpen(false);
    beginUpdateEdit(selected);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (!name) {
      setCreateErr('Name is required');
      return;
    }
    setCreateBusy(true);
    setCreateErr('');
    try {
      const created = await apiJsonAuth('/api/watchlists', { method: 'POST', body: { name } });
      const wlId = created?.id;
      if (!wlId) throw new Error('Invalid response from server');
      const ids = createTickers.map((t) => t.id).filter(Boolean);
      if (ids.length > 0) {
        await apiJsonAuth('/api/watchlists/add', {
          method: 'POST',
          body: { watchlist_id: wlId, ticker_ids: ids }
        });
      }
      closeManageUi();
      await load({ forceMine: true });
      setSelectedKey('usr:' + wlId);
    } catch (e) {
      setCreateErr(e?.message || 'Could not create watchlist');
    } finally {
      setCreateBusy(false);
    }
  };

  const deleteUserWatchlist = async (watchlistId) => {
    setDeleteBusyId(watchlistId);
    try {
      await apiJsonAuth('/api/watchlists/' + encodeURIComponent(watchlistId), { method: 'DELETE' });
      await load({ forceMine: true });
    } catch (e) {
      setError(e?.message || 'Could not delete watchlist');
    } finally {
      setDeleteBusyId('');
    }
  };

  const submitUpdateWatchlist = async () => {
    const name = updateEditName.trim();
    if (!name) {
      setUpdateErr('Name is required');
      return;
    }
    if (!updateEditId) return;
    setUpdateBusy(true);
    setUpdateErr('');
    try {
      const ticker_ids = updateEditTickers.map((t) => t.id).filter(Boolean);
      await apiJsonAuth('/api/watchlists/' + encodeURIComponent(updateEditId), {
        method: 'PATCH',
        body: { name, ticker_ids }
      });
      closeManageUi();
      await load({ forceMine: true });
      setSelectedKey('usr:' + updateEditId);
    } catch (e) {
      setUpdateErr(e?.message || 'Could not update watchlist');
    } finally {
      setUpdateBusy(false);
    }
  };

  const quickAddPendingTickerToWatchlist = useCallback(
    async (opt) => {
      if (!opt?.watchlistId) return;
      const symbol = String(pendingAddSymbol || '').toUpperCase().trim();
      if (!symbol) {
        beginUpdateEdit(opt);
        return;
      }
      setQuickAddBusyId(String(opt.watchlistId));
      setUpdatePickErr('');
      try {
        const resolved = await resolveTickerSymbols([symbol]);
        const hit = resolved.get(symbol);
        if (!hit?.id) {
          setUpdatePickErr(`Could not resolve ticker ${symbol}. Please try editing watchlist manually.`);
          beginUpdateEdit(opt);
          return;
        }
        const existingIds = opt.tickers.map((t) => String(t.tickerId || '')).filter(Boolean);
        const ticker_ids = [...new Set([...existingIds, String(hit.id)])];
        await apiJsonAuth('/api/watchlists/' + encodeURIComponent(opt.watchlistId), {
          method: 'PATCH',
          body: { name: String(opt.name || '').trim() || 'Untitled', ticker_ids }
        });
        setPendingAddSymbol('');
        try {
          sessionStorage.removeItem('watchlist_add_symbol');
        } catch {
          /* ignore */
        }
        closeManageUi();
        await load({ forceMine: true });
        setSelectedKey('usr:' + opt.watchlistId);
      } catch (e) {
        setUpdatePickErr(e?.message || 'Could not add ticker to watchlist');
      } finally {
        setQuickAddBusyId('');
      }
    },
    [beginUpdateEdit, closeManageUi, load, pendingAddSymbol]
  );

  useEffect(() => {
    if (!open) return;
    try {
      const pending = sessionStorage.getItem('watchlist_add_symbol');
      if (pending) primePendingAddSymbol(pending);
    } catch {
      /* ignore */
    }
    const ttlMs = 2 * 60 * 1000;
    const d = peekJsonCached({ path: '/api/watchlists/defaults', auth: false, ttlMs });
    const m = peekJsonCached({ path: '/api/watchlists', auth: true, ttlMs });
    if (d !== undefined || m !== undefined) {
      const merged = optionsFromApiArrays(d, m);
      if (merged.length > 0) {
        setOptions(merged);
        optionsRef.current = merged;
        setLoading(false);
        setSelectedKey((prev) => pickSelectedKeyForMerged(merged, prev));
      }
    }
    void load();
  }, [open, load, primePendingAddSymbol]);

  useEffect(() => {
    function onWatchlistAddTicker(e) {
      const symbol = String(e?.detail?.symbol || '').trim().toUpperCase();
      if (symbol) primePendingAddSymbol(symbol);
    }
    window.addEventListener('watchlist:add-ticker', onWatchlistAddTicker);
    return () => window.removeEventListener('watchlist:add-ticker', onWatchlistAddTicker);
  }, [primePendingAddSymbol]);

  useEffect(() => {
    if (open) return;
    closeManageUi();
  }, [open, closeManageUi]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key !== 'Escape') return;
      if (managePanel) {
        closeManageUi();
        return;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, managePanel, settingsOpen, closeManageUi]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onDoc(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) setSettingsOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [settingsOpen]);

  useEffect(() => {
    if (!ddOpen) return;
    function onDoc(e) {
      if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ddOpen]);

  const selected = useMemo(
    () => options.find((o) => o.key === selectedKey) || options[0] || null,
    [options, selectedKey]
  );

  /** Pre-fill create modal with tickers from the watchlist currently selected in the dropdown. */
  const copyWatchlist = useCallback(async () => {
    setSettingsOpen(false);
    setCreateFromCopy(true);
    setCreateName('');
    setCreateErr('');
    setCreateCsvMsg('');
    const opt = selected;
    if (!opt?.tickers?.length) {
      setCreateTickers([]);
      setManagePanel('create');
      return;
    }

    const withId = [];
    const symbolsNeedResolve = [];
    for (const t of opt.tickers) {
      const sym = String(t.symbol || '').trim().toUpperCase();
      if (!sym) continue;
      if (t.tickerId) {
        withId.push({ id: String(t.tickerId), symbol: sym, company_name: t.companyName || '' });
      } else {
        symbolsNeedResolve.push(sym);
      }
    }

    let picks = [...withId];
    if (symbolsNeedResolve.length) {
      try {
        const uniq = [...new Set(symbolsNeedResolve)];
        const resolved = await resolveTickerSymbols(uniq);
        for (const sym of uniq) {
          const hit = resolved.get(sym);
          if (hit?.id) {
            const row = opt.tickers.find((x) => String(x.symbol || '').trim().toUpperCase() === sym);
            picks.push({
              id: String(hit.id),
              symbol: sym,
              company_name: hit.company_name || row?.companyName || ''
            });
          }
        }
      } catch {
        setCreateErr('Could not resolve some tickers. Add any missing symbols in the list below.');
      }
    }

    setCreateTickers(picks);
    setManagePanel('create');
  }, [selected]);

  const downloadWatchlistCsv = useCallback(() => {
    setSettingsOpen(false);
    const opt = selected;
    const rows = opt?.tickers || [];
    const lines = ['symbol'];
    for (const t of rows) {
      const sym = String(t.symbol || '').trim();
      if (sym) lines.push(sym);
    }
    const body = lines.join('\r\n');
    const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const rawTitle = String(opt?.name || 'watchlist').trim() || 'watchlist';
    const safe = rawTitle.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80);
    a.download = safe + '-tickers.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [selected]);

  const onCreateCsvFileChange = async (e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setCreateCsvBusy(true);
    setCreateCsvMsg('');
    try {
      const text = await file.text();
      const syms = parseTickerSymbolsFromCsvText(text);
      if (syms.length === 0) {
        setCreateCsvMsg('No tickers found in that file.');
        return;
      }
      const resolved = await resolveTickerSymbolsBatched(syms);
      const prev = createTickersRef.current;
      const { next, missing, added } = mergeResolvedSymbolsIntoPicks(prev, syms, resolved);
      setCreateTickers(next);
      if (missing.length) {
        setCreateCsvMsg(
          (added ? `Added ${added} from CSV. ` : '') +
            `Could not resolve: ${missing.slice(0, 14).join(', ')}` +
            (missing.length > 14 ? '…' : '')
        );
      } else if (added > 0) {
        setCreateCsvMsg(`Added ${added} ticker(s) from CSV.`);
      } else {
        setCreateCsvMsg('All tickers from CSV were already selected.');
      }
    } catch (err) {
      setCreateCsvMsg(err?.message || 'Could not read CSV file.');
    } finally {
      setCreateCsvBusy(false);
    }
  };

  const onUpdateCsvFileChange = async (e) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setUpdateCsvBusy(true);
    setUpdateCsvMsg('');
    try {
      const text = await file.text();
      const syms = parseTickerSymbolsFromCsvText(text);
      if (syms.length === 0) {
        setUpdateCsvMsg('No tickers found in that file.');
        return;
      }
      const resolved = await resolveTickerSymbolsBatched(syms);
      const prev = updateEditTickersRef.current;
      const { next, missing, added } = mergeResolvedSymbolsIntoPicks(prev, syms, resolved);
      setUpdateEditTickers(next);
      if (missing.length) {
        setUpdateCsvMsg(
          (added ? `Added ${added} from CSV. ` : '') +
            `Could not resolve: ${missing.slice(0, 14).join(', ')}` +
            (missing.length > 14 ? '…' : '')
        );
      } else if (added > 0) {
        setUpdateCsvMsg(`Added ${added} ticker(s) from CSV.`);
      } else {
        setUpdateCsvMsg('All tickers from CSV were already selected.');
      }
    } catch (err) {
      setUpdateCsvMsg(err?.message || 'Could not read CSV file.');
    } finally {
      setUpdateCsvBusy(false);
    }
  };

  const sortedRows = useMemo(() => {
    const tickers = selected?.tickers || [];
    const rows = [...tickers];
    const mul = sortDesc ? -1 : 1;
    rows.sort((a, b) => {
      if (sortCol === 'security') {
        return mul * a.symbol.localeCompare(b.symbol);
      }
      if (sortCol === 'last') {
        const av = a.last ?? -Infinity;
        const bv = b.last ?? -Infinity;
        return mul * (av - bv);
      }
      const av = a.pctFraction ?? -Infinity;
      const bv = b.pctFraction ?? -Infinity;
      return mul * (av - bv);
    });
    return rows;
  }, [selected, sortCol, sortDesc]);

  const onSort = (col) => {
    if (sortCol === col) setSortDesc((d) => !d);
    else {
      setSortCol(col);
      setSortDesc(col === 'security' ? false : true);
    }
  };

  if (!open) return null;

  const panel = (
      <div
        className={'wl-flyout' + (docked ? ' wl-flyout--docked' : '')}
        role={docked ? 'complementary' : 'dialog'}
        aria-modal={docked ? undefined : 'true'}
        aria-labelledby="wl-flyout-title"
      >
        <div className="wl-flyout__head">
          <h2 id="wl-flyout-title" className="wl-flyout__title">
            My Watchlists
          </h2>
          <div className="wl-flyout__head-actions" ref={settingsRef}>
              <button
                type="button"
                className="wl-flyout__iconbtn"
                title="Add tickers to this watchlist"
                aria-label="Add tickers to this watchlist"
                onClick={openCreatePanel}
              >
                <IcoPlus className="wl-flyout__iconbtn-svg" />
              </button>
            <button
              type="button"
              className={'wl-flyout__iconbtn' + (settingsOpen ? ' wl-flyout__iconbtn--active' : '')}
              title="Watchlist settings"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              aria-haspopup="menu"
              onClick={() => setSettingsOpen((v) => !v)}
            >
              <IcoGear className="wl-flyout__iconbtn-svg" />
            </button>
            {settingsOpen ? (
              <ul className="wl-flyout__settings-menu" role="menu">
                <li role="none">
                  <button type="button" className="wl-flyout__settings-item" role="menuitem" onClick={openCreatePanel}>
                    Create Watchlist
                  </button>
                </li>
                <li role="none">
                  <button type="button" className="wl-flyout__settings-item" role="menuitem" onClick={openDeletePanel}>
                    Delete Watchlist
                  </button>
                </li>
                <li role="none">
                  <button type="button" className="wl-flyout__settings-item" role="menuitem" onClick={openUpdatePickPanel}>
                    Update Watchlist
                  </button>
                </li>
                <li role="none">
                  <button type="button" className="wl-flyout__settings-item" role="menuitem" onClick={copyWatchlist}>
                    Copy Watchlist
                  </button>
                </li>
                <li role="none">
                  <button type="button" className="wl-flyout__settings-item" role="menuitem" onClick={downloadWatchlistCsv}>
                    Download CSV
                  </button>
                </li>
              </ul>
            ) : null}
            <button type="button" className="wl-flyout__iconbtn" onClick={onClose} title="Close" aria-label="Close">
              <IcoClose className="wl-flyout__iconbtn-svg" />
            </button>
          </div>
        </div>

        <div className="wl-flyout__select-wrap" ref={ddRef}>
          <button
            type="button"
            className="wl-flyout__select"
            aria-haspopup="listbox"
            aria-expanded={ddOpen}
            disabled={!options.length && loading}
            onClick={() => setDdOpen((v) => !v)}
          >
            <IcoUserWatchlistSmall className="wl-flyout__select-ico" />
            <span className="wl-flyout__select-label">
              {loading && !options.length ? 'Loading…' : selected?.name || '—'}
            </span>
            <IcoChevronDown className="wl-flyout__select-chev" />
          </button>
          {ddOpen && options.length > 0 ? (
            <ul className="wl-flyout__select-menu" role="listbox">
              {options.map((o) => (
                <li key={o.key} role="option" aria-selected={o.key === selectedKey}>
                  <button
                    type="button"
                    className={'wl-flyout__select-item' + (o.key === selectedKey ? ' wl-flyout__select-item--active' : '')}
                    onClick={() => {
                      setSelectedKey(o.key);
                      setDdOpen(false);
                    }}
                  >
                    <span className="wl-flyout__select-item-row">
                      <span
                        className={
                          'wl-flyout__select-item-tag' +
                          (o.kind === 'user' ? ' wl-flyout__select-item-tag--user' : ' wl-flyout__select-item-tag--default')
                        }
                      >
                        {o.kind === 'user' ? 'Yours' : 'Default'}
                      </span>
                      <span className="wl-flyout__select-item-name">{o.name}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? <p className="wl-flyout__err">{error}</p> : null}

        <div className="wl-flyout__table-wrap" aria-busy={refreshing}>
          <table className="wl-flyout__table">
            <thead>
              <tr>
                <th scope="col">
                  <button type="button" className="wl-flyout__th-btn" onClick={() => onSort('security')}>
                    Security
                    <IcoSortChevron
                      className={
                        'wl-flyout__sort-ico' + (sortCol === 'security' ? ' wl-flyout__sort-ico--active' : '')
                      }
                    />
                  </button>
                </th>
                <th scope="col" className="wl-flyout__th-num">
                  <button type="button" className="wl-flyout__th-btn" onClick={() => onSort('last')}>
                    Last
                    <IcoSortChevron className={'wl-flyout__sort-ico' + (sortCol === 'last' ? ' wl-flyout__sort-ico--active' : '')} />
                  </button>
                </th>
                <th scope="col" className="wl-flyout__th-pct">
                  <button type="button" className="wl-flyout__th-btn" onClick={() => onSort('pct')}>
                    1D %
                    <IcoSortChevron className={'wl-flyout__sort-ico' + (sortCol === 'pct' ? ' wl-flyout__sort-ico--active' : '')} />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading && sortedRows.length === 0 ? (
                <>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <tr key={'sk-' + i} className="wl-flyout__skel-row" aria-hidden>
                      <td>
                        <span className="wl-flyout__skel-bar wl-flyout__skel-bar--wide" />
                        <span className="wl-flyout__skel-bar wl-flyout__skel-bar--narrow" />
                      </td>
                      <td className="wl-flyout__td-num">
                        <span className="wl-flyout__skel-bar wl-flyout__skel-bar--num" />
                      </td>
                      <td className="wl-flyout__td-pct">
                        <span className="wl-flyout__skel-bar wl-flyout__skel-bar--pct" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="wl-flyout__empty-cell">
                    {selected?.kind === 'user' && selected?.watchlistId ? (
                      <div className="wl-flyout__empty-state">
                        <p className="wl-flyout__empty-msg">
                          There are no tickers in the Watchlist please Add tickers to see the data
                        </p>
                        <button
                          type="button"
                          className="wl-flyout__empty-add-btn"
                          onClick={() => beginUpdateEdit(selected)}
                          aria-label="Add tickers to this watchlist"
                        >
                          <IcoPlus className="wl-flyout__empty-add-ico" />
                        </button>
                      </div>
                    ) : (
                      <div className="wl-flyout__empty-state wl-flyout__empty-state--plain">
                        <p className="wl-flyout__td-muted wl-flyout__empty-fallback">No tickers in this list.</p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.tickerId ? row.symbol + '-' + row.tickerId : row.symbol}>
                    <td>
                      <Link className="wl-flyout__sec-link" to={'/ticker/' + encodeURIComponent(row.symbol)}>
                        <span className="wl-flyout__sec-top">
                          <span className="wl-flyout__bullet" aria-hidden />
                          <span className="wl-flyout__sym">{row.symbol}</span>
                        </span>
                        <span className="wl-flyout__co">{row.companyName || '—'}</span>
                      </Link>
                    </td>
                    <td className="wl-flyout__td-num">{formatLast(row.last)}</td>
                    <td className={'wl-flyout__td-pct ' + pctTone(row.pctFraction)}>{formatPctDisplay(row.pctFraction)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
  );

  return (
    <>
      {docked ? null : <div className="wl-flyout__backdrop" aria-hidden onClick={onClose} />}
      {panel}
      {managePanel === 'create'
        ? createPortal(
        <div
          className="wl-manage-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeManageUi()}
        >
          <div className="wl-manage-modal" role="dialog" aria-labelledby="wl-create-title">
            <div className="wl-manage-modal__head">
              <h3 id="wl-create-title" className="wl-manage-modal__title">
                {createFromCopy ? 'Watchlist Copy' : 'Create watchlist'}
              </h3>
              <button type="button" className="wl-manage-modal__close" onClick={closeManageUi} aria-label="Close">
                <IcoClose className="wl-flyout__iconbtn-svg" />
              </button>
            </div>
            <div className="wl-manage-modal__body">
              <label className="wl-manage-label" htmlFor="wl-create-name">
                Name
              </label>
              <input
                id="wl-create-name"
                type="text"
                className="wl-manage-input"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="Watchlist name"
                disabled={createBusy}
                autoComplete="off"
              />
              <div className="wl-manage-csv-row">
                <p className="wl-manage-muted wl-manage-csv-row__hint">
                  Add tickers from a CSV file (a <code className="wl-manage-code">symbol</code> column or one ticker per
                  line). Merges with the list below.
                </p>
                <input
                  ref={createCsvInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="wl-manage-file-input"
                  aria-hidden
                  tabIndex={-1}
                  onChange={onCreateCsvFileChange}
                />
                <button
                  type="button"
                  className="wl-manage-btn wl-manage-btn--ghost wl-manage-btn--compact"
                  disabled={createBusy || createCsvBusy}
                  onClick={() => createCsvInputRef.current?.click()}
                >
                  {createCsvBusy ? 'Reading…' : 'Add from CSV'}
                </button>
              </div>
              {createCsvMsg ? <p className="wl-manage-csv-msg">{createCsvMsg}</p> : null}
              <WatchlistTickerMultiselect
                idPrefix="wl-create"
                selected={createTickers}
                onChange={setCreateTickers}
                disabled={createBusy}
                footerCancelLabel="Cancel"
                footerSubmitLabel={createBusy ? 'Saving…' : 'Create'}
                onFooterCancel={closeManageUi}
                onFooterSubmit={submitCreate}
              />
              {createErr ? <p className="wl-manage-err">{createErr}</p> : null}
            </div>
            <div className="wl-manage-modal__foot">
              <button type="button" className="wl-manage-btn wl-manage-btn--ghost" onClick={closeManageUi} disabled={createBusy}>
                Cancel
              </button>
              <button type="button" className="wl-manage-btn wl-manage-btn--primary" onClick={submitCreate} disabled={createBusy}>
                {createBusy ? 'Saving…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
        , document.body)
        : null}

      {managePanel === 'delete'
        ? createPortal(
        <div
          className="wl-manage-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeManageUi()}
        >
          <div className="wl-manage-modal" role="dialog" aria-labelledby="wl-del-title">
            <div className="wl-manage-modal__head">
              <h3 id="wl-del-title" className="wl-manage-modal__title">
                Delete watchlist
              </h3>
              <button type="button" className="wl-manage-modal__close" onClick={closeManageUi} aria-label="Close">
                <IcoClose className="wl-flyout__iconbtn-svg" />
              </button>
            </div>
            <div className="wl-manage-modal__body">
              {userWatchlists.length === 0 ? (
                <p className="wl-manage-muted">You have no custom watchlists to delete.</p>
              ) : (
                <ul className="wl-manage-list">
                  {userWatchlists.map((o) => (
                    <li key={o.key} className="wl-manage-list__row">
                      <span className="wl-manage-list__name">{o.name}</span>
                      <button
                        type="button"
                        className="wl-manage-iconbtn"
                        title={'Delete ' + o.name}
                        aria-label={'Delete ' + o.name}
                        disabled={!!deleteBusyId}
                        onClick={() => o.watchlistId && deleteUserWatchlist(o.watchlistId)}
                      >
                        {deleteBusyId === o.watchlistId ? (
                          <span className="wl-manage-muted">…</span>
                        ) : (
                          <IcoTrash className="wl-flyout__iconbtn-svg" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="wl-manage-modal__foot">
              <button type="button" className="wl-manage-btn wl-manage-btn--ghost" onClick={closeManageUi}>
                Close
              </button>
            </div>
          </div>
        </div>
        , document.body)
        : null}

      {managePanel === 'update-pick'
        ? createPortal(
        <div
          className="wl-manage-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeManageUi()}
        >
          <div className="wl-manage-modal" role="dialog" aria-labelledby="wl-upd-pick-title">
            <div className="wl-manage-modal__head">
              <h3 id="wl-upd-pick-title" className="wl-manage-modal__title">
                Update watchlist
              </h3>
              <button type="button" className="wl-manage-modal__close" onClick={closeManageUi} aria-label="Close">
                <IcoClose className="wl-flyout__iconbtn-svg" />
              </button>
            </div>
            <div className="wl-manage-modal__body">
              {userWatchlists.length === 0 ? (
                <p className="wl-manage-muted">You have no custom watchlists to update.</p>
              ) : (
                <ul className="wl-manage-list wl-manage-list--pick">
                  {userWatchlists.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        className="wl-manage-pick-row"
                        onClick={() => (pendingAddSymbol ? quickAddPendingTickerToWatchlist(o) : beginUpdateEdit(o))}
                        disabled={quickAddBusyId === String(o.watchlistId || '')}
                      >
                        <span className="wl-manage-list__name">{o.name}</span>
                        <span className="wl-manage-muted">
                          {quickAddBusyId === String(o.watchlistId || '')
                            ? `Adding ${pendingAddSymbol}…`
                            : `${o.tickers.length} ticker(s)`}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {updatePickErr ? <p className="wl-manage-err">{updatePickErr}</p> : null}
            </div>
            <div className="wl-manage-modal__foot">
              <button type="button" className="wl-manage-btn wl-manage-btn--ghost" onClick={closeManageUi}>
                Close
              </button>
            </div>
          </div>
        </div>
        , document.body)
        : null}

      {managePanel === 'update-edit'
        ? createPortal(
        <div
          className="wl-manage-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeManageUi()}
        >
          <div className="wl-manage-modal" role="dialog" aria-labelledby="wl-upd-edit-title">
            <div className="wl-manage-modal__head">
              <h3 id="wl-upd-edit-title" className="wl-manage-modal__title">
                Edit watchlist
              </h3>
              <button type="button" className="wl-manage-modal__close" onClick={closeManageUi} aria-label="Close">
                <IcoClose className="wl-flyout__iconbtn-svg" />
              </button>
            </div>
            <div className="wl-manage-modal__body">
              <label className="wl-manage-label" htmlFor="wl-upd-name">
                Name
              </label>
              <input
                id="wl-upd-name"
                type="text"
                className="wl-manage-input"
                value={updateEditName}
                onChange={(e) => setUpdateEditName(e.target.value)}
                disabled={updateBusy}
                autoComplete="off"
              />
              <div className="wl-manage-csv-row">
                <p className="wl-manage-muted wl-manage-csv-row__hint">
                  Add tickers from a CSV file (a <code className="wl-manage-code">symbol</code> column or one ticker per
                  line). Merges with the list below.
                </p>
                <input
                  ref={updateCsvInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="wl-manage-file-input"
                  aria-hidden
                  tabIndex={-1}
                  onChange={onUpdateCsvFileChange}
                />
                <button
                  type="button"
                  className="wl-manage-btn wl-manage-btn--ghost wl-manage-btn--compact"
                  disabled={updateBusy || updateCsvBusy}
                  onClick={() => updateCsvInputRef.current?.click()}
                >
                  {updateCsvBusy ? 'Reading…' : 'Add from CSV'}
                </button>
              </div>
              {updateCsvMsg ? <p className="wl-manage-csv-msg">{updateCsvMsg}</p> : null}
              <WatchlistTickerMultiselect
                idPrefix="wl-upd"
                selected={updateEditTickers}
                onChange={setUpdateEditTickers}
                disabled={updateBusy}
                footerCancelLabel="Cancel"
                footerSubmitLabel={updateBusy ? 'Saving…' : 'Apply changes'}
                onFooterCancel={closeManageUi}
                onFooterSubmit={submitUpdateWatchlist}
              />
              {updateErr ? <p className="wl-manage-err">{updateErr}</p> : null}
            </div>
            <div className="wl-manage-modal__foot">
              <button type="button" className="wl-manage-btn wl-manage-btn--ghost" onClick={() => setManagePanel('update-pick')} disabled={updateBusy}>
                Back
              </button>
              <button type="button" className="wl-manage-btn wl-manage-btn--primary" onClick={submitUpdateWatchlist} disabled={updateBusy}>
                {updateBusy ? 'Saving…' : 'Apply changes'}
              </button>
            </div>
          </div>
        </div>
        , document.body)
        : null}
    </>
  );
}
