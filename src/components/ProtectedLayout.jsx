import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { warmWatchlistDefaults } from '../hooks/useWatchlistDefaults.js';
// import { AppHeader } from './AppHeader.jsx';
import { AppSidebar } from './AppSidebar.jsx';
import { AppRightRail } from './AppRightRail.jsx';
import { SiteFooter } from './SiteFooter.jsx';
import { useSitewideSeo } from '../seo/usePageSeo.js';

export function ProtectedLayout() {
  useSitewideSeo();
  const location = useLocation();
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
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
      if (!getAuthToken()) return;
      const ttlMs = 2 * 60 * 1000;
      void Promise.all([
        warmWatchlistDefaults(ttlMs),
        fetchJsonCached({ path: '/api/watchlists', auth: true, ttlMs })
      ]).catch(() => {});
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
    if (!isMobile) return;
    setMobileLeftOpen(false);
  }, [location.pathname, location.search, isMobile]);

  return (
    <div className="app-shell">
      {/* <AppHeader compact theme={theme} onToggleTheme={toggleTheme} /> */}
      <div className="app-body">
        {isMobile && (mobileLeftOpen || mobileRightOpen) ? (
          <button
            type="button"
            className="app-mobile-overlay-backdrop"
            aria-label="Close side panels"
            onClick={() => {
              setMobileLeftOpen(false);
              setMobileRightOpen(false);
            }}
          />
        ) : null}
        <AppSidebar
          expanded={sidebarExpanded}
          setExpanded={setSidebarExpanded}
          mobileOpen={isMobile && mobileLeftOpen}
          onRequestClose={() => setMobileLeftOpen(false)}
        />
        <div className="app-main-column">
          <div className="app-main-scroll">
            <Outlet />
            <SiteFooter />
          </div>
        </div>
        <AppRightRail mobileOpen={isMobile && mobileRightOpen} onRequestClose={() => setMobileRightOpen(false)} />
        {isMobile ? (
          <>
            <button
              type="button"
              className="app-mobile-fab app-mobile-fab--left app-mobile-fab--nav"
              aria-label={mobileLeftOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileLeftOpen}
              aria-controls="app-sidebar-main"
              onClick={() => {
                setMobileRightOpen(false);
                setMobileLeftOpen((v) => !v);
              }}
            >
              <span className="app-mobile-fab__nav-ico" aria-hidden>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {mobileLeftOpen ? (
                    <path d="M6 6l12 12M18 6L6 18" />
                  ) : (
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  )}
                </svg>
              </span>
            </button>
            <button
              type="button"
              className="app-mobile-fab app-mobile-fab--right"
              aria-label="Open quick tools"
              onClick={() => {
                setMobileLeftOpen(false);
                setMobileRightOpen((v) => !v);
              }}
            >
              <span className="app-mobile-fab__dots" aria-hidden>⋮</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

