import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** @typedef {'watchlist' | 'news' | 'market-movers'} RightRailDockPanel */

/**
 * @typedef {{
 *   activePanel: RightRailDockPanel | null;
 *   isDockOpen: boolean;
 *   openWatchlist: () => void;
 *   toggleWatchlist: () => void;
 *   toggleNews: () => void;
 *   toggleMarketMovers: () => void;
 *   close: () => void;
 * }} RightRailDockValue */

const WatchlistDockContext = /** @type {import('react').Context<RightRailDockValue | null>} */ (createContext(null));

export function WatchlistDockProvider({ children }) {
  const [activePanel, setActivePanel] = useState(/** @type {RightRailDockPanel | null} */ (null));
  const location = useLocation();
  const navigate = useNavigate();

  const close = useCallback(() => {
    try {
      sessionStorage.removeItem('ticker_open_watchlist');
    } catch {
      /* ignore */
    }
    setActivePanel(null);
  }, []);

  const openWatchlist = useCallback(() => setActivePanel('watchlist'), []);

  const toggleWatchlist = useCallback(() => {
    setActivePanel((p) => (p === 'watchlist' ? null : 'watchlist'));
  }, []);

  const toggleNews = useCallback(() => {
    setActivePanel((p) => (p === 'news' ? null : 'news'));
  }, []);

  const toggleMarketMovers = useCallback(() => {
    setActivePanel((p) => (p === 'market-movers' ? null : 'market-movers'));
  }, []);

  useEffect(() => {
    const onOpen = () => setActivePanel('watchlist');
    window.addEventListener('ticker:open-watchlist', onOpen);
    return () => window.removeEventListener('ticker:open-watchlist', onOpen);
  }, []);

  useEffect(() => {
    const st = location.state && /** @type {{ openWatchlist?: boolean }} */ (location.state).openWatchlist;
    if (!st) return;
    setActivePanel('watchlist');
    const rest = { ...(location.state || {}) };
    delete rest.openWatchlist;
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: Object.keys(rest).length ? rest : undefined }
    );
  }, [location.state, location.pathname, location.search, location.hash, navigate]);

  const isDockOpen = activePanel !== null;

  const value = useMemo(
    () => ({
      activePanel,
      isDockOpen,
      openWatchlist,
      toggleWatchlist,
      toggleNews,
      toggleMarketMovers,
      close
    }),
    [activePanel, openWatchlist, toggleWatchlist, toggleNews, toggleMarketMovers, close]
  );

  return <WatchlistDockContext.Provider value={value}>{children}</WatchlistDockContext.Provider>;
}

export function useRightRailDock() {
  const ctx = useContext(WatchlistDockContext);
  if (!ctx) {
    throw new Error('useRightRailDock must be used within WatchlistDockProvider');
  }
  return ctx;
}

/** @typedef {{ isOpen: boolean, open: () => void, close: () => void, toggle: () => void }} WatchlistDockCompat */

export function useWatchlistDock() {
  const d = useRightRailDock();
  return useMemo(
    () => ({
      isOpen: d.activePanel === 'watchlist',
      open: d.openWatchlist,
      close: d.close,
      toggle: d.toggleWatchlist
    }),
    [d.activePanel, d.openWatchlist, d.close, d.toggleWatchlist]
  );
}

/**
 * When true, returns charts and related toolbars use the single “Filters” trigger; the
 * panel holds dropdowns and actions. Always true so desktop matches narrow/docked layouts.
 */
export function useReturnsChartFiltersMenuMode() {
  return true;
}
