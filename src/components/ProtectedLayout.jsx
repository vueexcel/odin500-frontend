import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { fetchJsonCached, getAuthToken } from '../store/apiStore.js';
import { warmWatchlistDefaults } from '../hooks/useWatchlistDefaults.js';
import { AppHeader } from './AppHeader.jsx';
import { AppSidebar } from './AppSidebar.jsx';
import { AppRightRail } from './AppRightRail.jsx';
import { SiteFooter } from './SiteFooter.jsx';

export function ProtectedLayout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
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

  const toggleTheme = () => {
    setTheme((curr) => (curr === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="app-shell">
      <AppHeader compact theme={theme} onToggleTheme={toggleTheme} />
      <div className="app-body">
        <AppSidebar expanded={sidebarExpanded} setExpanded={setSidebarExpanded} />
        <div className="app-main-column">
          <div className="app-main-scroll">
            <Outlet />
            <SiteFooter />
          </div>
        </div>
        <AppRightRail />
      </div>
    </div>
  );
}

