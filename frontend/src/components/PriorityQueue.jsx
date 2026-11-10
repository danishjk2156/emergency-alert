import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPrioritizedIncidents } from '../api';
import Icon from './Icon';
import StatusChip from './StatusChip';

function formatElapsed(isoDate, nowMs) {
  if (!isoDate) return '—';
  const diffSec = Math.max(0, Math.floor((nowMs - new Date(isoDate).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  return `${diffHr}h ${remMin}m ago`;
}

function PriorityBadge({ label = 'Medium', score = 50, breakdown }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const colors = {
    Critical: 'bg-danger text-white border-danger shadow-sm',
    High: 'bg-amber-600 text-white border-amber-600 shadow-sm',
    Medium: 'bg-amber-100 text-amber-900 border-amber-300',
    Low: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };

  return (
    <div className="relative inline-block" onMouseEnter={() => setShowTooltip(true)} onMouseLeave={() => setShowTooltip(false)}>
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-black uppercase tracking-wide cursor-help transition-transform hover:scale-105 ${
          colors[label] || colors.Medium
        }`}
      >
        {label === 'Critical' && (
          <span className="relative flex h-2 w-2" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
        )}
        <span>{label}</span>
        <span className="font-mono text-[11px] opacity-90">· {score}</span>
      </span>

      {showTooltip && (
        <div className="absolute left-1/2 bottom-full z-50 mb-2 w-56 -translate-x-1/2 rounded-lg bg-charcoal p-3 text-left text-xs text-white shadow-xl ring-1 ring-white/10 animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 font-bold">
            <span>Score Breakdown</span>
            <span className="font-mono text-brand-light">{score} / 100</span>
          </div>
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-white/70">Severity Weight</span>
              <span className="font-mono text-amber-400">+{breakdown?.severity ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">People Affected</span>
              <span className="font-mono text-danger-light">+{breakdown?.people ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Time Elapsed</span>
              <span className="font-mono text-cyan-400">+{breakdown?.time ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/70">Category Urgency</span>
              <span className="font-mono text-emerald-400">+{breakdown?.category ?? 0}</span>
            </div>
          </div>
          <div className="mt-2 border-t border-white/10 pt-1 text-[10px] text-white/50">
            Higher score = faster dispatch priority
          </div>
          <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-charcoal" />
        </div>
      )}
    </div>
  );
}

export default function PriorityQueue({ onSelectIncident }) {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const fetchQueue = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const data = await getPrioritizedIncidents();
      setIncidents(data);
      setError(null);
    } catch (err) {
      console.error('Failed to load priority queue:', err);
      setError('Unable to load priority queue.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchQueue(false);
    const interval = setInterval(() => fetchQueue(true), 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Update clock every minute for live "time since reported"
  useEffect(() => {
    const clock = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(clock);
  }, []);

  const handleRowClick = (id) => {
    if (onSelectIncident) {
      onSelectIncident(id);
    } else {
      navigate(`/admin/incidents/${id}`);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-paper/60 px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-danger/10 text-danger">
              <Icon name="siren" className="h-4 w-4" />
            </span>
            <h2 className="text-base font-black text-ink tracking-tight">Active Dispatch Priority Queue</h2>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            Auto-ranked dynamically by emergency severity, casualties, wait duration, and hazard category.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Updates every 30s
          </span>
          <button
            type="button"
            onClick={() => fetchQueue(false)}
            title="Refresh queue"
            className="rounded-md border border-border bg-white p-1.5 text-ink-muted hover:bg-paper hover:text-ink transition-colors"
          >
            <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !incidents.length ? (
        <div className="p-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent align-[-0.125em]" />
          <p className="mt-2 text-xs font-semibold text-ink-muted">Ranking active incidents...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-danger text-sm">{error}</div>
      ) : !incidents.length ? (
        <div className="p-10 text-center">
          <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <Icon name="check-circle" className="h-6 w-6" />
          </div>
          <p className="font-bold text-ink">No active incidents in queue</p>
          <p className="text-xs text-ink-muted mt-0.5">All reported emergencies are currently assigned or resolved.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-paper/30 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3 text-center">Rank</th>
                <th scope="col" className="px-4 py-3">Incident</th>
                <th scope="col" className="px-4 py-3">Category</th>
                <th scope="col" className="px-4 py-3">Priority Score</th>
                <th scope="col" className="px-4 py-3 text-center">Casualties</th>
                <th scope="col" className="px-4 py-3">Reported</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Assigned Team</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incidents.map((inc, index) => {
                const isCriticalUnassigned =
                  (inc.priority_label === 'Critical' || inc.severity === 'Critical') &&
                  (!inc.assigned_team && inc.status === 'Reported');

                const rank = inc.rank ?? index + 1;

                return (
                  <tr
                    key={inc.id}
                    onClick={() => handleRowClick(inc.id)}
                    className={`cursor-pointer transition-all hover:bg-brand/5 ${
                      isCriticalUnassigned
                        ? 'bg-red-50/70 border-l-4 border-l-danger animate-[pulse_2.5s_cubic-bezier(0.4,0,0.6,1)_infinite]'
                        : index % 2 === 0
                        ? 'bg-white'
                        : 'bg-paper/20'
                    }`}
                  >
                    {/* Rank */}
                    <td className="px-4 py-3.5 text-center font-mono font-black text-ink">
                      <span
                        className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs ${
                          rank === 1
                            ? 'bg-danger text-white'
                            : rank <= 3
                            ? 'bg-amber-100 text-amber-900 font-bold'
                            : 'bg-paper text-ink-muted'
                        }`}
                      >
                        #{rank}
                      </span>
                    </td>

                    {/* Incident Title & Ref */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-brand">
                          {inc.ref_code}
                        </span>
                        {isCriticalUnassigned && (
                          <span className="rounded bg-danger px-1.5 py-0.2 text-[9px] font-black uppercase text-white tracking-wider animate-pulse">
                            Needs Unit
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-ink max-w-xs truncate mt-0.5" title={inc.title}>
                        {inc.title}
                      </div>
                      <div className="text-[11px] text-ink-muted truncate max-w-xs flex items-center gap-1">
                        <Icon name="pin" className="h-3 w-3 inline shrink-0" />
                        {inc.location}
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 font-medium text-ink">
                        <span>{inc.category?.icon || '⚠️'}</span>
                        <span>{inc.category?.name || 'Emergency'}</span>
                      </span>
                    </td>

                    {/* Priority Badge */}
                    <td className="px-4 py-3.5">
                      <PriorityBadge
                        label={inc.priority_label}
                        score={inc.priority_score}
                        breakdown={inc.priority_breakdown}
                      />
                    </td>

                    {/* Casualties / People */}
                    <td className="px-4 py-3.5 text-center font-mono font-bold">
                      {inc.people_affected > 0 ? (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <Icon name="users" className="h-3.5 w-3.5" />
                          {inc.people_affected}
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>

                    {/* Live Time Since Reported */}
                    <td className="px-4 py-3.5 whitespace-nowrap text-ink-muted font-mono text-[11px]">
                      {formatElapsed(inc.created_at, nowMs)}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusChip status={inc.status} />
                    </td>

                    {/* Assigned Team */}
                    <td className="px-4 py-3.5">
                      {inc.assigned_team ? (
                        <span className="inline-flex items-center gap-1.5 rounded bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                          <span className="font-mono">{inc.assigned_team.code}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-ink-muted font-medium text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          Unassigned
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
