export default function Logo({ suffix = 'Net', light = false }) {
  return (
    <span className={`flex items-center gap-2 text-lg font-extrabold ${light ? 'text-white' : 'text-slate-900'}`}>
      <svg viewBox="0 0 26 26" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect width="26" height="26" rx="7" fill="#D72638" />
        <path d="M13 6v14M6 13h14" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
      <span>
        ResQ<span className={light ? 'text-red-300' : 'text-brand'}>{suffix}</span>
      </span>
    </span>
  );
}
