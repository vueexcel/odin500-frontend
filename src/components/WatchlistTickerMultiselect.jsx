import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TICKER_SEARCH_DEBOUNCE_MS } from '../config/tickerSearch.js';
import {
  fetchTickerSearchLive,
  normalizeTickerSearchRows,
  resolveTickerSymbols
} from '../store/apiStore.js';
import { sanitizeTickerSearchInput } from '../utils/tickerUrlSync.js';

const LOG_PREFIX = '[WatchlistTickerSearch]';

function dbg(...args) {
  if (import.meta.env.DEV) console.log(LOG_PREFIX, ...args);
}

function activeTokenFromQuery(rawQuery) {
  const raw = String(rawQuery || '');
  const parts = raw.split(',');
  const lastPart = parts.length ? parts[parts.length - 1] : raw;
  return sanitizeTickerSearchInput(lastPart);
}

function IconClear() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * @typedef {{ id: string, symbol: string, company_name?: string | null }} WatchlistTickerPick
 */

/**
 * Searchable list with checkboxes for building a ticker set (watchlist create/update).
 * Dropdown is portaled to document.body with fixed positioning so it is not clipped by modal overflow.
 * Uses a dedicated uncached fetch so stale sessionStorage/API cache cannot show permanent "No matches".
 * @param {{
 *   idPrefix: string,
 *   selected: WatchlistTickerPick[],
 *   onChange: (next: WatchlistTickerPick[]) => void,
 *   disabled?: boolean,
 *   placeholder?: string,
 *   footerCancelLabel?: string,
 *   footerSubmitLabel?: string,
 *   onFooterCancel?: () => void,
 *   onFooterSubmit?: () => void,
 * }} props
 */
export function WatchlistTickerMultiselect({
  idPrefix,
  selected,
  onChange,
  disabled = false,
  placeholder = 'Search symbol or company…',
  footerCancelLabel = 'Cancel',
  footerSubmitLabel = 'Submit',
  onFooterCancel,
  onFooterSubmit
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(/** @type {WatchlistTickerPick[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [ddRect, setDdRect] = useState(/** @type {{ top: number, left: number, width: number, maxHeight: number } | null} */ (null));

  const wrapRef = useRef(null);
  const anchorRef = useRef(null);
  const dropdownRef = useRef(null);

  const selectedById = useMemo(() => new Map(selected.map((t) => [String(t.id), t])), [selected]);

  // Search is driven by the token after the last comma:
  // "A,msft" -> query API with "msft", "A,msft,nvda" -> "nvda".
  const qNorm = useMemo(() => activeTokenFromQuery(query), [query]);

  useLayoutEffect(() => {
    if (!open) {
      setDdRect(null);
      return;
    }
    function measure() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const spaceBelow = vh - r.bottom - 8;
      const spaceAbove = r.top - 8;
      const preferBelow = spaceBelow >= 160 || spaceBelow >= spaceAbove;
      const maxH = Math.min(320, Math.max(120, preferBelow ? spaceBelow - 4 : spaceAbove - 4));
      if (preferBelow) {
        setDdRect({
          top: r.bottom + 4,
          left: r.left,
          width: Math.max(r.width, 200),
          maxHeight: maxH
        });
      } else {
        setDdRect({
          top: Math.max(8, r.top - maxH - 4),
          left: r.left,
          width: Math.max(r.width, 200),
          maxHeight: maxH
        });
      }
    }
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [open, query, results.length, loading, selected.length]);

  useEffect(() => {
    if (!open) return;
    if (!qNorm) {
      setResults([]);
      setLoading(false);
      setSearchErr('');
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      setLoading(true);
      setSearchErr('');
      dbg('fetch start', { qNorm });
      try {
        const raw = await fetchTickerSearchLive(qNorm);
        if (cancelled) return;
        dbg('search raw sample', Array.isArray(raw) ? raw[0] : raw);

        let mapped = normalizeTickerSearchRows(raw).filter((r) => r.symbol);
        const missingSyms = [
          ...new Set(mapped.filter((r) => !r.id).map((r) => r.symbol.toUpperCase()))
        ];
        if (missingSyms.length > 0) {
          try {
            const idMap = await resolveTickerSymbols(missingSyms);
            if (cancelled) return;
            mapped = mapped.map((r) => {
              if (r.id) return r;
              const hit = idMap.get(r.symbol.toUpperCase());
              if (!hit) return r;
              return {
                id: hit.id,
                symbol: r.symbol,
                company_name: r.company_name || hit.company_name || ''
              };
            });
            dbg('after POST /api/tickers/resolve', {
              requested: missingSyms.length,
              resolved: mapped.filter((x) => x.id).length
            });
          } catch (e) {
            dbg('resolve failed', e?.message || e);
          }
        }

        const withId = mapped.filter((r) => r.id);
        dbg('rows for dropdown', { total: mapped.length, withId: withId.length });
        setResults(withId);
      } catch (e) {
        if (!cancelled) {
          dbg('fetch error', e?.message || e);
          setResults([]);
          setSearchErr(e?.message || 'Search failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, TICKER_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [qNorm, open]);

  const closeDropdownOnly = useCallback(() => {
    setOpen(false);
  }, []);

  const handleFooterCancel = useCallback(() => {
    if (onFooterCancel) {
      setOpen(false);
      setQuery('');
      requestAnimationFrame(() => {
        const inp = anchorRef.current?.querySelector('input');
        if (inp instanceof HTMLInputElement) inp.blur();
        onFooterCancel();
      });
    } else {
      closeDropdownOnly();
    }
  }, [onFooterCancel, closeDropdownOnly]);

  const handleFooterSubmit = useCallback(() => {
    setOpen(false);
    setQuery('');
    requestAnimationFrame(() => {
      const inp = anchorRef.current?.querySelector('input');
      if (inp instanceof HTMLInputElement) inp.blur();
      if (onFooterSubmit) onFooterSubmit();
    });
  }, [onFooterSubmit]);

  /** Close when clicking outside the anchor + portaled menu (reliable `contains` check). */
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e) {
      if (e.button !== 0 && e.button !== undefined) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (wrapRef.current?.contains(t) || dropdownRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [open]);

  function toggleRow(row) {
    const id = String(row.id);
    if (!id) return;
    if (selectedById.has(id)) {
      onChange(selected.filter((t) => String(t.id) !== id));
    } else {
      onChange([
        ...selected,
        { id, symbol: row.symbol, company_name: row.company_name || '' }
      ]);
    }
  }

  function removeChip(id) {
    onChange(selected.filter((t) => String(t.id) !== String(id)));
  }

  const mergedRows = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const r of results) {
      const id = String(r.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
    for (const t of selected) {
      const id = String(t.id);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        symbol: t.symbol,
        company_name: t.company_name || ''
      });
    }
    return out;
  }, [results, selected]);

  const inputId = idPrefix + '-search';
  const showDropdown = open && (qNorm.length > 0 || mergedRows.length > 0);
  const dropdownNode =
    showDropdown && ddRect
      ? createPortal(
          <div
            ref={dropdownRef}
            id={idPrefix + '-dropdown-root'}
            className="wl-ticker-ms__dropdown wl-ticker-ms__dropdown--portal"
            role="presentation"
            style={{
              position: 'fixed',
              top: ddRect.top,
              left: ddRect.left,
              width: ddRect.width,
              maxHeight: ddRect.maxHeight,
              zIndex: 450
            }}
          >
            <div className="wl-ticker-ms__dropdown-scroll" role="listbox" aria-label="Ticker search results">
              {loading ? (
                <div className="wl-ticker-ms__status">Searching…</div>
              ) : searchErr ? (
                <div className="wl-ticker-ms__status wl-ticker-ms__status--err">{searchErr}</div>
              ) : !qNorm && mergedRows.length === 0 ? (
                <div className="wl-ticker-ms__status">Type to search symbols or companies</div>
              ) : mergedRows.length === 0 ? (
                <div className="wl-ticker-ms__status">No matches</div>
              ) : (
                <ul className="wl-ticker-ms__list">
                  {mergedRows.map((row) => {
                    const checked = selectedById.has(String(row.id));
                    return (
                      <li key={row.id} className="wl-ticker-ms__item">
                        <label className="wl-ticker-ms__row">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleRow(row)}
                          />
                          <span className="wl-ticker-ms__row-text">
                            <span className="wl-ticker-ms__sym">{row.symbol}</span>
                            {row.company_name ? (
                              <span className="wl-ticker-ms__co">{row.company_name}</span>
                            ) : null}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="wl-ticker-ms__dropdown-foot" role="group" aria-label="Search actions">
              <button
                type="button"
                className="wl-ticker-ms__foot-btn wl-ticker-ms__foot-btn--ghost"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFooterCancel();
                }}
              >
                {footerCancelLabel}
              </button>
              <button
                type="button"
                className="wl-ticker-ms__foot-btn wl-ticker-ms__foot-btn--primary"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleFooterSubmit();
                }}
              >
                {footerSubmitLabel}
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="wl-ticker-ms" ref={wrapRef} id={idPrefix + '-ms-wrap'}>
      <label className="wl-ticker-ms__label" htmlFor={inputId}>
        Tickers
      </label>
      {selected.length > 0 ? (
        <div className="wl-ticker-ms__chips">
          {selected.map((t) => (
            <span key={t.id} className="wl-ticker-ms__chip">
              <span className="wl-ticker-ms__chip-sym">{t.symbol}</span>
              <button
                type="button"
                className="wl-ticker-ms__chip-x"
                disabled={disabled}
                onClick={() => removeChip(t.id)}
                aria-label={'Remove ' + t.symbol}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="wl-ticker-ms__field-wrap" ref={anchorRef}>
        <input
          id={inputId}
          type="text"
          className="wl-ticker-ms__input"
          autoComplete="off"
          placeholder={placeholder}
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {query ? (
          <button
            type="button"
            className="wl-ticker-ms__clear"
            aria-label="Clear ticker search"
            title="Clear"
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery('');
              setOpen(false);
              setResults([]);
              setSearchErr('');
            }}
          >
            <IconClear />
          </button>
        ) : null}
      </div>
      {dropdownNode}
    </div>
  );
}
