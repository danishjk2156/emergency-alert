import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteIncident, getIncident, updateSeverity, updateStatus } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState, { ErrorState } from '../components/EmptyState';
import Icon, { CategoryIcon } from '../components/Icon';
import ReasonChips from '../components/ReasonChips';
import ReporterBadge from '../components/ReporterBadge';
import SeverityBadge from '../components/SeverityBadge';
import Spinner from '../components/Spinner';
import StatusChip from '../components/StatusChip';
import Timeline from '../components/Timeline';
import { useToast } from '../components/Toast';
import { SEVERITIES, STATUSES, STATUS_STYLES, formatDateTime } from '../constants';

const HEADER_TONE = {
  Critical: 'border-t-[6px] border-t-brand bg-brand-soft/50',
  High: 'border-t-[6px] border-t-orange-700',
  Medium: 'border-t-[6px] border-t-amber-400',
  Low: 'border-t-[6px] border-t-green-700',
};

function Panel({ title, icon, children, className = '' }) {
  return (
    <section className={`card p-5 sm:p-6 ${className}`}>
      <h2 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wide text-ink">
        {icon && <Icon name={icon} className="h-[18px] w-[18px] text-brand" />}
        {title}
      </h2>
      <span className="title-bar mb-4" aria-hidden="true" />
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
      <div className="space-y-5" aria-busy="true">
        <div className="skeleton h-4 w-56" />
        <div className="skeleton h-36" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="skeleton h-72" />
          <div className="skeleton h-72" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <EmptyState
        icon="search"
        title="Incident not found"
        message="It may have been deleted."
        action={
          <Link to="/admin/incidents" className="btn">
            <Icon name="arrow-left" className="h-4 w-4" /> Back to incidents
          </Link>
        }
      />
    );
  }

  if (error || !incident) return <ErrorState message={error || 'Could not load this incident.'} onRetry={load} />;

  const statusChanged = nextStatus !== incident.status;
  const hasCoords = incident.latitude != null && incident.longitude != null;
  const anon = incident.is_anonymous !== false;

  return (
    <div className="space-y-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-ink-3">
        <Link to="/admin/incidents" className="inline-flex items-center gap-1 font-bold hover:text-ink">
          <Icon name="arrow-left" className="h-4 w-4" /> Incidents
        </Link>
        <span aria-hidden="true">/</span>
        <span className="font-mono font-bold text-ink-2">{incident.ref_code}</span>
      </nav>

      <header className={`card animate-fade-up overflow-hidden ${HEADER_TONE[incident.severity] || HEADER_TONE.Low}`}>
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 gap-4">
            <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-soft text-brand sm:grid">
              <CategoryIcon code={incident.category?.code} className="h-7 w-7" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge level={incident.severity} score={incident.severity_score} upper />
                <StatusChip status={incident.status} />
                <ReporterBadge incident={incident} size="sm" />
                {incident.severity_overridden && (
                  <span className="rounded bg-charcoal px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-white">Overridden by admin</span>
                )}
                {incident.is_duplicate && <span className="rounded bg-black/10 px-2 py-0.5 text-[11px] font-bold text-ink-2">Duplicate</span>}
              </div>
              <h1 className="mt-2.5 text-2xl font-black leading-tight text-ink sm:text-3xl">{incident.title}</h1>
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
                <span className="inline-flex items-center gap-1.5">
                  <CategoryIcon code={incident.category?.code} className="h-4 w-4 sm:hidden" /> {incident.category?.name}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="pin" className="h-4 w-4" /> {incident.location}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="users" className="h-4 w-4" /> {incident.people_affected} people
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="clock" className="h-4 w-4" /> {formatDateTime(incident.created_at)}
                </span>
              </p>
            </div>
          </div>
          <button type="button" onClick={() => setConfirmOpen(true)} className="btn btn-danger">
            <Icon name="trash" className="h-4 w-4" /> Delete
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="stagger min-w-0 space-y-5">
          <Panel title="Description" icon="note">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{incident.description}</p>
          </Panel>

          <Panel title="Why this severity?" icon="radar">
            <ReasonChips reasons={incident.severity_reasons} />
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-black/10 pt-4">
              <label htmlFor="override" className="label mb-0">
                Override severity
              </label>
              <select id="override" className="input w-44" value={incident.severity} disabled={savingSeverity} onChange={(e) => changeSeverity(e.target.value)}>
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {savingSeverity && <Spinner className="h-4 w-4 text-ink-3" />}
            </div>
          </Panel>

          <Panel title="Reporter" icon={anon ? 'incognito' : 'shield'}>
            <div className={`mb-4 flex items-start gap-3 rounded-md p-3 ${anon ? 'border-2 border-dashed border-field/50' : 'bg-charcoal text-white'}`}>
              <Icon name={anon ? 'incognito' : 'shield'} className="mt-0.5 h-5 w-5" />
              <div className="text-sm">
                <p className="font-black uppercase tracking-wide">{anon ? 'Anonymous report' : 'Registered user'}</p>
                <p className={anon ? 'text-ink-3' : 'text-white/80'}>
                  {anon
                    ? 'Not linked to any account. Treat contact details below as unverified.'
                    : `Submitted while signed in as ${incident.reporter?.name || 'a user'}${incident.reporter?.email ? ` (${incident.reporter.email})` : ''}.`}
                </p>
              </div>
            </div>
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Name</dt>
                <dd className="mt-0.5 font-semibold text-ink">{incident.contact_name || '-'}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Phone</dt>
                <dd className="mt-0.5 font-semibold">
                  {incident.contact_phone ? (
                    <a href={`tel:${incident.contact_phone}`} className="text-brand hover:underline">
                      {incident.contact_phone}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Email</dt>
                <dd className="mt-0.5 truncate font-semibold">
                  {incident.contact_email ? (
                    <a href={`mailto:${incident.contact_email}`} className="text-brand hover:underline">
                      {incident.contact_email}
                    </a>
                  ) : (
                    '-'
                  )}
                </dd>
              </div>
            </dl>
          </Panel>

          <div className="grid min-h-[150px] place-items-center rounded-md border-2 border-dashed border-field/40 bg-white p-4 text-center text-sm text-ink-3">
            <div>
              <Icon name="map" className="mx-auto h-8 w-8 text-ink-3" />
              <p className="mt-2 font-black uppercase tracking-wide text-ink-2">Map view: coming in Round 2</p>
              {hasCoords && (
                <p className="mt-1 font-mono text-xs tabular-nums">
                  {Number(incident.latitude).toFixed(5)}, {Number(incident.longitude).toFixed(5)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="stagger min-w-0 space-y-5">
          <Panel title="Update status" icon="refresh">
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
                    className={`min-h-[48px] rounded-md border-2 px-2 text-sm font-bold transition-all duration-200 ${
                      selected ? `${STATUS_STYLES[s]} scale-[1.02] bg-white shadow-card ring-2 ring-current ring-offset-1` : 'border-field/40 text-ink-2 hover:border-ink'
                    }`}
                  >
                    {s}
                    {s === incident.status && <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">current</span>}
                  </button>
                );
              })}
            </div>
            <label htmlFor="note" className="label mt-5">
              Note <span className="font-medium normal-case tracking-normal text-ink-3">(optional)</span>
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
              {savingStatus ? <Spinner /> : <Icon name="check" className="h-4 w-4" />} Save status
            </button>
            {!statusChanged && <p className="mt-2 text-center text-xs text-ink-3">Pick a different status to save.</p>}
          </Panel>

          <Panel title="Activity timeline" icon="clock">
            <Timeline history={incident.history} createdAt={incident.created_at} reporterLabel={anon ? 'anonymous reporter' : incident.reporter?.name || 'registered user'} />
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this incident?"
        message={
          <>
            <strong className="text-ink">{incident.ref_code}</strong> · {incident.title}
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
