// Design tokens + shared lookups. Severity = filled pill, status = outlined chip.

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES = ['Reported', 'Pending', 'In Progress', 'Resolved'];

export const SEVERITY_STYLES = {
  Low: 'bg-green-600',
  Medium: 'bg-amber-500',
  High: 'bg-orange-600',
  Critical: 'bg-red-600',
};

// Bars / dots that reuse the severity colors
export const SEVERITY_BAR = {
  Low: 'bg-green-600',
  Medium: 'bg-amber-500',
  High: 'bg-orange-600',
  Critical: 'bg-red-600',
};

export const STATUS_STYLES = {
  Reported: 'border-gray-600 text-gray-700',
  Pending: 'border-amber-600 text-amber-700',
  'In Progress': 'border-blue-600 text-blue-700',
  Resolved: 'border-green-600 text-green-700',
};

export const STATUS_BAR = {
  Reported: 'bg-gray-400',
  Pending: 'bg-amber-500',
  'In Progress': 'bg-blue-600',
  Resolved: 'bg-green-600',
};

// Used if GET /categories fails, and to resolve a bare category code.
export const FALLBACK_CATEGORIES = [
  { id: 1, code: 'FIRE', name: 'Fire', icon: '🔥', base_weight: 30 },
  { id: 2, code: 'ROAD', name: 'Road Accident', icon: '🚗', base_weight: 20 },
  { id: 3, code: 'MEDICAL', name: 'Medical', icon: '❤️', base_weight: 20 },
  { id: 4, code: 'FLOOD', name: 'Flood', icon: '🌊', base_weight: 25 },
  { id: 5, code: 'COLLAPSE', name: 'Building Collapse', icon: '🏢', base_weight: 35 },
  { id: 6, code: 'OTHER', name: 'Other', icon: '⚠️', base_weight: 10 },
];

export const categoryByCode = (code) =>
  FALLBACK_CATEGORIES.find((c) => c.code === String(code || '').toUpperCase()) || {
    code: code || 'OTHER',
    name: code || 'Other',
    icon: '⚠️',
  };

export const SAFETY_TIPS = {
  FIRE: [
    'Get everyone out and stay out. Do not go back for belongings.',
    'Stay low under smoke and feel doors for heat before opening.',
    'If clothes catch fire: stop, drop and roll.',
  ],
  ROAD: [
    'Turn on hazard lights and keep clear of moving traffic.',
    'Do not move injured people unless there is fire or other danger.',
    'Press firmly on bleeding wounds with a clean cloth.',
  ],
  MEDICAL: [
    'Check breathing. If there is none and you are trained, start CPR.',
    'Keep the person still, warm and talking. No food or water.',
    'Note when symptoms started and any medicines they take.',
  ],
  FLOOD: [
    'Move to higher ground now. Never walk or drive through moving water.',
    'Switch off power at the mains if it is safe to reach.',
    'Stay away from drains, streams and fallen power lines.',
  ],
  COLLAPSE: [
    'Move away from the structure. More of it may fall.',
    'Do not go in to search. Tell responders where people were last seen.',
    'If trapped: cover your mouth, tap on pipes, shout only as a last resort.',
  ],
  OTHER: [
    'Move yourself and others away from the danger.',
    'Smell gas? No flames or switches. Open windows and leave.',
    'Follow instructions from responders when they arrive.',
  ],
};

/* ---------- normalizers (accept small backend variations) ---------- */

const SEV_MAP = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const STATUS_MAP = {
  reported: 'Reported',
  open: 'Reported',
  pending: 'Pending',
  'in progress': 'In Progress',
  in_progress: 'In Progress',
  inprogress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Resolved',
};

export const normSeverity = (s) => SEV_MAP[String(s || '').toLowerCase()] || 'Low';
export const normStatus = (s) => STATUS_MAP[String(s || '').toLowerCase()] || 'Reported';

/* ---------- date helpers (en-IN) ---------- */

const dtFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });

const toDate = (v) => (v instanceof Date ? v : new Date(v));
const valid = (d) => !Number.isNaN(d.getTime());

export function formatDateTime(v) {
  if (!v) return '—';
  const d = toDate(v);
  return valid(d) ? dtFmt.format(d) : '—';
}

export function formatTime(v) {
  if (!v) return '—';
  const d = toDate(v);
  return valid(d) ? timeFmt.format(d) : '—';
}

export function timeAgo(v) {
  if (!v) return '—';
  const d = toDate(v);
  if (!valid(d)) return '—';
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDateTime(d);
}
