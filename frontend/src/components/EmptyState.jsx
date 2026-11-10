import Icon from './Icon';

export default function EmptyState({ icon = 'inbox', title, message, action }) {
  return (
    <div className="animate-fade-up rounded-md border-2 border-dashed border-field/40 bg-white px-6 py-14 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <p className="mt-3 text-base font-black uppercase tracking-wide text-ink">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-3">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex animate-fade-up flex-wrap items-center gap-3 rounded-md border-l-4 border-brand bg-brand-soft px-4 py-3 text-sm">
      <Icon name="alert" className="h-5 w-5 text-brand-dark" />
      <span className="font-semibold text-brand-deep">{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn ml-auto">
          <Icon name="refresh" className="h-4 w-4" /> Try again
        </button>
      )}
    </div>
  );
}
