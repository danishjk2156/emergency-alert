export default function ReasonChips({ reasons = [] }) {
  if (!reasons.length) return <p className="text-sm text-ink-3">No scoring details available.</p>;
  return (
    <ul className="stagger flex flex-wrap gap-1.5">
      {reasons.map((r, i) => {
        const override = /^override|manually set/i.test(r);
        return (
          <li
            key={`${r}-${i}`}
            className={`rounded border px-2 py-1 text-xs font-semibold ${
              override ? 'border-brand bg-brand-soft text-brand-deep' : 'border-black/15 bg-paper text-ink-2'
            }`}
          >
            {r}
          </li>
        );
      })}
    </ul>
  );
}
