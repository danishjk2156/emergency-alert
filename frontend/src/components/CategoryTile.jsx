export default function CategoryTile({ category, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(category.code)}
      className={`flex min-h-[84px] flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 text-center text-xs font-semibold transition sm:text-sm ${
        selected
          ? 'border-brand bg-brand-soft text-slate-900 ring-4 ring-brand-ring'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
      }`}
    >
      <span className="text-2xl leading-none" aria-hidden="true">
        {category.icon}
      </span>
      {category.name}
    </button>
  );
}
