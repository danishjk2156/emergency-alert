import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deleteIncident, getCategories, getStats, listIncidents, updateStatus } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState, { ErrorState } from '../components/EmptyState';
import IncidentTable from '../components/IncidentTable';
import { useToast } from '../components/Toast';
import { FALLBACK_CATEGORIES, SEVERITIES, STATUSES } from '../constants';

const PAGE_SIZE = 10;
const SORTS = [
  { value: 'priority', label: 'Priority' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

export default function IncidentsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const severity = params.get('severity') || '';
  const category = params.get('category') || '';
  const q = params.get('q') || '';
  const sort = params.get('sort') || 'priority';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [search, setSearch] = useState(q);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [data, setData] = useState({ items: [], total: 0 });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const setParam = useCallback(
    (updates, { keepPage = false } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates)) {
            if (v === '' || v == null || (k === 'sort' && v === 'priority') || (k === 'page' && Number(v) <= 1)) next.delete(k);
            else next.set(k, String(v));
          }
          if (!keepPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  // Debounce search → URL (300ms)
  useEffect(() => {
    if (search.trim() === q) return undefined;
    const t = setTimeout(() => setParam({ q: search.trim() }), 300);
    return () => clearTimeout(t);
  }, [search, q, setParam]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, s] = await Promise.all([
        listIncidents({ status, severity, category, q, sort, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
        getStats(),
      ]);
      setData(list);
      setStats(s);
    } catch (e) {
      setError(e.message || 'Could not load incidents.');
    } finally {
      setLoading(false);
    }
  }, [status, severity, category, q, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  // If a delete empties the last page, step back one page
  useEffect(() => {
    if (!loading && data.items.length === 0 && data.total > 0 && page > 1) {
      setParam({ page: Math.ceil(data.total / PAGE_SIZE) }, { keepPage: true });
    }
  }, [loading, data, page, setParam]);

  async function onStatus(incident, next) {
    try {
      await updateStatus(incident.id, next);
      toast(`${incident.ref_code} → ${next}`);
      load();
    } catch (e) {
      toast(e.message || 'Could not update status', 'error');
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteIncident(toDelete.id);
      toast('Incident deleted');
      setToDelete(null);
      load();
    } catch (e) {
      toast(e.message || 'Could not delete incident', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = Boolean(status || severity || category || q);
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const chipCls = (on) =>
    `inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors ${
      on ? 'border-navy bg-navy text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
    }`;
  const allCount = stats ? Object.values(stats.by_status).reduce((a, b) => a + b, 0) || stats.total : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">All Incidents</h1>
        <p className="text-sm text-slate-500">
          {loading && !data.total ? 'Loading…' : `${data.total} incident${data.total === 1 ? '' : 's'}${filtered ? ' match your filters' : ''}`}
          {sort === 'priority' && ' · critical & unresolved first'}
        </p>
      </div>

      <div className="card flex flex-col gap-3 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label htmlFor="search" className="sr-only">
              Search incidents
            </label>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm" aria-hidden="true">
              🔍
            </span>
            <input
              id="search"
              type="search"
              className="input pl-9"
              placeholder="Search title, description, location…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select aria-label="Filter by status" className="input" value={status} onChange={(e) => setParam({ status: e.target.value })}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select aria-label="Filter by severity" className="input" value={severity} onChange={(e) => setParam({ severity: e.target.value })}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select aria-label="Filter by category" className="input" value={category} onChange={(e) => setParam({ category: e.target.value })}>
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <select aria-label="Sort" className="input" value={sort} onChange={(e) => setParam({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Quick status filter">
          <button type="button" className={chipCls(!status)} aria-pressed={!status} onClick={() => setParam({ status: '' })}>
            All {allCount !== null && <span className="tabular-nums opacity-80">{allCount}</span>}
          </button>
          {STATUSES.map((s) => (
            <button key={s} type="button" className={chipCls(status === s)} aria-pressed={status === s} onClick={() => setParam({ status: s })}>
              {s} <span className="tabular-nums opacity-80">{stats?.by_status?.[s] ?? 0}</span>
            </button>
          ))}
          {filtered && (
            <button
              type="button"
              className="ml-auto min-h-[36px] text-sm font-semibold text-blue-700 hover:underline"
              onClick={() => {
                setSearch('');
                setParams(sort !== 'priority' ? { sort } : {}, { replace: true });
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !loading && data.items.length === 0 ? (
        <EmptyState
          icon={filtered ? '🔎' : '🎉'}
          title={filtered ? 'No incidents match' : 'No incidents yet'}
          message={filtered ? 'Try a different search or clear the filters.' : 'New public reports will appear here.'}
        />
      ) : (
        <div className="card overflow-visible p-0 md:p-1">
          <div className="p-2 md:p-0">
            <IncidentTable items={data.items} loading={loading && data.items.length === 0} onStatus={onStatus} onDelete={setToDelete} />
          </div>
        </div>
      )}

      {data.total > 0 && !error && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
          <p className="tabular-nums">
            {from}–{to} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn" disabled={page <= 1 || loading} onClick={() => setParam({ page: page - 1 }, { keepPage: true })}>
              ‹ Prev
            </button>
            <span className="tabular-nums">
              Page {page} of {pages}
            </span>
            <button type="button" className="btn" disabled={page >= pages || loading} onClick={() => setParam({ page: page + 1 }, { keepPage: true })}>
              Next ›
            </button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this incident?"
        message={
          <>
            <strong className="text-slate-900">{toDelete?.ref_code}</strong> · {toDelete?.title}
            <br />
            This permanently removes it and its history. This can’t be undone.
          </>
        }
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
