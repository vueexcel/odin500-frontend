import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { fetchJsonCached, getAuthToken, isAuthDisabled } from '../store/apiStore.js';
import { warmWatchlistDefaults } from '../hooks/useWatchlistDefaults.js';
import { LoginGateProvider } from '../context/LoginGateContext.jsx';
import { WatchlistDockProvider, useRightRailDock } from '../context/WatchlistDockContext.jsx';
import { AppMainTopBar } from './AppMainTopBar.jsx';
import { AppSidebar } from './AppSidebar.jsx';
import { AppRightRail } from './AppRightRail.jsx';
import { WatchlistRailFlyout } from './WatchlistRailFlyout.jsx';
import { NewsRailFlyout } from './NewsRailFlyout.jsx';
import { MarketMoversRailFlyout } from './MarketMoversRailFlyout.jsx';
import { useSitewideSeo } from '../seo/usePageSeo.js';

function ProtectedLayoutShell() {
  useSitewideSeo();
  const location = useLocation();
  const { activePanel, isDockOpen, close: closeRightDock } = useRightRailDock();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 900;
  });
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('odin_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });
  const mainScrollRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('odin_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    const warmWatchlistCache = () => {
      const ttlMs = 2 * 60 * 1000;
      const tasks = [warmWatchlistDefaults(ttlMs)];
      if (getAuthToken()) {
        tasks.push(fetchJsonCached({ path: '/api/watchlists', auth: true, ttlMs }));
      } else if (!isAuthDisabled()) {
        return;
      }
      void Promise.all(tasks).catch(() => {});
    };
    warmWatchlistCache();
    window.addEventListener('odin-auth-updated', warmWatchlistCache);
    return () => window.removeEventListener('odin-auth-updated', warmWatchlistCache);
  }, []);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (isMobile && sidebarExpanded) {
      setSidebarExpanded(false);
    }
    if (!isMobile) {
      setMobileLeftOpen(false);
      setMobileRightOpen(false);
    }
  }, [isMobile, sidebarExpanded]);

  useEffect(() => {
    const scroller = mainScrollRef.current;
    if (scroller) scroller.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  const toggleTheme = () => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  const closeMobileOverlays = () => {
    setMobileLeftOpen(false);
    setMobileRightOpen(false);
  };

  return (
    <div className="app-shell">
      <div className="app-body">
        {isMobile && (mobileLeftOpen || mobileRightOpen || isDockOpen) ? (
          <button
            type="button"
            className="app-mobile-overlay-backdrop"
            aria-label="Close side panels"
            onClick={() => {
              closeMobileOverlays();
              if (isDockOpen) closeRightDock();
            }}
          />
        ) : null}
        <AppSidebar
          expanded={sidebarExpanded}
          setExpanded={setSidebarExpanded}
          mobileOpen={isMobile && mobileLeftOpen}
          onRequestClose={() => setMobileLeftOpen(false)}
        />
        <div className={'app-main-column' + (isDockOpen ? ' app-main-column--watchlist-open' : '')}>
          <AppMainTopBar
            theme={theme}
            onToggleTheme={toggleTheme}
            isMobile={isMobile}
            mobileNavOpen={mobileLeftOpen}
            onToggleMobileNav={() => {
              setMobileRightOpen(false);
              setMobileLeftOpen((v) => !v);
            }}
          />
          <div className="app-main-after-topbar">
            <div className="app-main-scroll" ref={mainScrollRef}>
              <Outlet />
            </div>
            {isDockOpen && isMobile ? (
              <button
                type="button"
                className="app-watchlist-dock-backdrop"
                aria-label="Close panel"
                onClick={closeRightDock}
              />
            ) : null}
            {activePanel === 'watchlist' ? (
              <aside className="app-watchlist-dock is-open" aria-label="Watchlist sidebar">
                <WatchlistRailFlyout open onClose={closeRightDock} docked />
              </aside>
            ) : null}
            {activePanel === 'news' ? (
              <aside className="app-watchlist-dock is-open" aria-label="Top news">
                <NewsRailFlyout open onClose={closeRightDock} docked />
              </aside>
            ) : null}
            {activePanel === 'market-movers' ? (
              <aside className="app-watchlist-dock is-open" aria-label="Market movers">
                <MarketMoversRailFlyout open onClose={closeRightDock} docked />
              </aside>
            ) : null}
          </div>
        </div>
        <AppRightRail mobileOpen={isMobile && mobileRightOpen} onRequestClose={() => setMobileRightOpen(false)} />
      </div>
    </div>
  );
}

export function ProtectedLayout() {
  return (
    <LoginGateProvider>
      <WatchlistDockProvider>
        <ProtectedLayoutShell />
      </WatchlistDockProvider>
    </LoginGateProvider>
  );
}
