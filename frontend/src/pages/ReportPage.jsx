import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createIncident, getCategories } from '../api';
import { useAuth } from '../auth';
import CategoryTile from '../components/CategoryTile';
import Icon from '../components/Icon';
import ReasonChips from '../components/ReasonChips';
import SectionTitle from '../components/SectionTitle';
import SeverityBadge from '../components/SeverityBadge';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { FALLBACK_CATEGORIES, SAFETY_TIPS, SEVERITY_BAR } from '../constants';
import { computeSeverity } from '../severity';

const MAX_DESC = 2000;
const EMPTY = {
  category_code: '',
  title: '',
  description: '',
  location: '',
  latitude: null,
  longitude: null,
  people_affected: 1,
  contact_name: '',
  contact_phone: '',
  contact_email: '',
};

// Same patterns the backend enforces (backend/app/schemas.py), so a valid form never gets rejected.
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const EMAIL_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
/** "+91 98765-43210" → "+919876543210" (keeps one leading +, drops spaces, dashes, brackets, dots). */
const normalizePhone = (v) => {
  const t = v.trim();
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
};

function validate(f) {
  const e = {};
  const title = f.title.trim();
  const desc = f.description.trim();
  const loc = f.location.trim();
  if (!f.category_code) e.category_code = 'Choose the type of emergency.';
  if (title.length < 5) e.title = 'Title must be at least 5 characters.';
  else if (title.length > 120) e.title = 'Title must be 120 characters or less.';
  if (desc.length < 10) e.description = 'Description must be at least 10 characters.';
  else if (f.description.length > MAX_DESC) e.description = `Description must be ${MAX_DESC} characters or less.`;
  if (loc.length < 3) e.location = 'Location must be at least 3 characters.';
  else if (loc.length > 200) e.location = 'Location must be 200 characters or less.';
  if (!Number.isInteger(f.people_affected) || f.people_affected < 0) e.people_affected = 'Enter 0 or more.';
  if (f.contact_name.trim().length > 80) e.contact_name = 'Name must be 80 characters or less.';
  if (f.contact_phone.trim() && !PHONE_RE.test(normalizePhone(f.contact_phone))) e.contact_phone = 'Phone must have 7–15 digits (spaces and dashes are fine).';
  if (f.contact_email.trim() && !EMAIL_RE.test(f.contact_email.trim())) e.contact_email = 'Enter a valid email address.';
  return e;
}

function Field({ id, label, error, hint, optional, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional ? (
          <span className="ml-1 font-medium normal-case tracking-normal text-ink-3">(optional)</span>
        ) : (
          <span className="ml-0.5 text-brand" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          <Icon name="alert" className="h-3.5 w-3.5" /> {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}

const STEPS = [
  ['01', 'Report', 'Tell us what happened and where. It takes under a minute.', 'note'],
  ['02', 'Triage', 'Severity is scored instantly. Critical cases go to the top.', 'radar'],
  ['03', 'Respond', 'Responders act, and you track progress with your code.', 'shield'],
];

function IdentityPanel({ user, isSignedIn, anonymous, setAnonymous }) {
  if (!isSignedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border-2 border-dashed border-field/50 bg-white p-4">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-paper text-ink">
          <Icon name="incognito" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-wide text-ink">You’re reporting anonymously</p>
          <p className="text-sm text-ink-3">No account needed. Save the reference code you get to track it.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/login?next=/report" className="btn">
            <Icon name="login" className="h-4 w-4" /> Sign in
          </Link>
          <Link to="/register?next=/report" className="btn btn-dark">
            Create account
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className={`rounded-md border-2 p-4 transition-colors duration-300 ${anonymous ? 'border-field/50 bg-white' : 'border-charcoal bg-charcoal text-white'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`grid h-11 w-11 place-items-center rounded-full transition-colors duration-300 ${anonymous ? 'bg-paper text-ink' : 'bg-white/15 text-white'}`}>
          <Icon name={anonymous ? 'incognito' : 'shield'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black uppercase tracking-wide">{anonymous ? 'Sending anonymously' : `Reporting as ${user?.name || user?.email}`}</p>
          <p className={`text-sm ${anonymous ? 'text-ink-3' : 'text-white/75'}`}>
            {anonymous ? 'Your account will not be linked to this report.' : 'Linked to your account, so it appears in My reports.'}
          </p>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm font-bold">
          <span>Report anonymously</span>
          <button
            type="button"
            role="switch"
            aria-checked={anonymous}
            onClick={() => setAnonymous((a) => !a)}
            className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${anonymous ? 'bg-brand' : 'bg-white/30'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${anonymous ? 'left-6' : 'left-1'}`} />
          </button>
        </label>
      </div>
    </div>
  );
}

export default function ReportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isSignedIn } = useAuth();
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [catsLoading, setCatsLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [anonymous, setAnonymous] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const linked = isSignedIn && !anonymous;

  useEffect(() => {
    let alive = true;
    getCategories()
      .then((c) => alive && setCategories(c))
      .finally(() => alive && setCatsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;
  const preview = useMemo(
    () => (form.category_code ? computeSeverity(form.category_code, form.people_affected, `${form.title} ${form.description}`) : null),
    [form.category_code, form.people_affected, form.title, form.description],
  );

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const touch = (key) => setTouched((t) => ({ ...t, [key]: true }));
  const err = (key) => (touched[key] ? errors[key] : undefined);
  const inputProps = (key) => ({
    id: key,
    value: form[key],
    onChange: (e) => set(key, e.target.value),
    onBlur: () => touch(key),
    'aria-invalid': err(key) ? 'true' : 'false',
    'aria-describedby': err(key) ? `${key}-error` : undefined,
  });

  function attachGps() {
    if (!('geolocation' in navigator)) {
      toast('Location is not supported in this browser.', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setForm((f) => ({
          ...f,
          latitude: Number(latitude.toFixed(6)),
          longitude: Number(longitude.toFixed(6)),
          location: f.location.trim() ? f.location : `GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        }));
        setLocating(false);
        toast('GPS location attached');
      },
      (e) => {
        setLocating(false);
        toast(e.code === 1 ? 'Location permission denied. Please type the address.' : 'Could not get your location. Please type the address.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, true])));
    if (!isValid || submitting) return;
    setSubmitting(true);
    setServerError('');
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      category_code: form.category_code,
      location: form.location.trim(),
      people_affected: form.people_affected,
    };
    if (form.latitude !== null) {
      body.latitude = form.latitude;
      body.longitude = form.longitude;
    }
    // Signed in + linked: the server fills name/email from the account; only an extra phone is sent.
    const name = linked ? user?.name || '' : form.contact_name.trim();
    const email = linked ? user?.email || '' : form.contact_email.trim();
    if (name) body.contact_name = name.slice(0, 80);
    if (form.contact_phone.trim()) body.contact_phone = normalizePhone(form.contact_phone);
    if (email && EMAIL_RE.test(email)) body.contact_email = email;

    try {
      const { incident, anonymousFallback } = await createIncident(body, { anonymous: isSignedIn && anonymous });
      if (anonymousFallback) toast('Your session had expired, so the report was sent anonymously.', 'info');
      else toast('Report submitted');
      navigate('/report/success', { state: { incident, linked: linked && !anonymousFallback } });
    } catch (ex) {
      setServerError(ex.message || 'Could not submit the report.');
      toast('Report not sent. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const tips = form.category_code ? SAFETY_TIPS[form.category_code] : null;
  const selectedName = categories.find((c) => c.code === form.category_code)?.name;

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-charcoal text-white">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(90% 120% at 100% 0%, rgba(215,25,31,.85) 0%, rgba(215,25,31,.35) 38%, rgba(47,47,47,0) 70%), linear-gradient(90deg, #2F2F2F 0%, #2F2F2F 45%, rgba(47,47,47,.6) 100%)',
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="animate-fade-up text-xs font-black uppercase tracking-[0.25em] text-white/70">Emergency response platform</p>
          <h1 className="mt-3 animate-fade-up text-4xl font-black uppercase leading-[1.02] tracking-tight [animation-delay:60ms] sm:text-6xl">
            Report an
            <br />
            emergency
          </h1>
          <span className="mt-5 block h-1 w-20 origin-left animate-grow-x bg-brand" aria-hidden="true" />
          <p className="mt-5 max-w-lg animate-fade-up text-[15px] text-white/85 [animation-delay:120ms]">
            Your report reaches the response team immediately. For life-threatening danger, also call{' '}
            <a href="tel:112" className="font-black text-white underline decoration-brand decoration-2 underline-offset-4">
              112
            </a>
            .
          </p>
          <div className="mt-6 flex animate-fade-up flex-wrap gap-3 [animation-delay:180ms]">
            <a href="#report-form" className="btn btn-primary">
              <Icon name="siren" className="h-4 w-4" /> Start report
            </a>
            <a href="tel:112" className="btn border-white/40 bg-white/10 text-white hover:border-white hover:bg-white/20">
              <Icon name="phone" className="h-4 w-4" /> Call 112
            </a>
          </div>
        </div>
      </section>

      {/* Red steps band */}
      <section className="bg-brand text-white" aria-label="How it works">
        <ol className="stagger mx-auto grid max-w-6xl sm:grid-cols-3">
          {STEPS.map(([num, head, text, icon], i) => (
            <li key={num} className={`flex items-start gap-4 px-5 py-5 sm:flex-col sm:items-center sm:px-6 sm:py-7 sm:text-center ${i === 1 ? 'bg-brand-dark' : ''}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
                <Icon name={icon} />
              </span>
              <span>
                <span className="block text-base font-black uppercase tracking-wide">
                  {num}/ {head}
                </span>
                <span className="mt-1 block text-sm text-white/85">{text}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Form */}
      <section id="report-form" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-6 lg:py-14">
        <SectionTitle center sub="Fields marked * are required. The more detail you give, the faster responders can help.">
          Incident details
        </SectionTitle>

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8">
          <form onSubmit={onSubmit} noValidate className="card space-y-6 p-5 sm:p-7">
            <IdentityPanel user={user} isSignedIn={isSignedIn} anonymous={anonymous} setAnonymous={setAnonymous} />

            <fieldset>
              <legend className="label">
                Emergency category
                <span className="ml-0.5 text-brand" aria-hidden="true">
                  *
                </span>
              </legend>
              <div role="radiogroup" aria-label="Emergency category" className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
                {catsLoading
                  ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[96px]" />)
                  : categories.map((c) => (
                      <CategoryTile
                        key={c.code}
                        category={c}
                        selected={form.category_code === c.code}
                        onSelect={(code) => {
                          set('category_code', code);
                          touch('category_code');
                        }}
                      />
                    ))}
              </div>
              {err('category_code') && (
                <p className="field-error">
                  <Icon name="alert" className="h-3.5 w-3.5" /> {err('category_code')}
                </p>
              )}
            </fieldset>

            <Field id="title" label="Incident title" error={err('title')}>
              <input {...inputProps('title')} className="input" maxLength={120} placeholder="e.g. Building collapsed near bus stand" />
            </Field>

            <Field
              id="description"
              label="Description"
              error={err('description')}
              hint={
                <p className={`mt-1.5 text-right text-xs font-semibold tabular-nums ${form.description.length > MAX_DESC ? 'text-brand-dark' : 'text-ink-3'}`}>
                  {form.description.length} / {MAX_DESC}
                </p>
              }
            >
              <textarea {...inputProps('description')} rows={4} className="input" placeholder="What happened? Mention if anyone is trapped, unconscious or injured." />
            </Field>

            <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_190px]">
              <Field
                id="location"
                label="Location"
                error={err('location')}
                hint={
                  form.latitude !== null ? (
                    <p className="mt-1.5 flex animate-fade-in items-center gap-1.5 text-xs font-bold text-green-800">
                      <Icon name="pin" className="h-3.5 w-3.5" /> GPS attached ({form.latitude}, {form.longitude})
                      <button type="button" className="ml-1 text-ink-3 underline hover:text-ink" onClick={() => setForm((f) => ({ ...f, latitude: null, longitude: null }))}>
                        remove
                      </button>
                    </p>
                  ) : null
                }
              >
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Icon name="pin" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
                    <input {...inputProps('location')} className="input pl-10" maxLength={200} placeholder="Address or landmark" autoComplete="street-address" />
                  </div>
                  <button type="button" onClick={attachGps} disabled={locating} className="btn shrink-0 whitespace-nowrap" aria-label="Use my location">
                    {locating ? <Spinner /> : <Icon name="crosshair" className="h-[18px] w-[18px] text-brand" />}
                    <span className="hidden sm:inline">Use my location</span>
                  </button>
                </div>
              </Field>

              <Field id="people_affected" label="People affected" error={err('people_affected')}>
                <div className="flex h-[44px] overflow-hidden rounded-md border-[1.5px] border-field bg-white transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
                  <button
                    type="button"
                    aria-label="Decrease people affected"
                    className="grid w-12 place-items-center text-ink transition-colors hover:bg-paper disabled:opacity-40"
                    disabled={form.people_affected <= 0}
                    onClick={() => set('people_affected', Math.max(0, (form.people_affected || 0) - 1))}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                  <input
                    id="people_affected"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    className="w-full min-w-0 border-x-[1.5px] border-field/40 text-center text-base font-black tabular-nums focus:outline-none"
                    value={Number.isInteger(form.people_affected) ? form.people_affected : ''}
                    onChange={(e) => set('people_affected', e.target.value === '' ? NaN : Math.max(0, Math.floor(Number(e.target.value))))}
                    onBlur={() => {
                      touch('people_affected');
                      if (!Number.isInteger(form.people_affected)) set('people_affected', 0);
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Increase people affected"
                    className="grid w-12 place-items-center text-ink transition-colors hover:bg-paper"
                    onClick={() => set('people_affected', (Number.isInteger(form.people_affected) ? form.people_affected : 0) + 1)}
                  >
                    <Icon name="plus" className="h-4 w-4" strokeWidth={3} />
                  </button>
                </div>
              </Field>
            </div>

            {linked ? (
              <div className="rounded-md border-l-4 border-charcoal bg-paper p-4">
                <p className="label mb-2">Contact details</p>
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="user" className="h-4 w-4" /> {user?.name || '—'}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="mail" className="h-4 w-4" /> {user?.email}
                  </span>
                </p>
                <div className="mt-3 max-w-xs">
                  <Field id="contact_phone" label="Phone for this report" optional error={err('contact_phone')}>
                    <input {...inputProps('contact_phone')} className="input" type="tel" autoComplete="tel" inputMode="tel" placeholder="9876543210" />
                  </Field>
                </div>
              </div>
            ) : (
              <details className="group rounded-md border-[1.5px] border-field/40 px-4 py-3 transition-colors open:bg-paper/60">
                <summary className="flex min-h-[36px] cursor-pointer list-none items-center gap-2 text-[13px] font-black uppercase tracking-wide text-ink">
                  <Icon name="chevron-right" className="h-4 w-4 transition-transform duration-300 group-open:rotate-90" />
                  Contact info (optional)
                </summary>
                <p className="mt-1 text-sm text-ink-3">
                  {isSignedIn ? 'This report is anonymous. Add contact details only if you want responders to reach you.' : 'Helps responders reach you. Only the response team can see this.'}
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <Field id="contact_name" label="Name" optional error={err('contact_name')}>
                    <input {...inputProps('contact_name')} className="input" autoComplete="name" maxLength={80} />
                  </Field>
                  <Field id="contact_phone" label="Phone" optional error={err('contact_phone')}>
                    <input {...inputProps('contact_phone')} className="input" type="tel" autoComplete="tel" inputMode="tel" placeholder="9876543210" />
                  </Field>
                  <Field id="contact_email" label="Email" optional error={err('contact_email')}>
                    <input {...inputProps('contact_email')} className="input" type="email" autoComplete="email" placeholder="you@example.com" />
                  </Field>
                </div>
              </details>
            )}

            {serverError && (
              <div role="alert" className="flex animate-fade-up items-start gap-2 rounded-md border-l-4 border-brand bg-brand-soft px-3 py-2.5 text-sm font-semibold text-brand-deep">
                <Icon name="alert" className="mt-0.5 h-4 w-4" /> {serverError}
              </div>
            )}

            <div>
              <button type="submit" disabled={!isValid || submitting} className="btn btn-primary min-h-[54px] w-full text-[15px]">
                {submitting ? (
                  <>
                    <Spinner /> Sending report…
                  </>
                ) : (
                  <>
                    <Icon name="siren" className="h-5 w-5" /> Submit emergency report
                  </>
                )}
              </button>
              {!isValid && <p className="mt-2 text-center text-xs font-medium text-ink-3">Complete the required fields to enable submit.</p>}
            </div>
          </form>

          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="Severity preview and safety tips">
            <section className="card overflow-hidden" aria-live="polite">
              <div className="flex items-center gap-2 bg-charcoal px-5 py-3 text-white">
                <Icon name="radar" className="h-[18px] w-[18px]" />
                <h2 className="text-[13px] font-black uppercase tracking-wide">Live severity preview</h2>
              </div>
              <div className="p-5">
                {preview ? (
                  <div className="animate-fade-in">
                    <div className="flex items-center gap-2">
                      <SeverityBadge level={preview.level} upper />
                      <span className="text-sm font-bold tabular-nums text-ink-2">score {preview.score} / 100</span>
                    </div>
                    <div
                      className="mt-3 h-2.5 overflow-hidden rounded-full bg-black/10"
                      role="meter"
                      aria-label="Severity score"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={preview.score}
                    >
                      <div className={`h-full rounded-full transition-all duration-500 ease-out ${SEVERITY_BAR[preview.level]}`} style={{ width: `${preview.score}%` }} />
                    </div>
                    <div className="mt-4">
                      <ReasonChips reasons={preview.reasons} />
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-ink-3">Pick a category to see how urgent this report looks.</p>
                )}
                <p className="mt-4 border-t border-black/10 pt-3 text-xs text-ink-3">Final severity is set by the server.</p>
              </div>
            </section>

            <section className="card p-5">
              <h2 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wide text-ink">
                <Icon name="shield" className="h-[18px] w-[18px] text-brand" />
                {selectedName ? `Safety tips: ${selectedName}` : 'Safety tips'}
              </h2>
              {tips ? (
                <ul key={form.category_code} className="stagger mt-3 space-y-2.5 text-sm text-ink-2">
                  {tips.map((t) => (
                    <li key={t} className="flex gap-2.5">
                      <Icon name="check" className="mt-0.5 h-4 w-4 text-brand" strokeWidth={3} />
                      {t}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-3">Choose a category to see what to do while help is on the way.</p>
              )}
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
