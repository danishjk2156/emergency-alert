import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  AlertTriangle,
  Map,
  PlusCircle,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const navLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/map', label: 'Map View', icon: Map },
  { to: '/report', label: 'Report Incident', icon: PlusCircle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] fixed h-full z-30">
        <div className="p-6 border-b border-[var(--border-color)]">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl">🚨</span>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)]">CobotEx</h1>
              <p className="text-xs text-[var(--text-muted)]">Emergency Incident Monitor</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.to;
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-red-600/20 text-red-400 border border-red-500/20'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {user && (
          <div className="p-4 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <Shield size={14} className="text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{user.full_name}</p>
                <p className="text-xs text-[var(--text-muted)] capitalize">{user.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-4 py-2 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-red-600/10 hover:text-red-400 transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-64 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] z-50">
            <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2" onClick={() => setSidebarOpen(false)}>
                <span className="text-2xl">🚨</span>
                <h1 className="text-lg font-bold text-[var(--text-primary)]">CobotEx</h1>
              </Link>
              <button onClick={() => setSidebarOpen(false)} className="text-[var(--text-secondary)]">
                <X size={20} />
              </button>
            </div>
            <nav className="p-4 space-y-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.to;
                const Icon = link.icon;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-red-600/20 text-red-400'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
                    }`}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:ml-64">
        {/* Top Navbar */}
        <header className="sticky top-0 z-20 bg-[var(--bg-secondary)]/80 backdrop-blur-md border-b border-[var(--border-color)]">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <Menu size={24} />
              </button>
              <div className="lg:hidden flex items-center gap-2">
                <span className="text-xl">🚨</span>
                <span className="font-bold text-[var(--text-primary)]">CobotEx</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-[var(--text-muted)]">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow" />
                System Active
              </div>
              {user && (
                <div className="hidden md:flex items-center gap-2 text-sm">
                  <span className="text-[var(--text-secondary)]">{user.full_name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300 capitalize">
                    {user.role}
                  </span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
