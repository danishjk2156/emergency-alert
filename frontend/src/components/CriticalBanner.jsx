import { Link } from 'react-router-dom';
import Icon from './Icon';

export default function CriticalBanner({ count, items = [], breakdown }) {
  if (!count) return null;
  const titles = items.slice(0, 3).map((i) => `${i.title}${i.location ? ` – ${String(i.location).split(',')[0]}` : ''}`);
  return (
    <div role="alert" className="flex animate-fade-up flex-wrap items-center gap-x-4 gap-y-2 overflow-hidden rounded-md bg-brand px-4 py-3 text-sm text-white shadow-lift">
      <span className="relative flex h-3 w-3 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
      </span>
      <strong className="font-black uppercase tracking-wide">
        {count} active critical incident{count === 1 ? '' : 's'}
        {breakdown && <span className="font-bold normal-case tracking-normal text-white/90"> ({breakdown})</span>}
      </strong>
      {titles.length > 0 && (
        <span className="min-w-0 flex-1 truncate text-white/90">
          {titles.join(' · ')}
          {items.length > 3 ? ' · …' : ''}
        </span>
      )}
      <Link to="/admin/incidents?severity=Critical" className="btn ml-auto border-white bg-white text-brand-dark hover:bg-brand-soft">
        View <Icon name="arrow-right" className="h-4 w-4" />
      </Link>
    </div>
  );
}
