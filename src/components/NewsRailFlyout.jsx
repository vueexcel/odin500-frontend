import { useEffect, useMemo } from 'react';
import { useGeneralNewsFeed } from '../hooks/useGeneralNewsFeed.js';

function IcoClose({ className }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

const MAX_HEADLINES = 24;

/**
 * Slide-out panel (same shell as watchlist) with scrollable general trading news from Finnhub.
 * @param {{ open: boolean, onClose: () => void }} props
 */
export function NewsRailFlyout({ open, onClose }) {
  const { busy, error, items } = useGeneralNewsFeed();

  const headlines = useMemo(() => items.slice(0, MAX_HEADLINES), [items]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="wl-flyout__backdrop" aria-hidden onClick={onClose} />
      <div
        className="wl-flyout rail-news-flyout"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rail-news-flyout-title"
      >
        <div className="wl-flyout__head">
          <h2 id="rail-news-flyout-title" className="wl-flyout__title">
            Top news
          </h2>
          <button type="button" className="wl-flyout__iconbtn" onClick={onClose} title="Close" aria-label="Close">
            <IcoClose className="wl-flyout__iconbtn-svg" />
          </button>
        </div>

        <p className="rail-news-flyout__hint">General trading headlines · updates every 30s</p>

        {error ? <p className="wl-flyout__err rail-news-flyout__err">{error}</p> : null}

        <div className="rail-news-flyout__scroll" aria-busy={busy}>
          {busy && headlines.length === 0 ? (
            <p className="rail-news-flyout__placeholder">Loading headlines…</p>
          ) : null}

          {!busy && headlines.length === 0 && !error ? (
            <p className="rail-news-flyout__placeholder">No headlines yet.</p>
          ) : null}

          <ul className="rail-news-flyout__list">
            {headlines.map((n) => (
              <li key={n.id} className="rail-news-flyout__item">
                <a
                  href={n.url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rail-news-flyout__link"
                >
                  {n.headline || n.title}
                </a>
                <div className="rail-news-flyout__meta">
                  <span className="rail-news-flyout__source">{n.source}</span>
                  <span className="rail-news-flyout__time">{n.time}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
