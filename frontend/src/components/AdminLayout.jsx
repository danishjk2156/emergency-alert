import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { USER_KEY, clearSession, getToken } from '../api';
import Logo from './Logo';
import { MockNotice } from './PublicLayout';

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

const itemCls = ({ isActive }) =>
  `flex min-h-[42px] items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors ${
    isActive ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
  }`;

function NavItems({ onNavigate }) {
  const navigate = useNavigate();
  const logout = () => {
    clearSession();
    navigate('/admin/login', { replace: true });
  };
  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      <NavLink to="/admin" end className={itemCls} onClick={onNavigate}>
        <span aria-hidden="true">▦</span> Dashboard
      </NavLink>
      <NavLink to="/admin/incidents" className={itemCls} onClick={onNavigate}>
        <span aria-hidden="true">☰</span> Incidents
      </NavLink>
      <a href="/report" target="_blank" rel="noreferrer" className={itemCls({ isActive: false })}>
        <span aria-hidden="true">＋</span> New report <span className="sr-only">(opens in a new tab)</span>
        <span aria-hidden="true" className="ml-auto text-xs opacity-60">
          ↗
        </span>
      </a>
      <button type="button" onClick={logout} className={`${itemCls({ isActive: false })} mt-6 w-full text-left`}>
        <span aria-hidden="true">⎋</span> Logout
      </button>
    </nav>
  );
}

/** Sidebar layout + auth guard for every /admin page. */
export default function AdminLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!getToken()) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
  }
  const user = readUser();

  return (
    <div className="min-h-screen bg-slate-100">
      <MockNotice />
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-2 lg:hidden">
        <Logo suffix="Command" light />
        <button
          type="button"
          className="btn border-navy-line bg-navy-light text-white hover:bg-navy-line"
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-nav"
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? '✕ Close' : '☰ Menu'}
        </button>
      </header>
      {menuOpen && (
        <div id="admin-mobile-nav" className="bg-navy px-3 pb-4 lg:hidden">
          <NavItems onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[220px_1fr]">
        <aside className="hidden bg-navy px-3 py-5 lg:block">
          <div className="sticky top-5">
            <div className="mb-6 px-2">
              <Logo suffix="Command" light />
            </div>
            <NavItems />
            {user?.email && (
              <p className="mt-8 truncate px-3 text-xs text-slate-400" title={user.email}>
                Signed in as {user.name || user.email}
              </p>
            )}
          </div>
        </aside>
        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
