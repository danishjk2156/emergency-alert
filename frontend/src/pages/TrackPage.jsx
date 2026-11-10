import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { trackIncident } from '../api';
import { ErrorState } from '../components/EmptyState';
import SeverityBadge from '../components/SeverityBadge';
import Spinner from '../components/Spinner';
import StatusChip from '../components/StatusChip';
import { STATUSES, formatDateTime } from '../constants';

export default function TrackPage() {
  const [params, setParams] = useSearchParams();
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
      setError(
        e.status === 404
          ? `We couldn’t find a report with code “${code}”. Check the code and try again.`
          : e.message,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Look up whenever the ?ref= in the URL changes (incl. arriving from the success page)
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
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-extrabold">Track your report</h1>
      <p className="mt-1 text-sm text-slate-600">Enter the reference code you received, e.g. ER-2026-0007.</p>

      <form onSubmit={onSubmit} className="mt-5 flex gap-2">
        <label htmlFor="ref" className="sr-only">
          Reference code
        </label>
        <input
          id="ref"
          className="input font-mono uppercase"
          placeholder="ER-2026-0007"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" className="btn btn-primary shrink-0 px-6" disabled={!input.trim() || loading}>
          {loading ? <Spinner /> : 'Track'}
        </button>
      </form>

      <div className="mt-6" aria-live="polite">
        {loading && <div className="skeleton h-48 rounded-xl" />}
        {error && <ErrorState message={error} />}
        {result && (
          <section className="card p-5">
            <p className="font-mono text-xs font-semibold text-slate-500">{result.ref_code}</p>
            <div className="mt-1 flex items-start justify-between gap-3">
              <h2 className="text-lg font-bold leading-snug">{result.title}</h2>
              <SeverityBadge level={result.severity} upper />
            </div>
            <div className="mt-3">
              <StatusChip status={result.status} />
            </div>

            <ol className="mt-5 grid grid-cols-4 gap-1.5" aria-label="Progress">
              {STATUSES.map((s, i) => (
                <li key={s} className="text-center" aria-current={i === step ? 'step' : undefined}>
                  <div
                    className={`h-1.5 rounded-full ${
                      i <= step ? (result.status === 'Resolved' ? 'bg-green-600' : 'bg-blue-600') : 'bg-slate-200'
                    }`}
                  />
                  <span className={`mt-1.5 block text-[11px] font-semibold ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
                </li>
              ))}
            </ol>

            <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Reported</dt>
                <dd className="font-medium">{formatDateTime(result.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Last update</dt>
                <dd className="font-medium">{formatDateTime(result.updated_at)}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
