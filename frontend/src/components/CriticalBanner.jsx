import { Link } from 'react-router-dom';

export default function CriticalBanner({ count, items = [] }) {
  if (!count) return null;
  const titles = items
    .slice(0, 3)
    .map((i) => `${i.title}${i.location ? ` – ${String(i.location).split(',')[0]}` : ''}`);
  return (
    <div
      role="alert"
      className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border-2 border-red-600 bg-red-50 px-4 py-3 text-sm"
    >
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
      </span>
      <strong className="text-red-800">
        {count} active critical incident{count === 1 ? '' : 's'}
      </strong>
      {titles.length > 0 && (
        <span className="min-w-0 flex-1 truncate text-slate-600">
          {titles.join(' · ')}
          {items.length > 3 ? ' · …' : ''}
        </span>
      )}
      <Link to="/admin/incidents?severity=Critical" className="btn btn-primary ml-auto">
        View
      </Link>
    </div>
  );
}
