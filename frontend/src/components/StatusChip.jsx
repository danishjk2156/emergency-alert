import { STATUS_STYLES } from '../constants';

/** Status = OUTLINED chip, so it is never confused with a severity pill. */
export default function StatusChip({ status = 'Reported' }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border-[1.5px] bg-white px-2.5 py-0.5 text-[11px] font-bold ${
        STATUS_STYLES[status] || STATUS_STYLES.Reported
      }`}
    >
      {status}
    </span>
  );
}
