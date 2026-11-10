// One request() helper + one function per backend endpoint.
import { FALLBACK_CATEGORIES, categoryByCode, normSeverity, normStatus } from './constants';
import { mockRequest } from './mock';

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
export const USE_MOCK = import.meta.env.MODE === 'mock' || import.meta.env.VITE_MOCK === 'true';

export const TOKEN_KEY = 'resqnet_token';
export const USER_KEY = 'resqnet_user';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Turn FastAPI errors ({detail: "..."} or 422 {detail: [{loc, msg}]}) into one sentence. */
function parseDetail(data, status) {
  const d = data && data.detail;
  if (typeof d === 'string') return d;
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

export async function request(path, { method = 'GET', body, auth = false, query } = {}) {
  const url = `${path}${buildQuery(query)}`;
  const token = getToken();

  if (USE_MOCK) {
    const res = await mockRequest(method, path, body, query || {}, token);
    if (res.status === 401 && auth) handleUnauthorized();
    if (res.status >= 400) throw new ApiError(res.status, parseDetail(res.data, res.status));
    return res.data;
  }

  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${url}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 204) return null;
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }

  if (res.status === 401 && auth) handleUnauthorized();
  if (!res.ok) throw new ApiError(res.status, parseDetail(data, res.status));
  return data;
}

function handleUnauthorized() {
  clearSession();
  if (!window.location.pathname.startsWith('/admin/login')) {
    window.location.href = '/admin/login?expired=1';
  }
}

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

export function normalizeIncident(raw) {
  if (!raw) return raw;
  return {
    ...raw,
    ref_code: raw.ref_code ?? raw.reference_no ?? raw.reference ?? `#${raw.id}`,
    category: normCategory(raw.category, raw.category_code),
    severity: normSeverity(raw.severity),
    status: normStatus(raw.status),
    severity_score: Number(raw.severity_score ?? 0),
    severity_reasons: Array.isArray(raw.severity_reasons) ? raw.severity_reasons.map(normReason) : [],
    people_affected: Number(raw.people_affected ?? 0),
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

/* ---------------- endpoints ---------------- */

export async function getCategories() {
  try {
    const data = await request('/categories');
    return Array.isArray(data) && data.length ? data : FALLBACK_CATEGORIES;
  } catch {
    return FALLBACK_CATEGORIES;
  }
}

export async function createIncident(body) {
  return normalizeIncident(await request('/incidents', { method: 'POST', body }));
}

export async function trackIncident(ref) {
  const data = await request(`/incidents/track/${encodeURIComponent(ref.trim())}`);
  return { ...data, severity: normSeverity(data.severity), status: normStatus(data.status) };
}

export async function login(email, password) {
  const data = await request('/auth/login', { method: 'POST', body: { email, password } });
  const token = data.token ?? data.access_token;
  if (!token) throw new ApiError(500, 'Login response had no token.');
  const user = data.user ?? { email };
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/** params: {status, severity, category, q, sort, limit, offset} → {items, total} */
export async function listIncidents(params = {}) {
  const data = await request('/incidents', { auth: true, query: params });
  const items = Array.isArray(data) ? data : data.items ?? [];
  return { items: items.map(normalizeIncident), total: Number(data.total ?? items.length) };
}

export async function getIncident(id) {
  return normalizeIncident(await request(`/incidents/${id}`, { auth: true }));
}

export async function updateStatus(id, status, note) {
  const body = { status };
  if (note && note.trim()) body.note = note.trim();
  return normalizeIncident(await request(`/incidents/${id}/status`, { method: 'PATCH', auth: true, body }));
}

export async function updateSeverity(id, severity) {
  return normalizeIncident(await request(`/incidents/${id}/severity`, { method: 'PATCH', auth: true, body: { severity } }));
}

export async function deleteIncident(id) {
  await request(`/incidents/${id}`, { method: 'DELETE', auth: true });
}

export async function getStats() {
  const s = await request('/dashboard/stats', { auth: true });
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
    by_status: byStatus,
    by_severity: bySeverity,
    by_category: byCategory.map((c) => ({ ...categoryByCode(c.code), ...c, count: Number(c.count ?? 0) })),
    recent_critical: Array.isArray(s.recent_critical) ? s.recent_critical : [],
  };
}
