import { useCallback, useEffect, useState } from 'react';
import { assignTeam, getNearestTeams, unassignTeam, updateStatus } from '../api';
import Icon from './Icon';
import Spinner from './Spinner';
import { useToast } from './Toast';

const STEPS = ['Reported', 'Assigned', 'In Progress', 'Resolved'];

export default function AssignmentPanel({ incident, onIncidentUpdated }) {
  const toast = useToast();
  const [nearestTeams, setNearestTeams] = useState([]);
  const [loadingNearest, setLoadingNearest] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [updatingLifecycle, setUpdatingLifecycle] = useState(false);

  const isAssigned = Boolean(incident?.assigned_team || incident?.assigned_team_id);
  const currentStatus = incident?.status || 'Reported';

  const loadNearest = useCallback(async () => {
    if (!incident?.id || isAssigned) return;
    setLoadingNearest(true);
    try {
      const data = await getNearestTeams(incident.id);
      setNearestTeams(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNearest(false);
    }
  }, [incident?.id, isAssigned]);

  useEffect(() => {
    loadNearest();
  }, [loadNearest]);

  const handleAssign = async (teamId = null) => {
    setAssigningId(teamId || 'auto');
    try {
      const res = await assignTeam(incident.id, teamId);
      toast(
        teamId
          ? 'Response team dispatched successfully.'
          : `Nearest team ${res?.assigned_team?.code || ''} automatically assigned.`,
        'success',
      );
      if (onIncidentUpdated) onIncidentUpdated();
    } catch (err) {
      if (err.status === 409) {
        toast(err.message || 'Team just became busy! Refreshing available units...', 'error');
        loadNearest();
      } else {
        toast(err.message || 'Failed to assign team.', 'error');
      }
    } finally {
      setAssigningId(null);
    }
  };

  const handleUnassign = async () => {
    setUpdatingLifecycle(true);
    try {
      await unassignTeam(incident.id);
      toast('Team unassigned. Incident returned to Reported state.', 'info');
      if (onIncidentUpdated) onIncidentUpdated();
      loadNearest();
    } catch (err) {
      toast(err.message || 'Failed to unassign team.', 'error');
    } finally {
      setUpdatingLifecycle(false);
    }
  };

  const handleNextStep = async () => {
    let next = null;
    let note = '';
    if (currentStatus === 'Assigned') {
      next = 'In Progress';
      note = 'Team arrived on scene, emergency response in progress.';
    } else if (currentStatus === 'In Progress') {
      next = 'Resolved';
      note = 'Incident resolved on site, area secured.';
    }

    if (!next) return;
    setUpdatingLifecycle(true);
    try {
      await updateStatus(incident.id, next, note);
      toast(`Status transitioned to ${next}.`, 'success');
      if (onIncidentUpdated) onIncidentUpdated();
    } catch (err) {
      toast(err.message || 'Failed to update incident step.', 'error');
    } finally {
      setUpdatingLifecycle(false);
    }
  };

  // Compute active step index for stepper
  const currentStepIdx = Math.max(
    0,
    STEPS.indexOf(currentStatus === 'Pending' ? 'Reported' : currentStatus),
  );

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-ink">
          <Icon name="siren" className="h-4 w-4 text-brand" />
          Dispatch Lifecycle & Team Assignment
        </h2>
        {isAssigned && (
          <span className="rounded-full bg-blue-100 text-blue-800 px-2.5 py-0.5 text-[11px] font-bold">
            Unit Assigned
          </span>
        )}
      </div>

      {/* When Team is Assigned: Team Card + Stepper */}
      {isAssigned ? (
        <div className="space-y-5">
          {/* Assigned Team Card */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-blue-700 bg-white border border-blue-200 rounded px-2 py-0.5">
                    {incident.assigned_team?.code || 'TEAM'}
                  </span>
                  <span className="text-xs font-bold text-ink">
                    {incident.assigned_team?.name || 'Assigned Response Unit'}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
                  <span className="flex items-center gap-1">
                    <Icon name="pin" className="h-3.5 w-3.5 text-blue-600" />
                    {incident.assigned_team?.location_label || 'Depot'}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <Icon name="clock" className="h-3.5 w-3.5 text-blue-600" />
                    ETA: ~{incident.assigned_team?.eta_mins ?? 8} min
                  </span>
                </div>
              </div>

              {currentStatus === 'Assigned' && (
                <button
                  type="button"
                  onClick={handleUnassign}
                  disabled={updatingLifecycle}
                  className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-danger hover:bg-red-50 transition-colors"
                >
                  Unassign
                </button>
              )}
            </div>
          </div>

          {/* 4-Step Horizontal Lifecycle Stepper */}
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-ink-muted mb-3">
              Emergency Response Lifecycle
            </p>
            <div className="relative flex items-center justify-between">
              {/* Connecting line */}
              <div className="absolute top-3 left-4 right-4 h-0.5 bg-border -z-0" />
              <div
                className="absolute top-3 left-4 h-0.5 bg-brand transition-all duration-300 -z-0"
                style={{ width: `${(currentStepIdx / (STEPS.length - 1)) * 90}%` }}
              />

              {STEPS.map((step, idx) => {
                const isPast = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;

                return (
                  <div key={step} className="flex flex-col items-center z-10">
                    <div
                      className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black transition-all ${
                        isCurrent
                          ? 'bg-brand text-white ring-4 ring-brand/20 scale-110 shadow-md'
                          : isPast
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white border-2 border-border text-ink-muted'
                      }`}
                    >
                      {isPast ? <Icon name="check" className="h-3.5 w-3.5" /> : idx + 1}
                    </div>
                    <span
                      className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider ${
                        isCurrent
                          ? 'text-brand'
                          : isPast
                          ? 'text-emerald-700'
                          : 'text-ink-muted'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Lifecycle Action Button */}
          {currentStatus === 'Assigned' && (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={updatingLifecycle}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-amber-700 transition-colors"
            >
              {updatingLifecycle ? <Spinner /> : <Icon name="arrow-right" className="h-4 w-4" />}
              Mark In Progress (Unit Arrived)
            </button>
          )}

          {currentStatus === 'In Progress' && (
            <button
              type="button"
              onClick={handleNextStep}
              disabled={updatingLifecycle}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md hover:bg-emerald-700 transition-colors"
            >
              {updatingLifecycle ? <Spinner /> : <Icon name="check-circle" className="h-4 w-4" />}
              Mark Resolved (Incident Handled)
            </button>
          )}

          {currentStatus === 'Resolved' && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
              <Icon name="check-circle" className="h-4 w-4 text-emerald-600" />
              Incident has been successfully resolved and closed.
            </div>
          )}
        </div>
      ) : (
        /* When Unassigned: Nearest Teams list + Auto-assign */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-ink-muted">
              Select an available response team or auto-assign the closest team.
            </p>
            <button
              type="button"
              onClick={() => handleAssign(null)}
              disabled={assigningId !== null || !nearestTeams.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white shadow hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {assigningId === 'auto' ? <Spinner /> : <Icon name="crosshair" className="h-3.5 w-3.5" />}
              Auto-Assign Nearest
            </button>
          </div>

          {loadingNearest ? (
            <div className="py-6 text-center">
              <Spinner className="h-5 w-5 text-brand mx-auto" />
              <p className="mt-2 text-xs text-ink-muted">Calculating closest response teams & ETAs...</p>
            </div>
          ) : !nearestTeams.length ? (
            <div className="rounded-lg border border-dashed border-border p-5 text-center text-xs text-ink-muted">
              No response teams currently available. All units are busy on active incidents.
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-paper/30 overflow-hidden">
              {nearestTeams.map((team) => (
                <div
                  key={team.id}
                  className={`flex flex-wrap items-center justify-between gap-3 p-3 transition-colors hover:bg-white ${
                    team.recommended ? 'bg-amber-50/70 border-l-4 border-l-amber-500' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-brand bg-white border border-border px-1.5 py-0.5 rounded">
                        {team.code}
                      </span>
                      <span className="text-xs font-bold text-ink">{team.name}</span>
                      {team.recommended && (
                        <span className="rounded bg-amber-500 px-1.5 py-0.2 text-[9px] font-black uppercase text-white tracking-wider">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-ink-muted">
                      <span>{team.location_label}</span>
                      <span>·</span>
                      <span className="font-mono font-semibold text-ink">
                        {team.distance_km} km away
                      </span>
                      <span>·</span>
                      <span className="font-mono font-semibold text-emerald-700">
                        ETA ~{team.eta_mins} min
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAssign(team.id)}
                    disabled={assigningId !== null}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-brand hover:text-white hover:border-brand transition-colors"
                  >
                    {assigningId === team.id ? <Spinner /> : null}
                    Assign Team
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
