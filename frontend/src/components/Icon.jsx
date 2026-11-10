// Inline SVG icon set (24×24, stroke-based). Replaces every emoji in the UI.
const PATHS = {
  fire: (
    <path d="M12 3c.5 3-1.5 4.5-3 6.5S6.5 13.6 6.5 15.5A5.5 5.5 0 0 0 12 21a5.5 5.5 0 0 0 5.5-5.5c0-2.7-1.7-4.4-2.6-5.4-.2 1.4-.9 2.4-1.9 2.9.3-2.9-.3-6.6-1-10Z" />
  ),
  car: (
    <>
      <path d="M5 17h14M6.5 17v2M17.5 17v2" />
      <path d="M3.5 13.5 5.3 8.2A2 2 0 0 1 7.2 7h9.6a2 2 0 0 1 1.9 1.2l1.8 5.3V17H3.5Z" />
      <circle cx="7.5" cy="13.8" r="1" />
      <circle cx="16.5" cy="13.8" r="1" />
    </>
  ),
  heart: (
    <>
      <path d="M19.5 12.6 12 20l-7.5-7.4A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 7.5 6.3Z" />
      <path d="M3.5 12h4l1.5-2.5 2.5 5 1.5-2.5h7.5" />
    </>
  ),
  waves: (
    <path d="M2 7c2 0 2-1.5 4-1.5S8 7 10 7s2-1.5 4-1.5S16 7 18 7s2-1.5 4-1.5M2 12.5c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" />
  ),
  building: (
    <>
      <path d="M4 21V5.5a1 1 0 0 1 .7-1l7-2.3a1 1 0 0 1 1.3 1V21" />
      <path d="M13 9h6a1 1 0 0 1 1 1v11M2.5 21h19" />
      <path d="M8 8v.01M8 12v.01M8 16v.01M16.5 13v.01M16.5 17v.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4.5M12 17v.01" />
    </>
  ),
  siren: (
    <>
      <path d="M6.5 18v-5a5.5 5.5 0 0 1 11 0v5" />
      <path d="M4 21h16v-2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v2ZM12 2.5v2M4.2 5.7l1.4 1.4M19.8 5.7l-1.4 1.4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.3A6.5 6.5 0 0 1 21.5 20" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  incognito: (
    <>
      <path d="M3 11h18M5 11l1.6-5.2A1.5 1.5 0 0 1 8.5 4.8l3.5 1 3.5-1a1.5 1.5 0 0 1 1.9 1L19 11" />
      <circle cx="7" cy="16.5" r="3" />
      <circle cx="17" cy="16.5" r="3" />
      <path d="M10 16.5c1.3-.8 2.7-.8 4 0" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.4 7.5 10 4.4-1.6 7.5-5.4 7.5-10v-6L12 2.5Z" />
      <path d="m8.8 12 2.2 2.2 4.4-4.4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  phone: (
    <path d="M21 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 1.1 4.2 2 2 0 0 1 3.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L7.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="m3 6.5 9 6.5 9-6.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10.5" rx="2" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  'eye-off': (
    <>
      <path d="M10.7 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.6 3.5M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2M2 2l20 20" />
    </>
  ),
  check: <path d="m4.5 12.5 5 5 10-11" />,
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m7.8 12.3 2.8 2.8 5.6-5.8" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="12.5" height="12.5" rx="2" />
      <path d="M15.5 8.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8.5a2 2 0 0 0 2 2h3.5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.5-4.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M20.5 12a8.5 8.5 0 0 1-15 5.5M3.5 12a8.5 8.5 0 0 1 15-5.5" />
      <path d="M18.5 2.5v4h-4M5.5 21.5v-4h4" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  logout: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5M5 12h11" />
    </>
  ),
  login: (
    <>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l5-5-5-5M15 12H4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2M6.5 6.5l.9 13a1.5 1.5 0 0 0 1.5 1.4h6.2a1.5 1.5 0 0 0 1.5-1.4l.9-13" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="7.5" height="9" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="5" rx="1.5" />
      <rect x="13.5" y="11" width="7.5" height="10" rx="1.5" />
      <rect x="3" y="15" width="7.5" height="6" rx="1.5" />
    </>
  ),
  list: <path d="M8.5 6h12M8.5 12h12M8.5 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  external: <path d="M14 3.5h6.5V10M20.5 3.5 11 13M18.5 14v5a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5h5" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  'arrow-right': <path d="M4.5 12h15M13 5.5l6.5 6.5-6.5 6.5" />,
  'arrow-left': <path d="M19.5 12h-15M11 5.5 4.5 12l6.5 6.5" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4Z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  inbox: (
    <>
      <path d="M3 13.5h5l1.5 2.5h5l1.5-2.5h5" />
      <path d="M5.4 5.1 3 13.5V19a1.5 1.5 0 0 0 1.5 1.5h15A1.5 1.5 0 0 0 21 19v-5.5l-2.4-8.4A1.5 1.5 0 0 0 17.2 4H6.8a1.5 1.5 0 0 0-1.4 1.1Z" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="m15.8 8.2-2.1 5.5-5.5 2.1 2.1-5.5 5.5-2.1Z" />
    </>
  ),
  radar: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 12 18.5 5.5" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  note: (
    <>
      <path d="M14.5 3H6a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 6 21h12a1.5 1.5 0 0 0 1.5-1.5V8L14.5 3Z" />
      <path d="M14.5 3v5h5M8.5 13h7M8.5 17h5" />
    </>
  ),
  'user-plus': (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0M19 8v6M16 11h6" />
    </>
  ),
  'circle-dashed': (
    <path d="M10.1 2.2a10 10 0 0 1 3.8 0M17.6 3.8a10 10 0 0 1 2.6 2.7M21.8 10.1a10 10 0 0 1 0 3.8M20.2 17.6a10 10 0 0 1-2.7 2.6M13.9 21.8a10 10 0 0 1-3.8 0M6.4 20.2a10 10 0 0 1-2.6-2.7M2.2 13.9a10 10 0 0 1 0-3.8M3.8 6.4a10 10 0 0 1 2.7-2.6" />
  ),
  keyboard: (
    <>
      <rect x="2" y="5.5" width="20" height="13" rx="2" />
      <path d="M6 9.5h.01M10 9.5h.01M14 9.5h.01M18 9.5h.01M6 13h.01M18 13h.01M9.5 13h5M7.5 16h9" />
    </>
  ),
  satellite: (
    <>
      <path d="M4.9 19.1a10 10 0 0 1 0-14.2M8.5 15.5a5 5 0 0 1 0-7M19.1 4.9a10 10 0 0 1 0 14.2M15.5 8.5a5 5 0 0 1 0 7" />
      <circle cx="12" cy="12" r="1.8" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.5 13.7 8a2 2 0 0 0 1.3 1.3l4.5 1.7-4.5 1.7a2 2 0 0 0-1.3 1.3L12 18.5 10.3 14a2 2 0 0 0-1.3-1.3L4.5 11 9 9.3A2 2 0 0 0 10.3 8L12 3.5Z" />
      <path d="M19 3v3.5M17.25 4.75h3.5M5 17.5V21M3.25 19.25h3.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 2.5 9.5 5-9.5 5-9.5-5 9.5-5Z" />
      <path d="m2.5 12.5 9.5 5 9.5-5M2.5 17l9.5 5 9.5-5" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13.5" r="8" />
      <path d="M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5v3" />
    </>
  ),
  link: (
    <path d="M10 13.5a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10.5a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  ),
  'thumbs-down': (
    <path d="M17 14V3.5M9.5 18.2 10.5 14H5.2a2 2 0 0 1-2-2.4l1.4-7A2 2 0 0 1 6.6 3H17v11l-3.6 6.3a1.6 1.6 0 0 1-2.9-1.1Z" />
  ),
};

export default function Icon({ name, className = 'h-5 w-5', strokeWidth = 2, title }) {
  const content = PATHS[name] || PATHS.alert;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {content}
    </svg>
  );
}

const CATEGORY_ICON = {
  FIRE: 'fire',
  ROAD: 'car',
  MEDICAL: 'heart',
  FLOOD: 'waves',
  COLLAPSE: 'building',
  OTHER: 'alert',
};

/** Category glyph by code. Ignores any emoji the API sends. */
export function CategoryIcon({ code, className = 'h-5 w-5', title }) {
  return <Icon name={CATEGORY_ICON[String(code || '').toUpperCase()] || 'alert'} className={className} title={title} />;
}
