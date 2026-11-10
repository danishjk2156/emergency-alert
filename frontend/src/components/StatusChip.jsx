import { STATUS_STYLES } from '../constants';

/** Status = OUTLINED chip, so it is never confused with a severity pill. */
export default function StatusChip({ status = 'Reported' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 bg-white px-2.5 py-0.5 text-[11px] font-bold ${
        STATUS_STYLES[status] || STATUS_STYLES.Reported
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}
