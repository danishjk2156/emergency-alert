import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createIncident, getCategories } from '../api';
import CategoryTile from '../components/CategoryTile';
import ReasonChips from '../components/ReasonChips';
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
  if (f.contact_phone.trim() && !PHONE_RE.test(normalizePhone(f.contact_phone))) {
    e.contact_phone = 'Phone must have 7–15 digits (spaces and dashes are fine).';
  }
  if (f.contact_email.trim() && !EMAIL_RE.test(f.contact_email.trim())) {
    e.contact_email = 'Enter a valid email address.';
  }
  return e;
}

// Same patterns the backend enforces (backend/app/schemas.py), so a valid form never gets rejected.
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const EMAIL_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
/** "+91 98765-43210" → "+919876543210" (keeps one leading +, drops spaces, dashes, brackets, dots). */
const normalizePhone = (v) => {
  const t = v.trim();
  return (t.startsWith('+') ? '+' : '') + t.replace(/\D/g, '');
};

function Field({ id, label, error, hint, children }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  );
}

export default function ReportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [catsLoading, setCatsLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

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
    if (form.contact_name.trim()) body.contact_name = form.contact_name.trim();
    if (form.contact_phone.trim()) body.contact_phone = normalizePhone(form.contact_phone);
    if (form.contact_email.trim()) body.contact_email = form.contact_email.trim();
    try {
      const incident = await createIncident(body);
      toast('Report submitted');
      navigate('/report/success', { state: { incident } });
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
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-8 lg:py-10">
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Report an Emergency</h1>
          <p className="mt-1 text-sm text-slate-600">
            For life-threatening danger, also call{' '}
            <a href="tel:112" className="font-bold text-brand underline-offset-2 hover:underline">
              112
            </a>
            . Fields marked <span className="text-brand">*</span> are required.
          </p>
        </div>

        <fieldset>
          <legend className="label">
            Emergency category <span className="text-brand">*</span>
          </legend>
          <div role="radiogroup" aria-label="Emergency category" className="grid grid-cols-3 gap-2 sm:gap-3">
            {catsLoading
              ? Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[84px] rounded-xl" />)
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
          {err('category_code') && <p className="field-error">{err('category_code')}</p>}
        </fieldset>

        <Field id="title" label={<>Incident title <span className="text-brand">*</span></>} error={err('title')}>
          <input {...inputProps('title')} className="input" maxLength={120} placeholder="e.g. Building collapsed near bus stand" />
        </Field>

        <Field
          id="description"
          label={<>Description <span className="text-brand">*</span></>}
          error={err('description')}
          hint={
            <p className={`mt-1 text-right text-xs tabular-nums ${form.description.length > MAX_DESC ? 'text-red-600' : 'text-slate-500'}`}>
              {form.description.length} / {MAX_DESC}
            </p>
          }
        >
          <textarea
            {...inputProps('description')}
            rows={4}
            className="input"
            placeholder="What happened? Mention if anyone is trapped, unconscious or injured."
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_180px]">
          <Field
            id="location"
            label={<>Location <span className="text-brand">*</span></>}
            error={err('location')}
            hint={
              form.latitude !== null ? (
                <p className="mt-1 text-xs font-medium text-green-700">
                  📍 GPS attached ({form.latitude}, {form.longitude}){' '}
                  <button
                    type="button"
                    className="ml-1 text-slate-500 underline hover:text-slate-800"
                    onClick={() => setForm((f) => ({ ...f, latitude: null, longitude: null }))}
                  >
                    remove
                  </button>
                </p>
              ) : null
            }
          >
            <div className="flex gap-2">
              <input {...inputProps('location')} className="input" maxLength={200} placeholder="Address or landmark" autoComplete="street-address" />
              <button type="button" onClick={attachGps} disabled={locating} className="btn shrink-0 whitespace-nowrap text-blue-700">
                {locating ? <Spinner /> : <span aria-hidden="true">📍</span>}
                <span className="hidden sm:inline">Use my location</span>
                <span className="sm:hidden">GPS</span>
              </button>
            </div>
          </Field>

          <Field id="people_affected" label={<>People affected <span className="text-brand">*</span></>} error={err('people_affected')}>
            <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30">
              <button
                type="button"
                aria-label="Decrease people affected"
                className="w-11 text-lg font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                disabled={form.people_affected <= 0}
                onClick={() => set('people_affected', Math.max(0, (form.people_affected || 0) - 1))}
              >
                −
              </button>
              <input
                id="people_affected"
                type="number"
                inputMode="numeric"
                min={0}
                className="w-full min-w-0 border-x border-slate-200 text-center text-sm font-bold tabular-nums focus:outline-none"
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
                className="w-11 text-lg font-bold text-slate-600 hover:bg-slate-100"
                onClick={() => set('people_affected', (Number.isInteger(form.people_affected) ? form.people_affected : 0) + 1)}
              >
                +
              </button>
            </div>
          </Field>
        </div>

        <details className="group rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <summary className="flex min-h-[32px] cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-700">
            <span aria-hidden="true" className="transition-transform group-open:rotate-90">
              ›
            </span>
            Contact info (optional)
          </summary>
          <p className="mt-1 text-xs text-slate-500">Helps responders reach you. Only the response team can see this.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Field id="contact_name" label="Name" error={err('contact_name')}>
              <input {...inputProps('contact_name')} className="input" autoComplete="name" maxLength={80} />
            </Field>
            <Field id="contact_phone" label="Phone" error={err('contact_phone')}>
              <input {...inputProps('contact_phone')} className="input" type="tel" autoComplete="tel" inputMode="tel" placeholder="9876543210" />
            </Field>
            <Field id="contact_email" label="Email" error={err('contact_email')}>
              <input {...inputProps('contact_email')} className="input" type="email" autoComplete="email" placeholder="you@example.com" />
            </Field>
          </div>
        </details>

        {serverError && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
            ⚠ {serverError}
          </div>
        )}

        <div>
          <button type="submit" disabled={!isValid || submitting} className="btn btn-primary min-h-[52px] w-full text-base">
            {submitting ? (
              <>
                <Spinner /> Sending report…
              </>
            ) : (
              <>🚨 Submit Emergency Report</>
            )}
          </button>
          {!isValid && (
            <p className="mt-2 text-center text-xs text-slate-500">Complete the required fields to enable submit.</p>
          )}
        </div>
      </form>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start" aria-label="Severity preview and safety tips">
        <section className="card p-5" aria-live="polite">
          <h2 className="text-sm font-bold text-slate-700">Live severity preview</h2>
          {preview ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <SeverityBadge level={preview.level} upper />
                <span className="text-xs font-medium tabular-nums text-slate-500">score {preview.score} / 100</span>
              </div>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200"
                role="meter"
                aria-label="Severity score"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={preview.score}
              >
                <div className={`h-full rounded-full transition-all duration-300 ${SEVERITY_BAR[preview.level]}`} style={{ width: `${preview.score}%` }} />
              </div>
              <div className="mt-3">
                <ReasonChips reasons={preview.reasons} />
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Pick a category to see how urgent this report looks.</p>
          )}
          <p className="mt-4 text-xs text-slate-500">Final severity is set by the server.</p>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-bold text-slate-700">{selectedName ? `Safety tips: ${selectedName}` : 'Safety tips'}</h2>
          {tips ? (
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Choose a category to see what to do while help is on the way.</p>
          )}
        </section>
      </aside>
    </div>
  );
}
