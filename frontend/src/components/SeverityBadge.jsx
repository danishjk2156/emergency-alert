import { SEVERITY_STYLES } from '../constants';

/** Severity = FILLED pill. Critical gets a pulsing dot. */
export default function SeverityBadge({ level = 'Low', score, size = 'md', upper = false }) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded font-black uppercase tracking-wide ${pad} ${
        SEVERITY_STYLES[level] || SEVERITY_STYLES.Low
      }`}
    >
      {level === 'Critical' && (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
      )}
      {upper ? level.toUpperCase() : level}
      {score !== undefined && score !== null && <span className="font-bold opacity-90">· {score}</span>}
    </span>
  );
}
