// One request() helper + one function per backend endpoint.
import { FALLBACK_CATEGORIES, categoryByCode, normSeverity, normStatus, normVerification } from './constants';
import { getDeviceId } from './lib/device';
import { mockRequest } from './mock';

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const USE_MOCK = import.meta.env.MODE === 'mock' || import.meta.env.VITE_MOCK === 'true';

export const TOKEN_KEY = 'resqnet_token';
export const USER_KEY = 'resqnet_user';
export const SESSION_EVENT = 'resqnet:session';

export class ApiError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.retryAfter = extra.retryAfter ?? null; // seconds, set on 429
  }
}

/** Seconds from a 429 body ({retry_after}) or a Retry-After header (seconds or HTTP date). */
function parseRetryAfter(data, header) {
  const fromBody = Number(data?.retry_after ?? data?.retryAfter);
  if (Number.isFinite(fromBody) && fromBody > 0) return Math.ceil(fromBody);
  if (header) {
    const n = Number(header);
    if (Number.isFinite(n) && n > 0) return Math.ceil(n);
    const at = Date.parse(header);
    if (!Number.isNaN(at)) return Math.max(1, Math.ceil((at - Date.now()) / 1000));
  }
  return 60;
}

/* ---------------- session (one session for both citizens and admins; role decides access) ---------------- */

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

function announce() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function saveSession(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    /* storage blocked: session lasts for this page only */
  }
  announce();
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
  announce();
}

/** Accounts without a role (older backends) are treated as admins only if the backend says so. */
export const isAdminUser = (u) => String(u?.role || '').toLowerCase() === 'admin';

/* ---------------- request helper ---------------- */

/** Turn FastAPI errors ({detail: "..."} or 422 {detail: [{loc, msg}]}) into one sentence. */
function parseDetail(data, status) {
  const d = data && data.detail;
  if (typeof d === 'string' && d !== 'Not Found') return d;
  if (Array.isArray(d) && d.length) {
    return d
      .map((e) => {
        const field = Array.isArray(e.loc) ? e.loc.filter((p) => p !== 'body' && p !== 'query').join('.') : '';
        const msg = String(e.msg || 'is invalid').replace(/^Value error, /, '');
        return field ? `${field.replace(/_/g, ' ')}: ${msg}` : msg;
      })
      .join(' · ');
  }
  if (status === 404) return 'Not found.';
  if (status === 403) return 'You don’t have permission to do that.';
  if (status === 409) return 'That already exists.';
  if (status === 429) return 'Too many reports from this device.';
  if (status >= 500) return 'The server had a problem. Please try again.';
  return `Request failed (${status}).`;
}

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/**
 * auth: 'required' → must send token; 401 ends the session and redirects to sign-in.
 *       'optional' → send token if there is one; caller handles 401.
 *       false      → never send a token.
 */
export async function request(path, { method = 'GET', body, auth = false, query, headers: extraHeaders = {} } = {}) {
  const token = auth ? getToken() : null;

  let status;
  let data = null;
  let retryHeader = null;

  if (USE_MOCK) {
    const res = await mockRequest(method, path, body, query || {}, token, extraHeaders);
    status = res.status;
    data = res.data;
    retryHeader = res.headers?.['Retry-After'] ?? null;
  } else {
    const headers = { Accept: 'application/json', ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`${BASE_URL}${path}${buildQuery(query)}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
    }
    status = res.status;
    retryHeader = res.headers.get('Retry-After');
    if (status !== 204) {
      const text = await res.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { detail: text };
        }
      }
    }
  }

  if (status === 401 && auth === 'required') handleUnauthorized();
  if (status === 429) {
    throw new ApiError(429, parseDetail(data, status) || 'Too many requests.', { retryAfter: parseRetryAfter(data, retryHeader) });
  }
  if (status >= 400) throw new ApiError(status, parseDetail(data, status));
  return status === 204 ? null : data;
}

function handleUnauthorized() {
  clearSession();
  const path = window.location.pathname;
  if (path.startsWith('/admin')) {
    if (!path.startsWith('/admin/login')) window.location.href = '/admin/login?expired=1';
  } else if (!path.startsWith('/login')) {
    window.location.href = `/login?expired=1&next=${encodeURIComponent(path)}`;
  }
}

const notEnabled = (e) => e instanceof ApiError && (e.status === 404 || e.status === 405);

/* ---------------- normalizers ---------------- */

function normReason(r) {
  if (typeof r === 'string') return r;
  if (r && typeof r === 'object') {
    const label = r.label ?? r.reason ?? r.rule ?? '';
    const pts = r.points ?? r.score;
    return pts !== undefined ? `${label} +${pts}` : String(label);
  }
  return String(r);
}

function normCategory(c, code) {
  if (c && typeof c === 'object') return { ...categoryByCode(c.code), ...c };
  return categoryByCode(c || code);
}

function normReporter(raw) {
  const r = raw.reporter;
  if (r && typeof r === 'object') return { id: r.id ?? raw.reporter_id ?? null, name: r.name ?? null, email: r.email ?? null };
  if (raw.reporter_id) return { id: raw.reporter_id, name: raw.reporter_name ?? null, email: raw.reporter_email ?? null };
  return null;
}

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const ids = (v) => (Array.isArray(v) ? v.map(Number).filter(Number.isFinite) : []);

/**
 * Trust-layer fields. `has_trust` is false when the backend predates the trust
 * layer, so the UI can hide trust widgets instead of showing empty ones.
 * `llm_assessment`: undefined = not supported, null = check still running.
 */
function normTrust(raw) {
  const has = 'trust_score' in raw || 'verification_status' in raw || 'llm_assessment' in raw;
  return {
    has_trust: has,
    trust_score: num(raw.trust_score),
    trust_reasons: Array.isArray(raw.trust_reasons) ? raw.trust_reasons.map(normReason) : [],
    verification_status: has ? normVerification(raw.verification_status) : null,
    llm_assessment: 'llm_assessment' in raw ? raw.llm_assessment ?? null : undefined,
    verification: raw.verification ?? null,
    location_source: raw.location_source ?? (raw.latitude != null ? 'gps' : 'manual'),
    location_accuracy_m: num(raw.location_accuracy_m),
    location_mismatch_km: num(raw.location_mismatch_km),
    duplicate_of: num(raw.duplicate_of),
    duplicate_of_ref: raw.duplicate_of_ref ?? null,
    cluster_id: raw.cluster_id ?? null,
    cluster_size: Math.max(1, num(raw.cluster_size) ?? 1),
    cluster_rank: num(raw.cluster_rank ?? raw.report_number),
    corroborating_ids: ids(raw.corroborating_ids),
    duplicate_ids: ids(raw.duplicate_ids),
    cluster_people_affected: num(raw.cluster_people_affected),
  };
}

export function normalizeIncident(raw) {
  if (!raw) return raw;
  const reporter = normReporter(raw);
  return {
    ...raw,
    ref_code: raw.ref_code ?? raw.reference_no ?? raw.reference ?? `#${raw.id}`,
    category: normCategory(raw.category, raw.category_code),
    severity: normSeverity(raw.severity),
    status: normStatus(raw.status),
    severity_score: Number(raw.severity_score ?? 0),
    severity_reasons: Array.isArray(raw.severity_reasons) ? raw.severity_reasons.map(normReason) : [],
    priority_score: Number(raw.priority_score ?? raw.severity_score ?? 50),
    priority_label: raw.priority_label ?? normSeverity(raw.severity),
    priority_breakdown: raw.priority_breakdown ?? {
      severity: Math.round(Number(raw.severity_score ?? 30) * 0.4),
      people: Math.min(30, Number(raw.people_affected ?? 0) * 3),
      time: 15,
      category: 15,
    },
    assigned_team: raw.assigned_team ?? null,
    people_affected: Number(raw.people_affected ?? 0),
    reporter,
    // A report is anonymous unless the server linked it to an account.
    is_anonymous: typeof raw.is_anonymous === 'boolean' ? raw.is_anonymous : !reporter,
    ...normTrust(raw),
    history: Array.isArray(raw.history)
      ? raw.history.map((h) => ({
          ...h,
          from_status: h.from_status ? normStatus(h.from_status) : null,
          to_status: normStatus(h.to_status),
          changed_at: h.changed_at ?? h.created_at,
          changed_by_name: h.changed_by_name ?? h.changed_by ?? null,
        }))
      : [],
  };
}

function normList(data) {
  const items = Array.isArray(data) ? data : data.items ?? [];
  return { items: items.map(normalizeIncident), total: Number(data.total ?? items.length) };
}

/* ---------------- public endpoints ---------------- */

export async function getCategories() {
  try {
    const data = await request('/categories');
    return Array.isArray(data) && data.length ? data : FALLBACK_CATEGORIES;
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

/**
 * Submit a report. Signed-in users send their token so the server links the
 * report to their account; `anonymous: true` asks the server to ignore it.
 * Returns { incident, anonymousFallback } — anonymousFallback is true when an
 * expired session forced an anonymous resubmit (reports are never blocked).
 */
export async function createIncident(body, { anonymous = false } = {}) {
  const signedIn = Boolean(getToken());
  const payload = signedIn && anonymous ? { ...body, anonymous: true } : body;
  const headers = { 'X-Device-Id': getDeviceId() };
  try {
    const data = await request('/incidents', { method: 'POST', body: payload, headers, auth: signedIn && !anonymous ? 'optional' : false });
    return { incident: normalizeIncident(data), anonymousFallback: false };
  } catch (e) {
    if (e.status === 401 && signedIn && !anonymous) {
      clearSession();
      const data = await request('/incidents', { method: 'POST', body, headers, auth: false });
      return { incident: normalizeIncident(data), anonymousFallback: true };
    }
    throw e;
  }
}

export async function trackIncident(ref) {
  const data = await request(`/incidents/track/${encodeURIComponent(ref.trim())}`);
  return { ...data, severity: normSeverity(data.severity), status: normStatus(data.status) };
}

/* ---------------- accounts ---------------- */

function takeSession(data, fallbackUser) {
  const token = data.token ?? data.access_token;
  if (!token) throw new ApiError(500, 'Sign-in response had no token.');
  const user = { role: 'user', ...(fallbackUser || {}), ...(data.user || {}) };
  saveSession(token, user);
  return user;
}

export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password } });
  return takeSession(data, { email });
}

export async function register({ name, email, password, phone }) {
  try {
    const body = { name, email, password };
    if (phone) body.phone = phone;
    const data = await request('/auth/register', { method: 'POST', body });
    return takeSession(data, { name, email, role: 'user' });
  } catch (e) {
    if (notEnabled(e)) throw new ApiError(e.status, 'Account sign-up isn’t enabled on the server yet. You can still report anonymously.');
    if (e.status === 409) throw new ApiError(409, 'An account with this email already exists. Try signing in.');
    throw e;
  }
}

/** Validates the stored token. Returns the user, or null if the server has no /auth/me yet. */
export async function getMe() {
  try {
    const user = await request('/auth/me', { auth: 'optional' });
    return user;
  } catch (e) {
    if (notEnabled(e)) return null;
    throw e;
  }
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST', auth: 'optional' });
  } catch {
    /* server may not support logout; the local session is cleared either way */
  }
  clearSession();
}

/** The signed-in citizen's own reports. */
export async function listMyIncidents(params = {}) {
  try {
    return normList(await request('/me/incidents', { auth: 'required', query: params }));
  } catch (e) {
    if (notEnabled(e)) throw new ApiError(e.status, '“My reports” isn’t enabled on the server yet. Use Track with your reference code.');
    throw e;
  }
}

/* ---------------- admin endpoints ---------------- */

/** params: {status, severity, category, q, sort, limit, offset} → {items, total} */
export async function listIncidents(params = {}) {
  return normList(await request('/incidents', { auth: 'required', query: params }));
}

export async function getIncident(id) {
  return normalizeIncident(await request(`/incidents/${id}`, { auth: 'required' }));
}

export async function updateStatus(id, status, note) {
  const body = { status };
  if (note && note.trim()) body.note = note.trim();
  return normalizeIncident(await request(`/incidents/${id}/status`, { method: 'PATCH', auth: 'required', body }));
}

export async function updateSeverity(id, severity) {
  return normalizeIncident(await request(`/incidents/${id}/severity`, { method: 'PATCH', auth: 'required', body: { severity } }));
}

export async function deleteIncident(id) {
  await request(`/incidents/${id}`, { method: 'DELETE', auth: 'required' });
}

/** Trust layer: admin marks a report Verified or False Alarm. */
export async function verifyIncident(id, { verification_status, note }) {
  const body = { verification_status };
  if (note && note.trim()) body.note = note.trim();
  return normalizeIncident(await request(`/incidents/${id}/verify`, { method: 'PATCH', auth: 'required', body }));
}

/**
 * Trust layer: reports in the same cluster.
 * → { corroborating: [{...incident, distance_m, minutes_apart}], duplicates: [...] }
 */
export async function getRelated(id) {
  const data = await request(`/incidents/${id}/related`, { auth: 'required' });
  const one = (r) => ({ ...normalizeIncident(r), distance_m: num(r.distance_m), minutes_apart: num(r.minutes_apart) });
  if (Array.isArray(data)) return { corroborating: data.filter((r) => !r.duplicate_of && !r.is_duplicate).map(one), duplicates: data.filter((r) => r.duplicate_of || r.is_duplicate).map(one) };
  return {
    corroborating: (data.corroborating ?? data.related ?? []).map(one),
    duplicates: (data.duplicates ?? []).map(one),
  };
}

export async function getStats() {
  const s = await request('/dashboard/stats', { auth: 'required' });
  const byStatus = {};
  for (const [k, v] of Object.entries(s.by_status || {})) byStatus[normStatus(k)] = (byStatus[normStatus(k)] || 0) + Number(v);
  const bySeverity = {};
  for (const [k, v] of Object.entries(s.by_severity || {})) bySeverity[normSeverity(k)] = Number(v);
  const byCategory = Array.isArray(s.by_category)
    ? s.by_category
    : Object.entries(s.by_category || {}).map(([code, count]) => ({ ...categoryByCode(code), count }));
  return {
    total: Number(s.total ?? 0),
    critical: Number(s.critical ?? 0),
    critical_active: Number(s.critical_active ?? 0),
    pending: Number(s.pending ?? 0),
    resolved: Number(s.resolved ?? 0),
    anonymous: s.anonymous ?? s.by_reporter?.anonymous ?? null,
    registered: s.registered ?? s.by_reporter?.registered ?? null,
    // Trust layer (null when the backend doesn't provide them)
    has_trust: 'unverified' in s || 'corroborated' in s || 'suspicious' in s,
    unverified: num(s.unverified),
    corroborated: num(s.corroborated),
    verified: num(s.verified),
    false_alarms: num(s.false_alarms),
    suspicious: num(s.suspicious),
    rate_limited_today: num(s.rate_limited_today),
    active_clusters: num(s.active_clusters),
    largest_cluster: s.largest_cluster && s.largest_cluster.size ? s.largest_cluster : null,
    by_status: byStatus,
    by_severity: bySeverity,
    by_category: byCategory.map((c) => ({ ...categoryByCode(c.code), ...c, count: Number(c.count ?? 0) })),
    recent_critical: Array.isArray(s.recent_critical) ? s.recent_critical : [],
  };
}

/* ---------------- Response Teams & Prioritization (Prompt F1) ---------------- */

export async function getPrioritizedIncidents() {
  const data = await request('/incidents/prioritized', { auth: 'required' });
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((item, idx) => ({
    ...normalizeIncident(item),
    rank: item.rank ?? idx + 1,
  }));
}

export async function getTeams(params = {}) {
  const data = await request('/teams', { auth: 'required', query: params });
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function createTeam(body) {
  return await request('/teams', { method: 'POST', auth: 'required', body });
}

export async function updateTeam(id, body) {
  return await request(`/teams/${id}`, { method: 'PUT', auth: 'required', body });
}

export async function deleteTeam(id) {
  await request(`/teams/${id}`, { method: 'DELETE', auth: 'required' });
}

export async function setTeamAvailability(id, available) {
  return await request(`/teams/${id}/availability`, { method: 'PATCH', auth: 'required', body: { available } });
}

export async function getNearestTeams(incidentId) {
  const data = await request(`/incidents/${incidentId}/nearest-teams`, { auth: 'required' });
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function assignTeam(incidentId, teamId) {
  const body = teamId ? { team_id: teamId } : {};
  return await request(`/incidents/${incidentId}/assign`, { method: 'POST', auth: 'required', body });
}

export async function unassignTeam(incidentId) {
  return await request(`/incidents/${incidentId}/unassign`, { method: 'POST', auth: 'required' });
}

export async function getAnalyticsSummary() {
  return await request('/analytics/summary', { auth: 'required' });
}
