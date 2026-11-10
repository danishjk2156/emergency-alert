import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import type { Incident, IncidentSeverity } from '../types';
import { listIncidents } from '../api/incidents';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';

// Fix default marker icon issue with Leaflet + bundlers
delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const severityColors: Record<IncidentSeverity, string> = {
  low: '#64748b',
  medium: '#f59e0b',
  high: '#f97316',
  critical: '#ef4444',
};

function createSeverityIcon(severity: IncidentSeverity) {
  const color = severityColors[severity];
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: 28px; height: 28px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

export default function MapPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listIncidents()
      .then(setIncidents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const validIncidents = incidents.filter(
    (i) => i.location.latitude !== 0 && i.location.longitude !== 0
  );

  const center: [number, number] =
    validIncidents.length > 0
      ? [validIncidents[0].location.latitude, validIncidents[0].location.longitude]
      : [40.7128, -74.006]; // Default to NYC

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Incident Map</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          Geographic view of all reported incidents
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-4">
        <span className="text-sm text-[var(--text-muted)] font-medium">Severity:</span>
        {Object.entries(severityColors).map(([severity, color]) => (
          <div key={severity} className="flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-full border border-white/30"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs text-[var(--text-secondary)] capitalize">{severity}</span>
          </div>
        ))}
      </div>

      {/* Map */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl overflow-hidden" style={{ height: '600px' }}>
        <MapContainer
          center={center}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          {validIncidents.map((incident) => (
            <Marker
              key={incident.id}
              position={[incident.location.latitude, incident.location.longitude]}
              icon={createSeverityIcon(incident.severity)}
            >
              <Popup>
                <div className="min-w-[200px] p-1">
                  <h3 className="font-semibold text-sm mb-1">{incident.title}</h3>
                  <div className="flex items-center gap-2 mb-2">
                    <StatusBadge status={incident.status} />
                    <SeverityBadge severity={incident.severity} />
                  </div>
                  {incident.location.address && (
                    <p className="text-xs text-gray-600 mb-2">{incident.location.address}</p>
                  )}
                  <Link
                    to={`/incidents/${incident.id}`}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    View Details →
                  </Link>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {validIncidents.length === 0 && (
        <div className="text-center py-8 text-[var(--text-muted)]">
          No incidents with valid coordinates to display on the map.
        </div>
      )}
    </div>
  );
}
