import { Fragment, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRelated } from '../api';
import { STATUSES, formatDistance, isFalseAlarm, isSuspicious, timeAgo } from '../constants';
import ClusterPill from './ClusterPill';
import Icon, { CategoryIcon } from './Icon';
import ReporterBadge from './ReporterBadge';
import SeverityBadge from './SeverityBadge';
import StatusChip from './StatusChip';
import TrustMeter from './TrustMeter';
import VerificationBadge from './VerificationBadge';

const isActiveCritical = (i) => i.severity === 'Critical' && i.status !== 'Resolved';

function RowMenu({ incident, onStatus, onDelete }) {
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex min-h-[40px] w-full items-center gap-2.5 rounded px-3 text-left text-sm font-medium text-ink transition-colors hover:bg-paper disabled:opacity-40';

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-md text-ink-2 transition-colors hover:bg-black/5 hover:text-ink"
        aria-label={`Actions for ${incident.ref_code}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setSub(false);
        }}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-56 animate-slide-down overflow-hidden rounded-md border border-black/10 bg-white p-1.5 shadow-lift">
          <button role="menuitem" type="button" className={item} onClick={() => navigate(`/admin/incidents/${incident.id}`)}>
            <Icon name="eye" className="h-4 w-4 text-ink-3" /> View
          </button>
          <button role="menuitem" type="button" aria-haspopup="menu" aria-expanded={sub} className={item} onClick={() => setSub((s) => !s)}>
            <Icon name="refresh" className="h-4 w-4 text-ink-3" /> Change status
            <Icon name={sub ? 'chevron-down' : 'chevron-right'} className="ml-auto h-4 w-4 text-ink-3" />
          </button>
          {sub && (
            <div role="menu" aria-label="Change status" className="mb-1 ml-4 animate-slide-down border-l-2 border-brand pl-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  role="menuitem"
                  type="button"
                  className={item}
                  disabled={s === incident.status}
                  onClick={() => {
                    setOpen(false);
                    onStatus(incident, s);
                  }}
                >
                  {s === incident.status && <Icon name="check" className="h-4 w-4 text-green-700" />}
                  {s}
                </button>
              ))}
            </div>
          )}
          <div className="my-1 border-t border-black/10" />
          <button
            role="menuitem"
            type="button"
            className={`${item} text-brand-dark hover:bg-brand-soft`}
            onClick={() => {
              setOpen(false);
              onDelete(incident);
            }}
          >
            <Icon name="trash" className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
}

function SkeletonRows({ cols }) {
  return Array.from({ length: 5 }, (_, r) => (
    <tr key={r}>
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="border-b border-black/5 px-3 py-4">
          <div className="skeleton h-3.5" style={{ width: `${45 + ((r * 7 + c * 13) % 50)}%` }} />
        </td>
      ))}
    </tr>
  ));
}

/* ---------- trust-aware helpers ---------- */

function titleCls(i) {
  if (isFalseAlarm(i)) return 'font-medium text-ink-3 line-through';
  return isActiveCritical(i) ? 'font-black text-ink' : 'font-semibold text-ink';
}

function rowCls(i) {
  // Critical keeps its red stripe even when unverified: low trust never hides an emergency.
  if (isActiveCritical(i)) return 'bg-brand-soft/70 hover:bg-brand-soft [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-brand';
  if (isFalseAlarm(i)) return 'opacity-40 hover:opacity-80';
  if (isSuspicious(i)) return 'hover:bg-paper [&>td:first-child]:border-l-4 [&>td:first-child]:border-dashed [&>td:first-child]:border-l-amber-500';
  return `hover:bg-paper ${i.status === 'Resolved' ? 'opacity-60 hover:opacity-100' : ''}`;
}

function ClusterMembers({ root, cols, open }) {
  const [state, setState] = useState({ loading: true, items: [], error: '' });
  useEffect(() => {
    let alive = true;
    getRelated(root.id)
      .then((r) => alive && setState({ loading: false, items: [...r.corroborating, ...r.duplicates], error: '' }))
      .catch((e) => alive && setState({ loading: false, items: [], error: e.message || 'Could not load cluster members.' }));
    return () => {
      alive = false;
    };
  }, [root.id]);

  if (state.loading) {
    return (
      <tr>
        <td colSpan={cols} className="bg-paper px-3 py-3">
          <div className="skeleton h-8" />
        </td>
      </tr>
    );
  }
  if (state.error || state.items.length === 0) {
    return (
      <tr>
        <td colSpan={cols} className="bg-paper px-10 py-3 text-xs text-ink-3">
          {state.error || 'No other reports in this cluster.'}
        </td>
      </tr>
    );
  }
  return state.items.map((m) => (
    <tr key={`m-${m.id}`} onClick={() => open(m)} className="cursor-pointer animate-fade-in bg-paper/80 text-xs transition-colors hover:bg-paper">
      <td className="border-b border-black/[0.06] py-2 pl-8 pr-3 font-mono font-bold text-ink-3">
        <span className="mr-1 text-ink-3" aria-hidden="true">└</span>
        {m.ref_code}
      </td>
      <td className="border-b border-black/[0.06] px-3 py-2" colSpan={Math.max(1, cols - 4)}>
        <span className={titleCls(m)}>{m.title}</span>
        <span className="ml-2 text-ink-3">
          {[m.distance_m != null && `${formatDistance(m.distance_m)} away`, m.minutes_apart != null && `${Math.round(m.minutes_apart)} min apart`].filter(Boolean).join(' · ')}
        </span>
        {(m.duplicate_of || m.is_duplicate) && <span className="ml-2 rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink-3">duplicate</span>}
      </td>
      <td className="border-b border-black/[0.06] px-3 py-2">
        <VerificationBadge status={m.verification_status} size="sm" />
      </td>
      <td className="border-b border-black/[0.06] px-3 py-2 text-ink-3" colSpan={3}>
        {m.created_at ? timeAgo(m.created_at) : m.location}
      </td>
    </tr>
  ));
}

/**
 * compact: dashboard version (Ref, Title, Severity, Status, Time).
 * Full version adds category, location, people, reporter, trust and the actions menu.
 * expandable: rows are cluster roots; a chevron shows the member reports.
 */
export default function IncidentTable({ items = [], loading, compact = false, onStatus, onDelete, linkBase = '/admin/incidents', expandable = false }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(() => new Set());
  const canOpen = Boolean(linkBase);
  const open = (i) => canOpen && navigate(`${linkBase}/${i.id}`);
  const withActions = !compact && onStatus && onDelete;
  const showTrust = !compact && items.some((i) => i.has_trust);
  const th = 'whitespace-nowrap border-b-2 border-charcoal bg-white px-3 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-ink';
  const td = 'border-b border-black/[0.06] px-3 py-3 align-middle';
  const cols = compact ? 5 : 8 + (showTrust ? 2 : 1) + (withActions ? 1 : 0);
  // With trust columns the table gets wide: location/people move under the title below 2xl.
  const wideOnly = showTrust ? 'hidden 2xl:table-cell' : '';

  const toggle = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      {/* Table (≥768px) */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={th}>Ref</th>
              <th scope="col" className={th}>{compact ? 'Title' : 'Incident'}</th>
              {!compact && (
                <>
                  <th scope="col" className={th}>Type</th>
                  <th scope="col" className={`${th} ${wideOnly}`}>Location</th>
                  <th scope="col" className={`${th} ${wideOnly}`}>People</th>
                  {!showTrust && <th scope="col" className={th}>Reporter</th>}
                </>
              )}
              <th scope="col" className={th}>Severity</th>
              {showTrust && (
                <>
                  <th scope="col" className={th}>Trust</th>
                  <th scope="col" className={th}>Verification</th>
                </>
              )}
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}>{compact ? 'Time' : 'Reported'}</th>
              {withActions && (
                <th scope="col" className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="stagger">
            {loading ? (
              <SkeletonRows cols={cols} />
            ) : (
              items.map((i) => {
                const isOpen = expanded.has(i.id);
                const canExpand = expandable && i.cluster_size > 1;
                return (
                  <Fragment key={i.id}>
                    <tr
                      tabIndex={canOpen ? 0 : undefined}
                      aria-label={`${i.ref_code}: ${i.title}, ${i.severity}, ${i.status}${i.verification_status ? `, ${i.verification_status}` : ''}`}
                      onClick={() => open(i)}
                      onKeyDown={(e) => e.key === 'Enter' && open(i)}
                      className={`${canOpen ? 'cursor-pointer' : ''} transition-colors duration-200 ${rowCls(i)}`}
                    >
                      <td className={`${td} whitespace-nowrap font-mono text-xs font-bold text-ink-2`}>
                        <span className="flex items-center gap-1">
                          {expandable && (
                            <button
                              type="button"
                              disabled={!canExpand}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(i.id);
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              aria-expanded={canExpand ? isOpen : undefined}
                              aria-label={canExpand ? `${isOpen ? 'Hide' : 'Show'} ${i.cluster_size} reports in this cluster` : 'Single report'}
                              className="grid h-7 w-7 place-items-center rounded text-ink-2 transition-colors hover:bg-black/5 disabled:opacity-20"
                            >
                              <Icon name="chevron-right" className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                            </button>
                          )}
                          {i.ref_code}
                        </span>
                      </td>
                      <td className={`${td} max-w-[320px]`}>
                        <p className="flex items-center gap-2">
                          <span className={`truncate ${titleCls(i)}`}>{i.title}</span>
                          <ClusterPill size={i.cluster_size} />
                        </p>
                        {!compact && <p className="truncate text-xs text-ink-3">{i.description}</p>}
                        {showTrust && (
                          <p className="truncate text-xs text-ink-3 2xl:hidden">
                            {i.location} · {i.people_affected} {i.people_affected === 1 ? 'person' : 'people'}
                          </p>
                        )}
                      </td>
                      {!compact && (
                        <>
                          <td className={td}>
                            <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft text-brand" title={i.category?.name}>
                              <CategoryIcon code={i.category?.code} className="h-[18px] w-[18px]" title={i.category?.name} />
                            </span>
                          </td>
                          <td className={`${td} max-w-[150px] truncate text-ink-2 ${wideOnly}`} title={i.location}>
                            {i.location}
                          </td>
                          <td className={`${td} font-semibold tabular-nums text-ink-2 ${wideOnly}`}>{i.people_affected}</td>
                          {!showTrust && (
                            <td className={td}>
                              <ReporterBadge incident={i} size="sm" />
                            </td>
                          )}
                        </>
                      )}
                      <td className={td}>
                        <SeverityBadge level={i.severity} size="sm" />
                      </td>
                      {showTrust && (
                        <>
                          <td className={td}>
                            <TrustMeter score={i.trust_score} compact />
                          </td>
                          <td className={td}>
                            <VerificationBadge status={i.verification_status} size="sm" />
                          </td>
                        </>
                      )}
                      <td className={td}>
                        <StatusChip status={i.status} />
                      </td>
                      <td className={`${td} whitespace-nowrap text-ink-3`}>
                        <time dateTime={i.created_at}>{timeAgo(i.created_at)}</time>
                      </td>
                      {withActions && (
                        <td className={`${td} w-12`}>
                          <RowMenu incident={i} onStatus={onStatus} onDelete={onDelete} />
                        </td>
                      )}
                    </tr>
                    {canExpand && isOpen && <ClusterMembers root={i} cols={cols} open={open} />}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (<768px) */}
      <ul className="stagger flex flex-col gap-2.5 md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, k) => <li key={k} className="skeleton h-28" />)
          : items.map((i) => (
              <li
                key={i.id}
                className={`card relative p-3.5 transition-shadow duration-200 ${
                  isActiveCritical(i)
                    ? 'border-l-4 border-l-brand bg-brand-soft/60'
                    : isSuspicious(i) && !isFalseAlarm(i)
                      ? 'border-l-4 border-dashed border-l-amber-500'
                      : ''
                } ${isFalseAlarm(i) ? 'opacity-50' : i.status === 'Resolved' ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => open(i)} disabled={!canOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded text-left">
                    <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <CategoryIcon code={i.category?.code} className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-mono text-[11px] font-bold text-ink-3">{i.ref_code}</span>
                      <span className={`block leading-snug ${titleCls(i)}`}>{i.title}</span>
                    </span>
                  </button>
                  {withActions && <RowMenu incident={i} onStatus={onStatus} onDelete={onDelete} />}
                </div>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                  <SeverityBadge level={i.severity} size="sm" />
                  {i.has_trust && <VerificationBadge status={i.verification_status} size="sm" />}
                  <ClusterPill size={i.cluster_size} />
                  <StatusChip status={i.status} />
                  {!compact && !i.has_trust && <ReporterBadge incident={i} size="sm" />}
                  {!compact && i.has_trust && i.trust_score != null && <TrustMeter score={i.trust_score} compact />}
                  {!compact && (
                    <span className="inline-flex items-center gap-1">
                      <Icon name="pin" className="h-3.5 w-3.5" /> {i.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Icon name="clock" className="h-3.5 w-3.5" /> {timeAgo(i.created_at)}
                  </span>
                </div>
              </li>
            ))}
      </ul>
    </>
  );
}
