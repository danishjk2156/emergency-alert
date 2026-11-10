import { useEffect, useRef } from 'react';
import Icon from './Icon';
import Spinner from './Spinner';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', busy, onConfirm, onCancel }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid animate-fade-in place-items-center bg-charcoal-dark/60 p-4 backdrop-blur-[2px]" onClick={() => !busy && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        className="w-full max-w-sm animate-scale-in overflow-hidden rounded-md bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-brand" />
        <div className="p-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-brand-soft text-brand">
            <Icon name="trash" />
          </span>
          <h2 id="confirm-title" className="mt-3 text-lg font-black uppercase tracking-wide text-ink">
            {title}
          </h2>
          <div id="confirm-message" className="mt-2 text-sm text-ink-2">
            {message}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button ref={cancelRef} type="button" className="btn" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={busy}>
              {busy && <Spinner />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
