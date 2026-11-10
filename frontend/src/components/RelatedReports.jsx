import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRelated } from '../api';
import { formatDistance } from '../constants';
import { ErrorState } from './EmptyState';
import Icon from './Icon';
import VerificationBadge from './VerificationBadge';

function apart(r) {
  const bits = [];
  if (r.distance_m != null) bits.push(`${formatDistance(r.distance_m)} away`);
  if (r.minutes_apart != null) bits.push(`${Math.round(r.minutes_apart)} min apart`);
  return bits.join(' · ');
}

/** Other reports in the same cluster: corroborating first, duplicates below. */
export default function RelatedReports({ id, refreshKey }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [unsupported, setUnsupported] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await getRelated(id));
    } catch (e) {
      if (e.status === 404 || e.status === 405) setUnsupported(true);
      else setError(e.message || 'Could not load related reports.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (unsupported) return null;

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wide text-ink">
        <Icon name="layers" className="h-[18px] w-[18px] text-brand" /> Related reports
      </h2>
      <span className="title-bar mb-4" aria-hidden="true" />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !data ? (
        <div className="space-y-2" aria-busy="true">
          <div className="skeleton h-12" />
          <div className="skeleton h-12" />
        </div>
      ) : data.corroborating.length === 0 && data.duplicates.length === 0 ? (
        <p className="text-sm text-ink-3">No other reports about this incident yet.</p>
      ) : (
        <div className="space-y-4">
          {data.corroborating.length > 0 && (
            <ul className="stagger divide-y divide-black/5">
              {data.corroborating.map((r) => (
                <li key={r.id}>
                  <Link to={`/admin/incidents/${r.id}`} className="flex items-center gap-3 rounded px-1 py-2.5 transition-colors hover:bg-paper">
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-[11px] font-bold text-ink-3">{r.ref_code}</span>
                      <span className="block truncate font-semibold text-ink">{r.title}</span>
                      {apart(r) && <span className="block text-xs text-ink-3">{apart(r)}</span>}
                    </span>
                    <VerificationBadge status={r.verification_status} size="sm" />
                    <Icon name="chevron-right" className="h-4 w-4 text-ink-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {data.duplicates.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-ink-3">Duplicates</p>
              <ul className="divide-y divide-black/5 rounded-md bg-paper">
                {data.duplicates.map((r) => (
                  <li key={r.id}>
                    <Link to={`/admin/incidents/${r.id}`} className="flex items-center gap-3 px-3 py-2 text-sm text-ink-3 hover:text-ink">
                      <span className="font-mono text-[11px] font-bold">{r.ref_code}</span>
                      <span className="min-w-0 flex-1 truncate">{r.title}</span>
                      <span className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase">duplicate</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
