import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { USE_MOCK } from '../api';
import { useAuth } from '../auth';
import Icon from './Icon';
import Logo from './Logo';
import { useToast } from './Toast';

export function MockNotice() {
  if (!USE_MOCK) return null;
  return (
    <div className="bg-charcoal-dark px-4 py-1.5 text-center text-xs font-medium text-white/75">
      Demo mode: sample data stored in this browser. Citizen demo: priya@example.com / priya1234
    </div>
  );
}

const navCls = ({ isActive }) =>
  `relative flex h-full items-center px-4 text-[13px] font-bold uppercase tracking-wide transition-colors duration-200 ${
    isActive ? 'bg-brand text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
  }`;

function ContactItem({ icon, label, value, href }) {
  return (
    <a href={href} className="group flex items-center gap-2.5 rounded-md py-1 text-[13px] text-ink-2 transition-colors hover:text-brand">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110">
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="leading-tight">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-ink-3">{label}</span>
        <span className="font-bold text-ink">{value}</span>
      </span>
    </a>
  );
}

function AccountArea({ onDone }) {
  const { user, isSignedIn, isAdmin, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  if (!isSignedIn) {
    return (
      <NavLink to="/login" className={navCls} onClick={onDone}>
        <Icon name="login" className="mr-2 h-4 w-4" /> Sign in
      </NavLink>
    );
  }
  return (
    <>
      <NavLink to={isAdmin ? '/admin' : '/account'} className={navCls} onClick={onDone}>
        <Icon name={isAdmin ? 'dashboard' : 'user'} className="mr-2 h-4 w-4" />
        <span className="max-w-[140px] truncate">{isAdmin ? 'Command center' : user?.name?.split(' ')[0] || 'My reports'}</span>
      </NavLink>
      <button
        type="button"
        className="flex h-full items-center px-4 text-[13px] font-bold uppercase tracking-wide text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        onClick={async () => {
          onDone?.();
          await logout();
          toast('Signed out');
          navigate('/report');
        }}
      >
        <Icon name="logout" className="mr-2 h-4 w-4" /> Sign out
      </button>
    </>
  );
}

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <MockNotice />

      {/* Utility bar */}
      <div className="bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link to="/report" aria-label="ResQNet home" className="rounded-md">
            <Logo />
          </Link>
          <div className="hidden items-center gap-7 md:flex">
            <ContactItem icon="phone" label="Emergency" value="Call 112" href="tel:112" />
            <ContactItem icon="mail" label="Support" value="help@resqnet.in" href="mailto:help@resqnet.in" />
            <ContactItem icon="radar" label="Already reported?" value="Track status" href="/track" />
          </div>
          <a href="tel:112" className="btn btn-primary md:hidden" aria-label="Call 112">
            <Icon name="phone" className="h-4 w-4" /> 112
          </a>
        </div>
      </div>

      {/* Main nav */}
      <header className="sticky top-0 z-30 bg-charcoal shadow-md">
        <div className="mx-auto flex h-[54px] max-w-6xl items-stretch justify-between px-0 sm:px-6">
          <nav aria-label="Main" className="hidden items-stretch md:flex">
            <NavLink to="/report" className={navCls}>
              Report emergency
            </NavLink>
            <NavLink to="/track" className={navCls}>
              Track report
            </NavLink>
            <NavLink to="/admin" className={navCls}>
              Admin
            </NavLink>
          </nav>
          <div className="hidden items-stretch md:flex">
            <AccountArea />
          </div>

          <div className="flex w-full items-center justify-between px-4 md:hidden">
            <span className="text-[13px] font-bold uppercase tracking-wide text-white">Menu</span>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="public-mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="grid h-10 w-10 place-items-center rounded-md text-white transition-colors hover:bg-white/10"
            >
              <Icon name={open ? 'x' : 'menu'} />
            </button>
          </div>
        </div>
        {open && (
          <nav id="public-mobile-nav" aria-label="Main" className="animate-slide-down border-t border-charcoal-line bg-charcoal md:hidden [&>a]:h-12 [&>button]:h-12">
            <NavLink to="/report" className={navCls}>
              Report emergency
            </NavLink>
            <NavLink to="/track" className={navCls}>
              Track report
            </NavLink>
            <NavLink to="/admin" className={navCls}>
              Admin
            </NavLink>
            <AccountArea onDone={() => setOpen(false)} />
          </nav>
        )}
      </header>

      <main key={location.pathname} className="flex-1 animate-fade-in">
        <Outlet />
      </main>

      <footer className="bg-charcoal-dark text-white/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo light tagline="Code Clash 2026" />
          <p>
            In immediate danger? Call{' '}
            <a href="tel:112" className="font-bold text-white underline-offset-2 hover:underline">
              112
            </a>{' '}
            first, then report here.
          </p>
        </div>
      </footer>
    </div>
  );
}
