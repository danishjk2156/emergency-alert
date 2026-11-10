import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Search } from 'lucide-react';
import type { Incident, IncidentFilters, IncidentStatus, IncidentSeverity, IncidentCategory } from '../types';
import { listIncidents } from '../api/incidents';
import IncidentCard from '../components/IncidentCard';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<IncidentFilters>({});

  const fetchIncidents = () => {
    setLoading(true);
    listIncidents(filters)
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const selectClasses =
    'bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] focus:border-blue-500';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Incidents</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Link
          to="/report"
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-lg transition-colors"
        >
          <PlusCircle size={18} />
          Report Incident
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
        <Search size={18} className="text-[var(--text-muted)]" />

        <select
          value={filters.status || ''}
          onChange={(e) => setFilters({ ...filters, status: (e.target.value || undefined) as IncidentStatus | undefined })}
          className={selectClasses}
        >
          <option value="">All Statuses</option>
          <option value="reported">Reported</option>
          <option value="investigating">Investigating</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={filters.severity || ''}
          onChange={(e) => setFilters({ ...filters, severity: (e.target.value || undefined) as IncidentSeverity | undefined })}
          className={selectClasses}
        >
          <option value="">All Severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>

        <select
          value={filters.category || ''}
          onChange={(e) => setFilters({ ...filters, category: (e.target.value || undefined) as IncidentCategory | undefined })}
          className={selectClasses}
        >
          <option value="">All Categories</option>
          <option value="fire">Fire</option>
          <option value="medical">Medical</option>
          <option value="natural_disaster">Natural Disaster</option>
          <option value="hazmat">Hazmat</option>
          <option value="infrastructure">Infrastructure</option>
          <option value="security">Security</option>
          <option value="traffic">Traffic</option>
          <option value="other">Other</option>
        </select>

        {(filters.status || filters.severity || filters.category) && (
          <button
            onClick={() => setFilters({})}
            className="text-sm text-red-400 hover:text-red-300 font-medium ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Incident Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent" />
        </div>
      ) : incidents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {incidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No incidents found</h3>
          <p className="text-[var(--text-secondary)]">
            {filters.status || filters.severity || filters.category
              ? 'Try adjusting your filters'
              : 'No incidents have been reported yet'}
          </p>
        </div>
      )}
    </div>
  );
}
