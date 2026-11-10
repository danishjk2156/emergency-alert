export default function ReasonChips({ reasons = [] }) {
  if (!reasons.length) return <p className="text-sm text-slate-500">No scoring details available.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {reasons.map((r, i) => (
        <li key={`${r}-${i}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
          {r}
        </li>
      ))}
    </ul>
  );
}
