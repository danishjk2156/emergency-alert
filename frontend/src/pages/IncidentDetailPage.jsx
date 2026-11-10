import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteIncident, getIncident, getTeams, updateSeverity, updateStatus, verifyIncident } from '../api';
import AssignmentPanel from '../components/AssignmentPanel';
import ClusterPill from '../components/ClusterPill';
import LlmInsight from '../components/LlmInsight';
import LocationInfo from '../components/LocationInfo';
import MapView from '../components/MapView';
import RelatedReports from '../components/RelatedReports';
import TrustMeter from '../components/TrustMeter';
import VerificationBadge from '../components/VerificationBadge';
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
import { SEVERITIES, STATUSES, STATUS_STYLES, canSetStatus, formatDateTime } from '../constants';

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
  const [teams, setTeams] = useState([]);

  const [nextStatus, setNextStatus] = useState('');
  const [note, setNote] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingSeverity, setSavingSeverity] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Trust layer
  const [verifyOpen, setVerifyOpen] = useState(null); // 'Verified' | 'False Alarm' | null
  const [verifyNote, setVerifyNote] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [aiPolling, setAiPolling] = useState(false);
  const [relatedKey, setRelatedKey] = useState(0);

  const load = useCallback(async () => {
    setError('');
    try {
      const [data, teamsData] = await Promise.all([
        getIncident(id),
        getTeams().catch(() => []),
      ]);
      setIncident(data);
      setTeams(teamsData || []);
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

  const aiPending = incident?.llm_assessment === null;
  useEffect(() => {
    if (!aiPending) {
      setAiPolling(false);
      return undefined;
    }
    setAiPolling(true);
    const started = Date.now();
    const t = setInterval(async () => {
      if (Date.now() - started > 30000) {
        clearInterval(t);
        setAiPolling(false);
        return;
      }
      try {
        const fresh = await getIncident(id);
        if (fresh.llm_assessment !== null) {
          setIncident(fresh);
          clearInterval(t);
          setAiPolling(false);
        }
      } catch {
        /* keep polling until the time limit */
      }
    }, 3000);
    return () => clearInterval(t);
  }, [aiPending, id]);

  async function doVerify() {
    if (!verifyOpen) return;
    setVerifying(true);
    try {
      await verifyIncident(incident.id, { verification_status: verifyOpen, note: verifyNote });
      toast(verifyOpen === 'Verified' ? 'Marked as verified' : 'Marked as false alarm');
      setVerifyOpen(null);
      setVerifyNote('');
      setRelatedKey((k) => k + 1);
      await load();
    } catch (e) {
      toast(e.message || 'Could not update verification', 'error');
    } finally {
      setVerifying(false);
    }
  }

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
                {incident.has_trust && <VerificationBadge status={incident.verification_status} size="sm" />}
                <ClusterPill size={incident.cluster_size} />
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
                  <Icon name="users" className="h-4 w-4" /> {incident.people_affected} {incident.people_affected === 1 ? 'person' : 'people'}
                </span>
                {incident.cluster_people_affected != null && incident.cluster_people_affected !== incident.people_affected && (
                  <span className="inline-flex items-center gap-1.5 font-bold text-indigo-800">
                    <Icon name="layers" className="h-4 w-4" /> Cluster estimate: {incident.cluster_people_affected} people
                  </span>
                )}
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
        {incident.has_trust && incident.trust_score != null && (
          <div className="flex flex-wrap items-center gap-3 border-t border-black/10 bg-white/60 px-5 py-3 sm:px-6">
            <span className="text-[11px] font-black uppercase tracking-[0.12em] text-ink-3">Trust</span>
            <TrustMeter score={incident.trust_score} />
            <span className="text-xs text-ink-3">Shown next to severity — it never lowers priority.</span>
          </div>
        )}
      </header>

      {incident.duplicate_of && (
        <div role="note" className="flex animate-fade-up flex-wrap items-center gap-2 rounded-md border-l-4 border-gray-500 bg-white px-4 py-3 text-sm shadow-card">
          <Icon name="copy" className="h-4 w-4 text-ink-3" />
          <span className="font-semibold text-ink-2">Possible duplicate of</span>
          <Link to={`/admin/incidents/${incident.duplicate_of}`} className="font-mono font-bold text-brand hover:underline">
            {incident.duplicate_of_ref || `#${incident.duplicate_of}`}
          </Link>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="stagger min-w-0 space-y-5">
          <Panel title="Description" icon="note">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink-2">{incident.description}</p>
          </Panel>

          <LlmInsight assessment={incident.llm_assessment} polling={aiPolling} currentCategory={incident.category?.code} />
          {incident.has_trust && <RelatedReports id={incident.id} refreshKey={relatedKey} />}

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

          {hasCoords ? (
            <div className="overflow-hidden rounded-xl border border-border shadow-sm">
              <div className="bg-paper px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted flex items-center justify-between border-b border-border">
                <span className="flex items-center gap-1.5">
                  <Icon name="map" className="h-3.5 w-3.5 text-brand" />
                  Incident Geolocation & Dispatch Route
                </span>
                <span className="font-mono text-ink">
                  {Number(incident.latitude).toFixed(4)}, {Number(incident.longitude).toFixed(4)}
                </span>
              </div>
              <MapView
                incidents={[incident]}
                teams={teams}
                selectedIncidentId={incident.id}
                height="280px"
                compact
              />
            </div>
          ) : (
            <div className="grid min-h-[150px] place-items-center rounded-md border-2 border-dashed border-field/40 bg-white p-4 text-center text-sm text-ink-3">
              <div>
                <Icon name="map" className="mx-auto h-8 w-8 text-ink-3" />
                <p className="mt-2 font-black uppercase tracking-wide text-ink-2">No GPS coordinates recorded</p>
                <p className="text-xs text-ink-muted">{incident.location}</p>
              </div>
            </div>
          )}
        </div>

        <div className="stagger min-w-0 space-y-5">
          {incident.has_trust && (
            <Panel title="Verification" icon="shield">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <VerificationBadge status={incident.verification_status} />
                {incident.trust_score != null && <TrustMeter score={incident.trust_score} />}
              </div>
              <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink-3">Why this trust score</p>
              <ReasonChips reasons={incident.trust_reasons} signed empty="No trust signals recorded." />
              <div className="mt-4 border-t border-black/10 pt-4">
                <LocationInfo source={incident.location_source} accuracy={incident.location_accuracy_m} mismatchKm={incident.location_mismatch_km} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="btn border-green-700 bg-green-700 text-white hover:border-green-800 hover:bg-green-800"
                  disabled={incident.verification_status === 'Verified'}
                  onClick={() => setVerifyOpen('Verified')}
                >
                  <Icon name="check" className="h-4 w-4" strokeWidth={3} /> Mark verified
                </button>
                <button
                  type="button"
                  className="btn border-gray-400 bg-gray-100 text-gray-800 hover:bg-gray-200"
                  disabled={incident.verification_status === 'False Alarm'}
                  onClick={() => setVerifyOpen('False Alarm')}
                >
                  <Icon name="x" className="h-4 w-4" strokeWidth={3} /> False alarm
                </button>
              </div>
            </Panel>
          )}

          <Panel title="Update status" icon="refresh">
            <div role="radiogroup" aria-label="New status" className="grid grid-cols-2 gap-2">
              {STATUSES.map((s) => {
                const selected = nextStatus === s;
                const isCurrent = s === incident.status;
                const allowed = isCurrent || canSetStatus(incident.status, s);
                return (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={!allowed}
                    title={!allowed ? (s === 'Assigned' ? 'Assign a team in the dispatch panel below' : `Not allowed from ${incident.status}`) : undefined}
                    onClick={() => setNextStatus(s)}
                    className={`min-h-[48px] rounded-md border-2 px-2 text-sm font-bold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
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
            {!statusChanged && (
              <p className="mt-2 text-center text-xs text-ink-3">
                {incident.status === 'Reported' ? 'Assign a response team below to move this incident forward.' : 'Pick the next status to save.'}
              </p>
            )}
          </Panel>

          <AssignmentPanel incident={incident} onIncidentUpdated={load} />

          <Panel title="Activity timeline" icon="clock">
            <Timeline history={incident.history} createdAt={incident.created_at} reporterLabel={anon ? 'anonymous reporter' : incident.reporter?.name || 'registered user'} />
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(verifyOpen)}
        icon={verifyOpen === 'Verified' ? 'check-circle' : 'thumbs-down'}
        title={verifyOpen === 'Verified' ? 'Mark as verified?' : 'Mark as false alarm?'}
        confirmLabel={verifyOpen === 'Verified' ? 'Mark verified' : 'Mark false alarm'}
        confirmClass={verifyOpen === 'Verified' ? 'border-green-700 bg-green-700 text-white hover:bg-green-800' : 'btn-dark'}
        busy={verifying}
        onConfirm={doVerify}
        onCancel={() => {
          setVerifyOpen(null);
          setVerifyNote('');
        }}
        message={
          <div className="space-y-3">
            <p>
              {verifyOpen === 'Verified'
                ? 'Confirms this report is genuine and raises this device’s reputation.'
                : 'This lowers this device’s reputation and removes it from its cluster.'}
            </p>
            <div>
              <label htmlFor="verify-note" className="label">
                Note <span className="font-medium normal-case tracking-normal text-ink-3">(optional)</span>
              </label>
              <textarea
                id="verify-note"
                rows={2}
                maxLength={300}
                className="input"
                value={verifyNote}
                onChange={(e) => setVerifyNote(e.target.value)}
                placeholder={verifyOpen === 'Verified' ? 'e.g. Confirmed by fire unit on site' : 'e.g. Caller confirmed it was a drill'}
              />
            </div>
          </div>
        }
      />

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
