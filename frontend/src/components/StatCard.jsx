const TONES = {
  default: { box: 'border-slate-200 bg-white', value: 'text-slate-900', sub: 'text-slate-500' },
  critical: { box: 'border-red-300 bg-red-50', value: 'text-red-600', sub: 'text-red-700' },
  amber: { box: 'border-slate-200 bg-white', value: 'text-amber-600', sub: 'text-slate-500' },
  green: { box: 'border-slate-200 bg-white', value: 'text-green-600', sub: 'text-slate-500' },
};

export default function StatCard({ label, value, sub, tone = 'default', loading }) {
  const t = TONES[tone] || TONES.default;
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${t.box}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      {loading ? (
        <div className="skeleton mt-2 h-8 w-16" />
      ) : (
        <p className={`mt-1 text-3xl font-extrabold tabular-nums ${t.value}`}>{value}</p>
      )}
      {sub && !loading && <p className={`mt-0.5 text-xs ${t.sub}`}>{sub}</p>}
    </div>
  );
}
