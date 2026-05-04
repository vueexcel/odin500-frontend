import { useEffect, useRef, useState } from 'react';
import { TICKER_SEARCH_DEBOUNCE_MS } from '../config/tickerSearch.js';
import { fetchJsonCached } from '../store/apiStore.js';
import { sanitizeTickerPageInput, sanitizeTickerSearchInput } from '../utils/tickerUrlSync.js';

function IconSearchLeading() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Normalize input for API query (symbol-only vs name/symbol search). */
function queryForSearch(variant, input) {
  if (variant === 'header') return sanitizeTickerSearchInput(input).trim();
  return sanitizeTickerPageInput(input);
}

export function TickerSymbolCombobox({
  symbol,
  onSymbolChange,
  inputId = 'ticker-page-symbol-input',
  placeholder = 'Search ticker (e.g. NVDA)',
  variant = 'default'
}) {
  const [input, setInput] = useState(symbol);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef(null);
  const listId = useRef('ticker-search-listbox-' + Math.random().toString(36).slice(2)).current;

  useEffect(() => {
    setInput(symbol);
  }, [symbol]);

  useEffect(() => {
    setHighlight((h) => (items.length === 0 ? -1 : h >= 0 && h < items.length ? h : 0));
  }, [items]);

  useEffect(() => {
    if (!open) return;
    const q = queryForSearch(variant, input);
    if (!q) {
      setItems([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await fetchJsonCached({
          path: '/api/tickers/search?q=' + encodeURIComponent(q),
          method: 'GET',
          ttlMs: 15 * 60 * 1000
        });
        if (cancelled) return;
        setItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, TICKER_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [input, open, variant]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setHighlight(-1);
        setInput(symbol);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, symbol]);

  function pick(row) {
    const sym = String(row.symbol || '')
      .toUpperCase()
      .trim();
    if (!sym) return;
    onSymbolChange(sym);
    setInput(sym);
    setOpen(false);
    setHighlight(-1);
    setItems([]);
  }

  function onKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown') {
        const q = queryForSearch(variant, input);
        if (q) setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setInput(symbol);
      setHighlight(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => (h < 0 ? 0 : Math.min(items.length - 1, h + 1)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length === 0) return;
      setHighlight((h) => Math.max(0, (h < 0 ? 0 : h) - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight >= 0 && items[highlight]) {
        pick(items[highlight]);
        return;
      }
      const q = queryForSearch(variant, input);
      if (!q) return;
      const symToken = sanitizeTickerPageInput(q);
      if (!symToken) return;
      const exact = items.find((it) => String(it.symbol || '').toUpperCase() === symToken);
      if (exact) pick(exact);
      else if (items.length === 1) pick(items[0]);
      else {
        onSymbolChange(symToken);
        setInput(symToken);
        setOpen(false);
        setHighlight(-1);
      }
    }
  }

  const qActive = queryForSearch(variant, input);
  const isHeader = variant === 'header';
  /* Header: only --header class so base .ticker-symbol-search__input (28px / padding) never applies. */
  const inputClass = isHeader ? 'ticker-symbol-search__input--header' : 'ticker-symbol-search__input';
  const inputAria = isHeader ? 'Search tickers by symbol or company name' : 'Ticker symbol';

  const onInputChange = (e) => {
    const v = isHeader ? sanitizeTickerSearchInput(e.target.value) : sanitizeTickerPageInput(e.target.value);
    setInput(v);
    setOpen(true);
  };

  return (
    <div
      className={'ticker-symbol-search' + (isHeader ? ' ticker-symbol-search--header' : '')}
      ref={wrapRef}
    >
      {isHeader ? (
        <div className="ticker-symbol-search__shell">
          <span className="ticker-symbol-search__leading" aria-hidden>
            <IconSearchLeading />
          </span>
          <input
            id={inputId}
            className={inputClass}
            type="text"
            autoComplete="off"
            spellCheck={false}
            aria-label={inputAria}
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            value={input}
            onChange={onInputChange}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
          />
        </div>
      ) : (
        <input
          id={inputId}
          className={inputClass}
          type="text"
          autoComplete="off"
          spellCheck={false}
          aria-label={inputAria}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          value={input}
          onChange={onInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
        />
      )}
      {open && qActive ? (
        <div
          id={listId}
          className={
            'ticker-symbol-search__dropdown' +
            (isHeader ? ' ticker-symbol-search__dropdown--header' : '')
          }
          role="listbox"
          aria-label="Ticker matches"
        >
          {loading ? (
            <div className="ticker-symbol-search__status">Searching…</div>
          ) : items.length === 0 ? (
            <div className="ticker-symbol-search__status">No matches</div>
          ) : (
            items.map((row, idx) => {
              const sym = String(row.symbol || '').toUpperCase();
              const co = row.company_name ? String(row.company_name) : '';
              return (
                <button
                  key={sym ? sym + '-' + idx : 'row-' + idx}
                  type="button"
                  role="option"
                  aria-selected={idx === highlight}
                  className={
                    'ticker-symbol-search__item' +
                    (isHeader ? ' ticker-symbol-search__item--header' : '') +
                    (idx === highlight ? ' ticker-symbol-search__item--active' : '')
                  }
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row)}
                >
                  {isHeader && co ? (
                    <span className="ticker-symbol-search__item-text">
                      <span className="ticker-symbol-search__sym">{sym}</span>
                      <span className="ticker-symbol-search__co">{co}</span>
                    </span>
                  ) : (
                    sym
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
