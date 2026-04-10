import { NavLink, useNavigate } from 'react-router-dom';
import odinLogo from '../assets/odin500-logo.svg';
import { clearApiCache, clearAuthToken } from '../store/apiStore.js';

const NAV_ITEMS = [
  { to: '/market', label: 'Market' },
  { to: '/tickers', label: 'Tickers' },
  { to: '/heatmap', label: 'Heatmap' },
  { to: '/odin-signals', label: 'Odin Signals' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/premium', label: 'Premium' },
  { to: '/about', label: 'About' }
];

function IconSearchInset() {
  return (
    <svg className="header-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l-1.5-1.5M20.5 20.5 19 19M19 5l1.5-1.5M5 19l-1.5 1.5"
      />
    </svg>
  );
}

export function AppHeader({ compact = false }) {
  const navigate = useNavigate();

  const handleSignOut = () => {
    clearAuthToken();
    clearApiCache();
    navigate('/login', { replace: true });
  };

  if (compact) {
    return (
      <header className="app-header app-header--figma app-header--compact">
        <div className="app-header-top-accent" aria-hidden />
        <div className="app-header-inner app-header-inner--figma">
          <div className="app-header-left-figma">
            <NavLink to="/market" className="app-header-wordmark-link" title="Odin500 home">
              <img src={odinLogo} alt="Odin500" className="app-header-logo-img" />
            </NavLink>
          </div>

          <nav className="app-header-nav-figma" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/market'}
                className={({ isActive }) =>
                  'app-header-nav-link' + (isActive ? ' app-header-nav-link--active' : '')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="app-header-utilities">
            <div className="header-search-field">
              <input className="header-search-input" type="search" placeholder="Search" aria-label="Search" />
              <button type="button" className="header-search-icon-btn" aria-label="Submit search">
                <IconSearchInset />
              </button>
            </div>
            <button type="button" className="header-avatar-btn" aria-label="Account">
              <span className="header-avatar-placeholder" />
            </button>
            <button type="button" className="header-bell-btn" aria-label="Notifications">
              <IconBell />
              <span className="header-bell-badge">3</span>
            </button>
            <button type="button" className="header-theme-switch" aria-label="Toggle theme" title="Theme">
              <span className="header-theme-switch-track">
                <span className="header-theme-switch-thumb">
                  <IconSun />
                </span>
              </span>
            </button>
            <button type="button" className="header-signout-ghost" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="brand">
          <img src={odinLogo} alt="Odin500" className="brand-logo" />
        </div>

        <nav className="main-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 'main-nav-link' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <input className="header-search" type="text" placeholder="Search" />
          <button type="button" className="btn-secondary header-signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
