import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { createTeam, deleteTeam, getTeams, setTeamAvailability, updateTeam } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';
import Spinner from '../components/Spinner';
import { useToast } from '../components/Toast';
import { TEAM_CATEGORIES, teamCategory } from '../constants';

// Fix Leaflet marker icons with clean divIcon
const pinIcon = L.divIcon({
  className: 'custom-leaflet-pin',
  html: `<div style="background-color: #2563eb; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

function MapClickPicker({ position, onPick }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    },
  });
  return position ? <Marker position={position} icon={pinIcon} /> : null;
}

const CATEGORIES = TEAM_CATEGORIES;

/** Next free code like FIRE-04 for a category. */
function suggestCode(teams, category) {
  const prefix = teamCategory(category)?.prefix || 'TEAM';
  const used = new Set(teams.map((t) => String(t.code || '').toUpperCase()));
  for (let n = 1; n < 1000; n++) {
    const code = `${prefix}-${String(n).padStart(2, '0')}`;
    if (!used.has(code)) return code;
  }
  return `${prefix}-${Date.now() % 1000}`;
}

export default function TeamsPage() {
  const toast = useToast();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState('all');
  const [availFilter, setAvailFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formValues, setFormValues] = useState({
    code: '',
    name: '',
    category: 'Fire',
    location_label: '',
    latitude: 13.0418,
    longitude: 80.2341,
  });
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deletingTeam, setDeletingTeam] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Toggling status state
  const [togglingId, setTogglingId] = useState(null);

  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getTeams({
        category: catFilter !== 'all' ? catFilter : undefined,
        availability: availFilter !== 'all' ? availFilter : undefined,
      });
      setTeams(data);
    } catch (err) {
      console.error(err);
      toast('Failed to load response teams.', 'error');
    } finally {
      setLoading(false);
    }
  }, [catFilter, availFilter, toast]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const handleOpenAdd = () => {
    setEditingTeam(null);
    setFormValues({
      code: '',
      name: '',
      category: 'Fire',
      location_label: '',
      latitude: 13.0418,
      longitude: 80.2341,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleOpenEdit = (team) => {
    setEditingTeam(team);
    setFormValues({
      code: team.code || '',
      name: team.name,
      category: team.category,
      location_label: team.location_label || '',
      latitude: team.latitude,
      longitude: team.longitude,
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (formValues.name.trim().length < 2) errors.name = 'Team name must be at least 2 characters.';
    if (formValues.code.trim() && !/^[A-Za-z0-9-]{2,20}$/.test(formValues.code.trim())) errors.code = 'Code: 2–20 letters, digits or dashes.';
    if (formValues.location_label.trim() && formValues.location_label.trim().length < 2) errors.location_label = 'Location label must be at least 2 characters.';
    if (!formValues.category) errors.category = 'Category is required.';
    if (!formValues.location_label.trim()) errors.location_label = 'Location label is required.';
    if (isNaN(Number(formValues.latitude))) errors.latitude = 'Valid latitude is required.';
    if (isNaN(Number(formValues.longitude))) errors.longitude = 'Valid longitude is required.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSaving(true);
    try {
      const payload = { ...formValues, code: formValues.code.trim() || suggestCode(teams, formValues.category) };
      if (editingTeam) {
        await updateTeam(editingTeam.id, payload);
        toast(`Team ${editingTeam.code} updated.`, 'success');
      } else {
        const created = await createTeam(payload);
        toast(`New team ${created.code || created.name} added.`, 'success');
      }
      setModalOpen(false);
      fetchTeams();
    } catch (err) {
      toast(err.message || 'Error saving team.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (team) => {
    setTogglingId(team.id);
    const willBeAvailable = team.status !== 'available';
    try {
      await setTeamAvailability(team.id, willBeAvailable);
      toast(`${team.code} is now marked ${willBeAvailable ? 'Available' : 'Busy'}.`, 'success');
      fetchTeams();
    } catch (err) {
      toast(err.message || 'Failed to update team availability.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTeam) return;
    setDeleteBusy(true);
    try {
      await deleteTeam(deletingTeam.id);
      toast(`Team ${deletingTeam.code} deleted.`, 'success');
      setDeletingTeam(null);
      fetchTeams();
    } catch (err) {
      toast(err.message || 'Failed to delete team.', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-ink">Emergency Response Teams</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Manage deployed rescue units, ambulance fleets, and patrol teams across Chennai.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-md hover:bg-brand-dark transition-colors"
        >
          <Icon name="plus" className="h-4 w-4" />
          Add Response Team
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-ink-muted">
          <Icon name="search" className="h-4 w-4" />
          Filter By:
        </div>

        {/* Category Dropdown */}
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="rounded-lg border border-border bg-paper/50 px-3 py-1.5 text-xs font-semibold text-ink focus:border-brand focus:outline-none"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>

        {/* Availability Filter */}
        <div className="flex rounded-lg border border-border bg-paper/50 p-0.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => setAvailFilter('all')}
            className={`rounded-md px-3 py-1 transition-colors ${
              availFilter === 'all' ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setAvailFilter('available')}
            className={`rounded-md px-3 py-1 transition-colors ${
              availFilter === 'available' ? 'bg-emerald-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Available
          </button>
          <button
            type="button"
            onClick={() => setAvailFilter('busy')}
            className={`rounded-md px-3 py-1 transition-colors ${
              availFilter === 'busy' ? 'bg-danger text-white shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            Busy
          </button>
        </div>

        <button
          type="button"
          onClick={fetchTeams}
          title="Reload teams"
          className="ml-auto rounded-lg border border-border p-2 text-ink-muted hover:bg-paper hover:text-ink transition-colors"
        >
          <Icon name="refresh" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Teams Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {loading && !teams.length ? (
          <div className="p-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent align-[-0.125em]" />
            <p className="mt-3 text-xs font-semibold text-ink-muted">Loading emergency teams...</p>
          </div>
        ) : !teams.length ? (
          <div className="p-12 text-center">
            <p className="font-bold text-ink">No response teams match your filters.</p>
            <p className="text-xs text-ink-muted mt-1">Try clearing or changing your category or availability filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-paper/50 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Team Name</th>
                  <th scope="col" className="px-4 py-3">Category</th>
                  <th scope="col" className="px-4 py-3">Base Location</th>
                  <th scope="col" className="px-4 py-3">Coordinates</th>
                  <th scope="col" className="px-4 py-3">Availability</th>
                  <th scope="col" className="px-4 py-3">Assigned Incident</th>
                  <th scope="col" className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {teams.map((team) => {
                  const isBusy = team.status === 'busy' || Boolean(team.assigned_incident_id);
                  const isToggling = togglingId === team.id;
                  const catObj = teamCategory(team.category) || { icon: '⚠️', name: team.category };

                  return (
                    <tr key={team.id} className="hover:bg-paper/30 transition-colors">
                      {/* Code */}
                      <td className="px-4 py-3 font-mono font-bold text-brand">
                        {team.code}
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-ink">{team.name}</span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-paper px-2 py-0.5 font-medium text-ink">
                          <span>{catObj.icon}</span>
                          <span>{team.category}</span>
                        </span>
                      </td>

                      {/* Location Label */}
                      <td className="px-4 py-3 text-ink-muted flex items-center gap-1 mt-1.5">
                        <Icon name="pin" className="h-3 w-3 inline text-ink-muted shrink-0" />
                        <span className="truncate max-w-[180px]">{team.location_label}</span>
                      </td>

                      {/* Coordinates */}
                      <td className="px-4 py-3 font-mono text-[11px] text-ink-muted">
                        {team.latitude?.toFixed(4)}, {team.longitude?.toFixed(4)}
                      </td>

                      {/* Availability Badge */}
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(team)}
                          disabled={isToggling}
                          title="Click to toggle availability"
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase transition-all hover:scale-105 ${
                            !isBusy
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              : 'bg-red-50 text-danger border-red-200 hover:bg-red-100'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${!isBusy ? 'bg-emerald-600' : 'bg-danger'}`} />
                          {isToggling ? 'Updating...' : !isBusy ? 'Available' : 'Busy'}
                        </button>
                      </td>

                      {/* Assigned Incident */}
                      <td className="px-4 py-3">
                        {team.assigned_incident ? (
                          <Link
                            to={`/admin/incidents/${team.assigned_incident.id}`}
                            className="inline-flex items-center gap-1.5 text-brand hover:underline font-bold"
                          >
                            <span className="font-mono">{team.assigned_incident.ref_code}</span>
                            <span className="truncate max-w-[120px] text-ink text-[11px] font-normal">
                              ({team.assigned_incident.title})
                            </span>
                          </Link>
                        ) : (
                          <span className="text-ink-muted text-[11px]">None</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(team)}
                            className="rounded p-1 text-ink-muted hover:bg-paper hover:text-ink transition-colors"
                            title="Edit team"
                          >
                            <Icon name="search" className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTeam(team)}
                            disabled={isBusy}
                            title={isBusy ? 'Cannot delete an active/busy team' : 'Delete team'}
                            className={`rounded p-1 transition-colors ${
                              isBusy
                                ? 'text-ink-muted/30 cursor-not-allowed'
                                : 'text-danger hover:bg-red-50 hover:text-red-700'
                            }`}
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-charcoal/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between border-b border-border bg-paper/60 px-6 py-4">
              <h2 className="text-base font-black uppercase tracking-tight text-ink">
                {editingTeam ? `Edit Team — ${editingTeam.code}` : 'Add New Response Team'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-paper hover:text-ink"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold uppercase text-ink">Team Name</label>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(e) => setFormValues((v) => ({ ...v, name: e.target.value }))}
                  placeholder="e.g. Guindy Fire Tender 2"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                />
                {formErrors.name && <p className="mt-1 text-xs text-danger">{formErrors.name}</p>}
              </div>

              {/* Code */}
              <div>
                <label className="block text-xs font-bold uppercase text-ink">
                  Team Code <span className="text-[10px] text-ink-muted normal-case">(leave empty to auto-generate)</span>
                </label>
                <input
                  type="text"
                  value={formValues.code}
                  maxLength={20}
                  onChange={(e) => setFormValues((v) => ({ ...v, code: e.target.value.toUpperCase() }))}
                  placeholder={suggestCode(teams.filter((t) => t.id !== editingTeam?.id), formValues.category)}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 font-mono text-xs font-medium text-ink focus:border-brand focus:outline-none"
                />
                {formErrors.code && <p className="mt-1 text-xs text-danger">{formErrors.code}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-bold uppercase text-ink">Response Category</label>
                <select
                  value={formValues.category}
                  onChange={(e) => setFormValues((v) => ({ ...v, category: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Location Label */}
              <div>
                <label className="block text-xs font-bold uppercase text-ink">Base / Depot Location Label</label>
                <input
                  type="text"
                  value={formValues.location_label}
                  onChange={(e) => setFormValues((v) => ({ ...v, location_label: e.target.value }))}
                  placeholder="e.g. Adyar Bus Depot Fire Outpost"
                  className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-xs font-medium text-ink focus:border-brand focus:outline-none"
                />
                {formErrors.location_label && (
                  <p className="mt-1 text-xs text-danger">{formErrors.location_label}</p>
                )}
              </div>

              {/* Mini Leaflet Map Picker */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase text-ink">
                    Pick Depot on Map <span className="text-[10px] text-ink-muted lowercase">(click map to pin)</span>
                  </label>
                  <span className="font-mono text-[11px] text-brand">
                    {formValues.latitude.toFixed(4)}, {formValues.longitude.toFixed(4)}
                  </span>
                </div>
                <div className="mt-1 h-44 w-full rounded-lg overflow-hidden border border-border">
                  <MapContainer
                    center={[formValues.latitude, formValues.longitude]}
                    zoom={12}
                    scrollWheelZoom={false}
                    className="h-full w-full"
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapClickPicker
                      position={[formValues.latitude, formValues.longitude]}
                      onPick={(lat, lng) => setFormValues((v) => ({ ...v, latitude: lat, longitude: lng }))}
                    />
                  </MapContainer>
                </div>
              </div>

              {/* Lat / Long inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formValues.latitude}
                    onChange={(e) => setFormValues((v) => ({ ...v, latitude: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-xs font-mono text-ink"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-muted">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formValues.longitude}
                    onChange={(e) => setFormValues((v) => ({ ...v, longitude: Number(e.target.value) }))}
                    className="mt-1 w-full rounded-md border border-border px-2.5 py-1.5 text-xs font-mono text-ink"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-border px-4 py-2 text-xs font-bold text-ink hover:bg-paper"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-dark transition-colors"
                >
                  {saving && <Spinner />}
                  {editingTeam ? 'Save Changes' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingTeam)}
        title={`Delete Team ${deletingTeam?.code}?`}
        message={`Are you sure you want to permanently remove "${deletingTeam?.name}"? This action cannot be undone.`}
        confirmLabel="Delete Team"
        busy={deleteBusy}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTeam(null)}
      />
    </div>
  );
}

