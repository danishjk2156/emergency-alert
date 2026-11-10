export default function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="text-3xl" aria-hidden="true">
        {icon}
      </div>
      <p className="mt-2 font-semibold text-slate-800">{title}</p>
      {message && <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
      <span className="font-medium text-red-700">⚠ {message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn ml-auto">
          Try again
        </button>
      )}
    </div>
  );
}
