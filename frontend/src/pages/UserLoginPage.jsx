import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import AuthShell, { FormAlert, IconInput, PasswordField } from '../components/AuthShell';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

export default function UserLoginPage() {
  const { login, isSignedIn, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const expired = params.get('expired') === '1';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (isSignedIn) return <Navigate to={next || (isAdmin ? '/admin' : '/account')} replace />;

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
      toast(`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`);
      const admin = String(user?.role).toLowerCase() === 'admin';
      navigate(next || (admin ? '/admin' : '/account'), { replace: true });
    } catch (ex) {
      setError(ex.status === 401 ? 'Invalid email or password.' : ex.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Citizen account"
      title="Report faster."
      highlight="Track everything."
      points={[
        ['note', 'All your reports', 'See every report you have made and its live status.'],
        ['user', 'Pre-filled contact', 'Responders can reach you without retyping details.'],
        ['incognito', 'Anonymous when you want', 'You can still send any report anonymously.'],
      ]}
      footer={
        <>
          New here?{' '}
          <Link to={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-brand hover:underline">
            Create an account
          </Link>
          <span className="mx-2 text-ink-3">·</span>
          <Link to="/report" className="font-bold text-ink hover:text-brand">
            Report without an account
          </Link>
        </>
      }
    >
      <h1 className="section-title">Sign in</h1>
      <span className="title-bar" aria-hidden="true" />
      <p className="mt-3 text-sm text-ink-3">Use your ResQNet account. Staff use the same form.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        {expired && !error && <FormAlert tone="warn">Your session expired. Please sign in again.</FormAlert>}
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <IconInput
            icon="mail"
            id="email"
            type="email"
            autoComplete="username"
            placeholder="you@example.com"
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
          {busy ? <Spinner /> : <Icon name="login" className="h-4 w-4" />} Sign in
        </button>
      </form>
    </AuthShell>
  );
}
