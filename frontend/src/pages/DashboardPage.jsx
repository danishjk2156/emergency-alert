import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getAnalyticsSummary, getStats, listIncidents } from '../api';
import CriticalBanner from '../components/CriticalBanner';
import { ErrorState } from '../components/EmptyState';
import Icon from '../components/Icon';
import IncidentTable from '../components/IncidentTable';
import PriorityQueue from '../components/PriorityQueue';
import SectionTitle from '../components/SectionTitle';
import Spinner from '../components/Spinner';
import { formatTime } from '../constants';

const REFRESH_MS = 30000;

const DONUT_COLORS = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#10b981', '#64748b'];

function AnalyticsCard({ label, value, icon, tone = 'default', sub, pulse = false, loading }) {
  const tones = {
    default: 'border-l-slate-400 text-ink',
    blue: 'border-l-blue-600 text-blue-900',
    red: 'border-l-danger text-danger-dark',
    emerald: 'border-l-emerald-600 text-emerald-900',
    amber: 'border-l-amber-500 text-amber-900',
    indigo: 'border-l-indigo-600 text-indigo-900',
  };

  return (
    <div
      className={`card relative overflow-hidden rounded-xl border border-border border-l-4 p-4 shadow-sm transition-all duration-300 ${
        tones[tone]
      } ${pulse ? 'bg-red-50/70 border-l-danger animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]' : 'bg-white'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-ink-muted">
          {label}
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-paper text-ink">
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-2">
        {loading ? (
          <div className="h-8 w-16 bg-paper animate-pulse rounded" />
        ) : (
          <span className="font-mono text-2xl font-black text-ink tabular-nums">
            {value ?? 0}
          </span>
        )}
      </div>
      {sub && <p className="mt-1 text-[11px] text-ink-muted truncate">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [latest, setLatest] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [critBreakdown, setCritBreakdown] = useState('');
  const alive = useRef(true);

  const loadData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [s, a, recent] = await Promise.all([
        getStats().catch(() => null),
        getAnalyticsSummary().catch(() => null),
        listIncidents({ sort: 'newest', limit: 5 }).catch(() => ({ items: [] })),
      ]);
      if (!alive.current) return;

      if (s?.has_trust && s?.critical_active > 0) {
        try {
          const crit = await listIncidents({ severity: 'Critical', sort: 'priority', limit: 50 });
          const active = (crit.items || []).filter(
            (i) => i.status !== 'Resolved' && i.verification_status !== 'False Alarm',
          );
          const corroborated = active.filter(
            (i) => i.verification_status === 'Corroborated' || i.verification_status === 'Verified',
          ).length;
          const unverified = active.length - corroborated;
          if (alive.current) {
            setCritBreakdown(
              active.length
                ? [corroborated && `${corroborated} corroborated`, unverified && `${unverified} unverified`]
                    .filter(Boolean)
                    .join(', ')
                : '',
            );
          }
        } catch {
          if (alive.current) setCritBreakdown('');
        }
      } else {
        if (alive.current) setCritBreakdown('');
      }

      if (!alive.current) return;
      setStats(s);
      setAnalytics(a);
      setLatest(recent.items || []);
      setError('');
      setUpdatedAt(new Date());
    } catch (e) {
      if (alive.current) setError(e.message || 'Could not load dashboard data.');
    } finally {
      if (alive.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    loadData();
    const interval = setInterval(() => loadData(), REFRESH_MS);
    return () => {
      alive.current = false;
      clearInterval(interval);
    };
  }, [loadData]);

  // Derived metrics from summary
  const totalInc = analytics?.total_incidents ?? stats?.total ?? 0;
  const critInc = analytics?.critical_incidents ?? stats?.critical_active ?? 0;
  const availTeams = analytics?.available_teams ?? 0;
  const busyTeams = analytics?.busy_teams ?? 0;
  const assignedInc = analytics?.assigned_incidents ?? 0;
  const resolvedInc = analytics?.resolved_incidents ?? stats?.resolved ?? 0;

  // Chart data
  const categoryData = (analytics?.by_category || []).map((c) => ({
    name: c.name || c.code,
    value: c.count,
  }));

  const statusData = (analytics?.by_status || []).map((s) => ({
    status: s.name,
    incidents: s.count,
  }));

  const timelineData = analytics?.last_7_days || [];

  return (
    <div className="space-y-6">
      {/* Title & Live Badge */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle
          as="h1"
          sub={
            <span className="inline-flex items-center gap-2">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
              </span>
              Real-time analytics · auto-refreshes every 30s
              {updatedAt && <span className="hidden sm:inline"> · updated {formatTime(updatedAt)}</span>}
            </span>
          }
        >
          Emergency Operations Dashboard
        </SectionTitle>
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-bold text-ink hover:bg-paper transition-colors shadow-sm"
        >
          {refreshing ? <Spinner /> : <Icon name="refresh" className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={() => loadData(true)} />}

      {/* Critical Alert Banner (Kept intact) */}
      {stats && (
        <CriticalBanner
          count={stats.critical_active}
          items={stats.recent_critical}
          breakdown={critBreakdown}
        />
      )}

      {/* Six Analytics Stat Cards (Prompt F6) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-6">
        <AnalyticsCard
          label="Total Incidents"
          value={totalInc}
          icon="inbox"
          tone="default"
          sub="cumulative intake"
          loading={loading}
        />
        <AnalyticsCard
          label="Critical Incidents"
          value={critInc}
          icon="siren"
          tone="red"
          sub={critInc > 0 ? 'Requires immediate action' : 'All clear'}
          pulse={critInc > 0}
          loading={loading}
        />
        <AnalyticsCard
          label="Available Teams"
          value={availTeams}
          icon="users"
          tone="emerald"
          sub="ready for dispatch"
          loading={loading}
        />
        <AnalyticsCard
          label="Busy Teams"
          value={busyTeams}
          icon="siren"
          tone="amber"
          sub="on active missions"
          loading={loading}
        />
        <AnalyticsCard
          label="Assigned Incidents"
          value={assignedInc}
          icon="pin"
          tone="indigo"
          sub="en route or on scene"
          loading={loading}
        />
        <AnalyticsCard
          label="Resolved Incidents"
          value={resolvedInc}
          icon="check-circle"
          tone="blue"
          sub="closed safely"
          loading={loading}
        />
      </div>

      {/* Analytics Charts Section (Prompt F6) */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* 1. Donut Chart: By Category */}
        <section className="card p-5">
          <div className="mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-ink">Incidents by Category</h2>
            <p className="text-[11px] text-ink-muted">Distribution across hazard classifications</p>
          </div>
          {loading ? (
            <div className="h-64 w-full bg-paper animate-pulse rounded-lg" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="45%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '11px',
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* 2. Bar Chart: Incidents by Status */}
        <section className="card p-5">
          <div className="mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-ink">Incidents by Status</h2>
            <p className="text-[11px] text-ink-muted">Lifecycle stage progression</p>
          </div>
          {loading ? (
            <div className="h-64 w-full bg-paper animate-pulse rounded-lg" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis
                    dataKey="status"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '11px',
                    }}
                  />
                  <Bar dataKey="incidents" fill="#D7191F" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* 3. Line Chart: Incidents Over Last 7 Days */}
        <section className="card p-5">
          <div className="mb-3">
            <h2 className="text-xs font-black uppercase tracking-wider text-ink">Intake Over Last 7 Days</h2>
            <p className="text-[11px] text-ink-muted">Daily volume trend</p>
          </div>
          {loading ? (
            <div className="h-64 w-full bg-paper animate-pulse rounded-lg" />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#ffffff',
                      fontSize: '11px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#2563eb' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      {/* Priority Dispatch Queue (Prompt F2) */}
      <PriorityQueue />

      {/* Latest Incidents Table */}
      <section className="card p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-xs font-black uppercase tracking-wider text-ink">Recent Incoming Reports</h2>
            <span className="title-bar" aria-hidden="true" />
          </div>
          <Link
            to="/admin/incidents?sort=newest"
            className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:underline"
          >
            View all incidents <Icon name="arrow-right" className="h-3.5 w-3.5" />
          </Link>
        </div>
        {!loading && latest.length === 0 ? (
          <p className="py-10 text-center text-xs text-ink-muted">No incidents recorded yet.</p>
        ) : (
          <IncidentTable items={latest} loading={loading} compact />
        )}
      </section>
    </div>
  );
}
