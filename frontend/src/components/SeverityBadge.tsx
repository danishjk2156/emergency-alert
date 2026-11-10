import type { IncidentSeverity } from '../types';

const severityConfig: Record<IncidentSeverity, { bg: string; text: string; label: string; icon: string }> = {
  low: { bg: 'bg-slate-700/50 border-slate-500/30', text: 'text-slate-300', label: 'Low', icon: '○' },
  medium: { bg: 'bg-amber-900/50 border-amber-500/30', text: 'text-amber-400', label: 'Medium', icon: '◑' },
  high: { bg: 'bg-orange-900/50 border-orange-500/30', text: 'text-orange-400', label: 'High', icon: '●' },
  critical: { bg: 'bg-red-900/50 border-red-500/30', text: 'text-red-400', label: 'Critical', icon: '⬤' },
};

export default function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const config = severityConfig[severity];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${config.text}`}
    >
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
}
