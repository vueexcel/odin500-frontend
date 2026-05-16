import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLoginGateOptional } from './LoginGateContext.jsx';

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
  const loginGate = useLoginGateOptional();

  const gateWatchlist = useCallback(
    (action) => {
      if (loginGate) return loginGate.requireLogin(action);
      if (typeof action === 'function') action();
      return true;
    },
    [loginGate]
  );

  const close = useCallback(() => {
    try {
      sessionStorage.removeItem('ticker_open_watchlist');
      sessionStorage.removeItem('watchlist_add_symbol');
    } catch {
      /* ignore */
    }
    setActivePanel(null);
  }, []);

  const openWatchlist = useCallback(() => {
    gateWatchlist(() => setActivePanel('watchlist'));
  }, [gateWatchlist]);

  const toggleWatchlist = useCallback(() => {
    gateWatchlist(() => setActivePanel((p) => (p === 'watchlist' ? null : 'watchlist')));
  }, [gateWatchlist]);

  const toggleNews = useCallback(() => {
    setActivePanel((p) => (p === 'news' ? null : 'news'));
  }, []);

  const toggleMarketMovers = useCallback(() => {
    setActivePanel((p) => (p === 'market-movers' ? null : 'market-movers'));
  }, []);

  useEffect(() => {
    const onOpen = () => gateWatchlist(() => setActivePanel('watchlist'));
    window.addEventListener('ticker:open-watchlist', onOpen);
    return () => window.removeEventListener('ticker:open-watchlist', onOpen);
  }, [gateWatchlist]);

  useEffect(() => {
    const st = location.state && /** @type {{ openWatchlist?: boolean }} */ (location.state).openWatchlist;
    if (!st) return;
    gateWatchlist(() => setActivePanel('watchlist'));
    const rest = { ...(location.state || {}) };
    delete rest.openWatchlist;
    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      { replace: true, state: Object.keys(rest).length ? rest : undefined }
    );
  }, [location.state, location.pathname, location.search, location.hash, navigate, gateWatchlist]);

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
