import { useState, useRef, useEffect } from 'react';

export function TickerSearch({ value, onChange, allTickers, onInvalidateOdin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, []);

  function filterMenu(q) {
    const upper = String(q || '').trim().toUpperCase();
    const matches = upper
      ? allTickers.filter((s) => s.indexOf(upper) !== -1).slice(0, 60)
      : allTickers.slice(0, 30);
    setFiltered(matches);
  }

  return (
    <div className="field">
      <label htmlFor="tickerInput">Ticker (searchable)</label>
      <div className="ticker-search-wrap" ref={wrapRef}>
        <input
          id="tickerInput"
          type="text"
          value={value}
          placeholder="Type symbol e.g. AAPL"
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value);
            onInvalidateOdin();
            filterMenu(e.target.value);
            setMenuOpen(true);
          }}
          onFocus={() => {
            filterMenu(value);
            setMenuOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setMenuOpen(false);
              return;
            }
            if (e.key === 'Enter' && filtered.length > 0) {
              e.preventDefault();
              onChange(filtered[0]);
              setMenuOpen(false);
              onInvalidateOdin();
            }
          }}
        />
        <div className={'ticker-menu' + (menuOpen ? '' : ' hidden')}>
          {!filtered.length ? (
            <div className="ticker-empty">No tickers found</div>
          ) : (
            filtered.map((sym) => (
              <button
                key={sym}
                type="button"
                className="ticker-option"
                onClick={() => {
                  onChange(sym);
                  setMenuOpen(false);
                  onInvalidateOdin();
                }}
              >
                {sym}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
