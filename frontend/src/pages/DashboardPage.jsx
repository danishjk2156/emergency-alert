import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStats, listIncidents } from '../api';
import CriticalBanner from '../components/CriticalBanner';
import { ErrorState } from '../components/EmptyState';
import IncidentTable from '../components/IncidentTable';
import Spinner from '../components/Spinner';
import StatCard from '../components/StatCard';
import { FALLBACK_CATEGORIES, SEVERITIES, SEVERITY_BAR, STATUSES, STATUS_BAR, formatTime } from '../constants';

const REFRESH_MS = 15000;

function StackedBar({ title, keys, counts, colors }) {
  const total = keys.reduce((s, k) => s + (counts[k] || 0), 0);
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div
        className="flex h-4 overflow-hidden rounded-md bg-slate-100"
        role="img"
        aria-label={`${title}: ${keys.map((k) => `${k} ${counts[k] || 0}`).join(', ')}`}
      >
        {total > 0 &&
          keys.map((k) =>
            counts[k] ? <div key={k} className={colors[k]} style={{ width: `${(counts[k] / total) * 100}%` }} title={`${k}: ${counts[k]}`} /> : null,
          )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {keys.map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${colors[k]}`} aria-hidden="true" />
            {k} <strong className="tabular-nums text-slate-900">{counts[k] || 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryBars({ data }) {
  // Always show all 6 categories, even with 0
  const rows = FALLBACK_CATEGORIES.map((c) => {
    const hit = data.find((d) => d.code === c.code);
    return { ...c, ...(hit || {}), count: hit ? hit.count : 0 };
  });
  const extra = data.filter((d) => !FALLBACK_CATEGORIES.some((c) => c.code === d.code));
  const all = [...rows, ...extra];
  const max = Math.max(1, ...all.map((r) => r.count));
  return (
    <ul className="space-y-2.5">
      {all.map((r) => (
        <li key={r.code}>
          <Link
            to={`/admin/incidents?category=${encodeURIComponent(r.code)}`}
            className="flex min-h-[32px] items-center gap-3 rounded-md px-1 text-sm hover:bg-slate-50"
          >
            <span className="w-40 shrink-0 truncate text-slate-700">
              <span aria-hidden="true">{r.icon}</span> {r.name}
            </span>
            <span className="h-3.5 flex-1 overflow-hidden rounded bg-slate-100">
              <span className="block h-full rounded bg-slate-500 transition-all duration-500" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <strong className="w-8 text-right tabular-nums">{r.count}</strong>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const alive = useRef(true);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [s, recent] = await Promise.all([getStats(), listIncidents({ sort: 'newest', limit: 5 })]);
      if (!alive.current) return;
      setStats(s);
      setLatest(recent.items);
      setError('');
      setUpdatedAt(new Date());
    } catch (e) {
      if (alive.current) setError(e.message || 'Could not load the dashboard.');
    } finally {
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    load();
    const t = setInterval(() => load(), REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [load]);

  const resolvedPct = stats?.total ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Emergency Dashboard</h1>
          <p className="text-sm text-slate-500">
            Live overview · auto-refresh every 15s
            {updatedAt && <span className="hidden sm:inline"> · updated {formatTime(updatedAt)}</span>}
          </p>
        </div>
        <button type="button" onClick={() => load(true)} disabled={refreshing} className="btn">
          {refreshing ? <Spinner /> : <span aria-hidden="true">⟳</span>} Refresh
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => load(true)} />}

      {stats && <CriticalBanner count={stats.critical_active} items={stats.recent_critical} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Reported" value={stats?.total ?? 0} loading={loading} sub="all time" />
        <StatCard label="Critical" value={stats?.critical ?? 0} tone="critical" loading={loading} sub={`${stats?.critical_active ?? 0} active`} />
        <StatCard label="Pending" value={stats?.pending ?? 0} tone="amber" loading={loading} sub="not resolved" />
        <StatCard label="Resolved" value={stats?.resolved ?? 0} tone="green" loading={loading} sub={`${resolvedPct}% of total`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <h2 className="mb-4 font-bold">Incidents by Category</h2>
          {loading ? (
            <div className="space-y-3">
              {FALLBACK_CATEGORIES.map((c) => (
                <div key={c.code} className="skeleton h-4" />
              ))}
            </div>
          ) : (
            <CategoryBars data={stats?.by_category || []} />
          )}
        </section>

        <section className="card space-y-6 p-5">
          <h2 className="font-bold">By Status &amp; Severity</h2>
          {loading ? (
            <>
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </>
          ) : (
            <>
              <StackedBar title="By status" keys={STATUSES} counts={stats?.by_status || {}} colors={STATUS_BAR} />
              <StackedBar title="By severity" keys={SEVERITIES} counts={stats?.by_severity || {}} colors={SEVERITY_BAR} />
            </>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">Latest incidents</h2>
          <Link to="/admin/incidents?sort=newest" className="text-sm font-semibold text-blue-700 hover:underline">
            View all →
          </Link>
        </div>
        {!loading && latest.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No incidents yet 🎉</p>
        ) : (
          <IncidentTable items={latest} loading={loading} compact />
        )}
      </section>
    </div>
  );
}
