import { Link, useNavigate } from 'react-router-dom';
import { TickerSymbolCombobox } from './TickerSymbolCombobox.jsx';
import odinLogo from '../assets/odin500-logo.svg';
import odinLogoLight from '../assets/odin500-logo-light.svg';

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

function IconMoon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconNavMenu() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 10H3M21 18H3M21 6H3M21 14H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Top strip inside the main column: ticker search + theme toggle.
 * On mobile: brand logo (left), search (center), theme + nav menu (right).
 */
export function AppMainTopBar({
  theme = 'dark',
  onToggleTheme,
  isMobile = false,
  mobileNavOpen = false,
  onToggleMobileNav = null
}) {
  const navigate = useNavigate();
  const isLight = theme === 'light';
  const brandLogo = isLight ? odinLogoLight : odinLogo;

  return (
    <header className={'app-main-topbar' + (isMobile ? ' app-main-topbar--mobile' : '')} role="banner">
      {isMobile ? (
        <Link to="/market" className="app-main-topbar__brand" aria-label="Odin500 home">
          <img src={brandLogo} alt="" className="app-main-topbar__logo" />
        </Link>
      ) : null}
      <div className="app-main-topbar__search">
        <TickerSymbolCombobox
          variant="header"
          symbol=""
          onSymbolChange={(sym) => navigate(`/ticker/${encodeURIComponent(sym)}`)}
          inputId="app-main-topbar-ticker-search"
        />
      </div>
      <div className="app-main-topbar__actions">
        <button
          type="button"
          className="app-main-topbar__theme"
          onClick={onToggleTheme}
          aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
          title={isLight ? 'Dark mode' : 'Light mode'}
        >
          <span className="app-main-topbar__theme-track">
            <span className="app-main-topbar__theme-knob">{isLight ? <IconSun /> : <IconMoon />}</span>
          </span>
        </button>
        {isMobile && typeof onToggleMobileNav === 'function' ? (
          <button
            type="button"
            className="app-main-topbar__nav"
            aria-label={mobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileNavOpen}
            aria-controls="app-sidebar-main"
            onClick={onToggleMobileNav}
          >
            <IconNavMenu />
          </button>
        ) : null}
      </div>
    </header>
  );
}
