import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJsonCached } from '../store/apiStore.js';

/**
 * @typedef {{ symbol: string, companyName: string, last: number | null, pctFraction: number | null }} WatchlistTickerRow
 * @typedef {{ key: string, name: string, kind: 'user' | 'default', tickers: WatchlistTickerRow[] }} WatchlistOption
 */

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

  const load = useCallback(async () => {
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

    try {
      const { data: mineRaw } = await fetchJsonCached({
        path: '/api/watchlists',
        auth: true,
        ttlMs: 2 * 60 * 1000
      });
      const mine = Array.isArray(mineRaw) ? mineRaw : [];
      const userOpts = mine.map((wl) => ({
        key: 'usr:' + wl.id,
        name: String(wl.name || 'Untitled').trim() || 'Untitled',
        kind: /** @type {'user'} */ ('user'),
        tickers: mapUserTickers(wl.tickers)
      }));
      setOptions([...userOpts, ...built]);
      if (userOpts.length + built.length > 0) setError('');
      setSelectedKey((prev) => {
        if (prev && [...userOpts, ...built].some((o) => o.key === prev)) return prev;
        if (userOpts[0]) return userOpts[0].key;
        if (built[0]) return built[0].key;
        return '';
      });
    } catch {
      setOptions(built);
      if (built.length > 0) setError('');
      setSelectedKey((prev) => {
        if (prev && built.some((o) => o.key === prev)) return prev;
        return built[0]?.key || '';
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

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
          <div className="wl-flyout__head-actions">
            <button type="button" className="wl-flyout__iconbtn" title="Watchlist settings" aria-label="Settings">
              <IcoGear className="wl-flyout__iconbtn-svg" />
            </button>
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
                  <td colSpan={3} className="wl-flyout__td-muted">
                    No tickers in this list.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.symbol}>
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
    </>
  );
}
