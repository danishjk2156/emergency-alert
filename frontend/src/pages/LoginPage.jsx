import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import AuthShell, { FormAlert, IconInput, PasswordField } from '../components/AuthShell';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

/** Admin sign in (/admin/login). Citizens are sent to /login. */
export default function LoginPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { login, logout, isSignedIn, isAdmin, user } = useAuth();
  const state = useLocation().state || {};
  const from = state.from && state.from.startsWith('/admin') && !state.from.startsWith('/admin/login') ? state.from : '/admin';
  const expired = useSearchParams()[0].get('expired') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isSignedIn && isAdmin) return <Navigate to={from} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const u = await login(email.trim(), password);
      if (String(u?.role).toLowerCase() !== 'admin') {
        await logout();
        setError('This account does not have admin access. Citizens can sign in from the main site.');
        return;
      }
      toast(`Welcome back${u?.name ? `, ${u.name.split(' ')[0]}` : ''}`);
      navigate(from, { replace: true });
    } catch (ex) {
      setError(ex.status === 401 ? 'Invalid email or password.' : ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Command center"
      title="Every second"
      highlight="counts."
      points={[
        ['siren', 'Critical first', 'Highest-risk incidents rise to the top automatically.'],
        ['refresh', 'Live dashboard', 'Stats refresh every 15 seconds.'],
        ['shield', 'Know the source', 'See whether each report is anonymous or from a registered user.'],
      ]}
      footer={
        <Link to="/report" className="inline-flex items-center gap-1.5 font-bold text-ink hover:text-brand">
          <Icon name="arrow-left" className="h-4 w-4" /> Back to public reporting
        </Link>
      }
    >
      <h1 className="section-title">Admin sign in</h1>
      <span className="title-bar" aria-hidden="true" />
      <p className="mt-3 text-sm text-ink-3">Authorised personnel only.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        {expired && !error && <FormAlert tone="warn">Your session expired. Please sign in again.</FormAlert>}
        {isSignedIn && !isAdmin && !error && (
          <FormAlert tone="warn">
            You’re signed in as {user?.email} (citizen). Sign in with an admin account to continue.
          </FormAlert>
        )}
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <IconInput
            icon="mail"
            id="email"
            type="email"
            autoComplete="username"
            placeholder="admin@codeclash.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? 'true' : 'false'}
          />
        </div>
        <PasswordField
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          error={error}
          describedBy={error ? 'login-error' : undefined}
        />
        <FormAlert id="login-error">{error}</FormAlert>
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? <Spinner /> : <Icon name="lock" className="h-4 w-4" />} Sign in
        </button>
      </form>

      <div className="mt-5 rounded-md border-l-4 border-charcoal bg-paper px-3 py-2.5 text-xs text-ink-2">
        <span className="font-black uppercase tracking-wide">Demo:</span> admin@codeclash.dev / admin123
      </div>
    </AuthShell>
  );
}
