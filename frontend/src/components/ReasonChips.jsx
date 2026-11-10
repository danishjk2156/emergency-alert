/**
 * Reason strings as chips. With `signed`, chips ending "+N" are green and
 * "−N"/"-N" are red (used for trust reasons).
 */
function toneOf(r, signed) {
  if (/^override|manually set/i.test(r)) return 'border-brand bg-brand-soft text-brand-deep';
  if (signed) {
    if (/[+]\s*\d+\s*$/.test(r)) return 'border-green-600/40 bg-green-50 text-green-900';
    if (/[−-]\s*\d+\s*$/.test(r)) return 'border-red-600/40 bg-red-50 text-red-800';
  }
  return 'border-black/15 bg-paper text-ink-2';
}

export default function ReasonChips({ reasons = [], signed = false, empty = 'No scoring details available.' }) {
  if (!reasons.length) return <p className="text-sm text-ink-3">{empty}</p>;
  return (
    <ul className="stagger flex flex-wrap gap-1.5">
      {reasons.map((r, i) => (
        <li key={`${r}-${i}`} className={`rounded border px-2 py-1 text-xs font-semibold ${toneOf(r, signed)}`}>
          {r}
        </li>
      ))}
    </ul>
  );
}
