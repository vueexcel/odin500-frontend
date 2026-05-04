import { useNavigate } from 'react-router-dom';
import { TickerSymbolCombobox } from './TickerSymbolCombobox.jsx';

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

/**
 * Top strip inside the main column (between left sidebar and right rail): ticker search + theme toggle.
 */
export function AppMainTopBar({ theme = 'dark', onToggleTheme }) {
  const navigate = useNavigate();
  const isLight = theme === 'light';

  return (
    <header className="app-main-topbar" role="banner">
      <div className="app-main-topbar__search">
        <TickerSymbolCombobox
          variant="header"
          symbol=""
          onSymbolChange={(sym) => navigate(`/ticker/${encodeURIComponent(sym)}`)}
          inputId="app-main-topbar-ticker-search"
        />
      </div>
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
    </header>
  );
}
