import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MockNotice } from './PublicLayout';
import Icon from './Icon';
import Logo from './Logo';

/** Split layout used by sign in, register and admin sign in. */
export default function AuthShell({ eyebrow, title, highlight, points = [], children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <MockNotice />
      <div className="grid flex-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <aside className="relative hidden overflow-hidden bg-charcoal p-10 text-white md:flex md:flex-col md:justify-between">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{ background: 'radial-gradient(120% 80% at 100% 100%, rgba(215,25,31,.55) 0%, rgba(215,25,31,0) 60%)' }}
            aria-hidden="true"
          />
          <div className="absolute bottom-0 left-0 h-1.5 w-full bg-brand" aria-hidden="true" />
          <Link to="/report" className="relative w-fit rounded-md">
            <Logo light />
          </Link>
          <div className="relative animate-fade-up">
            {eyebrow && <p className="text-xs font-black uppercase tracking-[0.25em] text-white/60">{eyebrow}</p>}
            <h2 className="mt-3 text-4xl font-black uppercase leading-[1.05] tracking-tight">
              {title}
              {highlight && (
                <>
                  <br />
                  <span className="text-[#FF5A5F]">{highlight}</span>
                </>
              )}
            </h2>
            <span className="mt-5 block h-1 w-16 origin-left animate-grow-x bg-brand" aria-hidden="true" />
            <ul className="stagger mt-8 space-y-3.5">
              {points.map(([icon, head, text]) => (
                <li key={head} className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-white/10 text-white">
                    <Icon name={icon} className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-sm font-black uppercase tracking-wide">{head}</span>
                    <span className="block text-sm text-white/70">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p className="relative text-xs text-white/50">Code Clash 2026 · ResQNet</p>
        </aside>

        <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
          <div className="mx-auto w-full max-w-sm animate-fade-up">
            <div className="mb-8 md:hidden">
              <Link to="/report" className="rounded-md">
                <Logo />
              </Link>
            </div>
            {children}
            {footer && <div className="mt-8 border-t border-black/10 pt-5 text-sm text-ink-2">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PasswordField({ id, label = 'Password', value, onChange, autoComplete, error, describedBy, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative">
        <Icon name="lock" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className="input pl-10 pr-12"
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1 top-1/2 grid h-9 w-10 -translate-y-1/2 place-items-center rounded text-ink-2 transition-colors hover:bg-black/5 hover:text-ink"
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          <Icon name={show ? 'eye-off' : 'eye'} className="h-[18px] w-[18px]" />
        </button>
      </div>
      {hint}
    </div>
  );
}

export function IconInput({ icon, ...props }) {
  return (
    <div className="relative">
      <Icon name={icon} className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
      <input {...props} className={`input pl-10 ${props.className || ''}`} />
    </div>
  );
}

export function FormAlert({ id, children, tone = 'error' }) {
  if (!children) return null;
  const cls = tone === 'error' ? 'border-brand bg-brand-soft text-brand-deep' : 'border-amber-500 bg-amber-50 text-amber-900';
  return (
    <p id={id} role="alert" className={`flex animate-fade-up items-start gap-2 rounded-md border-l-4 px-3 py-2.5 text-sm font-semibold ${cls}`}>
      <Icon name="alert" className="mt-0.5 h-4 w-4" />
      <span>{children}</span>
    </p>
  );
}
