import Icon from './Icon';

/**
 * Shows whether a report came from a signed-in account or an anonymous person.
 * Uses icon + text (never colour alone).
 */
export default function ReporterBadge({ incident, size = 'md' }) {
  const anon = incident?.is_anonymous !== false;
  const sm = size === 'sm';
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-bold ${sm ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} ${
        anon ? 'border-black/20 bg-paper text-ink-2' : 'border-charcoal bg-charcoal text-white'
      }`}
      title={anon ? 'Reported anonymously' : `Reported by registered user${incident?.reporter?.name ? `: ${incident.reporter.name}` : ''}`}
    >
      <Icon name={anon ? 'incognito' : 'shield'} className={sm ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      {anon ? 'Anonymous' : sm ? 'Registered' : `Registered${incident?.reporter?.name ? ` · ${incident.reporter.name}` : ''}`}
    </span>
  );
}
