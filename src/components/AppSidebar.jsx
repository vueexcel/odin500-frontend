import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SidebarToggleGlyph } from './SidebarToggleGlyph.jsx';
import odinLogo from '../assets/odin500-logo.svg';
import odinLogoLight from '../assets/odin500-logo-light.svg';
import { useHeaderProfile } from '../hooks/useHeaderProfile.js';
import { getDocumentTheme, subscribeDocumentTheme } from '../utils/documentTheme.js';
import { prefetchRouteChunks } from '../utils/routePrefetch.js';
import { DEFAULT_TICKER_ROUTE_SYMBOL, isMainTickerRoutePath } from '../utils/tickerUrlSync.js';

function IconGlobe() {
  return (
    <svg
      className="app-sidebar__ico"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 9L14.5515 13.6061C14.3555 13.746 14.2576 13.816 14.1527 13.8371C14.0602 13.8557 13.9643 13.8478 13.8762 13.8142C13.7762 13.7762 13.691 13.691 13.5208 13.5208L10.4792 10.4792C10.309 10.309 10.2238 10.2238 10.1238 10.1858C10.0357 10.1522 9.9398 10.1443 9.84732 10.1629C9.74241 10.184 9.64445 10.254 9.44853 10.3939L3 15M7.8 21H16.2C17.8802 21 18.7202 21 19.362 20.673C19.9265 20.3854 20.3854 19.9265 20.673 19.362C21 18.7202 21 17.8802 21 16.2V7.8C21 6.11984 21 5.27976 20.673 4.63803C20.3854 4.07354 19.9265 3.6146 19.362 3.32698C18.7202 3 17.8802 3 16.2 3H7.8C6.11984 3 5.27976 3 4.63803 3.32698C4.07354 3.6146 3.6146 4.07354 3.32698 4.63803C3 5.27976 3 6.11984 3 7.8V16.2C3 17.8802 3 18.7202 3.32698 19.362C3.6146 19.9265 4.07354 20.3854 4.63803 20.673C5.27976 21 6.11984 21 7.8 21Z" />
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
function IconChevronRight() {
  return (
    <svg className="app-sidebar__account-chevron-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
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
    const warm = () => prefetchRouteChunks(to);
    return (
      <NavLink
        to={to}
        end={to === '/market'}
        className={({ isActive }) => 'app-sidebar__row' + (isActive || active ? ' app-sidebar__row--active' : '')}
        onClick={onClick}
        onMouseEnter={warm}
        onFocus={warm}
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
  const [theme, setTheme] = useState(() => getDocumentTheme());
  const { profileName, initials, avatarUrl } = useHeaderProfile({
    guestLabel: 'Guest',
    signedInFallback: 'Account'
  });
  const accountWrapRef = useRef(null);
  const tickerPathMatch =
    location.pathname.match(/^\/ticker\/([^/?#]+)$/i) ||
    location.pathname.match(
      /^\/statistic\/ticker-(?:annual|quarterly|monthly|weekly|daily)\/([^/?#]+)$/i
    );
  const activeTickerSymbol = tickerPathMatch?.[1] ? decodeURIComponent(tickerPathMatch[1]).trim().toUpperCase() : '';
  const tickerSuffix = activeTickerSymbol
    ? `/${encodeURIComponent(activeTickerSymbol)}`
    : `/${encodeURIComponent(DEFAULT_TICKER_ROUTE_SYMBOL)}`;
  const annualTo = `/statistic/ticker-annual${tickerSuffix}`;
  const quarterlyTo = `/statistic/ticker-quarterly${tickerSuffix}`;
  const monthlyTo = `/statistic/ticker-monthly${tickerSuffix}`;
  const weeklyTo = `/statistic/ticker-weekly${tickerSuffix}`;
  const dailyTo = `/statistic/ticker-daily${tickerSuffix}`;
  const statSection =
    location.pathname === '/statistic-data' ? new URLSearchParams(location.search).get('section') || '' : '';
  const annualPageActive = location.pathname.startsWith('/statistic/ticker-annual');
  const quarterlyPageActive = location.pathname.startsWith('/statistic/ticker-quarterly');
  const monthlyPageActive = location.pathname.startsWith('/statistic/ticker-monthly');
  const weeklyPageActive = location.pathname.startsWith('/statistic/ticker-weekly');
  const dailyPageActive = location.pathname.startsWith('/statistic/ticker-daily');
  const isStatsRoute =
    annualPageActive || quarterlyPageActive || monthlyPageActive || weeklyPageActive || dailyPageActive || location.pathname === '/statistic-data';
  const isIndicesRoute = location.pathname.startsWith('/indices');
  const isSectorDataRoute = location.pathname.startsWith('/sector-data');
  const [indicesOpen, setIndicesOpen] = useState(isIndicesRoute);
  const [statsOpen, setStatsOpen] = useState(isStatsRoute);

  const brandLogo = theme === 'light' ? odinLogoLight : odinLogo;

  useEffect(() => {
    if (isIndicesRoute) setIndicesOpen(true);
  }, [isIndicesRoute]);

  useEffect(() => {
    if (isStatsRoute) setStatsOpen(true);
  }, [isStatsRoute]);

  useEffect(() => {
    setTheme(getDocumentTheme());
    return subscribeDocumentTheme(() => {
      setTheme(getDocumentTheme());
    });
  }, []);

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
          <button
            type="button"
            className="app-sidebar__account-btn app-sidebar__account-btn--collapsed"
            aria-label="Open account page"
            title="Account"
            onClick={() => navigate('/accounts')}
            onMouseEnter={() => prefetchRouteChunks('/accounts')}
            onFocus={() => prefetchRouteChunks('/accounts')}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="header-avatar-image" aria-hidden />
            ) : (
              <span className="header-avatar-placeholder">{initials}</span>
            )}
          </button>
        </div>
      ) : (
        <>
          <div className="app-sidebar__topbar">
            <div className="app-sidebar__brand">
              <img src={brandLogo} alt="Odin500" className="app-sidebar__logo" />
            </div>
            <button
              type="button"
              className="app-sidebar__toggle app-sidebar__toggle--inline"
              aria-expanded="true"
              aria-label="Close navigation menu"
              onClick={() => {
                if (mobileOpen && typeof onRequestClose === 'function') onRequestClose();
                else setExpanded(false);
              }}
            >
              <SidebarToggleGlyph expanded />
            </button>
          </div>

          <div className="app-sidebar__scroll">
            <nav className="app-sidebar__nav" aria-label="Markets">
              <NavRow to="/market" icon={IconGlobe} label="Markets" />
              <div
                className={
                  'app-sidebar__row app-sidebar__row--indices app-sidebar__row--indices-split' +
                  (isIndicesRoute ? ' app-sidebar__row--active' : '')
                }
                role="group"
                aria-label="Indices"
                onMouseEnter={() => prefetchRouteChunks('/indices/dow-jones')}
              >
                <button
                  type="button"
                  className="app-sidebar__indices-main"
                  onClick={() => {
                    navigate('/indices/dow-jones');
                    setIndicesOpen(true);
                  }}
                  onFocus={() => prefetchRouteChunks('/indices/dow-jones')}
                  title="Open Dow Jones index (opens menu)"
                >
                  <span className="app-sidebar__row-icon">
                    <IconGrid />
                  </span>
                  <span className="app-sidebar__row-label">Indices</span>
                </button>
                <button
                  type="button"
                  className="app-sidebar__indices-chevron-btn"
                  aria-expanded={indicesOpen}
                  aria-controls="app-sidebar-indices-options"
                  aria-label={indicesOpen ? 'Collapse indices submenu' : 'Expand indices submenu'}
                  onClick={() => setIndicesOpen((v) => !v)}
                >
                  <span
                    className={'app-sidebar__indices-chevron' + (indicesOpen ? ' app-sidebar__indices-chevron--open' : '')}
                    aria-hidden
                  >
                    <IconChevronRight />
                  </span>
                </button>
              </div>
              {indicesOpen ? (
                <div id="app-sidebar-indices-options" className="app-sidebar__subnav" role="group" aria-label="Indices options">
                  <NavRow to="/indices/dow-jones" icon={IconLineChart} label="Dow Jones" />
                  <NavRow to="/indices/nasdaq-100" icon={IconLineChart} label="Nasdaq-100" />
                  <NavRow to="/indices/sp500" icon={IconLineChart} label="SP 500" />
                </div>
              ) : null}
              <NavRow to="/news" icon={IconNews} label="News" />
              <NavRow to="/market-movers" icon={IconFlame} label="Market Movers" />
              <NavRow to="/heatmap" icon={IconGrid} label="Heatmaps" />
              <NavRow
                to="/sector-data/xlk"
                icon={IconPie}
                label="Sector Data"
                active={isSectorDataRoute}
              />
            </nav>

            
            <nav className="app-sidebar__nav" aria-label="Page">
              <NavRow
                to={`/ticker/${DEFAULT_TICKER_ROUTE_SYMBOL}`}
                icon={IconPeople}
                label="Tickers"
                active={isMainTickerRoutePath(location.pathname)}
              />
            </nav>

            <nav className="app-sidebar__nav" aria-label="Statistics">
              <button
                type="button"
                className={'app-sidebar__row app-sidebar__row--btn app-sidebar__row--stats' + (isStatsRoute ? ' app-sidebar__row--active' : '')}
                aria-expanded={statsOpen}
                aria-controls="app-sidebar-stats-options"
                onClick={() => {
                  setStatsOpen((wasOpen) => {
                    const nextOpen = !wasOpen;
                    if (nextOpen) navigate(annualTo);
                    return nextOpen;
                  });
                }}
                onMouseEnter={() => {
                  prefetchRouteChunks(annualTo);
                  prefetchRouteChunks(quarterlyTo);
                  prefetchRouteChunks(monthlyTo);
                  prefetchRouteChunks(weeklyTo);
                  prefetchRouteChunks(dailyTo);
                }}
                onFocus={() => {
                  prefetchRouteChunks(annualTo);
                  prefetchRouteChunks(quarterlyTo);
                  prefetchRouteChunks(monthlyTo);
                  prefetchRouteChunks(weeklyTo);
                  prefetchRouteChunks(dailyTo);
                }}
              >
                <span className="app-sidebar__row-icon">
                  <IconBarChart />
                </span>
                <span className="app-sidebar__row-label">Statistics</span>
                <span className={'app-sidebar__indices-chevron' + (statsOpen ? ' app-sidebar__indices-chevron--open' : '')} aria-hidden>
                  <IconChevronRight />
                </span>
              </button>
              {statsOpen ? (
                <div id="app-sidebar-stats-options" className="app-sidebar__subnav" role="group" aria-label="Statistics options">
                  <NavRow to={annualTo} icon={IconBarChart} label="Annual" active={annualPageActive} />
                  <NavRow
                    to={quarterlyTo}
                    icon={IconBarChart}
                    label="Quarterly"
                    active={quarterlyPageActive || statSection === 'quarterly'}
                  />
                  <NavRow to={monthlyTo} icon={IconBarChart} label="Monthly" active={monthlyPageActive || statSection === 'monthly'} />
                  <NavRow to={weeklyTo} icon={IconBarChart} label="Weekly" active={weeklyPageActive || statSection === 'weekly'} />
                  <NavRow to={dailyTo} icon={IconBarChart} label="Daily" active={dailyPageActive || statSection === 'daily'} />
                </div>
              ) : null}
              <NavRow to="/relative-strength/ticker" icon={IconLineChart} label="Relative strength" />
              {/* <NavRow icon={IconFocus} label="Odin Index Signals" onClick={() => {}} /> */}
              {/* <NavRow to="/odin-signals" icon={IconFocus} label="Odin Signals" /> */}
              {/* <NavRow icon={IconWallet} label="Sample Odin Portfolios" onClick={() => {}} />
              <NavRow icon={IconMonitor} label="Odin Signals Performance" onClick={() => {}} /> */}
            </nav>

            <div className="app-sidebar__section-label">Data</div>
            <nav className="app-sidebar__nav" aria-label="Data">
              <NavRow to="/historical-data" icon={IconDocSearch} label="Historical data" />
              {/* <NavRow icon={IconLineChart} label="Returns" onClick={() => {}} /> */}
              {/* <NavRow to="/statistic-data" icon={IconCamera} label="Statistic Table" /> */}
            </nav>

            {/* <div className="app-sidebar__section-label">Premium</div>
            <nav className="app-sidebar__nav" aria-label="Premium">
              <NavRow to="/premium" icon={IconBriefcase} label="Premium" />
            </nav> */}
          </div>
          <div className="app-sidebar__footer" ref={accountWrapRef}>
            <button
              type="button"
              className="app-sidebar__account-btn"
              aria-label="Open account page"
              onClick={() => navigate('/accounts')}
              onMouseEnter={() => prefetchRouteChunks('/accounts')}
              onFocus={() => prefetchRouteChunks('/accounts')}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="header-avatar-image" aria-hidden />
              ) : (
                <span className="header-avatar-placeholder">{initials}</span>
              )}
              <span className="app-sidebar__account-label">Account</span>
              <span className="app-sidebar__account-chevron" aria-hidden>
                <IconChevronRight />
              </span>
            </button>
          </div>
        </>
      )}
    </aside>
  );
}
