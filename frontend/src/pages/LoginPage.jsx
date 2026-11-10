import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getToken, login } from '../api';
import Logo from '../components/Logo';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const from = useLocation().state?.from || '/admin';
  const [params] = useSearchParams();
  const expired = params.get('expired') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (getToken()) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await login(email.trim(), password);
      toast(`Welcome back${user?.name ? `, ${user.name}` : ''}`);
      navigate(from.startsWith('/admin/login') ? '/admin' : from, { replace: true });
    } catch (ex) {
      setError(ex.status === 401 ? 'Invalid email or password.' : ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy p-10 text-white md:flex">
        <Logo suffix="Net" light />
        <div>
          <h2 className="text-3xl font-extrabold leading-tight">
            Command Center
            <br />
            <span className="text-red-300">every second counts.</span>
          </h2>
          <p className="mt-3 max-w-sm text-sm text-slate-300">Monitor, triage and resolve emergencies from one dashboard.</p>
          <ul className="mt-8 grid max-w-md grid-cols-2 gap-3 text-sm">
            {[
              ['🚨', 'Critical first', 'Highest risk rises to the top'],
              ['⟳', 'Live', 'Dashboard refreshes every 15s'],
              ['🧮', 'Explained', 'Every score shows its reasons'],
              ['🕒', 'Tracked', 'Full status history'],
            ].map(([icon, t, d]) => (
              <li key={t} className="rounded-xl border border-navy-line bg-navy-light p-3">
                <p className="font-semibold">
                  <span aria-hidden="true">{icon}</span> {t}
                </p>
                <p className="mt-0.5 text-xs text-slate-300">{d}</p>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-400">Code Clash 2026 · Round 1</p>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-extrabold">Admin sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Authorised personnel only.</p>

          {expired && !error && (
            <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">Your session expired. Please sign in again.</p>
          )}

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                className="input"
                autoComplete="username"
                placeholder="admin@codeclash.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={error ? 'true' : 'false'}
              />
            </div>
            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? 'text' : 'password'}
                  className="input pr-20"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={error ? 'true' : 'false'}
                  aria-describedby={error ? 'login-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-1 top-1/2 min-h-[34px] -translate-y-1/2 rounded-md px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                >
                  {show ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && (
              <p id="login-error" role="alert" className="text-sm font-medium text-red-600">
                ⚠ {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {busy && <Spinner />} Sign in
            </button>
          </form>

          <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            <span className="font-semibold">Demo:</span> admin@codeclash.dev / admin123
          </div>
          <Link to="/report" className="mt-8 inline-block text-sm font-semibold text-blue-700 hover:underline">
            ← Back to public reporting
          </Link>
        </div>
      </div>
    </div>
  );
}
