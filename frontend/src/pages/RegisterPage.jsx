import { useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth';
import AuthShell, { FormAlert, IconInput, PasswordField } from '../components/AuthShell';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';

const EMAIL_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const normalizePhone = (v) => {
  const t = v.trim();
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
};
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH = [
  { label: 'Too short', cls: 'bg-brand', w: '15%' },
  { label: 'Weak', cls: 'bg-brand', w: '30%' },
  { label: 'Fair', cls: 'bg-amber-500', w: '55%' },
  { label: 'Good', cls: 'bg-green-600', w: '80%' },
  { label: 'Strong', cls: 'bg-green-700', w: '100%' },
];

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = 'Enter your name (at least 2 characters).';
  else if (f.name.trim().length > 80) e.name = 'Name must be 80 characters or less.';
  if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.';
  if (f.phone.trim() && !PHONE_RE.test(normalizePhone(f.phone))) e.phone = 'Phone must have 7–15 digits.';
  if (f.password.length < 8) e.password = 'Use at least 8 characters.';
  if (f.confirm !== f.password) e.confirm = 'Passwords don’t match.';
  return e;
}

export default function RegisterPage() {
  const { register, isSignedIn, isAdmin } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const next = safeNext(useSearchParams()[0].get('next'));

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [touched, setTouched] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const errors = useMemo(() => validate(form), [form]);
  const valid = Object.keys(errors).length === 0;
  const pw = STRENGTH[strength(form.password)];

  if (isSignedIn) return <Navigate to={next || (isAdmin ? '/admin' : '/account')} replace />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const touch = (k) => () => setTouched((t) => ({ ...t, [k]: true }));
  const err = (k) => (touched[k] ? errors[k] : undefined);

  async function onSubmit(e) {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, password: true, confirm: true });
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      const user = await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone.trim() ? normalizePhone(form.phone) : undefined,
      });
      toast(`Account created. Welcome, ${user?.name?.split(' ')[0] || 'there'}`);
      navigate(next || '/account', { replace: true });
    } catch (ex) {
      setError(ex.message || 'Could not create your account.');
    } finally {
      setBusy(false);
    }
  }

  const fieldErr = (k) =>
    err(k) && (
      <p id={`${k}-error`} className="field-error">
        <Icon name="alert" className="h-3.5 w-3.5" /> {err(k)}
      </p>
    );
  const aria = (k) => ({ 'aria-invalid': err(k) ? 'true' : 'false', 'aria-describedby': err(k) ? `${k}-error` : undefined });

  return (
    <AuthShell
      eyebrow="Create account"
      title="One account."
      highlight="Every report tracked."
      points={[
        ['shield', 'Verified reporter', 'Reports from accounts are marked registered for responders.'],
        ['radar', 'Live status', 'Follow every report from Reported to Resolved.'],
        ['lock', 'Private', 'Your contact details are only visible to the response team.'],
      ]}
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-brand hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <h1 className="section-title">Create account</h1>
      <span className="title-bar" aria-hidden="true" />
      <p className="mt-3 text-sm text-ink-3">Takes 30 seconds. You can always report anonymously instead.</p>

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <div>
          <label htmlFor="name" className="label">
            Full name
          </label>
          <IconInput icon="user" id="name" autoComplete="name" maxLength={80} value={form.name} onChange={set('name')} onBlur={touch('name')} {...aria('name')} />
          {fieldErr('name')}
        </div>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <IconInput
            icon="mail"
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={set('email')}
            onBlur={touch('email')}
            {...aria('email')}
          />
          {fieldErr('email')}
        </div>
        <div>
          <label htmlFor="phone" className="label">
            Phone <span className="font-medium normal-case tracking-normal text-ink-3">(optional)</span>
          </label>
          <IconInput
            icon="phone"
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="9876543210"
            value={form.phone}
            onChange={set('phone')}
            onBlur={touch('phone')}
            {...aria('phone')}
          />
          {fieldErr('phone')}
        </div>
        <PasswordField
          id="password"
          value={form.password}
          onChange={(e) => {
            set('password')(e);
            touch('password')();
          }}
          autoComplete="new-password"
          error={err('password')}
          describedBy="pw-strength"
          hint={
            <div id="pw-strength" className="mt-2" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className={`h-full rounded-full transition-all duration-500 ${pw.cls}`} style={{ width: form.password ? pw.w : '0%' }} />
              </div>
              <p className="mt-1 text-xs font-semibold text-ink-3">
                {form.password ? `Strength: ${pw.label}` : 'At least 8 characters. Mix letters, numbers and symbols.'}
              </p>
              {fieldErr('password')}
            </div>
          }
        />
        <div>
          <PasswordField
            id="confirm"
            label="Confirm password"
            value={form.confirm}
            onChange={(e) => {
              set('confirm')(e);
              if (e.target.value.length >= form.password.length) touch('confirm')();
            }}
            autoComplete="new-password"
            error={err('confirm')}
            describedBy={err('confirm') ? 'confirm-error' : undefined}
          />
          {fieldErr('confirm')}
        </div>

        <FormAlert>{error}</FormAlert>

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? <Spinner /> : <Icon name="user-plus" className="h-4 w-4" />} Create account
        </button>
      </form>
    </AuthShell>
  );
}
