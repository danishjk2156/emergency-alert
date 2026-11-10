import { trustBand } from '../constants';

/** Trust 0–100 with a band label. Shown NEXT TO severity, never instead of it. */
export default function TrustMeter({ score, compact = false, showScore = true }) {
  const band = trustBand(score);
  if (!band) {
    return <span className="text-xs text-ink-3">{compact ? '–' : 'Trust not available'}</span>;
  }
  const pct = Math.max(0, Math.min(100, score));
  const aria = `Trust ${Math.round(score)}, ${band.label.toLowerCase()}`;
  return (
    <span className={`inline-flex items-center ${compact ? 'gap-1.5' : 'gap-2.5'}`} role="img" aria-label={aria} title={aria}>
      <span className={`relative block overflow-hidden rounded-full border bg-white ${band.track} ${compact ? 'h-2 w-14' : 'h-2.5 w-28'}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out ${band.bar}`} style={{ width: `${pct}%` }} />
      </span>
      <span className={`whitespace-nowrap font-bold ${band.text} ${compact ? 'text-[11px]' : 'text-xs'}`}>
        {showScore && <span className="tabular-nums">{Math.round(score)}</span>}
        {!compact && <span className="ml-1 font-semibold">· {band.label}</span>}
      </span>
    </span>
  );
}
