// In-browser stand-in for the FastAPI backend, following the same contract.
// Only used with `npm run dev:mock` (or VITE_MOCK=true). Data persists in localStorage.
import { FALLBACK_CATEGORIES, SEVERITIES, STATUSES } from './constants';
import { computeSeverity } from './severity';

const KEY = 'resqnet_mock_v3';
const YEAR = new Date().getFullYear();
const ADMIN = { id: 1, name: 'Admin', email: 'admin@codeclash.dev', role: 'admin' };
const MOCK_TOKEN = 'mock-admin-token';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const refFor = (id) => `ER-${YEAR}-${String(id).padStart(4, '0')}`;
const cat = (code) => {
  const c = FALLBACK_CATEGORIES.find((x) => x.code === code) || FALLBACK_CATEGORIES[5];
  return { code: c.code, name: c.name, icon: c.icon };
};

// [code, title, description, location, people, status, minutesAgo, contact?]
const SEED = [
  ['MEDICAL', 'Fever and dizziness', 'Elderly man with high fever since morning, feeling dizzy.', 'Adyar, Chennai', 1, 'Resolved', 160, ['Lakshmi', '9840012345']],
  ['ROAD', 'Bike skid near signal', 'Two-wheeler skidded on wet road. Rider injured, conscious.', 'Guindy Signal, Chennai', 1, 'Resolved', 130],
  ['FLOOD', 'Rising water in colony', 'Rising water entering ground floor homes after rain. Families stuck.', 'Velachery, Chennai', 25, 'Pending', 102, ['Karthik', '9876501234']],
  ['OTHER', 'Gas leak, residents unconscious', 'Strong gas leak in apartment block, two residents unconscious.', 'Tambaram, Chennai', 6, 'In Progress', 88],
  ['ROAD', 'Minor collision on OMR', 'Car and auto collided. No one hurt, traffic slow.', 'Sholinganallur, OMR', 2, 'Pending', 35],
  ['FIRE', 'Smoke spreading on 2nd floor', 'Thick smoke spreading from a shop on the 2nd floor.', 'Guindy, Chennai', 3, 'In Progress', 27, ['Meena', '', 'meena@example.com']],
  ['COLLAPSE', 'Building collapsed near bus stand', '3-storey building collapsed after heavy rain. Several people trapped under debris, one child missing.', 'Vandalur Main Rd, Chennai', 10, 'Reported', 2, ['Ravi', '9812345610']],
  ['FIRE', 'Kitchen fire in restaurant', 'Kitchen fire, staff evacuated. Flames contained.', 'T. Nagar, Chennai', 4, 'Resolved', 300],
  ['MEDICAL', 'Child not breathing properly', 'Child choking at home, struggling to breathe.', 'Anna Nagar, Chennai', 1, 'In Progress', 18],
  ['FLOOD', 'Underpass waterlogged', 'Underpass flooded, two cars stuck with people inside.', 'Kodambakkam, Chennai', 4, 'Reported', 50],
  ['ROAD', 'Bus and lorry collision', 'Bus hit a lorry on the highway. Many passengers injured, one trapped in seat.', 'GST Road, Chengalpattu', 18, 'Pending', 64],
  ['OTHER', 'Fallen tree blocking road', 'Large tree fell across the road after the storm. Road blocked.', 'Mylapore, Chennai', 0, 'Resolved', 400],
];

function seed() {
  const now = Date.now();
  const incidents = SEED.map(([code, title, description, location, people, status, mins, contact = []], i) => {
    const id = i + 1;
    const created = new Date(now - mins * 60000).toISOString();
    const sev = computeSeverity(code, people, `${title} ${description}`);
    const history = [{ from_status: null, to_status: 'Reported', note: 'Initial emergency report logged', changed_by_name: null, changed_at: created }];
    const path = STATUSES.slice(1, STATUSES.indexOf(status) + 1);
    let prev = 'Reported';
    path.forEach((to, k) => {
      history.push({
        from_status: prev,
        to_status: to,
        note: to === 'Resolved' ? 'Handled on site, area safe.' : to === 'In Progress' ? 'Unit dispatched.' : null,
        changed_by_name: 'Admin',
        changed_at: new Date(now - mins * 60000 + (k + 1) * Math.max(1, mins / 4) * 60000).toISOString(),
      });
      prev = to;
    });
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
      contact_name: contact[0] || null,
      contact_phone: contact[1] || null,
      contact_email: contact[2] || null,
      severity: sev.level,
      severity_score: sev.score,
      severity_reasons: sev.reasons,
      severity_overridden: false,
      status,
      is_duplicate: false,
      created_at: created,
      updated_at: history.length ? history[history.length - 1].changed_at : created,
      resolved_at: status === 'Resolved' ? history[history.length - 1].changed_at : null,
      history,
    };
  });
  return { nextId: incidents.length + 1, incidents };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore and reseed */
  }
  const db = seed();
  save(db);
  return db;
}

function save(db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage blocked: keep working in memory */
  }
}

let db = load();

const ok = (data, status = 200) => ({ status, data: structuredClone(data) });
const fail = (status, detail) => ({ status, data: { detail } });
const SEV_RANK = { Critical: 3, High: 2, Medium: 1, Low: 0 };
const time = (i) => new Date(i.created_at).getTime();
const withoutHistory = ({ history: _h, ...rest }) => rest;

function stats() {
  const list = db.incidents;
  const by_status = Object.fromEntries(STATUSES.map((s) => [s, list.filter((i) => i.status === s).length]));
  const by_severity = Object.fromEntries(SEVERITIES.map((s) => [s, list.filter((i) => i.severity === s).length]));
  const by_category = FALLBACK_CATEGORIES.map((c) => ({
    code: c.code,
    name: c.name,
    icon: c.icon,
    count: list.filter((i) => i.category.code === c.code).length,
  }));
  const activeCrit = list
    .filter((i) => i.severity === 'Critical' && i.status !== 'Resolved')
    .sort((a, b) => time(b) - time(a));
  return {
    total: list.length,
    critical: by_severity.Critical,
    critical_active: activeCrit.length,
    pending: list.length - by_status.Resolved,
    resolved: by_status.Resolved,
    by_status,
    by_severity,
    by_category,
    recent_critical: activeCrit.slice(0, 5).map((i) => ({
      id: i.id,
      ref_code: i.ref_code,
      title: i.title,
      location: i.location,
      created_at: i.created_at,
    })),
  };
}

function list(q) {
  const term = (q.q || '').trim().toLowerCase();
  let items = db.incidents.filter(
    (i) =>
      (!q.status || i.status === q.status) &&
      (!q.severity || i.severity === q.severity) &&
      (!q.category || i.category.code === q.category) &&
      (!term || `${i.ref_code} ${i.title} ${i.description} ${i.location}`.toLowerCase().includes(term)),
  );
  items = [...items].sort((a, b) => {
    if (q.sort === 'newest') return time(b) - time(a);
    if (q.sort === 'oldest') return time(a) - time(b);
    const ra = a.status === 'Resolved' ? 1 : 0;
    const rb = b.status === 'Resolved' ? 1 : 0;
    return ra - rb || SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.severity_score - a.severity_score || time(b) - time(a);
  });
  const limit = Math.min(100, Number(q.limit) || 10);
  const offset = Math.max(0, Number(q.offset) || 0);
  return { items: items.slice(offset, offset + limit).map(withoutHistory), total: items.length };
}

function validateCreate(b) {
  const errs = [];
  const len = (v) => String(v || '').trim().length;
  if (len(b.title) < 5 || len(b.title) > 120) errs.push({ loc: ['body', 'title'], msg: 'must be 5–120 characters' });
  if (len(b.description) < 10 || len(b.description) > 2000) errs.push({ loc: ['body', 'description'], msg: 'must be 10–2000 characters' });
  if (len(b.location) < 3 || len(b.location) > 200) errs.push({ loc: ['body', 'location'], msg: 'must be 3–200 characters' });
  if (!FALLBACK_CATEGORIES.some((c) => c.code === b.category_code)) errs.push({ loc: ['body', 'category_code'], msg: 'unknown category' });
  return errs;
}

export async function mockRequest(method, path, body, query, token) {
  await sleep(method === 'GET' ? 220 : 420);
  const authed = token === MOCK_TOKEN;
  const m = (re) => path.match(re);
  let r;

  if (method === 'GET' && path === '/categories') return ok(FALLBACK_CATEGORIES);

  if (method === 'POST' && path === '/auth/login') {
    if (String(body?.email).trim().toLowerCase() === ADMIN.email && body?.password === 'admin123') {
      return ok({ token: MOCK_TOKEN, user: ADMIN });
    }
    return fail(401, 'Invalid email or password');
  }

  if (method === 'POST' && path === '/incidents') {
    const errs = validateCreate(body || {});
    if (errs.length) return fail(422, errs);
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
      contact_name: body.contact_name || null,
      contact_phone: body.contact_phone || null,
      contact_email: body.contact_email || null,
      severity: sev.level,
      severity_score: sev.score,
      severity_reasons: sev.reasons,
      severity_overridden: false,
      status: 'Reported',
      is_duplicate: false,
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
    if (!inc) return fail(404, 'No report found with that reference code');
    const { ref_code, title, status, severity, created_at, updated_at } = inc;
    return ok({ ref_code, title, status, severity, created_at, updated_at });
  }

  // Everything below is admin-only
  if (!authed) return fail(401, 'Not authenticated');

  if (method === 'GET' && path === '/dashboard/stats') return ok(stats());
  if (method === 'GET' && path === '/incidents') return ok(list(query));

  if ((r = m(/^\/incidents\/(\d+)(\/status|\/severity)?$/))) {
    const id = Number(r[1]);
    const inc = db.incidents.find((i) => i.id === id);
    if (!inc) return fail(404, 'Incident not found');
    const now = new Date().toISOString();

    if (method === 'GET' && !r[2]) return ok(inc);

    if (method === 'PATCH' && r[2] === '/status') {
      if (!STATUSES.includes(body?.status)) return fail(422, [{ loc: ['body', 'status'], msg: 'invalid status' }]);
      if (body.status !== inc.status || body.note) {
        inc.history.push({ from_status: inc.status, to_status: body.status, note: body.note || null, changed_by_name: ADMIN.name, changed_at: now });
      }
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

  return fail(404, 'Not found');
}

export function resetMock() {
  db = seed();
  save(db);
}
