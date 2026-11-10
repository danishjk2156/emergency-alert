import { Link } from 'react-router-dom';
import { MapPin, Clock } from 'lucide-react';
import type { Incident, IncidentCategory } from '../types';
import StatusBadge from './StatusBadge';
import SeverityBadge from './SeverityBadge';

const categoryIcons: Record<IncidentCategory, string> = {
  fire: '🔥',
  medical: '🏥',
  natural_disaster: '🌊',
  hazmat: '☣️',
  infrastructure: '🏗️',
  security: '🔒',
  traffic: '🚗',
  other: '📋',
};

const categoryLabels: Record<IncidentCategory, string> = {
  fire: 'Fire',
  medical: 'Medical',
  natural_disaster: 'Natural Disaster',
  hazmat: 'Hazmat',
  infrastructure: 'Infrastructure',
  security: 'Security',
  traffic: 'Traffic',
  other: 'Other',
};

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link
      to={`/incidents/${incident.id}`}
      className="block bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-5 hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-light)] transition-all duration-200 animate-fade-in"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{categoryIcons[incident.category]}</span>
          <span className="text-xs text-[var(--text-muted)] uppercase tracking-wide font-medium">
            {categoryLabels[incident.category]}
          </span>
        </div>
        <SeverityBadge severity={incident.severity} />
      </div>

      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2 line-clamp-2">
        {incident.title}
      </h3>

      <p className="text-sm text-[var(--text-secondary)] mb-4 line-clamp-2">
        {incident.description}
      </p>

      <div className="flex items-center justify-between">
        <StatusBadge status={incident.status} />
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
          {incident.location.address && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              <span className="truncate max-w-[120px]">{incident.location.address}</span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {timeAgo(incident.created_at)}
          </span>
        </div>
      </div>

      {incident.assigned_to && (
        <div className="mt-3 pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
          Assigned to: <span className="text-[var(--text-secondary)] font-medium">{incident.assigned_to}</span>
        </div>
      )}
    </Link>
  );
}
