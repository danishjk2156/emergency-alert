import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react';
import type { DashboardStats, Incident } from '../types';
import { getStats, getRecent } from '../api/dashboard';
import StatsCard from '../components/StatsCard';
import IncidentCard from '../components/IncidentCard';

const SEVERITY_COLORS: Record<string, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

const CATEGORY_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

const STATUS_COLORS: Record<string, string> = {
  reported: '#3b82f6',
  investigating: '#8b5cf6',
  in_progress: '#f59e0b',
  resolved: '#10b981',
  closed: '#64748b',
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getStats(), getRecent(5)])
      .then(([s, r]) => {
        setStats(s);
        setRecent(r);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent" />
      </div>
    );
  }

  if (!stats) return null;

  const severityData = Object.entries(stats.incidents_by_severity).map(([key, value]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value,
    fill: SEVERITY_COLORS[key] || '#64748b',
  }));

  const categoryData = Object.entries(stats.incidents_by_category).map(([key, value], i) => ({
    name: key.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value,
    fill: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));

  const statusData = Object.entries(stats.incidents_by_status).map(([key, value]) => ({
    name: key.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value,
    fill: STATUS_COLORS[key] || '#64748b',
  }));

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-[var(--text-secondary)] mt-1">Emergency incident overview and analytics</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          icon={<Activity size={20} />}
          label="Total Incidents"
          value={stats.total_incidents}
        />
        <StatsCard
          icon={<AlertTriangle size={20} />}
          label="Open Incidents"
          value={stats.open_incidents}
          trend="up"
          trendColor="text-amber-400"
        />
        <StatsCard
          icon={<Clock size={20} />}
          label="In Progress"
          value={stats.in_progress_incidents}
          trend="neutral"
        />
        <StatsCard
          icon={<CheckCircle size={20} />}
          label="Resolved"
          value={stats.resolved_incidents}
          trend="up"
          trendColor="text-emerald-400"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Severity Bar Chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
            By Severity
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={severityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {severityData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Pie Chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
            By Category
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {categoryData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status Donut Chart */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
            By Status
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
              >
                {statusData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
              <Legend
                formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value}</span>}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Incidents */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Recent Incidents</h2>
          <Link
            to="/incidents"
            className="text-sm text-red-400 hover:text-red-300 font-medium"
          >
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {recent.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
          {recent.length === 0 && (
            <div className="col-span-full text-center py-12 text-[var(--text-muted)]">
              No incidents reported yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
