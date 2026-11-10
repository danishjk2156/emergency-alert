import type { IncidentStatus } from '../types';

const statusConfig: Record<IncidentStatus, { bg: string; text: string; label: string }> = {
  reported: { bg: 'bg-blue-900/50 border-blue-500/30', text: 'text-blue-400', label: 'Reported' },
  investigating: { bg: 'bg-purple-900/50 border-purple-500/30', text: 'text-purple-400', label: 'Investigating' },
  in_progress: { bg: 'bg-amber-900/50 border-amber-500/30', text: 'text-amber-400', label: 'In Progress' },
  resolved: { bg: 'bg-emerald-900/50 border-emerald-500/30', text: 'text-emerald-400', label: 'Resolved' },
  closed: { bg: 'bg-gray-800/50 border-gray-500/30', text: 'text-gray-400', label: 'Closed' },
};

export default function StatusBadge({ status }: { status: IncidentStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      {config.label}
    </span>
  );
}
