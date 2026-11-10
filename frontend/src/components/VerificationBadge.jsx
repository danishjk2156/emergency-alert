import Icon from './Icon';

// Outlined/dashed shapes so it never looks like a filled SeverityBadge or a rounded StatusChip.
const STYLES = {
  Unverified: { cls: 'border-dashed border-slate-400 bg-white text-slate-700', icon: 'circle-dashed' },
  Corroborated: { cls: 'border-blue-600 bg-blue-50 text-blue-800', icon: 'users' },
  Verified: { cls: 'border-green-700 bg-green-700 text-white', icon: 'check' },
  'False Alarm': { cls: 'border-gray-400 bg-gray-100 text-gray-500', icon: 'x' },
};

export default function VerificationBadge({ status, size = 'md' }) {
  if (!status) return null;
  const s = STYLES[status] || STYLES.Unverified;
  const sm = size === 'sm';
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border-[1.5px] font-bold uppercase tracking-wide ${s.cls} ${
        sm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      }`}
      aria-label={`Verification: ${status}`}
    >
      <Icon name={s.icon} className={sm ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.5} />
      <span className={status === 'False Alarm' ? 'line-through' : ''}>{status}</span>
    </span>
  );
}
