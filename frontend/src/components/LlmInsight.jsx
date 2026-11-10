import { categoryByCode } from '../constants';
import Icon from './Icon';

function Row({ ok, label }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`grid h-5 w-5 place-items-center rounded-full ${ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}`}>
        <Icon name={ok ? 'check' : 'x'} className="h-3 w-3" strokeWidth={3} />
      </span>
      <span className="font-semibold text-ink-2">{label}</span>
    </li>
  );
}

/**
 * AI plausibility check.
 * assessment: undefined → backend has no AI check (render nothing)
 *             null      → still running (polling = true) or gave up (polling = false)
 *             {error}   → unavailable, rule-based score used
 */
export default function LlmInsight({ assessment, polling, currentCategory }) {
  if (assessment === undefined) return null;

  const shell = (children) => (
    <section className="card p-5 sm:p-6" aria-live="polite">
      <h2 className="flex items-center gap-2 text-[13px] font-black uppercase tracking-wide text-ink">
        <Icon name="sparkles" className="h-[18px] w-[18px] text-brand" /> AI check
      </h2>
      <span className="title-bar mb-4" aria-hidden="true" />
      {children}
    </section>
  );

  if (assessment === null) {
    return shell(
      polling ? (
        <div className="space-y-2.5" aria-busy="true">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink-2">
            <span className="h-2 w-2 animate-ping rounded-full bg-brand" aria-hidden="true" /> AI check running…
          </p>
          <div className="skeleton h-3.5 w-3/4" />
          <div className="skeleton h-3.5 w-1/2" />
          <div className="skeleton h-3.5 w-2/3" />
        </div>
      ) : (
        <p className="text-sm text-ink-3">The AI check is taking longer than usual. Refresh the page later to see it.</p>
      ),
    );
  }

  if (assessment.error) {
    return shell(
      <p className="flex items-start gap-2 text-sm text-ink-2">
        <Icon name="alert" className="mt-0.5 h-4 w-4 text-amber-600" />
        AI check unavailable — rule-based score used.
      </p>,
    );
  }

  const a = assessment;
  const confidence = a.confidence != null ? Math.round(a.confidence <= 1 ? a.confidence * 100 : a.confidence) : null;
  const suggested = a.suggested_category ? categoryByCode(a.suggested_category) : null;
  const mismatch = a.category_matches === false && suggested && suggested.code !== currentCategory;

  return shell(
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="space-y-1.5">
          <Row ok={a.plausible !== false} label={a.plausible !== false ? 'Plausible emergency' : 'Not plausible'} />
          {a.gibberish_or_test && <Row ok={false} label="Looks like gibberish or a test" />}
          {a.category_matches != null && <Row ok={a.category_matches} label={a.category_matches ? 'Category matches description' : 'Category may be wrong'} />}
        </ul>
        {confidence != null && (
          <div className="text-right">
            <p className="text-2xl font-black tabular-nums text-ink">{confidence}%</p>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3">confidence</p>
          </div>
        )}
      </div>

      {Array.isArray(a.life_threat_signals) && a.life_threat_signals.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-wider text-ink-3">Life-threat signals</p>
          <ul className="flex flex-wrap gap-1.5">
            {a.life_threat_signals.map((s) => (
              <li key={s} className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mismatch && (
        <p className="flex items-center gap-2 rounded-md border-l-4 border-indigo-500 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-900">
          <Icon name="note" className="h-4 w-4" /> Suggested category: {suggested.name}
        </p>
      )}

      {a.possible_higher_severity && (
        <p className="flex items-center gap-2 rounded-md border-l-4 border-amber-500 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          <Icon name="alert" className="h-4 w-4" /> AI suggests severity may be higher. Consider overriding it.
        </p>
      )}

      {Array.isArray(a.reasons) && a.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
          {a.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>,
  );
}
