import { STATUS_BAR, formatDateTime, formatTime } from '../constants';

/** Status history, newest first, ending with the original report. */
export default function Timeline({ history = [], createdAt }) {
  const entries = [...history].sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at));
  return (
    <ol className="ml-1.5 border-l-2 border-slate-200 pl-5">
      {entries.map((h, i) => (
        <li key={`${h.changed_at}-${i}`} className="relative mb-4 text-sm">
          <span
            className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${STATUS_BAR[h.to_status] || 'bg-slate-400'}`}
          />
          <p className="font-semibold text-slate-800">{h.from_status ? `${h.from_status} → ${h.to_status}` : h.to_status}</p>
          <p className="text-xs text-slate-500">
            {h.changed_by_name ? `by ${h.changed_by_name} · ` : ''}
            <time dateTime={h.changed_at} title={formatDateTime(h.changed_at)}>
              {formatTime(h.changed_at)}
            </time>
          </p>
          {h.note && <p className="mt-1 rounded-md bg-slate-50 px-2.5 py-1.5 text-slate-700">{h.note}</p>}
        </li>
      ))}
      <li className="relative text-sm">
        <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-gray-400 ring-4 ring-white" />
        <p className="font-semibold text-slate-800">Reported</p>
        <p className="text-xs text-slate-500">
          by public reporter · <time dateTime={createdAt}>{formatDateTime(createdAt)}</time>
        </p>
      </li>
    </ol>
  );
}
