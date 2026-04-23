import { useEffect, useRef, useState } from 'react';
import { TICKER_SEARCH_DEBOUNCE_MS } from '../config/tickerSearch.js';
import { fetchJsonCached } from '../store/apiStore.js';
import { sanitizeTickerPageInput } from '../utils/tickerUrlSync.js';

export function TickerSymbolCombobox({
  symbol,
  onSymbolChange,
  inputId = 'ticker-page-symbol-input',
  placeholder = 'Search ticker (e.g. NVDA)'
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
    const q = sanitizeTickerPageInput(input);
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
  }, [input, open]);

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
        const q = sanitizeTickerPageInput(input);
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
      const q = sanitizeTickerPageInput(input);
      if (!q) return;
      const exact = items.find((it) => String(it.symbol || '').toUpperCase() === q);
      if (exact) pick(exact);
      else if (items.length === 1) pick(items[0]);
      else {
        onSymbolChange(q);
        setInput(q);
        setOpen(false);
        setHighlight(-1);
      }
    }
  }

  const qActive = sanitizeTickerPageInput(input);

  return (
    <div className="ticker-symbol-search" ref={wrapRef}>
      <input
        id={inputId}
        className="ticker-symbol-search__input"
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-label="Ticker symbol"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        value={input}
        onChange={(e) => {
          setInput(sanitizeTickerPageInput(e.target.value));
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
      {open && qActive ? (
        <div
          id={listId}
          className="ticker-symbol-search__dropdown"
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
              return (
                <button
                  key={sym ? sym + '-' + idx : 'row-' + idx}
                  type="button"
                  role="option"
                  aria-selected={idx === highlight}
                  className={
                    'ticker-symbol-search__item' +
                    (idx === highlight ? ' ticker-symbol-search__item--active' : '')
                  }
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(row)}
                >
                  {sym}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
