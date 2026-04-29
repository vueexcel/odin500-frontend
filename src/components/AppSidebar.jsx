import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SidebarToggleGlyph } from './SidebarToggleGlyph.jsx';
import odinLogo from '../assets/odin500-logo.svg';
import odinLogoLight from '../assets/odin500-logo-light.svg';

function IconGlobe() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 0 0 18M12 3a14 14 0 0 1 0 18" />
    </svg>
  );
}
function IconNews() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 5h12v12H4z" />
      <path d="M8 5V3h12v14h-2M8 9h8M8 13h5" />
    </svg>
  );
}
function IconFlame() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 3c-1 4-5 5-5 10a5 5 0 1 0 10 0c0-3-2-5-5-10z" />
    </svg>
  );
}
function IconPeople() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconFocus() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8V4h4M16 4h4v4M4 16v4h4M16 20h4v-4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}
function IconLineChart() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M3 18h18M4 14l4-4 4 4 6-8 3 3" />
    </svg>
  );
}
function IconWallet() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />
      <path d="M17 11h2a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-2" />
    </svg>
  );
}
function IconBriefcase() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8z" />
    </svg>
  );
}
function IconPie() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12 12V3a9 9 0 1 1-8.2 11" />
      <path d="M12 12h9a9 9 0 0 1-9 9v-9z" />
    </svg>
  );
}
function IconMonitor() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M5 20V10M12 20V4M19 20v-6" />
    </svg>
  );
}
function IconDocSearch() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 4h9a2 2 0 0 1 2 2v9M6 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <circle cx="17.5" cy="17.5" r="3.5" />
      <path d="M20 20l2 2" />
    </svg>
  );
}
function IconCamera() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function IconAnalyst() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20v-1a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v1M16 11l4 2v3" />
      <path d="M18 10v4" />
    </svg>
  );
}
function IconFinancial() {
  return (
    <svg className="app-sidebar__ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M6 4h12v16H6z" />
      <path d="M9 14l2-3 2 2 3-4" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg className="app-sidebar__search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function Sparkle() {
  return (
    <svg className="app-sidebar__sparkle" width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#facc15"
        d="M12 2l1.2 4.2L17 7l-3.8 2.8L15 14l-3-2.5L9 14l1.8-4.2L7 7l3.8-.8L12 2z"
      />
    </svg>
  );
}

function NavRow({ to, onClick, icon: Icon, label, badge, badgeTone, active = false }) {
  const content = (
    <>
      <span className="app-sidebar__row-icon">
        <Icon />
      </span>
      <span className="app-sidebar__row-label">{label}</span>
      {badge != null ? (
        <span className={'app-sidebar__badge app-sidebar__badge--' + (badgeTone || 'muted')}>{badge}</span>
      ) : null}
    </>
  );

  if (to) {
    return (
      <NavLink
        to={to}
        end={to === '/market'}
        className={({ isActive }) => 'app-sidebar__row' + (isActive || active ? ' app-sidebar__row--active' : '')}
        onClick={onClick}
      >
        {content}
      </NavLink>
    );
  }

  return (
    <button type="button" className="app-sidebar__row app-sidebar__row--btn app-sidebar__row--placeholder" onClick={onClick}>
      {content}
    </button>
  );
}

export function AppSidebar({ expanded, setExpanded, mobileOpen = false, onRequestClose = null }) {
  const navigate = useNavigate();
  const isExpandedView = expanded || mobileOpen;
  const location = useLocation();
  const tickerPathMatch = location.pathname.match(
    /^\/(?:ticker|ticker-annual|ticker-quarterly|ticker-monthly|ticker-weekly|ticker-daily)\/([^/?#]+)$/i
  );
  const activeTickerSymbol = tickerPathMatch?.[1] ? decodeURIComponent(tickerPathMatch[1]).trim().toUpperCase() : '';
  const tickerSuffix = activeTickerSymbol ? `/${encodeURIComponent(activeTickerSymbol)}` : '';
  const annualTo = `/ticker-annual${tickerSuffix}`;
  const quarterlyTo = `/ticker-quarterly${tickerSuffix}`;
  const monthlyTo = `/ticker-monthly${tickerSuffix}`;
  const weeklyTo = `/ticker-weekly${tickerSuffix}`;
  const dailyTo = `/ticker-daily${tickerSuffix}`;
  const statSection =
    location.pathname === '/statistic-data' ? new URLSearchParams(location.search).get('section') || '' : '';
  const annualPageActive = location.pathname.startsWith('/ticker-annual');
  const quarterlyPageActive = location.pathname.startsWith('/ticker-quarterly');
  const monthlyPageActive = location.pathname.startsWith('/ticker-monthly');
  const weeklyPageActive = location.pathname.startsWith('/ticker-weekly');
  const dailyPageActive = location.pathname.startsWith('/ticker-daily');

  const handleAnyClick = () => {
    if (mobileOpen && typeof onRequestClose === 'function') onRequestClose();
  };
  const handleNavClick = (event, to) => {
    // Keep browser affordances (new tab, middle click) intact.
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    handleAnyClick();
    event.preventDefault();
    navigate(to);
  };

  return (
    <aside
      id="app-sidebar-main"
      className={
        'app-sidebar ' +
        (isExpandedView ? 'app-sidebar--expanded' : 'app-sidebar--collapsed') +
        (mobileOpen ? ' app-sidebar--mobile-open app-sidebar--expanded' : '')
      }
      aria-label="Main navigation"
    >
      {!isExpandedView ? (
        <div className="app-sidebar__collapsed-only">
          <button
            type="button"
            className="app-sidebar__toggle app-sidebar__toggle--fab"
            aria-expanded="false"
            aria-label="Open navigation menu"
            onClick={() => setExpanded(true)}
          >
            <SidebarToggleGlyph expanded={false} />
          </button>
        </div>
      ) : (
        <>
          <div className="app-sidebar__topbar">
            <div className="app-sidebar__brand">
              <img src={odinLogoLight} alt="Odin500" className="app-sidebar__logo" />
            </div>
            <button
              type="button"
              className="app-sidebar__toggle app-sidebar__toggle--inline"
              aria-expanded="true"
              aria-label="Close navigation menu"
              onClick={() => setExpanded(false)}
            >
              <SidebarToggleGlyph expanded />
            </button>
          </div>

          <div className="app-sidebar__scroll">
            <nav className="app-sidebar__nav" aria-label="Markets">
              <NavRow to="/market" icon={IconGlobe} label="Markets" onClick={(e) => handleNavClick(e, '/market')} />
              <NavRow icon={IconGrid} label="Default Screen" onClick={() => {}} />
              <NavRow to="/indices/dow-jones" icon={IconLineChart} label="Dow Jones" onClick={(e) => handleNavClick(e, '/indices/dow-jones')} />
              <NavRow to="/indices/nasdaq-100" icon={IconLineChart} label="Nasdaq-100" onClick={(e) => handleNavClick(e, '/indices/nasdaq-100')} />
              <NavRow to="/indices/sp500" icon={IconLineChart} label="SP 500" onClick={(e) => handleNavClick(e, '/indices/sp500')} />
              <NavRow to="/news" icon={IconNews} label="News" onClick={(e) => handleNavClick(e, '/news')} />
              <NavRow to="/market-movers" icon={IconFlame} label="Market Movers" onClick={(e) => handleNavClick(e, '/market-movers')} />
              <NavRow to="/heatmap" icon={IconGrid} label="Heatmaps" onClick={(e) => handleNavClick(e, '/heatmap')} />
            </nav>

            <div className="app-sidebar__section-label">pages</div>
            <nav className="app-sidebar__nav" aria-label="Page">
              <NavRow to="/ticker" icon={IconPeople} label="Tickers" onClick={(e) => handleNavClick(e, '/ticker')} />
            </nav>

            <div className="app-sidebar__section-label">Statistics</div>
            <nav className="app-sidebar__nav" aria-label="Statistics">
              <NavRow to={annualTo} icon={IconBarChart} label="Annual" active={annualPageActive} onClick={(e) => handleNavClick(e, annualTo)} />
              <NavRow
                to={quarterlyTo}
                icon={IconBarChart}
                label="Quarterly"
                active={quarterlyPageActive || statSection === 'quarterly'}
                onClick={(e) => handleNavClick(e, quarterlyTo)}
              />
              <NavRow to={monthlyTo} icon={IconBarChart} label="Monthly" active={monthlyPageActive || statSection === 'monthly'} onClick={(e) => handleNavClick(e, monthlyTo)} />
              <NavRow to={weeklyTo} icon={IconBarChart} label="Weekly" active={weeklyPageActive || statSection === 'weekly'} onClick={(e) => handleNavClick(e, weeklyTo)} />
              <NavRow to={dailyTo} icon={IconBarChart} label="Daily" active={dailyPageActive || statSection === 'daily'} onClick={(e) => handleNavClick(e, dailyTo)} />
              <NavRow icon={IconLineChart} label="Relative strength" onClick={() => {}} />
              <NavRow icon={IconFocus} label="Odin Index Signals" onClick={() => {}} />
              <NavRow to="/odin-signals" icon={IconFocus} label="Odin Signals" onClick={(e) => handleNavClick(e, '/odin-signals')} />
              <NavRow icon={IconWallet} label="Sample Odin Portfolios" onClick={() => {}} />
              <NavRow icon={IconMonitor} label="Odin Signals Performance" onClick={() => {}} />
            </nav>

            <div className="app-sidebar__section-label">Data</div>
            <nav className="app-sidebar__nav" aria-label="Data">
              <NavRow to="/historical-data" icon={IconDocSearch} label="Historical data" onClick={(e) => handleNavClick(e, '/historical-data')} />
              <NavRow icon={IconLineChart} label="Returns" onClick={() => {}} />
              <NavRow to="/statistic-data" icon={IconCamera} label="Statistic Table" onClick={(e) => handleNavClick(e, '/statistic-data')} />
            </nav>

            <div className="app-sidebar__section-label">Premium</div>
            <nav className="app-sidebar__nav" aria-label="Premium">
              <NavRow icon={IconBriefcase} label="Premium" onClick={() => {}} />
            </nav>
          </div>
        </>
      )}
    </aside>
  );
}
