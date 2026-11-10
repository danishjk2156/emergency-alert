import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import Icon from './Icon';
import Logo from './Logo';
import { MockNotice } from './PublicLayout';

const itemCls = ({ isActive }) =>
  `group relative flex min-h-[44px] items-center gap-3 rounded-md px-3 text-[13px] font-bold uppercase tracking-wide transition-all duration-200 ${
    isActive ? 'bg-brand text-white shadow-md' : 'text-white/75 hover:translate-x-0.5 hover:bg-white/10 hover:text-white'
  }`;

function NavItems() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      <NavLink to="/admin" end className={itemCls}>
        <Icon name="dashboard" className="h-[18px] w-[18px]" /> Dashboard
      </NavLink>
      <NavLink to="/admin/incidents" className={itemCls}>
        <Icon name="list" className="h-[18px] w-[18px]" /> Incidents
      </NavLink>
      <NavLink to="/admin/teams" className={itemCls}>
        <Icon name="users" className="h-[18px] w-[18px]" /> Response Teams
      </NavLink>
      <NavLink to="/admin/map" className={itemCls}>
        <Icon name="map" className="h-[18px] w-[18px]" /> Live Map
      </NavLink>
      <a href="/report" target="_blank" rel="noreferrer" className={itemCls({ isActive: false })}>
        <Icon name="plus" className="h-[18px] w-[18px]" /> New report
        <span className="sr-only">(opens in a new tab)</span>
        <Icon name="external" className="ml-auto h-3.5 w-3.5 opacity-60" />
      </a>
      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate('/admin/login', { replace: true });
        }}
        className={`${itemCls({ isActive: false })} mt-6 w-full text-left`}
      >
        <Icon name="logout" className="h-[18px] w-[18px]" /> Logout
      </button>
    </nav>
  );
}

/** Sidebar layout + admin-role guard for every /admin page. */
export default function AdminLayout() {
  const location = useLocation();
  const { user, isSignedIn, isAdmin } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  if (!isSignedIn || !isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search, notAdmin: isSignedIn && !isAdmin }} />;
  }

  return (
    <div className="min-h-screen bg-paper">
      <MockNotice />
      <header className="sticky top-0 z-30 flex items-center justify-between bg-charcoal px-4 py-2 shadow-md lg:hidden">
        <Logo light tagline="Command center" />
        <button
          type="button"
          className="grid h-10 w-10 place-items-center rounded-md text-white hover:bg-white/10"
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <Icon name={menuOpen ? 'x' : 'menu'} />
        </button>
      </header>
      {menuOpen && (
        <div id="admin-mobile-nav" className="animate-slide-down bg-charcoal px-3 pb-4 lg:hidden">
          <NavItems />
        </div>
      )}

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[240px_1fr]">
        <aside className="hidden border-r-4 border-brand bg-charcoal px-3 py-6 lg:block">
          <div className="sticky top-6">
            <div className="mb-8 px-2">
              <Logo light tagline="Command center" />
            </div>
            <NavItems />
            {user && (
              <div className="mt-10 rounded-md border border-charcoal-line bg-charcoal-light px-3 py-3 text-xs text-white/70">
                <p className="font-bold uppercase tracking-wider text-white/50">Signed in</p>
                <p className="mt-1 truncate font-bold text-white" title={user.email}>
                  {user.name || user.email}
                </p>
              </div>
            )}
          </div>
        </aside>
        <main key={location.pathname} className="min-w-0 animate-fade-in px-4 py-6 sm:px-6 lg:px-9 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
