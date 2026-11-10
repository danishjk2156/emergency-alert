// In-browser stand-in for the FastAPI backend. It follows the same contract,
// plus the citizen-account endpoints (docs/server-auth-plan.md) and the trust
// layer: rate limiting, device location, an AI plausibility check, trust score,
// clusters and duplicates.
// Only used with `npm run dev:mock` (or VITE_MOCK=true). Data persists in localStorage.
import { FALLBACK_CATEGORIES, SEVERITIES, STATUSES } from './constants';
import { computeSeverity } from './severity';

const KEY = 'resqnet_mock_v5';
const YEAR = new Date().getFullYear();

const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 }; // 3 reports / 10 min / device
const LLM_DELAY_MS = 4500; // AI check "runs in the background"
const CLUSTER_RADIUS_M = 1500;
const CLUSTER_WINDOW_MS = 3 * 60 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 30 * 60 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const refFor = (id) => `ER-${YEAR}-${String(id).padStart(4, '0')}`;
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
const cat = (code) => {
  const c = FALLBACK_CATEGORIES.find((x) => x.code === code) || FALLBACK_CATEGORIES[5];
  return { code: c.code, name: c.name };
};
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const t = (iso) => new Date(iso).getTime();

function haversineM(a, b) {
  if (a?.latitude == null || b?.latitude == null) return null;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Rough geocoder for demo addresses (km mismatch + reverse geocoding)
const PLACES = {
  adyar: [13.0012, 80.2565],
  guindy: [13.0067, 80.2206],
  velachery: [12.9815, 80.218],
  tambaram: [12.9249, 80.1],
  sholinganallur: [12.901, 80.2279],
  vandalur: [12.8923, 80.081],
  'anna nagar': [13.085, 80.2101],
  kodambakkam: [13.0521, 80.2255],
  chengalpattu: [12.6921, 79.9707],
  mylapore: [13.0339, 80.2619],
  't. nagar': [13.0418, 80.2341],
  'flower bazaar': [13.0902, 80.281],
};
function geocode(text) {
  const s = String(text || '').toLowerCase();
  const hit = Object.keys(PLACES).find((k) => s.includes(k));
  return hit ? { latitude: PLACES[hit][0], longitude: PLACES[hit][1], name: hit } : null;
}
function reverseGeocode(c) {
  let best = null;
  for (const [name, [lat, lng]] of Object.entries(PLACES)) {
    const d = haversineM(c, { latitude: lat, longitude: lng });
    if (best === null || d < best.d) best = { name, d };
  }
  const title = best ? best.name.replace(/\b\w/g, (m) => m.toUpperCase()) : 'Unknown area';
  return best && best.d < 6000 ? `Near ${title}, Chennai (from GPS)` : `GPS ${c.latitude.toFixed(5)}, ${c.longitude.toFixed(5)}`;
}

/* ---------------- AI plausibility check (simulated) ---------------- */

const CATEGORY_WORDS = {
  FIRE: ['fire', 'smoke', 'flame', 'burn', 'blaze', 'cylinder', 'explosion'],
  FLOOD: ['flood', 'water', 'rain', 'waterlog', 'drown', 'submerged', 'lake'],
  MEDICAL: ['breath', 'unconscious', 'fever', 'heart', 'bleed', 'choking', 'faint', 'dizzy', 'patient'],
  ROAD: ['car', 'bus', 'bike', 'lorry', 'collision', 'accident', 'highway', 'traffic', 'skid'],
  COLLAPSE: ['collapse', 'debris', 'building', 'wall', 'storey', 'roof'],
  OTHER: ['gas', 'leak', 'tree', 'wire', 'storm'],
};
const THREAT_WORDS = ['trapped', 'unconscious', 'not breathing', 'bleeding', 'child', 'explosion', 'drowning', 'missing', 'fire spreading'];

function isGibberish(text) {
  const s = String(text || '').toLowerCase();
  if (/\b(test|testing|asdf|qwer|lorem|ipsum|hello world|dummy|xyz)\b/.test(s)) return true;
  const letters = s.replace(/[^a-z]/g, '');
  if (letters.length >= 8) {
    const vowels = letters.replace(/[^aeiou]/g, '').length / letters.length;
    if (vowels < 0.18) return true;
  }
  return /(.)\1{4,}/.test(s);
}

function assess(inc) {
  const text = `${inc.title} ${inc.description}`.toLowerCase();
  if (inc._honeypot || isGibberish(text)) {
    return {
      plausible: false,
      gibberish_or_test: true,
      category_matches: false,
      suggested_category: null,
      life_threat_signals: [],
      possible_higher_severity: false,
      confidence: 0.91,
      reasons: ['Text reads like a test or random keystrokes', 'No concrete details about what happened or who is affected'],
    };
  }
  const scores = Object.fromEntries(Object.entries(CATEGORY_WORDS).map(([code, words]) => [code, words.filter((w) => text.includes(w)).length]));
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const matches = scores[inc.category.code] > 0 || best[1] === 0;
  const signals = THREAT_WORDS.filter((w) => text.includes(w));
  const higher = signals.length >= 2 && inc.severity !== 'Critical';
  const reasons = [
    matches ? `Description is consistent with ${inc.category.name.toLowerCase()}` : `Description sounds more like ${cat(best[0]).name.toLowerCase()} than ${inc.category.name.toLowerCase()}`,
    signals.length ? `Mentions ${signals.join(', ')}` : 'No direct life-threat wording',
  ];
  if (inc.people_affected >= 10) reasons.push(`${inc.people_affected} people affected is a large number for one report`);
  return {
    plausible: true,
    gibberish_or_test: false,
    category_matches: matches,
    suggested_category: matches ? inc.category.code : best[0],
    life_threat_signals: signals,
    possible_higher_severity: higher,
    confidence: clamp(0.62 + signals.length * 0.08 + (matches ? 0.1 : -0.05), 0.5, 0.96),
    reasons,
  };
}

/* ---------------- seed ---------------- */

// Demo only: passwords kept in plain text inside the browser mock. The real server must hash (see plan doc).
const SEED_USERS = [
  { id: 1, name: 'Admin User', email: 'admin@codeclash.dev', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Priya Raman', email: 'priya@example.com', password: 'priya1234', role: 'user', phone: '9840011223' },
];

// [code, title, description, location, people, status, minutesAgo, reporterId|null, contact, device, gps?, verification?]
const SEED = [
  ['MEDICAL', 'Fever and dizziness', 'Elderly man with high fever since morning, feeling dizzy.', 'Adyar, Chennai', 1, 'Resolved', 160, 2, [], 'dev-priya', [13.0015, 80.2561, 25], 'Verified'],
  ['ROAD', 'Bike skid near signal', 'Two-wheeler skidded on wet road. Rider injured, conscious.', 'Guindy Signal, Chennai', 1, 'Resolved', 130, null, [], 'dev-a1'],
  ['FLOOD', 'Rising water in colony', 'Rising water entering ground floor homes after rain. Families stuck.', 'Velachery, Chennai', 25, 'Pending', 102, null, ['Karthik', '9876501234'], 'dev-f1', [12.9818, 80.2186, 30]],
  ['FLOOD', 'Water entering houses near Velachery lake', 'Lake overflowing, water knee deep in our street. Elderly couple stuck on ground floor.', 'Velachery Main Rd, Chennai', 12, 'Reported', 84, null, ['Divya', '9840022110'], 'dev-f2', [12.9806, 80.2172, 45]],
  ['FLOOD', 'Flooding in Velachery colony', 'Heavy rain, rising water in the colony, cars submerged.', 'Velachery, Chennai', 30, 'Reported', 61, null, [], 'dev-f3', [12.9824, 80.2195, 60]],
  ['OTHER', 'Gas leak, residents unconscious', 'Strong gas leak in apartment block, two residents unconscious.', 'Tambaram, Chennai', 6, 'In Progress', 88, 2, [], 'dev-priya', [12.925, 80.1003, 20]],
  ['ROAD', 'Minor collision on OMR', 'Minor collision, one injured. Traffic slow.', 'Sholinganallur, OMR', 2, 'Pending', 35, null, [], 'dev-a2'],
  ['FIRE', 'Smoke spreading on 2nd floor', 'Fire, smoke spreading to 2nd floor of a shop.', 'Guindy, Chennai', 3, 'In Progress', 27, null, ['Meena', '', 'meena@example.com'], 'dev-a3', [13.0071, 80.2209, 35]],
  ['COLLAPSE', 'Building collapsed near bus stand', '3-storey building collapsed after heavy rain. People trapped under debris, one child missing.', 'Vandalur Main Rd, Chennai', 10, 'Reported', 2, null, ['Ravi', '9812345610'], 'dev-c1'],
  ['FIRE', 'Kitchen fire in restaurant', 'Kitchen fire, staff evacuated. Flames contained.', 'T. Nagar, Chennai', 4, 'Resolved', 300, null, [], 'dev-a4', [13.0421, 80.2338, 15], 'Verified'],
  ['MEDICAL', 'Child not breathing properly', 'Child choking at home, struggling to breathe.', 'Anna Nagar, Chennai', 1, 'In Progress', 18, 2, [], 'dev-priya', [13.0853, 80.2098, 18]],
  ['ROAD', 'Bus and lorry collision', 'Bus hit a lorry on the highway. Many passengers injured, one trapped in seat.', 'GST Road, Chengalpattu', 18, 'Pending', 64, null, [], 'dev-a5', [12.86, 80.08, 2400]],
  ['OTHER', 'test asdf', 'testing testing asdf qwer', 'xyz', 0, 'Reported', 9, null, [], 'dev-spam'],
  ['FIRE', 'Fire alarm going off in office', 'Fire alarm ringing on 4th floor, no smoke seen. Turned out to be a drill.', 'Guindy, Chennai', 40, 'Resolved', 220, null, [], 'dev-a6', null, 'False Alarm'],
];

function makeIncident(id, fields, nowMs) {
  const sev = computeSeverity(fields.category_code, fields.people_affected, `${fields.title} ${fields.description}`);
  const createdIso = new Date(fields.created_ms ?? nowMs).toISOString();
  return {
    id,
    ref_code: refFor(id),
    title: fields.title,
    description: fields.description,
    category: cat(fields.category_code),
    location: fields.location,
    latitude: fields.latitude ?? null,
    longitude: fields.longitude ?? null,
    location_source: fields.latitude != null ? 'gps' : 'manual',
    location_accuracy_m: fields.location_accuracy_m ?? null,
    people_affected: fields.people_affected,
    contact_name: fields.contact_name || null,
    contact_phone: fields.contact_phone || null,
    contact_email: fields.contact_email || null,
    severity: sev.level,
    severity_score: sev.score,
    severity_reasons: sev.reasons,
    severity_overridden: false,
    status: 'Reported',
    is_duplicate: false,
    reporter_id: fields.reporter?.id ?? null,
    reporter: fields.reporter ? { id: fields.reporter.id, name: fields.reporter.name, email: fields.reporter.email } : null,
    is_anonymous: !fields.reporter,
    device_id: fields.device_id || null,
    verification_override: null, // 'Verified' | 'False Alarm' set by admin
    duplicate_of: null,
    cluster_root: null,
    llm_ready_at: t(createdIso) + LLM_DELAY_MS,
    _honeypot: Boolean(fields.honeypot),
    created_at: createdIso,
    updated_at: createdIso,
    resolved_at: null,
    history: [{ from_status: null, to_status: 'Reported', note: 'Initial emergency report logged', changed_by_name: null, changed_at: createdIso }],
  };
}

function seed() {
  const now = Date.now();
  const state = { nextId: 1, nextUserId: SEED_USERS.length + 1, users: SEED_USERS.map((u) => ({ ...u })), tokens: {}, incidents: [], devices: {}, hits: {}, rateLimited: [] };
  for (const [code, title, description, location, people, status, mins, reporterId, contact, device, gps, verif] of SEED) {
    const reporter = state.users.find((u) => u.id === reporterId) || null;
    const inc = makeIncident(
      state.nextId++,
      {
        category_code: code,
        title,
        description,
        location,
        people_affected: people,
        reporter,
        device_id: device,
        contact_name: contact[0] || reporter?.name,
        contact_phone: contact[1] || reporter?.phone,
        contact_email: contact[2] || reporter?.email,
        latitude: gps?.[0],
        longitude: gps?.[1],
        location_accuracy_m: gps?.[2],
        created_ms: now - mins * 60000,
      },
      now,
    );
    inc.llm_ready_at = 0; // seeded reports were checked long ago
    let prev = 'Reported';
    STATUSES.slice(1, STATUSES.indexOf(status) + 1).forEach((to, k) => {
      inc.history.push({
        from_status: prev,
        to_status: to,
        note: to === 'Resolved' ? 'Handled on site, area safe.' : to === 'In Progress' ? 'Unit dispatched.' : null,
        changed_by_name: 'Admin User',
        changed_at: new Date(now - mins * 60000 + (k + 1) * Math.max(1, mins / 4) * 60000).toISOString(),
      });
      prev = to;
    });
    inc.status = status;
    inc.updated_at = inc.history[inc.history.length - 1].changed_at;
    inc.resolved_at = status === 'Resolved' ? inc.updated_at : null;
    if (verif) inc.verification_override = verif;
    placeInCluster(state, inc);
    state.incidents.push(inc);
  }
  for (const inc of state.incidents) {
    if (inc.verification_override === 'False Alarm') bumpDevice(state, inc.device_id, 'false');
    if (inc.verification_override === 'Verified') bumpDevice(state, inc.device_id, 'verified');
  }
  return state;
}

function bumpDevice(state, deviceId, kind) {
  if (!deviceId) return;
  const d = (state.devices[deviceId] ||= { verified: 0, false: 0 });
  d[kind] += 1;
}

/* ---------------- clustering & duplicates ---------------- */

const tokens = (s) => String(s || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);

function sameArea(a, b) {
  const d = haversineM(a, b);
  if (d != null) return d <= CLUSTER_RADIUS_M;
  const ta = new Set(tokens(a.location));
  return tokens(b.location).some((w) => ta.has(w) && w !== 'chennai');
}

/** Sets duplicate_of / cluster_root for a new incident (mutates). */
function placeInCluster(state, inc) {
  const candidates = state.incidents.filter(
    (o) => o.category.code === inc.category.code && o.verification_override !== 'False Alarm' && Math.abs(t(inc.created_at) - t(o.created_at)) <= CLUSTER_WINDOW_MS,
  );
  // Same device, same category, within 30 min → duplicate, not a corroboration
  const dup = inc.device_id && candidates.find((o) => o.device_id === inc.device_id && Math.abs(t(inc.created_at) - t(o.created_at)) <= DUPLICATE_WINDOW_MS);
  if (dup) {
    inc.duplicate_of = dup.duplicate_of || dup.id;
    inc.is_duplicate = true;
    inc.cluster_root = null;
    return;
  }
  const match = candidates.find((o) => !o.duplicate_of && o.device_id !== inc.device_id && sameArea(inc, o));
  if (match) {
    const root = match.cluster_root || match.id;
    inc.cluster_root = root;
    const rootInc = state.incidents.find((o) => o.id === root);
    if (rootInc) rootInc.cluster_root = root;
  }
}

/** Removes an incident from its cluster; re-roots the remaining members (or dissolves a cluster of one). */
function leaveCluster(state, inc) {
  const root = inc.cluster_root;
  inc.cluster_root = null;
  if (!root) return;
  const rest = state.incidents
    .filter((o) => o.cluster_root === root && o.id !== inc.id && o.verification_override !== 'False Alarm')
    .sort((a, b) => t(a.created_at) - t(b.created_at));
  const newRoot = rest.length > 1 ? rest[0].id : null;
  for (const o of state.incidents) if (o.cluster_root === root && o.id !== inc.id) o.cluster_root = newRoot;
}

function clusterMembers(state, inc) {
  if (!inc.cluster_root) return [inc];
  return state.incidents.filter((o) => o.cluster_root === inc.cluster_root && !o.duplicate_of && o.verification_override !== 'False Alarm');
}

/* ---------------- derived view (trust, verification, AI) ---------------- */

function view(state, inc, nowMs = Date.now(), { forPublic = false } = {}) {
  const members = clusterMembers(state, inc);
  const devices = new Set(members.map((m) => m.device_id).filter(Boolean));
  const corroborated = members.length >= 2 && devices.size >= 2;
  const llmReady = nowMs >= inc.llm_ready_at;
  const llm = llmReady ? assess(inc) : null;
  const dev = state.devices[inc.device_id] || { verified: 0, false: 0 };
  const typedGeo = geocode(inc.location);
  const mismatchKm = inc.latitude != null && typedGeo ? haversineM(inc, typedGeo) / 1000 : null;
  const recentFromDevice = state.incidents.filter((o) => o.device_id && o.device_id === inc.device_id && o.id !== inc.id && Math.abs(t(o.created_at) - t(inc.created_at)) < 60 * 60 * 1000).length;

  const reasons = [];
  let score = 50;
  const add = (label, pts) => {
    if (!pts) return;
    score += pts;
    reasons.push(`${label} ${pts > 0 ? '+' : '−'}${Math.abs(pts)}`);
  };
  reasons.push('Base score 50');
  if (inc.latitude != null) add(inc.location_accuracy_m != null && inc.location_accuracy_m > 1000 ? 'Low-accuracy GPS' : 'Device GPS attached', inc.location_accuracy_m != null && inc.location_accuracy_m > 1000 ? 5 : 15);
  if (mismatchKm != null && mismatchKm > 5) add(`GPS ${mismatchKm.toFixed(1)} km from typed address`, -15);
  if (inc.contact_phone) add('Phone number given', 10);
  if (!inc.is_anonymous) add('Signed-in account', 10);
  if (corroborated) add(`Corroborated by ${devices.size - 1} other device${devices.size - 1 === 1 ? '' : 's'}`, 20);
  if (inc.duplicate_of) add('Repeat report from same device', -10);
  if (recentFromDevice >= 2) add('Several reports from this device in an hour', -10);
  if (dev.false > 0) add('Device has past false alarms', -20 * Math.min(dev.false, 2));
  if (dev.verified > 0) add('Device has verified reports', 10);
  if (inc._honeypot) add('Hidden form field filled (bot signal)', -50);
  if (llm?.gibberish_or_test) add('AI: looks like gibberish or a test', -35);
  else if (llm && llm.category_matches === false) add('AI: category may not match', -10);
  else if (llm?.plausible) add('AI: plausible emergency', 5);
  score = clamp(score, 0, 100);

  let verification = 'Unverified';
  if (inc.verification_override) verification = inc.verification_override;
  else if (corroborated) verification = 'Corroborated';

  const peopleTotal = members.reduce((s, m) => s + (m.people_affected || 0), 0);
  const sorted = [...members].sort((a, b) => t(a.created_at) - t(b.created_at));
  const rank = sorted.findIndex((m) => m.id === inc.id) + 1;

  const { history, verification_override: _v, llm_ready_at: _l, _honeypot: _h, device_id: _d, cluster_root, ...rest } = inc;
  const out = {
    ...rest,
    verification_status: verification,
    cluster_id: cluster_root ? `C-${cluster_root}` : null,
    cluster_size: members.length,
    cluster_rank: members.length > 1 ? rank : null,
    duplicate_of_ref: inc.duplicate_of ? refFor(inc.duplicate_of) : null,
  };
  if (forPublic) return out; // never expose trust numbers or AI output to the public reporter

  return {
    ...out,
    history,
    trust_score: Math.round(score),
    trust_reasons: reasons,
    llm_assessment: llm,
    verification: llmReady ? null : 'in_progress',
    location_mismatch_km: mismatchKm != null ? Number(mismatchKm.toFixed(1)) : null,
    corroborating_ids: members.filter((m) => m.id !== inc.id).map((m) => m.id),
    duplicate_ids: state.incidents.filter((o) => o.duplicate_of === inc.id).map((o) => o.id),
    cluster_people_affected: members.length > 1 ? Math.max(...members.map((m) => m.people_affected || 0), Math.round(peopleTotal / members.length)) : null,
  };
}

/* ---------------- storage ---------------- */

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore and reseed */
  }
  const fresh = seed();
  save(fresh);
  return fresh;
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: keep working in memory */
  }
}

let db = load();

const ok = (data, status = 200, headers) => ({ status, data: structuredClone(data), headers });
const fail = (status, detail, extra = {}, headers) => ({ status, data: { detail, ...extra }, headers });
const publicUser = (u) => (u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null);
const userForToken = (token) => (token ? db.users.find((u) => u.id === db.tokens[token]) || null : null);

function issueToken(user) {
  const token = randomToken();
  db.tokens[token] = user.id;
  save(db);
  return token;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function stats() {
  const now = Date.now();
  const views = db.incidents.map((i) => view(db, i, now));
  const by_status = Object.fromEntries(STATUSES.map((s) => [s, views.filter((i) => i.status === s).length]));
  const by_severity = Object.fromEntries(SEVERITIES.map((s) => [s, views.filter((i) => i.severity === s).length]));
  const by_category = FALLBACK_CATEGORIES.map((c) => ({ code: c.code, name: c.name, count: views.filter((i) => i.category.code === c.code).length }));
  const activeCrit = views.filter((i) => i.severity === 'Critical' && i.status !== 'Resolved' && i.verification_status !== 'False Alarm').sort((a, b) => t(b.created_at) - t(a.created_at));
  const anonymous = views.filter((i) => i.is_anonymous).length;
  const roots = new Map();
  for (const v of views) if (v.cluster_id && v.cluster_size > 1 && v.status !== 'Resolved') roots.set(v.cluster_id, v);
  const largest = [...roots.values()].sort((a, b) => b.cluster_size - a.cluster_size)[0];
  const largestRoot = largest ? views.find((v) => v.id === Number(largest.cluster_id.slice(2))) || largest : null;
  return {
    total: views.length,
    critical: by_severity.Critical,
    critical_active: activeCrit.length,
    pending: views.length - by_status.Resolved,
    resolved: by_status.Resolved,
    anonymous,
    registered: views.length - anonymous,
    by_status,
    by_severity,
    by_category,
    recent_critical: activeCrit.slice(0, 5).map((i) => ({ id: i.id, ref_code: i.ref_code, title: i.title, location: i.location, created_at: i.created_at })),
    unverified: views.filter((i) => i.verification_status === 'Unverified').length,
    corroborated: views.filter((i) => i.verification_status === 'Corroborated').length,
    verified: views.filter((i) => i.verification_status === 'Verified').length,
    false_alarms: views.filter((i) => i.verification_status === 'False Alarm').length,
    suspicious: views.filter((i) => i.trust_score < 30 && i.verification_status !== 'False Alarm').length,
    rate_limited_today: db.rateLimited.filter((ts) => ts >= startOfToday()).length,
    active_clusters: roots.size,
    largest_cluster: largestRoot ? { root_id: largestRoot.id, title: largestRoot.title, size: largest.cluster_size } : null,
  };
}

function list(q, scope = db.incidents) {
  const now = Date.now();
  const term = (q.q || '').trim().toLowerCase();
  let items = scope.map((i) => view(db, i, now));
  if (q.include_duplicates !== 'true') items = items.filter((i) => !i.duplicate_of);
  if (q.group === 'cluster') items = items.filter((i) => !i.cluster_id || i.cluster_id === `C-${i.id}`);
  items = items.filter(
    (i) =>
      (!q.status || i.status === q.status) &&
      (!q.severity || i.severity === q.severity) &&
      (!q.category || i.category.code === q.category) &&
      (!q.verification_status || i.verification_status === q.verification_status) &&
      (q.min_trust === undefined || q.min_trust === '' || i.trust_score >= Number(q.min_trust)) &&
      (q.max_trust === undefined || q.max_trust === '' || i.trust_score <= Number(q.max_trust)) &&
      (!term || `${i.ref_code} ${i.title} ${i.description} ${i.location}`.toLowerCase().includes(term)),
  );
  items.sort((a, b) => {
    if (q.sort === 'newest') return t(b.created_at) - t(a.created_at);
    if (q.sort === 'oldest') return t(a.created_at) - t(b.created_at);
    // Priority never demotes an emergency for low trust: active Critical first, then score, then corroboration.
    const ca = a.severity === 'Critical' && a.status !== 'Resolved' ? 0 : 1;
    const cb = b.severity === 'Critical' && b.status !== 'Resolved' ? 0 : 1;
    const ra = a.status === 'Resolved' || a.verification_status === 'False Alarm' ? 1 : 0;
    const rb = b.status === 'Resolved' || b.verification_status === 'False Alarm' ? 1 : 0;
    return ca - cb || ra - rb || b.severity_score - a.severity_score || b.cluster_size - a.cluster_size || t(b.created_at) - t(a.created_at);
  });
  const limit = Math.min(100, Number(q.limit) || 10);
  const offset = Math.max(0, Number(q.offset) || 0);
  return { items: items.slice(offset, offset + limit).map(({ history: _h, ...r }) => r), total: items.length };
}

const EMAIL_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function validateCreate(b) {
  const errs = [];
  const len = (v) => String(v || '').trim().length;
  const hasGps = b.latitude != null && b.longitude != null;
  if (len(b.title) < 5 || len(b.title) > 120) errs.push({ loc: ['body', 'title'], msg: 'must be 5–120 characters' });
  if (len(b.description) < 10 || len(b.description) > 2000) errs.push({ loc: ['body', 'description'], msg: 'must be 10–2000 characters' });
  if (!(hasGps && len(b.location) === 0) && (len(b.location) < 3 || len(b.location) > 200)) errs.push({ loc: ['body', 'location'], msg: 'must be 3–200 characters (or send GPS)' });
  if (!FALLBACK_CATEGORIES.some((c) => c.code === b.category_code)) errs.push({ loc: ['body', 'category_code'], msg: 'unknown category' });
  if (b.contact_phone && !PHONE_RE.test(b.contact_phone)) errs.push({ loc: ['body', 'contact_phone'], msg: 'must contain 7-15 digits' });
  if (b.contact_email && !EMAIL_RE.test(b.contact_email)) errs.push({ loc: ['body', 'contact_email'], msg: 'must be a valid email address' });
  return errs;
}

/* ---------------- router ---------------- */

export async function mockRequest(method, path, body, query, token, headers = {}) {
  await sleep(method === 'GET' ? 200 : 380);
  const me = userForToken(token);
  const m = (re) => path.match(re);
  const now = Date.now();
  let r;

  /* ---------- public ---------- */
  if (method === 'GET' && path === '/categories') return ok(FALLBACK_CATEGORIES);

  if (method === 'POST' && path === '/auth/login') {
    const user = db.users.find((u) => u.email.toLowerCase() === String(body?.email || '').trim().toLowerCase());
    if (!user || user.password !== body?.password) return fail(401, 'Invalid email or password');
    return ok({ token: issueToken(user), user: publicUser(user) });
  }

  if (method === 'POST' && path === '/auth/register') {
    const name = String(body?.name || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const errs = [];
    if (name.length < 2 || name.length > 80) errs.push({ loc: ['body', 'name'], msg: 'must be 2–80 characters' });
    if (!EMAIL_RE.test(email)) errs.push({ loc: ['body', 'email'], msg: 'must be a valid email address' });
    if (password.length < 8) errs.push({ loc: ['body', 'password'], msg: 'must be at least 8 characters' });
    if (body?.phone && !PHONE_RE.test(body.phone)) errs.push({ loc: ['body', 'phone'], msg: 'must contain 7-15 digits' });
    if (errs.length) return fail(422, errs);
    if (db.users.some((u) => u.email === email)) return fail(409, 'An account with this email already exists');
    const user = { id: db.nextUserId++, name, email, password, role: 'user', phone: body?.phone || null };
    db.users.push(user);
    return ok({ token: issueToken(user), user: publicUser(user) }, 201);
  }

  if (method === 'GET' && path === '/auth/me') {
    if (!me) return fail(401, 'Invalid or expired authentication token');
    return ok(publicUser(me));
  }

  if (method === 'POST' && path === '/auth/logout') {
    if (token) delete db.tokens[token];
    save(db);
    return { status: 204, data: null };
  }

  if (method === 'POST' && path === '/incidents') {
    if (token && !me) return fail(401, 'Invalid or expired authentication token');
    const deviceId = headers['X-Device-Id'] || 'unknown-device';

    // Rate limit per device
    const recent = (db.hits[deviceId] || []).filter((ts) => now - ts < RATE_LIMIT.windowMs);
    if (recent.length >= RATE_LIMIT.max) {
      const retry = Math.ceil((recent[0] + RATE_LIMIT.windowMs - now) / 1000);
      db.rateLimited.push(now);
      save(db);
      return fail(429, 'Too many reports from this device. If this is an emergency, call 112.', { retry_after: retry }, { 'Retry-After': String(retry) });
    }

    const errs = validateCreate(body || {});
    if (errs.length) return fail(422, errs);

    db.hits[deviceId] = [...recent, now];
    const reporter = me && !body.anonymous ? me : null;
    const hasGps = body.latitude != null && body.longitude != null;
    const location = String(body.location || '').trim() || (hasGps ? reverseGeocode(body) : '');
    const inc = makeIncident(
      db.nextId++,
      {
        category_code: body.category_code,
        title: body.title.trim(),
        description: body.description.trim(),
        location,
        people_affected: Number(body.people_affected) || 0,
        reporter,
        device_id: deviceId,
        contact_name: body.contact_name || reporter?.name,
        contact_phone: body.contact_phone || reporter?.phone,
        contact_email: body.contact_email || reporter?.email,
        latitude: hasGps ? body.latitude : null,
        longitude: hasGps ? body.longitude : null,
        location_accuracy_m: body.location_accuracy_m ?? null,
        honeypot: Boolean(String(body.website || '').trim()),
      },
      now,
    );
    if (hasGps) inc.location_source = body.location?.trim() ? 'both' : 'gps';
    placeInCluster(db, inc);
    db.incidents.push(inc);
    save(db);
    return ok(view(db, inc, now, { forPublic: true }), 201);
  }

  if (method === 'GET' && (r = m(/^\/incidents\/track\/(.+)$/))) {
    const ref = decodeURIComponent(r[1]).toUpperCase();
    const inc = db.incidents.find((i) => i.ref_code === ref);
    if (!inc) return fail(404, 'Incident not found');
    const { ref_code, title, status, severity, created_at, updated_at } = inc;
    return ok({ ref_code, title, status, severity, created_at, updated_at });
  }

  /* ---------- signed-in citizen ---------- */
  if (method === 'GET' && path === '/me/incidents') {
    if (!me) return fail(401, 'Invalid or expired authentication token');
    const res = list({ sort: 'newest', include_duplicates: 'true', ...query }, db.incidents.filter((i) => i.reporter_id === me.id));
    // Citizens don't see trust internals
    res.items = res.items.map(({ trust_score: _a, trust_reasons: _b, llm_assessment: _c, ...rest }) => rest);
    return ok(res);
  }

  /* ---------- admin only ---------- */
  if (!me) return fail(401, 'Missing Authorization header');
  if (me.role !== 'admin') return fail(403, 'Admin privileges required');

  if (method === 'GET' && path === '/dashboard/stats') return ok(stats());
  if (method === 'GET' && path === '/incidents') return ok(list(query));

  if ((r = m(/^\/incidents\/(\d+)(\/status|\/severity|\/verify|\/related)?$/))) {
    const id = Number(r[1]);
    const inc = db.incidents.find((i) => i.id === id);
    if (!inc) return fail(404, 'Incident not found');
    const nowIso = new Date().toISOString();

    if (method === 'GET' && !r[2]) {
      const v = view(db, inc, now);
      return ok({ ...v, history: [...v.history].reverse() });
    }

    if (method === 'GET' && r[2] === '/related') {
      const members = clusterMembers(db, inc).filter((o) => o.id !== inc.id);
      const rootId = inc.duplicate_of || inc.id;
      const dups = db.incidents.filter((o) => o.id !== inc.id && (o.duplicate_of === rootId || (inc.duplicate_of && o.id === inc.duplicate_of)));
      const enrich = (o) => {
        const v = view(db, o, now);
        const d = haversineM(inc, o);
        const { history: _h, ...rest } = v;
        return { ...rest, distance_m: d != null ? Math.round(d) : null, minutes_apart: Math.round(Math.abs(t(o.created_at) - t(inc.created_at)) / 60000) };
      };
      return ok({ corroborating: members.map(enrich), duplicates: dups.map(enrich) });
    }

    if (method === 'PATCH' && r[2] === '/verify') {
      const status = body?.verification_status;
      if (!['Verified', 'False Alarm', 'Unverified'].includes(status)) return fail(422, [{ loc: ['body', 'verification_status'], msg: 'must be Verified, False Alarm or Unverified' }]);
      const before = inc.verification_override;
      inc.verification_override = status === 'Unverified' ? null : status;
      if (status === 'False Alarm' && before !== 'False Alarm') {
        bumpDevice(db, inc.device_id, 'false');
        leaveCluster(db, inc);
      }
      if (status === 'Verified' && before !== 'Verified') bumpDevice(db, inc.device_id, 'verified');
      inc.history.push({
        from_status: inc.status,
        to_status: inc.status,
        note: `Verification: ${status}${body?.note ? ` — ${body.note}` : ''}`,
        changed_by_name: me.name,
        changed_at: nowIso,
      });
      inc.updated_at = nowIso;
      save(db);
      const v = view(db, inc, now);
      return ok({ ...v, history: [...v.history].reverse() });
    }

    if (method === 'PATCH' && r[2] === '/status') {
      if (![...STATUSES, 'False Alarm'].includes(body?.status)) return fail(422, [{ loc: ['body', 'status'], msg: 'invalid status' }]);
      inc.history.push({ from_status: inc.status, to_status: body.status, note: body.note || null, changed_by_name: me.name, changed_at: nowIso });
      inc.status = body.status;
      inc.resolved_at = body.status === 'Resolved' ? nowIso : null;
      inc.updated_at = nowIso;
      save(db);
      return ok(view(db, inc, now));
    }

    if (method === 'PATCH' && r[2] === '/severity') {
      if (!SEVERITIES.includes(body?.severity)) return fail(422, [{ loc: ['body', 'severity'], msg: 'invalid severity' }]);
      inc.severity = body.severity;
      inc.severity_overridden = true;
      inc.severity_reasons = [...inc.severity_reasons, `manually set to ${body.severity} by admin`];
      inc.updated_at = nowIso;
      save(db);
      return ok(view(db, inc, now));
    }

    if (method === 'DELETE' && !r[2]) {
      leaveCluster(db, inc);
      db.incidents = db.incidents.filter((i) => i.id !== id);
      for (const o of db.incidents) if (o.duplicate_of === id) o.duplicate_of = null;
      save(db);
      return { status: 204, data: null };
    }
  }

  return fail(404, 'Not Found');
}

export function resetMock() {
  db = seed();
  save(db);
}
