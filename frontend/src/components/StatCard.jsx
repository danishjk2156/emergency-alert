import Icon from './Icon';

const TONES = {
  default: { box: 'bg-white', icon: 'bg-charcoal text-white', value: 'text-ink', sub: 'text-ink-3' },
  critical: { box: 'bg-brand text-white', icon: 'bg-white/20 text-white', value: 'text-white', sub: 'text-white/85' },
  amber: { box: 'bg-white', icon: 'bg-amber-100 text-amber-800', value: 'text-amber-700', sub: 'text-ink-3' },
  green: { box: 'bg-white', icon: 'bg-green-100 text-green-800', value: 'text-green-700', sub: 'text-ink-3' },
};

export default function StatCard({ label, value, sub, tone = 'default', icon = 'inbox', loading }) {
  const t = TONES[tone] || TONES.default;
  return (
    <div className={`card card-hover p-4 sm:p-5 ${t.box}`}>
      <div className="flex items-start justify-between gap-3">
        <p className={`text-[11px] font-black uppercase tracking-[0.12em] ${tone === 'critical' ? 'text-white/85' : 'text-ink-3'}`}>{label}</p>
        <span className={`grid h-9 w-9 place-items-center rounded-md ${t.icon}`}>
          <Icon name={icon} className="h-[18px] w-[18px]" />
        </span>
      </div>
      {loading ? (
        <div className="skeleton mt-2 h-9 w-16" />
      ) : (
        <p className={`mt-1 text-[34px] font-black leading-none tabular-nums ${t.value}`}>{value}</p>
      )}
      {sub && !loading && <p className={`mt-1.5 text-xs font-medium ${t.sub}`}>{sub}</p>}
    </div>
  );
}
