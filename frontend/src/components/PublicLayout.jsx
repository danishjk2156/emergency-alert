import { Link, NavLink, Outlet } from 'react-router-dom';
import { USE_MOCK } from '../api';
import Logo from './Logo';

const linkCls = ({ isActive }) =>
  `inline-flex min-h-[40px] items-center rounded-lg px-3 text-sm font-semibold transition-colors ${
    isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-900'
  }`;

export function MockNotice() {
  if (!USE_MOCK) return null;
  return (
    <div className="bg-slate-900 px-4 py-1 text-center text-xs font-medium text-slate-300">
      Demo mode: sample data stored in this browser, no backend calls.
    </div>
  );
}

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-white">
      <MockNotice />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link to="/report" aria-label="ResQNet home" className="rounded-lg">
            <Logo />
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            <NavLink to="/report" className={linkCls}>
              Report
            </NavLink>
            <NavLink to="/track" className={linkCls}>
              Track
            </NavLink>
            <NavLink to="/admin" className={linkCls}>
              Admin
            </NavLink>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
