import { NavLink } from 'react-router-dom';
import { SidebarToggleGlyph } from './SidebarToggleGlyph.jsx';
import odinLogo from '../assets/odin500-logo.svg';

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

function NavRow({ to, onClick, icon: Icon, label, badge, badgeTone }) {
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
        className={({ isActive }) => 'app-sidebar__row' + (isActive ? ' app-sidebar__row--active' : '')}
      >
        {content}
      </NavLink>
    );
  }

  return (
    <button type="button" className="app-sidebar__row app-sidebar__row--btn" onClick={onClick}>
      {content}
    </button>
  );
}

export function AppSidebar({ expanded, setExpanded }) {
  return (
    <aside
      id="app-sidebar-main"
      className={'app-sidebar ' + (expanded ? 'app-sidebar--expanded' : 'app-sidebar--collapsed')}
      aria-label="Main navigation"
    >
      {!expanded ? (
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
              <img src={odinLogo} alt="Odin500" className="app-sidebar__logo" />
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
              <NavRow to="/market" icon={IconGlobe} label={"Today's Markets"} badge="NOW" badgeTone="blue" />
              <NavRow icon={IconNews} label="Market News" badge="TOP" onClick={() => {}} />
              <NavRow icon={IconFlame} label="Market Movers" badge="MOV" onClick={() => {}} />
              <NavRow icon={IconPeople} label="My Watchlists" badge="MYW" onClick={() => {}} />
              <NavRow icon={IconFocus} label="My Screens" badge="MYS" onClick={() => {}} />
              <button type="button" className="app-sidebar__row app-sidebar__row--btn app-sidebar__row--new">
                <span className="app-sidebar__row-icon">
                  <IconLineChart />
                </span>
                <span className="app-sidebar__row-label">My Graphs</span>
                <span className="app-sidebar__badge app-sidebar__badge--pill-new">
                  <Sparkle />
                  <span>New</span>
                </span>
              </button>
            </nav>

            <div className="app-sidebar__section-label">Portfolio tools</div>
            <nav className="app-sidebar__nav" aria-label="Portfolio">
              <NavRow icon={IconWallet} label="My Portfolio" badge="MYP" onClick={() => {}} />
              <NavRow icon={IconBriefcase} label="Client Portfolios" badge="CP" onClick={() => {}} />
              <NavRow icon={IconPie} label="Model Portfolios" badge="MP" onClick={() => {}} />
            </nav>

            <div className="app-sidebar__section-label">Dashboards</div>
            <nav className="app-sidebar__nav" aria-label="Dashboards">
              <NavRow icon={IconMonitor} label="My Dashboards" onClick={() => {}} />
              <NavRow icon={IconGrid} label="Market Dashboards" onClick={() => {}} />
              <NavRow to="/odin-signals" icon={IconBarChart} label="Analytics" />
              <NavRow to="/heatmap" icon={IconGrid} label="Heatmap" />
              <NavRow icon={IconDocSearch} label="Advanced Search" onClick={() => {}} />
            </nav>

            <div className="app-sidebar__section-label">Security analysis</div>
            <button type="button" className="app-sidebar__search-card" onClick={() => {}}>
              <div className="app-sidebar__search-card-text">
                <span className="app-sidebar__search-ticker">TSLA</span>
                <span className="app-sidebar__search-name">Tesla, Inc.</span>
              </div>
              <IconSearch />
            </button>
            <nav className="app-sidebar__nav" aria-label="Security analysis">
              <NavRow icon={IconCamera} label="Snapshots" onClick={() => {}} />
              <NavRow icon={IconAnalyst} label="Analyst Estimates" onClick={() => {}} />
              <NavRow icon={IconFinancial} label="Financial Analysis" onClick={() => {}} />
            </nav>
          </div>
        </>
      )}
    </aside>
  );
}
