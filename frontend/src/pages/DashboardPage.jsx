import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getStats, listIncidents } from '../api';
import ClusterPill from '../components/ClusterPill';
import CriticalBanner from '../components/CriticalBanner';
import { ErrorState } from '../components/EmptyState';
import Icon, { CategoryIcon } from '../components/Icon';
import IncidentTable from '../components/IncidentTable';
import SectionTitle from '../components/SectionTitle';
import Spinner from '../components/Spinner';
import StatCard from '../components/StatCard';
import { FALLBACK_CATEGORIES, SEVERITIES, SEVERITY_BAR, STATUSES, STATUS_BAR, formatTime } from '../constants';

const REFRESH_MS = 15000;

const MINI_TONES = {
  blue: 'border-l-blue-600 text-blue-800',
  slate: 'border-l-slate-400 text-ink',
  amber: 'border-l-amber-500 text-amber-800',
  gray: 'border-l-gray-400 text-gray-600',
  red: 'border-l-brand text-brand-dark',
};

function MiniStat({ label, value, tone, icon, to }) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-black uppercase tracking-[0.12em] text-ink-3">{label}</span>
        <Icon name={icon} className="h-4 w-4 opacity-70" />
      </span>
      <span className="mt-1 block text-2xl font-black tabular-nums">{value ?? '–'}</span>
    </>
  );
  const cls = `card block border-l-4 px-3.5 py-3 transition-all duration-300 ${MINI_TONES[tone]}`;
  return to ? (
    <Link to={to} className={`${cls} card-hover`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function StackedBar({ title, keys, counts, colors }) {
  const total = keys.reduce((s, k) => s + (counts[k] || 0), 0);
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-ink-3">{title}</h3>
      <div className="flex h-4 overflow-hidden rounded bg-black/10" role="img" aria-label={`${title}: ${keys.map((k) => `${k} ${counts[k] || 0}`).join(', ')}`}>
        {total > 0 &&
          keys.map((k) =>
            counts[k] ? (
              <div key={k} className={`${colors[k]} transition-all duration-700 ease-out`} style={{ width: `${(counts[k] / total) * 100}%` }} title={`${k}: ${counts[k]}`} />
            ) : null,
          )}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {keys.map((k) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${colors[k]}`} aria-hidden="true" />
            {k} <strong className="tabular-nums text-ink">{counts[k] || 0}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryBars({ data }) {
  const rows = FALLBACK_CATEGORIES.map((c) => {
    const hit = data.find((d) => d.code === c.code);
    return { ...c, ...(hit || {}), count: hit ? hit.count : 0 };
  });
  const extra = data.filter((d) => !FALLBACK_CATEGORIES.some((c) => c.code === d.code));
  const all = [...rows, ...extra];
  const max = Math.max(1, ...all.map((r) => r.count));
  return (
    <ul className="stagger space-y-2">
      {all.map((r) => (
        <li key={r.code}>
          <Link to={`/admin/incidents?category=${encodeURIComponent(r.code)}`} className="group flex min-h-[38px] items-center gap-3 rounded px-1 text-sm transition-colors hover:bg-paper">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110">
              <CategoryIcon code={r.code} className="h-4 w-4" />
            </span>
            <span className="w-36 shrink-0 truncate font-semibold text-ink-2">{r.name}</span>
            <span className="h-3 flex-1 overflow-hidden rounded bg-black/[0.07]">
              <span className="block h-full rounded bg-charcoal transition-all duration-700 ease-out group-hover:bg-brand" style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <strong className="w-8 text-right tabular-nums text-ink">{r.count}</strong>
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
  const [critBreakdown, setCritBreakdown] = useState('');
  const alive = useRef(true);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [s, recent] = await Promise.all([getStats(), listIncidents({ sort: 'newest', limit: 5 })]);
      if (!alive.current) return;
      // Trust layer: "3 active critical (2 corroborated, 1 unverified)"
      if (s.has_trust && s.critical_active > 0) {
        try {
          const crit = await listIncidents({ severity: 'Critical', sort: 'priority', limit: 50 });
          const active = crit.items.filter((i) => i.status !== 'Resolved' && i.verification_status !== 'False Alarm');
          const corroborated = active.filter((i) => i.verification_status === 'Corroborated' || i.verification_status === 'Verified').length;
          const unverified = active.length - corroborated;
          if (alive.current) setCritBreakdown(active.length ? [corroborated && `${corroborated} corroborated`, unverified && `${unverified} unverified`].filter(Boolean).join(', ') : '');
        } catch {
          if (alive.current) setCritBreakdown('');
        }
      } else setCritBreakdown('');
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
  const hasReporterSplit = stats && stats.anonymous != null && stats.registered != null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          as="h1"
          sub={
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-600 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-700" />
              </span>
              Live overview · auto-refresh every 15s
              {updatedAt && <span className="hidden sm:inline"> · updated {formatTime(updatedAt)}</span>}
            </span>
          }
        >
          Emergency dashboard
        </SectionTitle>
        <button type="button" onClick={() => load(true)} disabled={refreshing} className="btn">
          {refreshing ? <Spinner /> : <Icon name="refresh" className="h-4 w-4" />} Refresh
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => load(true)} />}

      {stats && <CriticalBanner count={stats.critical_active} items={stats.recent_critical} breakdown={critBreakdown} />}

      <div className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total reported" value={stats?.total ?? 0} loading={loading} icon="inbox" sub="all time" />
        <StatCard label="Critical" value={stats?.critical ?? 0} tone="critical" icon="siren" loading={loading} sub={`${stats?.critical_active ?? 0} active`} />
        <StatCard label="Pending" value={stats?.pending ?? 0} tone="amber" icon="clock" loading={loading} sub="not resolved" />
        <StatCard label="Resolved" value={stats?.resolved ?? 0} tone="green" icon="check-circle" loading={loading} sub={`${resolvedPct}% of total`} />
      </div>

      {stats?.has_trust && (
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            <MiniStat label="Corroborated" value={stats.corroborated} tone="blue" icon="users" to="/admin/incidents?verification_status=Corroborated" />
            <MiniStat label="Unverified" value={stats.unverified} tone="slate" icon="circle-dashed" to="/admin/incidents?verification_status=Unverified" />
            <MiniStat label="Suspicious" value={stats.suspicious} tone="amber" icon="alert" to="/admin/incidents?max_trust=29" />
            <MiniStat label="False alarms" value={stats.false_alarms} tone="gray" icon="x" to="/admin/incidents?verification_status=False%20Alarm" />
            <MiniStat label="Rate-limited today" value={stats.rate_limited_today} tone="red" icon="timer" />
          </div>
          {stats.largest_cluster ? (
            <Link
              to={`/admin/incidents/${stats.largest_cluster.root_id}`}
              className="card card-hover group flex animate-fade-up items-center gap-4 border-l-4 border-l-indigo-600 p-4"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-indigo-50 text-indigo-700">
                <Icon name="layers" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10.5px] font-black uppercase tracking-[0.12em] text-ink-3">
                  Largest active cluster{stats.active_clusters != null && ` · ${stats.active_clusters} active`}
                </span>
                <span className="mt-0.5 block truncate font-black text-ink">{stats.largest_cluster.title}</span>
                <span className="mt-1 inline-block">
                  <ClusterPill size={stats.largest_cluster.size} />
                </span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-brand">
                View <Icon name="arrow-right" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ) : (
            <div className="card flex items-center gap-3 p-4 text-sm text-ink-3">
              <Icon name="layers" className="h-5 w-5" /> No active clusters right now.
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <h2 className="text-[13px] font-black uppercase tracking-wide text-ink">Incidents by category</h2>
          <span className="title-bar mb-4" aria-hidden="true" />
          {loading ? (
            <div className="space-y-3">
              {FALLBACK_CATEGORIES.map((c) => (
                <div key={c.code} className="skeleton h-6" />
              ))}
            </div>
          ) : (
            <CategoryBars data={stats?.by_category || []} />
          )}
        </section>

        <section className="card space-y-6 p-5">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-wide text-ink">Status &amp; severity</h2>
            <span className="title-bar" aria-hidden="true" />
          </div>
          {loading ? (
            <>
              <div className="skeleton h-10" />
              <div className="skeleton h-10" />
            </>
          ) : (
            <>
              <StackedBar title="By status" keys={STATUSES} counts={stats?.by_status || {}} colors={STATUS_BAR} />
              <StackedBar title="By severity" keys={SEVERITIES} counts={stats?.by_severity || {}} colors={SEVERITY_BAR} />
              {hasReporterSplit && (
                <StackedBar
                  title="By reporter"
                  keys={['Registered', 'Anonymous']}
                  counts={{ Registered: stats.registered, Anonymous: stats.anonymous }}
                  colors={{ Registered: 'bg-charcoal', Anonymous: 'bg-gray-400' }}
                />
              )}
            </>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-[13px] font-black uppercase tracking-wide text-ink">Latest incidents</h2>
            <span className="title-bar" aria-hidden="true" />
          </div>
          <Link to="/admin/incidents?sort=newest" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">
            View all <Icon name="arrow-right" className="h-4 w-4" />
          </Link>
        </div>
        {!loading && latest.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-3">No incidents yet.</p>
        ) : (
          <IncidentTable items={latest} loading={loading} compact />
        )}
      </section>
    </div>
  );
}
