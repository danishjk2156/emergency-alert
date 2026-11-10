import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { trackIncident } from '../api';
import { useAuth } from '../auth';
import { ErrorState } from '../components/EmptyState';
import Icon from '../components/Icon';
import SectionTitle from '../components/SectionTitle';
import SeverityBadge from '../components/SeverityBadge';
import Spinner from '../components/Spinner';
import StatusChip from '../components/StatusChip';
import { STATUSES, formatDateTime } from '../constants';

export default function TrackPage() {
  const [params, setParams] = useSearchParams();
  const { isSignedIn, isAdmin } = useAuth();
  const urlRef = params.get('ref') || '';
  const [input, setInput] = useState(urlRef);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const lookup = useCallback(async (ref) => {
    const code = ref.trim().toUpperCase();
    if (!code) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await trackIncident(code));
    } catch (e) {
      setError(e.status === 404 ? `We couldn’t find a report with code “${code}”. Check the code and try again.` : e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (urlRef) {
      setInput(urlRef);
      lookup(urlRef);
    }
  }, [urlRef, lookup]);

  function onSubmit(e) {
    e.preventDefault();
    const code = input.trim().toUpperCase();
    if (!code) return;
    if (code === urlRef) lookup(code);
    else setParams({ ref: code });
  }

  const step = result ? STATUSES.indexOf(result.status) : -1;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <SectionTitle as="h1" sub="Enter the reference code you received when you reported, e.g. ER-2026-0007.">
        Track your report
      </SectionTitle>

      <form onSubmit={onSubmit} className="card mt-6 flex gap-2 p-3">
        <label htmlFor="ref" className="sr-only">
          Reference code
        </label>
        <div className="relative flex-1">
          <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
          <input
            id="ref"
            className="input pl-10 font-mono uppercase tracking-wider"
            placeholder="ER-2026-0007"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button type="submit" className="btn btn-primary shrink-0 px-6" disabled={!input.trim() || loading}>
          {loading ? <Spinner /> : 'Track'}
        </button>
      </form>

      {isSignedIn && !isAdmin && (
        <p className="mt-3 text-sm text-ink-3">
          Signed in?{' '}
          <Link to="/account" className="font-bold text-brand hover:underline">
            See all your reports
          </Link>
        </p>
      )}

      <div className="mt-6" aria-live="polite">
        {loading && <div className="skeleton h-56" />}
        {error && <ErrorState message={error} />}
        {result && (
          <section className="card animate-fade-up overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-charcoal px-5 py-3 text-white">
              <span className="font-mono text-sm font-bold tracking-wider">{result.ref_code}</span>
              <SeverityBadge level={result.severity} upper size="sm" />
            </div>
            <div className="p-5">
              <h2 className="text-xl font-black leading-snug text-ink">{result.title}</h2>
              <div className="mt-2">
                <StatusChip status={result.status} />
              </div>

              <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Progress">
                {STATUSES.map((s, i) => (
                  <li key={s} className="text-center" aria-current={i === step ? 'step' : undefined}>
                    <span
                      className={`mx-auto grid h-9 w-9 place-items-center rounded-full border-2 text-xs font-black transition-all duration-500 ${
                        i <= step
                          ? result.status === 'Resolved'
                            ? 'border-green-700 bg-green-700 text-white'
                            : 'border-brand bg-brand text-white'
                          : 'border-black/15 bg-white text-ink-3'
                      } ${i === step ? 'scale-110 shadow-lift' : ''}`}
                      style={{ transitionDelay: `${i * 100}ms` }}
                    >
                      {i < step || (i === step && result.status === 'Resolved') ? <Icon name="check" className="h-4 w-4" strokeWidth={3} /> : i + 1}
                    </span>
                    <span className={`mt-2 block text-[11px] font-bold uppercase tracking-wide ${i === step ? 'text-ink' : 'text-ink-3'}`}>{s}</span>
                  </li>
                ))}
              </ol>

              <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-black/10 pt-4 text-sm">
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Reported</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{formatDateTime(result.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Last update</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{formatDateTime(result.updated_at)}</dd>
                </div>
              </dl>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
