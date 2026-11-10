import { useCallback, useEffect, useState } from 'react';
import { getPrioritizedIncidents, getTeams } from '../api';
import Icon from '../components/Icon';
import MapView from '../components/MapView';
import Spinner from '../components/Spinner';

export default function MapPage() {
  const [incidents, setIncidents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [incData, teamData] = await Promise.all([
        getPrioritizedIncidents(),
        getTeams(),
      ]);
      setIncidents(incData);
      setTeams(teamData);
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => loadData(), 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink">
            Live Emergency Map & Dispatches
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            Real-time geospatial tracking of active incidents, response units, and live dispatch routes.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 py-2 text-xs font-bold uppercase text-ink hover:bg-paper transition-colors shadow-sm"
        >
          <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Map
        </button>
      </div>

      {loading && !incidents.length ? (
        <div className="h-[600px] w-full rounded-xl border border-border bg-white grid place-items-center">
          <div className="text-center">
            <Spinner className="h-8 w-8 text-brand mx-auto" />
            <p className="mt-3 text-xs font-bold text-ink-muted">Loading geospatial coordinates & routes...</p>
          </div>
        </div>
      ) : (
        <MapView incidents={incidents} teams={teams} height="650px" />
      )}
    </div>
  );
}

