import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Icon from './Icon';

const ToastContext = createContext(null);

const STYLES = {
  success: { bar: 'bg-green-700', icon: 'check-circle', iconCls: 'text-green-700' },
  error: { bar: 'bg-brand', icon: 'alert', iconCls: 'text-brand' },
  info: { bar: 'bg-charcoal', icon: 'note', iconCls: 'text-charcoal' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const toast = useCallback(
    (message, type = 'success') => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 5500 : 3200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end">
        {toasts.map((t) => {
          const s = STYLES[t.type] || STYLES.info;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex w-full max-w-sm animate-slide-in-right items-stretch overflow-hidden rounded-md bg-white text-sm font-semibold text-ink shadow-lift"
            >
              <span className={`w-1.5 shrink-0 ${s.bar}`} aria-hidden="true" />
              <span className="flex flex-1 items-center gap-3 px-3.5 py-3">
                <Icon name={s.icon} className={`h-5 w-5 ${s.iconCls}`} />
                <span className="flex-1">{t.message}</span>
                <button
                  type="button"
                  onClick={() => dismiss(t.id)}
                  className="-mr-1 grid h-8 w-8 place-items-center rounded text-ink-3 transition-colors hover:bg-black/5 hover:text-ink"
                  aria-label="Dismiss notification"
                >
                  <Icon name="x" className="h-4 w-4" />
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
