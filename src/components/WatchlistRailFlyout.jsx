import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJsonCached, fetchWithAuth } from '../store/apiStore.js';
import { apiUrl } from '../utils/apiOrigin.js';
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
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function WatchlistRailFlyout({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState(/** @type {WatchlistOption[]} */ ([]));
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
  const [updateEditId, setUpdateEditId] = useState('');
  const [updateEditName, setUpdateEditName] = useState('');
  const [updateEditTickers, setUpdateEditTickers] = useState([]);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateErr, setUpdateErr] = useState('');
  const [deleteBusyId, setDeleteBusyId] = useState('');

  const closeManageUi = useCallback(() => {
    setManagePanel(null);
    setSettingsOpen(false);
    setCreateErr('');
    setUpdateErr('');
    setCreateBusy(false);
    setUpdateBusy(false);
    setDeleteBusyId('');
  }, []);

  const load = useCallback(async (opts = {}) => {
    const forceMine = opts.forceMine === true;
    setLoading(true);
    setError('');
    const built = /** @type {WatchlistOption[]} */ ([]);
    try {
      const { data: defaultsRaw } = await fetchJsonCached({
        path: '/api/watchlists/defaults',
        auth: false,
        ttlMs: 2 * 60 * 1000
      });
      const defaults = Array.isArray(defaultsRaw) ? defaultsRaw : [];
      for (const d of defaults) {
        const g = String(d.group || '').trim() || 'Default';
        built.push({
          key: 'def:' + g,
          name: g,
          kind: 'default',
          tickers: mapDefaultItems(d.items)
        });
      }
    } catch (e) {
      setError(e?.message || 'Could not load default watchlists');
    }

    /** @type {WatchlistOption[]} */
    let merged = built;
    try {
      const { data: mineRaw } = await fetchJsonCached({
        path: '/api/watchlists',
        auth: true,
        ttlMs: 2 * 60 * 1000,
        force: forceMine
      });
      const mine = Array.isArray(mineRaw) ? mineRaw : [];
      const userOpts = mine.map((wl) => ({
        key: 'usr:' + wl.id,
        watchlistId: String(wl.id),
        name: String(wl.name || 'Untitled').trim() || 'Untitled',
        kind: /** @type {'user'} */ ('user'),
        tickers: mapUserTickers(wl.tickers)
      }));
      merged = [...userOpts, ...built];
      setOptions(merged);
      if (userOpts.length + built.length > 0) setError('');
      setSelectedKey((prev) => {
        if (prev && merged.some((o) => o.key === prev)) return prev;
        if (userOpts[0]) return userOpts[0].key;
        if (built[0]) return built[0].key;
        return '';
      });
    } catch {
      merged = built;
      setOptions(merged);
      if (built.length > 0) setError('');
      setSelectedKey((prev) => {
        if (prev && built.some((o) => o.key === prev)) return prev;
        return built[0]?.key || '';
      });
    } finally {
      setLoading(false);
    }
    return merged;
  }, []);

  const userWatchlists = useMemo(() => options.filter((o) => o.kind === 'user'), [options]);

  const openCreatePanel = () => {
    setSettingsOpen(false);
    setCreateName('');
    setCreateTickers([]);
    setCreateErr('');
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

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

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

  return (
    <>
      <div className="wl-flyout__backdrop" aria-hidden onClick={onClose} />
      <div
        className="wl-flyout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wl-flyout-title"
      >
        <div className="wl-flyout__head">
          <h2 id="wl-flyout-title" className="wl-flyout__title">
            My Watchlists
          </h2>
          <div className="wl-flyout__head-actions" ref={settingsRef}>
            {selected?.kind === 'user' && selected?.watchlistId ? (
              <button
                type="button"
                className="wl-flyout__iconbtn"
                title="Add tickers to this watchlist"
                aria-label="Add tickers to this watchlist"
                onClick={openUpdateForSelectedUserList}
              >
                <IcoPlus className="wl-flyout__iconbtn-svg" />
              </button>
            ) : null}
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
            disabled={!options.length && !loading}
            onClick={() => setDdOpen((v) => !v)}
          >
            <IcoUserWatchlistSmall className="wl-flyout__select-ico" />
            <span className="wl-flyout__select-label">{loading ? 'Loading…' : selected?.name || '—'}</span>
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

        <div className="wl-flyout__table-wrap">
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
              {loading ? (
                <tr>
                  <td colSpan={3} className="wl-flyout__td-muted">
                    Loading…
                  </td>
                </tr>
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

      {managePanel === 'create' ? (
        <div
          className="wl-manage-overlay"
          role="presentation"
          onClick={(e) => e.target === e.currentTarget && closeManageUi()}
        >
          <div className="wl-manage-modal" role="dialog" aria-labelledby="wl-create-title">
            <div className="wl-manage-modal__head">
              <h3 id="wl-create-title" className="wl-manage-modal__title">
                Create watchlist
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
              <WatchlistTickerMultiselect
                idPrefix="wl-create"
                selected={createTickers}
                onChange={setCreateTickers}
                disabled={createBusy}
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
      ) : null}

      {managePanel === 'delete' ? (
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
      ) : null}

      {managePanel === 'update-pick' ? (
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
                      <button type="button" className="wl-manage-pick-row" onClick={() => beginUpdateEdit(o)}>
                        <span className="wl-manage-list__name">{o.name}</span>
                        <span className="wl-manage-muted">{o.tickers.length} ticker(s)</span>
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
      ) : null}

      {managePanel === 'update-edit' ? (
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
              <WatchlistTickerMultiselect
                idPrefix="wl-upd"
                selected={updateEditTickers}
                onChange={setUpdateEditTickers}
                disabled={updateBusy}
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
      ) : null}
    </>
  );
}
