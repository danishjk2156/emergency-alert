import { CategoryIcon } from './Icon';

export default function CategoryTile({ category, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onSelect(category.code)}
      className={`group relative flex min-h-[96px] flex-col items-center justify-center gap-2 overflow-hidden rounded-md border-2 px-2 py-3 text-center text-[12px] font-bold uppercase tracking-wide transition-all duration-200 ease-out sm:text-[13px] ${
        selected
          ? 'border-brand bg-brand text-white shadow-lift'
          : 'border-field/50 bg-white text-ink hover:-translate-y-0.5 hover:border-brand hover:shadow-card'
      }`}
    >
      <span
        className={`grid h-11 w-11 place-items-center rounded-full transition-all duration-300 ${
          selected ? 'scale-110 bg-white/20 text-white' : 'bg-brand-soft text-brand group-hover:scale-110'
        }`}
      >
        <CategoryIcon code={category.code} className="h-6 w-6" />
      </span>
      {category.name}
      {selected && (
        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 animate-scale-in place-items-center rounded-full bg-white text-brand" aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
    </button>
  );
}
