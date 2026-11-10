// Design tokens + shared lookups. Severity = filled pill, status = outlined chip.

export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const STATUSES = ['Reported', 'Pending', 'In Progress', 'Resolved'];

export const SEVERITY_STYLES = {
  Low: 'bg-green-700 text-white',
  Medium: 'bg-amber-400 text-ink',
  High: 'bg-orange-700 text-white',
  Critical: 'bg-brand text-white',
};

// Bars / dots that reuse the severity colours
export const SEVERITY_BAR = {
  Low: 'bg-green-700',
  Medium: 'bg-amber-400',
  High: 'bg-orange-700',
  Critical: 'bg-brand',
};

export const STATUS_STYLES = {
  Reported: 'border-gray-600 text-gray-800',
  Pending: 'border-amber-600 text-amber-800',
  'In Progress': 'border-blue-700 text-blue-800',
  Resolved: 'border-green-700 text-green-800',
  'False Alarm': 'border-gray-400 text-gray-500 line-through',
};

export const STATUS_BAR = {
  Reported: 'bg-gray-500',
  Pending: 'bg-amber-500',
  'In Progress': 'bg-blue-700',
  Resolved: 'bg-green-700',
  'False Alarm': 'bg-gray-300',
};

// Used if GET /categories fails, and to resolve a bare category code.
export const FALLBACK_CATEGORIES = [
  { id: 1, code: 'FIRE', name: 'Fire Emergency', base_weight: 30 },
  { id: 2, code: 'ROAD', name: 'Road Accident', base_weight: 20 },
  { id: 3, code: 'MEDICAL', name: 'Medical Emergency', base_weight: 20 },
  { id: 4, code: 'FLOOD', name: 'Flood', base_weight: 25 },
  { id: 5, code: 'COLLAPSE', name: 'Building Collapse', base_weight: 35 },
  { id: 6, code: 'OTHER', name: 'Other Emergencies', base_weight: 10 },
];

export const categoryByCode = (code) =>
  FALLBACK_CATEGORIES.find((c) => c.code === String(code || '').toUpperCase()) || {
    code: code || 'OTHER',
    name: code || 'Other',
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
  'false alarm': 'False Alarm',
  false_alarm: 'False Alarm',
};

export const normSeverity = (s) => SEV_MAP[String(s || '').toLowerCase()] || 'Low';
export const normStatus = (s) => STATUS_MAP[String(s || '').toLowerCase()] || 'Reported';

/* ---------- trust layer ---------- */

export const VERIFICATION_STATUSES = ['Unverified', 'Corroborated', 'Verified', 'False Alarm'];
const VERIF_MAP = {
  unverified: 'Unverified',
  pending: 'Unverified',
  corroborated: 'Corroborated',
  verified: 'Verified',
  'false alarm': 'False Alarm',
  false_alarm: 'False Alarm',
};
export const normVerification = (s) => VERIF_MAP[String(s || '').toLowerCase()] || 'Unverified';

/** 0–29 Suspicious · 30–69 Unverified · 70–100 Likely genuine */
export function trustBand(score) {
  if (score == null) return null;
  if (score < 30) return { key: 'suspicious', label: 'Suspicious', bar: 'bg-red-600', text: 'text-red-700', track: 'border-red-600' };
  if (score < 70) return { key: 'unverified', label: 'Unverified', bar: 'bg-slate-400', text: 'text-ink-2', track: 'border-slate-400' };
  return { key: 'genuine', label: 'Likely genuine', bar: 'bg-green-600', text: 'text-green-800', track: 'border-green-600' };
}

export const isSuspicious = (i) => i?.trust_score != null && i.trust_score < 30;
export const isFalseAlarm = (i) => i?.verification_status === 'False Alarm' || i?.status === 'False Alarm';

export function formatDistance(m) {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}

export function formatCountdown(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

/* ---------- date helpers (en-IN) ---------- */

const dtFmt = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' });

// The backend stores UTC but SQLite drops the offset, so timestamps arrive as
// "2026-11-10T06:52:36.97" with no "Z". Treat zone-less ISO strings as UTC.
const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
export const toDate = (v) => {
  if (v instanceof Date) return v;
  if (typeof v === 'string' && NAIVE_ISO.test(v)) return new Date(`${v}Z`);
  return new Date(v);
};
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
