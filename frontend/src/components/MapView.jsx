import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';

function haversineDistKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Number((2 * R * Math.asin(Math.sqrt(a))).toFixed(1));
}

function createIncidentIcon(inc) {
  const label = inc.priority_label || inc.severity || 'Medium';
  const colors = {
    Critical: '#dc2626',
    High: '#ea580c',
    Medium: '#eab308',
    Low: '#16a34a',
  };
  const bg = colors[label] || '#eab308';
  const emoji = inc.category?.icon || '⚠️';

  return L.divIcon({
    className: 'custom-incident-marker',
    html: `
      <div style="
        position: relative;
        background-color: ${bg};
        width: 34px;
        height: 34px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        color: white;
      ">
        ${emoji}
        ${
          label === 'Critical'
            ? `<span style="
                position: absolute;
                inset: -4px;
                border-radius: 50%;
                border: 2px solid #dc2626;
                animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></span>`
            : ''
        }
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function createTeamIcon(team) {
  const isAvail = team.status === 'available' && !team.assigned_incident_id;
  const bg = isAvail ? '#2563eb' : '#64748b';

  return L.divIcon({
    className: 'custom-team-marker',
    html: `
      <div style="
        background-color: ${bg};
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 10px;
        color: white;
        font-family: monospace;
      ">
        ${team.code ? team.code.slice(0, 3) : 'UNIT'}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -15],
  });
}

function AutoFitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || !points.length) return;
    try {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    } catch (e) {
      console.warn('Could not fit map bounds:', e);
    }
  }, [map, points]);

  return null;
}

function RoutePolyline({ inc, team }) {
  const [routeCoords, setRouteCoords] = useState(null);
  const [eta, setEta] = useState(null);

  const directDist = useMemo(() => {
    return haversineDistKm(team.latitude, team.longitude, inc.latitude, inc.longitude);
  }, [team.latitude, team.longitude, inc.latitude, inc.longitude]);

  useEffect(() => {
    let active = true;
    const fetchOsrmRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${team.longitude},${team.latitude};${inc.longitude},${inc.latitude}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
        if (!res.ok) throw new Error('OSRM error');
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          const coords = data.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const durationMins = Math.max(3, Math.round(data.routes[0].duration / 60));
          if (active) {
            setRouteCoords(coords);
            setEta(durationMins);
            return;
          }
        }
      } catch {
        // Fallback to straight line
      }
      if (active) {
        setRouteCoords([
          [team.latitude, team.longitude],
          [inc.latitude, inc.longitude],
        ]);
        setEta(Math.max(3, Math.round((directDist || 5) * 2.5 + 3)));
      }
    };

    fetchOsrmRoute();
    return () => {
      active = false;
    };
  }, [inc.latitude, inc.longitude, team.latitude, team.longitude, directDist]);

  if (!routeCoords) return null;

  const midIdx = Math.floor(routeCoords.length / 2);
  const midPoint = routeCoords[midIdx] || routeCoords[0];

  return (
    <>
      <Polyline
        positions={routeCoords}
        pathOptions={{
          color: '#dc2626',
          weight: 4,
          dashArray: '8, 8',
          opacity: 0.85,
        }}
      />
      <Tooltip
        position={midPoint}
        permanent
        direction="top"
        className="custom-route-tooltip"
      >
        <span className="font-mono text-[10px] font-black text-danger bg-white px-1.5 py-0.5 rounded shadow">
          {directDist} km · ETA ~{eta} min
        </span>
      </Tooltip>
    </>
  );
}

export default function MapView({
  incidents = [],
  teams = [],
  selectedIncidentId = null,
  height = '500px',
  compact = false,
}) {
  const [showIncidents, setShowIncidents] = useState(true);
  const [showTeams, setShowTeams] = useState(true);

  // Filter valid incidents with coordinates
  const validIncidents = useMemo(() => {
    return incidents.filter((i) => i.latitude != null && i.longitude != null);
  }, [incidents]);

  // Filter valid teams with coordinates
  const validTeams = useMemo(() => {
    return teams.filter((t) => t.latitude != null && t.longitude != null);
  }, [teams]);

  // Points for auto-fitting bounds
  const allPoints = useMemo(() => {
    const pts = [];
    if (showIncidents) validIncidents.forEach((i) => pts.push([i.latitude, i.longitude]));
    if (showTeams) validTeams.forEach((t) => pts.push([t.latitude, t.longitude]));
    return pts.length > 0 ? pts : [[13.0418, 80.2341]];
  }, [showIncidents, showTeams, validIncidents, validTeams]);

  // Find assignments for drawing routes
  const assignedPairs = useMemo(() => {
    const pairs = [];
    validIncidents.forEach((inc) => {
      if (selectedIncidentId && inc.id !== selectedIncidentId) return;
      if (inc.assigned_team_id || inc.assigned_team) {
        const teamId = inc.assigned_team_id || inc.assigned_team?.id;
        const team = validTeams.find((t) => t.id === teamId);
        if (team) {
          pairs.push({ inc, team });
        }
      }
    });
    return pairs;
  }, [validIncidents, validTeams, selectedIncidentId]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-sm bg-paper" style={{ height }}>
      {/* Map Layer */}
      <MapContainer
        center={[13.0418, 80.2341]}
        zoom={12}
        scrollWheelZoom={!compact}
        className="h-full w-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <AutoFitBounds points={allPoints} />

        {/* Route Lines between Assigned Teams & Incidents */}
        {assignedPairs.map(({ inc, team }) => (
          <RoutePolyline key={`${inc.id}-${team.id}`} inc={inc} team={team} />
        ))}

        {/* Incident Markers */}
        {showIncidents &&
          validIncidents.map((inc) => (
            <Marker
              key={inc.id}
              position={[inc.latitude, inc.longitude]}
              icon={createIncidentIcon(inc)}
            >
              <Popup className="custom-popup">
                <div className="p-1 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b pb-1">
                    <span className="font-mono font-bold text-brand">{inc.ref_code}</span>
                    <span className="rounded bg-red-100 text-danger px-1 text-[10px] font-bold">
                      {inc.priority_label || inc.severity}
                    </span>
                  </div>
                  <div className="font-bold text-ink leading-tight">{inc.title}</div>
                  <div className="text-[11px] text-ink-muted">{inc.location}</div>
                  <div className="flex items-center justify-between pt-1 text-[11px] font-semibold">
                    <span>Status: {inc.status}</span>
                    <span>Casualties: {inc.people_affected || 0}</span>
                  </div>
                  <div className="pt-1">
                    <Link
                      to={`/admin/incidents/${inc.id}`}
                      className="inline-block text-brand hover:underline font-bold text-[11px]"
                    >
                      View Incident Details →
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* Team Markers */}
        {showTeams &&
          validTeams.map((team) => (
            <Marker
              key={team.id}
              position={[team.latitude, team.longitude]}
              icon={createTeamIcon(team)}
            >
              <Popup>
                <div className="p-1 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2 border-b pb-1">
                    <span className="font-mono font-bold text-blue-700">{team.code}</span>
                    <span
                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                        team.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-danger'
                      }`}
                    >
                      {team.status}
                    </span>
                  </div>
                  <div className="font-bold text-ink">{team.name}</div>
                  <div className="text-[11px] text-ink-muted">{team.location_label}</div>
                  {team.assigned_incident_id && (
                    <div className="text-[11px] font-semibold text-danger pt-1">
                      Assigned to Incident #{team.assigned_incident_id}
                    </div>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
      </MapContainer>

      {/* Floating Toggles & Legend Overlay */}
      {!compact && (
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2 rounded-xl bg-white/95 p-3.5 shadow-lg backdrop-blur-md border border-border text-xs">
          <div className="font-bold uppercase tracking-wider text-ink-muted text-[10px]">
            Layers & Filters
          </div>

          <label className="flex items-center gap-2 cursor-pointer font-semibold text-ink">
            <input
              type="checkbox"
              checked={showIncidents}
              onChange={(e) => setShowIncidents(e.target.checked)}
              className="rounded text-brand focus:ring-brand"
            />
            <span>Incidents ({validIncidents.length})</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer font-semibold text-ink">
            <input
              type="checkbox"
              checked={showTeams}
              onChange={(e) => setShowTeams(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Response Teams ({validTeams.length})</span>
          </label>

          <div className="border-t border-border pt-2.5 mt-1 space-y-1 text-[11px]">
            <div className="font-bold uppercase tracking-wider text-ink-muted text-[10px] mb-1">
              Priority Legend
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              <span>Critical Emergency</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span>High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
              <span>Medium Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              <span>Low Priority</span>
            </div>
            <div className="flex items-center gap-2 mt-1 pt-1 border-t border-border">
              <span className="h-2.5 w-2.5 rounded bg-blue-600" />
              <span>Available Unit</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded bg-slate-500" />
              <span>Busy / Dispatched</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
