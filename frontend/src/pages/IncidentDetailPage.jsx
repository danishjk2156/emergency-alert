import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteIncident, getIncident, updateSeverity, updateStatus } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState, { ErrorState } from '../components/EmptyState';
import ReasonChips from '../components/ReasonChips';
import SeverityBadge from '../components/SeverityBadge';
import Spinner from '../components/Spinner';
import StatusChip from '../components/StatusChip';
import Timeline from '../components/Timeline';
import { useToast } from '../components/Toast';
import { SEVERITIES, STATUSES, STATUS_STYLES, formatDateTime } from '../constants';

const HEADER_TONE = {
  Critical: 'border-red-600 bg-red-50',
  High: 'border-orange-400 bg-orange-50',
  Medium: 'border-amber-400 bg-amber-50',
  Low: 'border-slate-200 bg-white',
};

function Panel({ title, children, className = '' }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="mb-3 font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default function IncidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingSeverity, setSavingSeverity] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getIncident(id);
      setIncident(data);
      setNextStatus(data.status);
      setNotFound(false);
    } catch (e) {
      if (e.status === 404) setNotFound(true);
      else setError(e.message || 'Could not load this incident.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function saveStatus() {
    setSavingStatus(true);
    try {
      await updateStatus(incident.id, nextStatus, note);
      toast(`Status updated to ${nextStatus}`);
      setNote('');
      await load();
    } catch (e) {
      toast(e.message || 'Could not update status', 'error');
    } finally {
      setSavingStatus(false);
    }
  }

  async function changeSeverity(level) {
    if (level === incident.severity) return;
    setSavingSeverity(true);
    try {
      await updateSeverity(incident.id, level);
      toast(`Severity set to ${level}`);
      await load();
    } catch (e) {
      toast(e.message || 'Could not change severity', 'error');
    } finally {
      setSavingSeverity(false);
    }
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await deleteIncident(incident.id);
      toast('Incident deleted');
      navigate('/admin/incidents', { replace: true });
    } catch (e) {
      toast(e.message || 'Could not delete incident', 'error');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="skeleton h-4 w-56" />
        <div className="skeleton h-32 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="skeleton h-72 rounded-xl" />
          <div className="skeleton h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <EmptyState
        icon="🔍"
        title="Incident not found"
        message="It may have been deleted."
        action={
          <Link to="/admin/incidents" className="btn">
            ← Back to incidents
          </Link>
        }
      />
    );
  }

  if (error || !incident) return <ErrorState message={error || 'Could not load this incident.'} onRetry={load} />;

  const statusChanged = nextStatus !== incident.status;
  const hasCoords = incident.latitude != null && incident.longitude != null;

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500">
        <Link to="/admin/incidents" className="font-medium hover:text-slate-900 hover:underline">
          ← Incidents
        </Link>{' '}
        / <span className="font-mono">{incident.ref_code}</span>
      </nav>

      <header className={`rounded-xl border-2 p-5 ${HEADER_TONE[incident.severity] || HEADER_TONE.Low}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge level={incident.severity} score={incident.severity_score} upper />
              <StatusChip status={incident.status} />
              {incident.severity_overridden && (
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-bold text-white">Overridden by admin</span>
              )}
              {incident.is_duplicate && (
                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">Duplicate</span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight">{incident.title}</h1>
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
              <span>
                <span aria-hidden="true">{incident.category?.icon}</span> {incident.category?.name}
              </span>
              <span>📍 {incident.location}</span>
              <span>👥 {incident.people_affected} people</span>
              <span>🕒 {formatDateTime(incident.created_at)}</span>
            </p>
          </div>
          <button type="button" onClick={() => setConfirmOpen(true)} className="btn btn-danger">
            🗑 Delete
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <Panel title="Description">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{incident.description}</p>
          </Panel>

          <Panel title="Why this severity?">
            <ReasonChips reasons={incident.severity_reasons} />
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <label htmlFor="override" className="text-sm font-semibold text-slate-700">
                Override severity
              </label>
              <select
                id="override"
                className="input w-44"
                value={incident.severity}
                disabled={savingSeverity}
                onChange={(e) => changeSeverity(e.target.value)}
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {savingSeverity && <Spinner className="h-4 w-4 text-slate-500" />}
            </div>
          </Panel>

          <Panel title="Reporter contact">
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Name</dt>
                <dd className="font-medium">{incident.contact_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Phone</dt>
                <dd className="font-medium">
                  {incident.contact_phone ? (
                    <a href={`tel:${incident.contact_phone}`} className="text-blue-700 hover:underline">
                      {incident.contact_phone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-slate-500">Email</dt>
                <dd className="truncate font-medium">
                  {incident.contact_email ? (
                    <a href={`mailto:${incident.contact_email}`} className="text-blue-700 hover:underline">
                      {incident.contact_email}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          <div className="grid min-h-[140px] place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
            <div>
              <p className="font-semibold">🗺 Map view — coming in Round 2</p>
              {hasCoords && (
                <p className="mt-1 font-mono text-xs tabular-nums">
                  {Number(incident.latitude).toFixed(5)}, {Number(incident.longitude).toFixed(5)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <Panel title="Update status">
            <div role="radiogroup" aria-label="New status" className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => {
                const selected = nextStatus === s;
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setNextStatus(s)}
                    className={`min-h-[42px] rounded-lg border-2 px-2 text-sm font-bold transition ${
                      selected ? `${STATUS_STYLES[s]} bg-slate-50 ring-2 ring-current ring-offset-1` : 'border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                  >
                    {s}
                    {s === incident.status && <span className="block text-[10px] font-medium opacity-70">current</span>}
                  </button>
                );
              })}
            </div>
            <label htmlFor="note" className="label mt-4">
              Note (optional)
            </label>
            <textarea
              id="note"
              rows={3}
              maxLength={500}
              className="input"
              placeholder="e.g. Fire unit dispatched, ETA 10 min"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="button" onClick={saveStatus} disabled={!statusChanged || savingStatus} className="btn btn-primary mt-3 w-full">
              {savingStatus && <Spinner />} Save status
            </button>
            {!statusChanged && <p className="mt-2 text-center text-xs text-slate-500">Pick a different status to save.</p>}
          </Panel>

          <Panel title="Activity timeline">
            <Timeline history={incident.history} createdAt={incident.created_at} />
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this incident?"
        message={
          <>
            <strong className="text-slate-900">{incident.ref_code}</strong> · {incident.title}
            <br />
            This permanently removes it and its history. This can’t be undone.
          </>
        }
        busy={deleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
