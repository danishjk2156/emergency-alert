/** ResQNet mark: red shield with a white cross, plus a bold uppercase wordmark. */
export default function Logo({ light = false, tagline = 'Emergency Response', compact = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 40 44" className="h-10 w-9 shrink-0 drop-shadow-sm" aria-hidden="true">
        <path d="M20 1.5 37 7.6v13.1c0 10.4-7.2 18.3-17 21.8C10.2 39 3 31.1 3 20.7V7.6L20 1.5Z" fill="#D7191F" />
        <path d="M20 4.9 33.9 9.9v10.8c0 8.6-5.9 15.2-13.9 18.3-8-3.1-13.9-9.7-13.9-18.3V9.9L20 4.9Z" fill="none" stroke="#fff" strokeOpacity=".35" />
        <path d="M17 13h6v6h6v6h-6v6h-6v-6h-6v-6h6z" fill="#fff" />
      </svg>
      <span className="leading-none">
        <span className={`block text-[19px] font-black uppercase tracking-[0.08em] ${light ? 'text-white' : 'text-ink'}`}>
          Res<span className="text-brand">Q</span>Net
        </span>
        {!compact && (
          <span className={`mt-1 block text-[10px] font-bold uppercase tracking-[0.22em] ${light ? 'text-white/60' : 'text-ink-3'}`}>
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
