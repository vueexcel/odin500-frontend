import { Outlet } from 'react-router-dom';
import { AppHeader } from './AppHeader.jsx';
import { SiteFooter } from './SiteFooter.jsx';

export function ProtectedLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <div className="flex w-full flex-1 flex-col">
        <Outlet />
      </div>
      <SiteFooter />
    </div>
  );
}
