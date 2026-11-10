import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATUSES, timeAgo } from '../constants';
import SeverityBadge from './SeverityBadge';
import StatusChip from './StatusChip';

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

  const item = 'flex min-h-[38px] w-full items-center rounded-md px-3 text-left text-sm hover:bg-slate-100 disabled:opacity-40';

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-lg text-lg text-slate-500 hover:bg-slate-100"
        aria-label={`Actions for ${incident.ref_code}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          setSub(false);
        }}
      >
        ⋯
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <button role="menuitem" type="button" className={item} onClick={() => navigate(`/admin/incidents/${incident.id}`)}>
            View
          </button>
          <button
            role="menuitem"
            type="button"
            aria-haspopup="menu"
            aria-expanded={sub}
            className={`${item} justify-between`}
            onClick={() => setSub((s) => !s)}
          >
            Change status <span aria-hidden="true">{sub ? '▾' : '▸'}</span>
          </button>
          {sub && (
            <div role="menu" aria-label="Change status" className="mb-1 ml-2 border-l border-slate-200 pl-1.5">
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
                  {s === incident.status ? `✓ ${s}` : s}
                </button>
              ))}
            </div>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button
            role="menuitem"
            type="button"
            className={`${item} text-red-700 hover:bg-red-50`}
            onClick={() => {
              setOpen(false);
              onDelete(incident);
            }}
          >
            Delete
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
        <td key={c} className="border-b border-slate-100 px-3 py-4">
          <div className="skeleton h-3.5" style={{ width: `${45 + ((r * 7 + c * 13) % 50)}%` }} />
        </td>
      ))}
    </tr>
  ));
}

/**
 * compact: dashboard version (Ref, Title, Severity, Status, Time).
 * Full version adds category, location, people and the ⋯ actions menu.
 */
export default function IncidentTable({ items = [], loading, compact = false, onStatus, onDelete }) {
  const navigate = useNavigate();
  const open = (i) => navigate(`/admin/incidents/${i.id}`);
  const withActions = !compact && onStatus && onDelete;
  const th = 'whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500';
  const td = 'border-b border-slate-100 px-3 py-3 align-middle';
  const cols = compact ? 5 : withActions ? 9 : 8;

  const rowCls = (i) =>
    isActiveCritical(i)
      ? 'bg-red-50 hover:bg-red-100/70 [&>td:first-child]:border-l-4 [&>td:first-child]:border-l-red-600'
      : `hover:bg-slate-50 ${i.status === 'Resolved' ? 'opacity-60' : ''}`;

  return (
    <>
      {/* Table (≥768px) */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={th}>Ref</th>
              <th scope="col" className={th}>{compact ? 'Title' : 'Incident'}</th>
              {!compact && (
                <>
                  <th scope="col" className={th}>Category</th>
                  <th scope="col" className={th}>Location</th>
                  <th scope="col" className={th}>People</th>
                </>
              )}
              <th scope="col" className={th}>Severity</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}>{compact ? 'Time' : 'Reported'}</th>
              {withActions && (
                <th scope="col" className={th}>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={cols} />
            ) : (
              items.map((i) => (
                <tr
                  key={i.id}
                  tabIndex={0}
                  aria-label={`${i.ref_code}: ${i.title}, ${i.severity}, ${i.status}`}
                  onClick={() => open(i)}
                  onKeyDown={(e) => e.key === 'Enter' && open(i)}
                  className={`cursor-pointer transition-colors ${rowCls(i)}`}
                >
                  <td className={`${td} whitespace-nowrap font-mono text-xs font-semibold text-slate-700`}>{i.ref_code}</td>
                  <td className={`${td} max-w-[320px]`}>
                    <p className={`truncate ${isActiveCritical(i) ? 'font-bold' : 'font-medium'} text-slate-900`}>{i.title}</p>
                    {!compact && <p className="truncate text-xs text-slate-500">{i.description}</p>}
                  </td>
                  {!compact && (
                    <>
                      <td className={`${td} text-lg`} title={i.category?.name}>
                        <span aria-hidden="true">{i.category?.icon}</span>
                        <span className="sr-only">{i.category?.name}</span>
                      </td>
                      <td className={`${td} max-w-[160px] truncate text-slate-700`} title={i.location}>
                        {i.location}
                      </td>
                      <td className={`${td} tabular-nums text-slate-700`}>{i.people_affected}</td>
                    </>
                  )}
                  <td className={td}>
                    <SeverityBadge level={i.severity} size="sm" />
                  </td>
                  <td className={td}>
                    <StatusChip status={i.status} />
                  </td>
                  <td className={`${td} whitespace-nowrap text-slate-500`}>
                    <time dateTime={i.created_at}>{timeAgo(i.created_at)}</time>
                  </td>
                  {withActions && (
                    <td className={`${td} w-12`}>
                      <RowMenu incident={i} onStatus={onStatus} onDelete={onDelete} />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (<768px) */}
      <ul className="flex flex-col gap-2 md:hidden">
        {loading
          ? Array.from({ length: 4 }, (_, k) => <li key={k} className="skeleton h-28 rounded-xl" />)
          : items.map((i) => (
              <li
                key={i.id}
                className={`relative rounded-xl border bg-white p-3 shadow-sm ${
                  isActiveCritical(i) ? 'border-red-300 border-l-4 border-l-red-600 bg-red-50' : 'border-slate-200'
                } ${i.status === 'Resolved' ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => open(i)} className="min-w-0 flex-1 rounded text-left">
                    <span className="block font-mono text-[11px] font-semibold text-slate-500">{i.ref_code}</span>
                    <span className="block font-semibold leading-snug text-slate-900">
                      <span aria-hidden="true">{i.category?.icon} </span>
                      {i.title}
                    </span>
                  </button>
                  {withActions && <RowMenu incident={i} onStatus={onStatus} onDelete={onDelete} />}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <SeverityBadge level={i.severity} size="sm" />
                  <StatusChip status={i.status} />
                  {!compact && <span>📍 {i.location}</span>}
                  {!compact && <span>👥 {i.people_affected}</span>}
                  <span>· {timeAgo(i.created_at)}</span>
                </div>
              </li>
            ))}
      </ul>
    </>
  );
}
