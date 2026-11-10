import Icon from './Icon';

/** "×3 reports": independent reports from different devices about one incident. */
export default function ClusterPill({ size }) {
  if (!size || size < 2) return null;
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-bold text-white"
      title="Independent reports from different devices"
      aria-label={`${size} independent reports from different devices`}
    >
      <Icon name="layers" className="h-3 w-3" strokeWidth={2.5} />×{size} reports
    </span>
  );
}
