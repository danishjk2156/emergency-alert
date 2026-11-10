import { STATUS_BAR, formatDateTime, formatTime, toDate } from '../constants';

/**
 * Status history, newest first. The backend writes the initial "→ Reported" row
 * itself; if a history ever lacks it, a row is added from created_at.
 */
export default function Timeline({ history = [], createdAt }) {
  const entries = [...history].sort((a, b) => toDate(b.changed_at) - toDate(a.changed_at));
  const hasCreation = entries.some((h) => !h.from_status && h.to_status === 'Reported');
  if (!hasCreation && createdAt) {
    entries.push({ from_status: null, to_status: 'Reported', note: null, changed_by_name: null, changed_at: createdAt });
  }

  return (
    <ol className="ml-1.5 border-l-2 border-slate-200 pl-5">
      {entries.map((h, i) => {
        const isCreation = !h.from_status;
        const who = h.changed_by_name || (isCreation ? 'public reporter' : 'system');
        return (
          <li key={`${h.id ?? h.changed_at}-${i}`} className="relative mb-4 text-sm last:mb-0">
            <span
              className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${STATUS_BAR[h.to_status] || 'bg-slate-400'}`}
            />
            <p className="font-semibold text-slate-800">{isCreation ? h.to_status : `${h.from_status} → ${h.to_status}`}</p>
            <p className="text-xs text-slate-500">
              by {who} ·{' '}
              <time dateTime={h.changed_at} title={formatDateTime(h.changed_at)}>
                {isCreation ? formatDateTime(h.changed_at) : formatTime(h.changed_at)}
              </time>
            </p>
            {h.note && <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-slate-700">{h.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
