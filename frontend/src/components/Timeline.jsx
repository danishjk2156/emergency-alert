import { STATUS_BAR, formatDateTime, formatTime, toDate } from '../constants';

/**
 * Status history, newest first. The backend writes the initial "→ Reported" row
 * itself; if a history ever lacks it, a row is added from created_at.
 */
export default function Timeline({ history = [], createdAt, reporterLabel = 'public reporter' }) {
  const entries = [...history].sort((a, b) => toDate(b.changed_at) - toDate(a.changed_at));
  const hasCreation = entries.some((h) => !h.from_status && h.to_status === 'Reported');
  if (!hasCreation && createdAt) {
    entries.push({ from_status: null, to_status: 'Reported', note: null, changed_by_name: null, changed_at: createdAt });
  }

  return (
    <ol className="stagger ml-1.5 border-l-2 border-black/10 pl-5">
      {entries.map((h, i) => {
        const isCreation = !h.from_status;
        const who = h.changed_by_name || (isCreation ? reporterLabel : 'system');
        return (
          <li key={`${h.id ?? h.changed_at}-${i}`} className="relative mb-5 text-sm last:mb-0">
            <span className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${STATUS_BAR[h.to_status] || 'bg-gray-500'}`} />
            <p className="font-bold text-ink">{isCreation ? h.to_status : `${h.from_status} → ${h.to_status}`}</p>
            <p className="text-xs text-ink-3">
              by {who} ·{' '}
              <time dateTime={h.changed_at} title={formatDateTime(h.changed_at)}>
                {isCreation ? formatDateTime(h.changed_at) : formatTime(h.changed_at)}
              </time>
            </p>
            {h.note && <p className="mt-1.5 rounded border-l-2 border-brand bg-paper px-2.5 py-1.5 text-ink-2">{h.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
