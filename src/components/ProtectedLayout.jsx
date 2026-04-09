import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader.jsx';
import { AppSidebar } from './AppSidebar.jsx';
import { AppRightRail } from './AppRightRail.jsx';
import { SiteFooter } from './SiteFooter.jsx';

export function ProtectedLayout() {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  return (
    <div className="app-shell">
      <AppHeader compact />
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

