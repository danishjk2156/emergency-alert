import { formatDistance } from '../constants';
import Icon from './Icon';

/** Where the location came from, and whether GPS disagrees with the typed address. */
export default function LocationInfo({ source, accuracy, mismatchKm }) {
  const gps = source === 'gps' || source === 'both';
  return (
    <div className="space-y-2 text-sm">
      <p className="inline-flex items-center gap-2 font-semibold text-ink-2">
        <Icon name={gps ? 'satellite' : 'keyboard'} className="h-4 w-4 text-ink-3" />
        {gps ? `GPS${accuracy != null ? ` ±${formatDistance(accuracy)}` : ''}` : 'Typed address only'}
        {gps && accuracy != null && accuracy > 1000 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900">low accuracy</span>}
      </p>
      {mismatchKm != null && mismatchKm > 5 && (
        <p className="flex items-start gap-2 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 font-semibold text-amber-900">
          <Icon name="alert" className="mt-0.5 h-4 w-4" />
          GPS is {mismatchKm.toFixed(mismatchKm < 10 ? 1 : 0)} km from the typed address
        </p>
      )}
    </div>
  );
}
