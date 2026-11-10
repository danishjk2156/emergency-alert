import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { listMyIncidents } from '../api';
import { useAuth } from '../auth';
import EmptyState, { ErrorState } from '../components/EmptyState';
import Icon, { CategoryIcon } from '../components/Icon';
import SectionTitle from '../components/SectionTitle';
import SeverityBadge from '../components/SeverityBadge';
import StatusChip from '../components/StatusChip';
import { STATUSES, formatDateTime, timeAgo } from '../constants';

function Progress({ status }) {
  const step = STATUSES.indexOf(status);
  return (
    <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label={`Progress: ${status}`}>
      {STATUSES.map((s, i) => (
        <li key={s} aria-current={i === step ? 'step' : undefined}>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
            <div
              className={`h-full origin-left rounded-full transition-transform duration-700 ${status === 'Resolved' ? 'bg-green-700' : 'bg-brand'}`}
              style={{ transform: `scaleX(${i <= step ? 1 : 0})`, transitionDelay: `${i * 90}ms` }}
            />
          </div>
          <span className={`mt-1.5 block text-[10px] font-bold uppercase tracking-wide ${i === step ? 'text-ink' : 'text-ink-3'}`}>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default function MyReportsPage() {
  const { user, isSignedIn, isAdmin } = useAuth();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listMyIncidents({ sort: 'newest', limit: 50 }));
    } catch (e) {
      setError(e.message || 'Could not load your reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) load();
  }, [isSignedIn, load]);

  if (!isSignedIn) return <Navigate to="/login?next=/account" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  const open = data.items.filter((i) => i.status !== 'Resolved').length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <div className="card flex animate-fade-up flex-wrap items-center gap-4 overflow-hidden p-5">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-charcoal text-xl font-black uppercase text-white">
          {(user?.name || user?.email || '?').slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.15em] text-ink-3">Signed in as</p>
          <p className="truncate text-lg font-black text-ink">{user?.name || 'Citizen'}</p>
          <p className="truncate text-sm text-ink-3">{user?.email}</p>
        </div>
        <div className="flex gap-6 text-center">
          <div>
            <p className="text-2xl font-black tabular-nums text-ink">{loading ? '–' : data.total}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Reports</p>
          </div>
          <div>
            <p className="text-2xl font-black tabular-nums text-brand">{loading ? '–' : open}</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Open</p>
          </div>
        </div>
        <Link to="/report" className="btn btn-primary w-full sm:w-auto">
          <Icon name="siren" className="h-4 w-4" /> New report
        </Link>
      </div>

      <SectionTitle className="mt-10" sub="Every report you made while signed in. Anonymous reports are not listed here; track those with their reference code.">
        My reports
      </SectionTitle>

      <div className="mt-6">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skeleton h-44" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon="note"
            title="No reports yet"
            message="Reports you send while signed in will show up here with their live status."
            action={
              <Link to="/report" className="btn btn-primary">
                Report an emergency
              </Link>
            }
          />
        ) : (
          <ul className="stagger grid gap-4 md:grid-cols-2">
            {data.items.map((i) => (
              <li key={i.id} className={`card card-hover p-5 ${i.severity === 'Critical' && i.status !== 'Resolved' ? 'border-l-4 border-l-brand' : ''}`}>
                <div className="flex items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <CategoryIcon code={i.category?.code} className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-bold text-ink-3">{i.ref_code}</p>
                    <h3 className="font-black leading-snug text-ink">{i.title}</h3>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
                      <Icon name="pin" className="h-3.5 w-3.5" /> {i.location}
                    </p>
                  </div>
                  <SeverityBadge level={i.severity} size="sm" />
                </div>
                <Progress status={i.status} />
                <div className="mt-4 flex items-center justify-between gap-2 text-xs text-ink-3">
                  <span className="flex items-center gap-2">
                    <StatusChip status={i.status} />
                    <time dateTime={i.created_at} title={formatDateTime(i.created_at)}>
                      {timeAgo(i.created_at)}
                    </time>
                  </span>
                  <Link to={`/track?ref=${encodeURIComponent(i.ref_code)}`} className="inline-flex items-center gap-1 font-bold text-brand hover:underline">
                    Track <Icon name="arrow-right" className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
