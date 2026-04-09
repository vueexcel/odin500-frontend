import { NavLink, useNavigate } from 'react-router-dom';
import odinLogo from '../assets/odin500-logo.svg';
import { clearApiCache, clearAuthToken } from '../store/apiStore.js';

const NAV_ITEMS = [
  { to: '/market', label: 'Market' },
  { to: '/tickers', label: 'Tickers' },
  { to: '/odin-signals', label: 'Odin Signals' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/premium', label: 'Premium' },
  { to: '/about', label: 'About' }
];

export function AppHeader() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    clearAuthToken();
    clearApiCache();
    navigate('/login', { replace: true });
  };

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
