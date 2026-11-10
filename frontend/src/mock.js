// In-browser stand-in for the FastAPI backend, following the same contract plus
// the citizen-account endpoints described in docs/server-auth-plan.md.
// Only used with `npm run dev:mock` (or VITE_MOCK=true). Data persists in localStorage.
import { FALLBACK_CATEGORIES, SEVERITIES, STATUSES } from './constants';
import { computeSeverity } from './severity';

const KEY = 'resqnet_mock_v4';
const YEAR = new Date().getFullYear();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const refFor = (id) => `ER-${YEAR}-${String(id).padStart(4, '0')}`;
const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
const cat = (code) => {
  const c = FALLBACK_CATEGORIES.find((x) => x.code === code) || FALLBACK_CATEGORIES[5];
  return { code: c.code, name: c.name };
};

// Demo only: passwords kept in plain text inside the browser mock. The real server must hash (see plan doc).
const SEED_USERS = [
  { id: 1, name: 'Admin User', email: 'admin@codeclash.dev', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Priya Raman', email: 'priya@example.com', password: 'priya1234', role: 'user', phone: '9840011223' },
];

// [code, title, description, location, people, status, minutesAgo, reporterId|null, contact?]
const SEED = [
  ['MEDICAL', 'Fever and dizziness', 'Elderly man with high fever since morning, feeling dizzy.', 'Adyar, Chennai', 1, 'Resolved', 160, 2],
  ['ROAD', 'Bike skid near signal', 'Two-wheeler skidded on wet road. Rider injured, conscious.', 'Guindy Signal, Chennai', 1, 'Resolved', 130, null],
  ['FLOOD', 'Rising water in colony', 'Rising water entering ground floor homes after rain. Families stuck.', 'Velachery, Chennai', 25, 'Pending', 102, null, ['Karthik', '9876501234']],
  ['OTHER', 'Gas leak, residents unconscious', 'Strong gas leak in apartment block, two residents unconscious.', 'Tambaram, Chennai', 6, 'In Progress', 88, 2],
  ['ROAD', 'Minor collision on OMR', 'Minor collision, one injured. Traffic slow.', 'Sholinganallur, OMR', 2, 'Pending', 35, null],
  ['FIRE', 'Smoke spreading on 2nd floor', 'Fire, smoke spreading to 2nd floor of a shop.', 'Guindy, Chennai', 3, 'In Progress', 27, null, ['Meena', '', 'meena@example.com']],
  ['COLLAPSE', 'Building collapsed near bus stand', '3-storey building collapsed after heavy rain. People trapped under debris, one child missing.', 'Vandalur Main Rd, Chennai', 10, 'Reported', 2, null, ['Ravi', '9812345610']],
  ['FIRE', 'Kitchen fire in restaurant', 'Kitchen fire, staff evacuated. Flames contained.', 'T. Nagar, Chennai', 4, 'Resolved', 300, null],
  ['MEDICAL', 'Child not breathing properly', 'Child choking at home, struggling to breathe.', 'Anna Nagar, Chennai', 1, 'In Progress', 18, 2],
  ['FLOOD', 'Underpass waterlogged', 'Underpass flooded, two cars stuck with people inside.', 'Kodambakkam, Chennai', 4, 'Reported', 50, null],
  ['ROAD', 'Bus and lorry collision', 'Bus hit a lorry on the highway. Many passengers injured, one trapped in seat.', 'GST Road, Chengalpattu', 18, 'Pending', 64, null],
  ['OTHER', 'Fallen tree blocking road', 'Large tree fell across the road after the storm. Road blocked.', 'Mylapore, Chennai', 0, 'Resolved', 400, null],
];

const publicUser = (u) => (u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null);
const reporterOf = (u) => (u ? { id: u.id, name: u.name, email: u.email } : null);

function seed() {
  const now = Date.now();
  const users = SEED_USERS.map((u) => ({ ...u }));
  const incidents = SEED.map(([code, title, description, location, people, status, mins, reporterId, contact = []], i) => {
    const id = i + 1;
    const created = new Date(now - mins * 60000).toISOString();
    const sev = computeSeverity(code, people, `${title} ${description}`);
    const reporter = users.find((u) => u.id === reporterId) || null;
    const history = [
      { from_status: null, to_status: 'Reported', note: 'Initial emergency report logged', changed_by_name: null, changed_at: created },
    ];
    let prev = 'Reported';
    STATUSES.slice(1, STATUSES.indexOf(status) + 1).forEach((to, k) => {
      history.push({
        from_status: prev,
        to_status: to,
        note: to === 'Resolved' ? 'Handled on site, area safe.' : to === 'In Progress' ? 'Unit dispatched.' : null,
        changed_by_name: 'Admin User',
        changed_at: new Date(now - mins * 60000 + (k + 1) * Math.max(1, mins / 4) * 60000).toISOString(),
      });
      prev = to;
    });
    const last = history[history.length - 1].changed_at;
    return {
      id,
      ref_code: refFor(id),
      title,
      description,
      category: cat(code),
      location,
      latitude: null,
      longitude: null,
      people_affected: people,
      contact_name: contact[0] || reporter?.name || null,
      contact_phone: contact[1] || reporter?.phone || null,
      contact_email: contact[2] || reporter?.email || null,
      severity: sev.level,
      severity_score: sev.score,
      severity_reasons: sev.reasons,
      severity_overridden: false,
      status,
      is_duplicate: false,
      reporter_id: reporter?.id ?? null,
      reporter: reporterOf(reporter),
      is_anonymous: !reporter,
      created_at: created,
      updated_at: last,
      resolved_at: status === 'Resolved' ? last : null,
      history,
    };
  });
  return { nextId: incidents.length + 1, nextUserId: users.length + 1, users, tokens: {}, incidents };
}

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

const ok = (data, status = 200) => ({ status, data: structuredClone(data) });
const fail = (status, detail) => ({ status, data: { detail } });
const time = (i) => new Date(i.created_at).getTime();
const withoutHistory = ({ history: _h, ...rest }) => rest;
const userForToken = (token) => (token ? db.users.find((u) => u.id === db.tokens[token]) || null : null);

function issueToken(user) {
  const token = randomToken();
  db.tokens[token] = user.id;
  save(db);
  return token;
}

function stats() {
  const list = db.incidents;
  const by_status = Object.fromEntries(STATUSES.map((s) => [s, list.filter((i) => i.status === s).length]));
  const by_severity = Object.fromEntries(SEVERITIES.map((s) => [s, list.filter((i) => i.severity === s).length]));
  const by_category = FALLBACK_CATEGORIES.map((c) => ({
    code: c.code,
    name: c.name,
    count: list.filter((i) => i.category.code === c.code).length,
  }));
  const activeCrit = list.filter((i) => i.severity === 'Critical' && i.status !== 'Resolved').sort((a, b) => time(b) - time(a));
  const anonymous = list.filter((i) => i.is_anonymous).length;
  return {
    total: list.length,
    critical: by_severity.Critical,
    critical_active: activeCrit.length,
    pending: list.length - by_status.Resolved,
    resolved: by_status.Resolved,
    anonymous,
    registered: list.length - anonymous,
    by_status,
    by_severity,
    by_category,
    recent_critical: activeCrit.slice(0, 5).map((i) => ({ id: i.id, ref_code: i.ref_code, title: i.title, location: i.location, created_at: i.created_at })),
  };
}

function filterSortPage(items, q) {
  const term = (q.q || '').trim().toLowerCase();
  let out = items.filter(
    (i) =>
      (!q.status || i.status === q.status) &&
      (!q.severity || i.severity === q.severity) &&
      (!q.category || i.category.code === q.category) &&
      (!term || `${i.ref_code} ${i.title} ${i.description} ${i.location}`.toLowerCase().includes(term)),
  );
  out = [...out].sort((a, b) => {
    if (q.sort === 'newest') return time(b) - time(a);
    if (q.sort === 'oldest') return time(a) - time(b);
    const ca = a.severity === 'Critical' && a.status !== 'Resolved' ? 0 : 1;
    const cb = b.severity === 'Critical' && b.status !== 'Resolved' ? 0 : 1;
    return ca - cb || b.severity_score - a.severity_score || time(b) - time(a);
  });
  const limit = Math.min(100, Number(q.limit) || 10);
  const offset = Math.max(0, Number(q.offset) || 0);
  return { items: out.slice(offset, offset + limit).map(withoutHistory), total: out.length };
}

const EMAIL_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;

function validateCreate(b) {
  const errs = [];
  const len = (v) => String(v || '').trim().length;
  if (len(b.title) < 5 || len(b.title) > 120) errs.push({ loc: ['body', 'title'], msg: 'must be 5–120 characters' });
  if (len(b.description) < 10 || len(b.description) > 2000) errs.push({ loc: ['body', 'description'], msg: 'must be 10–2000 characters' });
  if (len(b.location) < 3 || len(b.location) > 200) errs.push({ loc: ['body', 'location'], msg: 'must be 3–200 characters' });
  if (!FALLBACK_CATEGORIES.some((c) => c.code === b.category_code)) errs.push({ loc: ['body', 'category_code'], msg: 'unknown category' });
  if (b.contact_phone && !PHONE_RE.test(b.contact_phone)) errs.push({ loc: ['body', 'contact_phone'], msg: 'must contain 7-15 digits' });
  if (b.contact_email && !EMAIL_RE.test(b.contact_email)) errs.push({ loc: ['body', 'contact_email'], msg: 'must be a valid email address' });
  return errs;
}

export async function mockRequest(method, path, body, query, token) {
  await sleep(method === 'GET' ? 200 : 380);
  const me = userForToken(token);
  const m = (re) => path.match(re);
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
    // Optional auth: a token that is present but invalid is a 401 (the client then resubmits anonymously).
    if (token && !me) return fail(401, 'Invalid or expired authentication token');
    const errs = validateCreate(body || {});
    if (errs.length) return fail(422, errs);
    const reporter = me && !body.anonymous ? me : null;
    const id = db.nextId++;
    const now = new Date().toISOString();
    const sev = computeSeverity(body.category_code, body.people_affected, `${body.title} ${body.description}`);
    const inc = {
      id,
      ref_code: refFor(id),
      title: body.title.trim(),
      description: body.description.trim(),
      category: cat(body.category_code),
      location: body.location.trim(),
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      people_affected: Number(body.people_affected) || 0,
      contact_name: body.contact_name || reporter?.name || null,
      contact_phone: body.contact_phone || reporter?.phone || null,
      contact_email: body.contact_email || reporter?.email || null,
      severity: sev.level,
      severity_score: sev.score,
      severity_reasons: sev.reasons,
      severity_overridden: false,
      status: 'Reported',
      is_duplicate: false,
      reporter_id: reporter?.id ?? null,
      reporter: reporterOf(reporter),
      is_anonymous: !reporter,
      created_at: now,
      updated_at: now,
      resolved_at: null,
      history: [{ from_status: null, to_status: 'Reported', note: 'Initial emergency report logged', changed_by_name: null, changed_at: now }],
    };
    db.incidents.push(inc);
    save(db);
    return ok(withoutHistory(inc), 201);
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
    return ok(filterSortPage(db.incidents.filter((i) => i.reporter_id === me.id), { sort: 'newest', ...query }));
  }

  /* ---------- admin only ---------- */
  if (!me) return fail(401, 'Missing Authorization header');
  if (me.role !== 'admin') return fail(403, 'Admin privileges required');

  if (method === 'GET' && path === '/dashboard/stats') return ok(stats());
  if (method === 'GET' && path === '/incidents') return ok(filterSortPage(db.incidents, query));

  if ((r = m(/^\/incidents\/(\d+)(\/status|\/severity)?$/))) {
    const id = Number(r[1]);
    const inc = db.incidents.find((i) => i.id === id);
    if (!inc) return fail(404, 'Incident not found');
    const now = new Date().toISOString();

    if (method === 'GET' && !r[2]) return ok({ ...inc, history: [...inc.history].reverse() });

    if (method === 'PATCH' && r[2] === '/status') {
      if (!STATUSES.includes(body?.status)) return fail(422, [{ loc: ['body', 'status'], msg: 'invalid status' }]);
      inc.history.push({ from_status: inc.status, to_status: body.status, note: body.note || null, changed_by_name: me.name, changed_at: now });
      inc.status = body.status;
      inc.resolved_at = body.status === 'Resolved' ? now : null;
      inc.updated_at = now;
      save(db);
      return ok(inc);
    }

    if (method === 'PATCH' && r[2] === '/severity') {
      if (!SEVERITIES.includes(body?.severity)) return fail(422, [{ loc: ['body', 'severity'], msg: 'invalid severity' }]);
      inc.severity = body.severity;
      inc.severity_overridden = true;
      inc.severity_reasons = [...inc.severity_reasons, `manually set to ${body.severity} by admin`];
      inc.updated_at = now;
      save(db);
      return ok(inc);
    }

    if (method === 'DELETE' && !r[2]) {
      db.incidents = db.incidents.filter((i) => i.id !== id);
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
