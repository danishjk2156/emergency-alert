import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import Icon, { CategoryIcon } from '../components/Icon';
import ReasonChips from '../components/ReasonChips';
import ReporterBadge from '../components/ReporterBadge';
import SeverityBadge from '../components/SeverityBadge';
import StatusChip from '../components/StatusChip';
import { useToast } from '../components/Toast';
import VerificationBadge from '../components/VerificationBadge';

export default function ReportSuccessPage() {
  const state = useLocation().state || {};
  const incident = state.incident;
  const { isSignedIn, isAdmin } = useAuth();
  const toast = useToast();

  // Direct visits (refresh / bookmark) have no state: send them to tracking.
  if (!incident) return <Navigate to="/track" replace />;

  // The server decides: a report is linked only if it came back attached to an account.
  const linked = incident.is_anonymous === false;
  const shown = incident;

  async function copy() {
    try {
      await navigator.clipboard.writeText(incident.ref_code);
      toast('Copied');
    } catch {
      toast('Could not copy. Please write the code down.', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <div className="text-center">
        <span className="mx-auto grid h-20 w-20 animate-scale-in place-items-center rounded-full bg-green-700 text-white shadow-lift">
          <Icon name="check" className="h-10 w-10" strokeWidth={3} />
        </span>
        <h1 className="mt-5 animate-fade-up text-3xl font-black uppercase tracking-tight">Report received</h1>
        <span className="title-bar title-bar-center" aria-hidden="true" />
        <p className="mt-3 animate-fade-up text-[15px] text-ink-2">The response team has been notified. Save your reference code to track progress.</p>
      </div>

      <div className="card mt-7 animate-fade-up overflow-hidden text-center [animation-delay:80ms]">
        <div className="bg-charcoal px-5 py-2.5 text-xs font-black uppercase tracking-[0.2em] text-white/80">Reference code</div>
        <div className="p-5">
          <p className="break-all font-mono text-3xl font-bold tracking-wider text-ink sm:text-4xl">{incident.ref_code}</p>
          <button type="button" onClick={copy} className="btn mt-4">
            <Icon name="copy" className="h-4 w-4" /> Copy code
          </button>
        </div>
      </div>

      {incident.has_trust && (
        <div className="card mt-4 flex animate-fade-up items-start gap-3 p-4 text-sm [animation-delay:100ms]" aria-live="polite">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${incident.verification_status === 'Corroborated' ? 'bg-blue-50 text-blue-700' : 'bg-paper text-ink-2'}`}>
            <Icon name={incident.verification_status === 'Corroborated' ? 'users' : 'shield'} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge level={incident.severity} size="sm" />
              <VerificationBadge status={incident.verification_status} size="sm" />
            </div>
            <p className="mt-1.5 font-semibold text-ink">
              {incident.verification_status === 'Corroborated'
                ? 'Other people nearby reported this too — priority raised.'
                : incident.verification_status === 'Verified'
                  ? 'Responders have confirmed this report.'
                  : 'Responders have been alerted. We’re verifying your report in the background.'}
            </p>
            {incident.cluster_size >= 2 && (
              <p className="mt-0.5 text-ink-3">
                This is report {incident.cluster_rank || incident.cluster_size} of {incident.cluster_size} for this incident.
              </p>
            )}
          </div>
        </div>
      )}

      <div
        className={`mt-4 flex animate-fade-up items-start gap-3 rounded-md p-4 text-sm [animation-delay:120ms] ${
          linked ? 'bg-charcoal text-white' : 'border-2 border-dashed border-field/50 bg-white text-ink-2'
        }`}
      >
        <Icon name={linked ? 'shield' : 'incognito'} className="mt-0.5 h-5 w-5" />
        <div className="flex-1">
          <p className="font-black uppercase tracking-wide">{linked ? 'Linked to your account' : 'Submitted anonymously'}</p>
          <p className={linked ? 'text-white/80' : 'text-ink-3'}>
            {linked
              ? 'You can follow this report anytime from My reports.'
              : 'Only this code can bring it back. Write it down or copy it now.'}
          </p>
        </div>
        {linked && !isAdmin ? (
          <Link to="/account" className="btn border-white bg-white text-ink">
            My reports
          </Link>
        ) : !isSignedIn ? (
          <Link to="/register" className="btn btn-dark">
            Create account
          </Link>
        ) : null}
      </div>

      <section className="card mt-4 animate-fade-up p-5 [animation-delay:160ms]">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <CategoryIcon code={incident.category?.code} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-black leading-snug text-ink">{incident.title}</h2>
            <p className="text-sm text-ink-3">{incident.category?.name}</p>
          </div>
          <SeverityBadge level={incident.severity} upper />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-black/10 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Status</dt>
            <dd className="mt-1">
              <StatusChip status={incident.status} />
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Reporter</dt>
            <dd className="mt-1">
              <ReporterBadge incident={shown} size="sm" />
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">Location</dt>
            <dd className="mt-1 truncate font-semibold text-ink" title={incident.location}>
              {incident.location}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wider text-ink-3">People affected</dt>
            <dd className="mt-1 font-semibold tabular-nums text-ink">{incident.people_affected}</dd>
          </div>
        </dl>
        <h3 className="mt-5 text-[13px] font-black uppercase tracking-wide text-ink">Why this severity?</h3>
        <div className="mt-2">
          <ReasonChips reasons={incident.severity_reasons} />
        </div>
      </section>

      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link to="/report" className="btn">
          <Icon name="plus" className="h-4 w-4" /> Report another
        </Link>
        <Link to={`/track?ref=${encodeURIComponent(incident.ref_code)}`} className="btn btn-primary">
          Track status <Icon name="arrow-right" className="h-4 w-4" />
        </Link>
      </div>
      <p className="mt-6 text-center text-xs text-ink-3">
        If things get worse, call{' '}
        <a href="tel:112" className="font-black text-brand">
          112
        </a>{' '}
        right away.
      </p>
    </div>
  );
}
