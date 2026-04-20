import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NewsRailFlyout } from './NewsRailFlyout.jsx';
import { WatchlistRailFlyout } from './WatchlistRailFlyout.jsx';

/**
 * Fixed narrow right rail (Figma): always visible, not expandable.
 */
function IcoUser() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="10" r="2.75" fill="currentColor" />
      <path
        d="M6.5 18.5c.8-2.2 2.6-3.5 5.5-3.5s4.7 1.3 5.5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoAnalytics() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="9" r="2.5" fill="currentColor" />
      <path
        d="M4.5 19c.6-1.8 2-3 3.5-3s2.9 1.2 3.5 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <rect x="13" y="5" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M15 14l2-3 2 2 2-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 4l2 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IcoNews() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M18 6h2a2 2 0 0 1 2 2v11a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 9h6M8 12h6M8 15h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="14" y="9" width="2.5" height="2.5" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function IcoFlame() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3c-1.2 3.5-4 4.5-4 9a4 4 0 1 0 8 0c0-3-1.5-4.5-2.5-6.5-.5-1-1-1.8-1.5-2.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 14c-.8 1.2-1 2.2-1 3a2 2 0 1 0 4 0c0-.6-.3-1.4-1-2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IcoBell() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        stroke="currentColor"
        d="M15 17h5l-1.4-1.4A2 2 0 0 0 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 0 .6 1.4L6 17h5m6 0v1a3 3 0 1 1-6 0v-1"
      />
    </svg>
  );
}

function IcoOdinSignals() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M7 15l3-3 2 2 5-5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="15" r="1" fill="currentColor" />
      <circle cx="10" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="14" r="1" fill="currentColor" />
      <circle cx="17" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}

export function AppRightRail({ mobileOpen = false, onRequestClose = null }) {
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);

  const closeAll = () => {
    setWatchlistOpen(false);
    setNewsOpen(false);
    if (typeof onRequestClose === 'function') onRequestClose();
  };

  const toggleWatchlist = () => {
    if (mobileOpen) {
      closeAll();
      return;
    }
    setNewsOpen(false);
    setWatchlistOpen((o) => !o);
  };

  const toggleNews = () => {
    if (mobileOpen) {
      closeAll();
      return;
    }
    setWatchlistOpen(false);
    setNewsOpen((o) => !o);
  };

  return (
    <>
      <WatchlistRailFlyout open={watchlistOpen} onClose={() => setWatchlistOpen(false)} />
      <NewsRailFlyout open={newsOpen} onClose={() => setNewsOpen(false)} />
      <aside className={'app-right-rail' + (mobileOpen ? ' app-right-rail--mobile-open' : '')} aria-label="Quick navigation">
        <div className="app-right-rail__stack">
          <button
            type="button"
            className="app-right-rail__btn"
            title="User Silhouette"
            aria-label="User Silhouette"
            onClick={() => {
              if (mobileOpen) closeAll();
            }}
          >
            <IcoUser />
          </button>
          <button
            type="button"
            className={'app-right-rail__btn' + (watchlistOpen ? ' app-right-rail__btn--active' : '')}
            title="Watch Lists"
            aria-label="Watch Lists"
            aria-expanded={watchlistOpen}
            onClick={toggleWatchlist}
          >
            <IcoAnalytics />
          </button>
          <Link
            to="/odin-signals"
            className="app-right-rail__btn"
            title="Odin Signals"
            aria-label="Odin Signals"
            onClick={() => {
              closeAll();
            }}
          >
            <IcoOdinSignals />
          </Link>
          <Link
            to="/market-movers"
            className="app-right-rail__btn"
            title="Market Movers"
            aria-label="Market Movers"
            onClick={() => {
              closeAll();
            }}
          >
            <IcoFlame />
          </Link>
          <button
            type="button"
            className={'app-right-rail__btn' + (newsOpen ? ' app-right-rail__btn--active' : '')}
            title="Top news"
            aria-label="Top news"
            aria-expanded={newsOpen}
            onClick={toggleNews}
          >
            <IcoNews />
          </button>
          <button
            type="button"
            className="app-right-rail__btn"
            title="[Alerts]"
            aria-label="[Alerts]"
            onClick={() => {
              if (mobileOpen) closeAll();
            }}
          >
            <IcoBell />
          </button>
        </div>
      </aside>
    </>
  );
}
