import { Link, Navigate, useLocation } from 'react-router-dom';
import ReasonChips from '../components/ReasonChips';
import SeverityBadge from '../components/SeverityBadge';
import StatusChip from '../components/StatusChip';
import { useToast } from '../components/Toast';

export default function ReportSuccessPage() {
  const incident = useLocation().state?.incident;
  const toast = useToast();

  // Direct visits (refresh / bookmark) have no state: send them to tracking.
  if (!incident) return <Navigate to="/track" replace />;

  async function copy() {
    try {
      await navigator.clipboard.writeText(incident.ref_code);
      toast('Copied');
    } catch {
      toast('Could not copy. Please write the code down.', 'error');
    }
  }

  const people = incident.people_affected;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center sm:py-14">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-green-100 text-4xl text-green-600" aria-hidden="true">
        ✓
      </div>
      <h1 className="mt-4 text-2xl font-extrabold">Report received</h1>
      <p className="mt-1 text-sm text-slate-600">The response team has been notified. Save your reference code to track progress.</p>

      <div className="mt-6 rounded-2xl border-2 border-dashed border-brand bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Reference code</p>
        <p className="mt-1 break-all font-mono text-3xl font-extrabold tracking-wider text-slate-900">{incident.ref_code}</p>
        <button type="button" onClick={copy} className="btn mt-3">
          📋 Copy
        </button>
      </div>

      <section className="card mt-4 p-5 text-left">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-bold leading-snug text-slate-900">{incident.title}</h2>
          <SeverityBadge level={incident.severity} upper />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Category</dt>
            <dd className="font-medium">
              <span aria-hidden="true">{incident.category?.icon} </span>
              {incident.category?.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd>
              <StatusChip status={incident.status} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Location</dt>
            <dd className="font-medium">{incident.location}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">People affected</dt>
            <dd className="font-medium tabular-nums">{people}</dd>
          </div>
        </dl>
        <h3 className="mt-4 text-sm font-bold text-slate-700">Why this severity?</h3>
        <div className="mt-2">
          <ReasonChips reasons={incident.severity_reasons} />
        </div>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/report" className="btn">
          Report another
        </Link>
        <Link to={`/track?ref=${encodeURIComponent(incident.ref_code)}`} className="btn btn-primary">
          Track status
        </Link>
      </div>
      <p className="mt-6 text-xs text-slate-500">
        If things get worse, call{' '}
        <a href="tel:112" className="font-bold text-brand">
          112
        </a>{' '}
        right away.
      </p>
    </div>
  );
}
