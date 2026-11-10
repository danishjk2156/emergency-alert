import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { deleteIncident, getCategories, getStats, listIncidents, updateStatus } from '../api';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState, { ErrorState } from '../components/EmptyState';
import Icon from '../components/Icon';
import IncidentTable from '../components/IncidentTable';
import SectionTitle from '../components/SectionTitle';
import { useToast } from '../components/Toast';
import { FALLBACK_CATEGORIES, SEVERITIES, STATUSES, VERIFICATION_STATUSES } from '../constants';

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
  // Trust layer filters (all kept in the URL)
  const verification = params.get('verification_status') || '';
  const maxTrust = params.get('max_trust') || '';
  const group = params.get('group') === 'cluster';
  const showDuplicates = params.get('duplicates') === '1';

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
        listIncidents({
          status,
          severity,
          category,
          q,
          sort,
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          verification_status: verification,
          max_trust: maxTrust,
          group: group ? 'cluster' : '',
          include_duplicates: showDuplicates ? 'true' : '',
        }),
        getStats(),
      ]);
      setData(list);
      setStats(s);
    } catch (e) {
      setError(e.message || 'Could not load incidents.');
    } finally {
      setLoading(false);
    }
  }, [status, severity, category, q, sort, page, verification, maxTrust, group, showDuplicates]);

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

  const filtered = Boolean(status || severity || category || q || verification || maxTrust);
  const trustOn = Boolean(stats?.has_trust || data.items.some((i) => i.has_trust));
  // Duplicates are hidden unless asked for (also filtered here in case the server ignores the flag).
  const visible = showDuplicates ? data.items : data.items.filter((i) => !i.duplicate_of);
  const hiddenDupes = data.items.length - visible.length;
  const from = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, data.total);
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const chipCls = (on) =>
    `inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors ${
      on ? 'border-charcoal bg-charcoal text-white' : 'border-field/50 bg-white text-ink hover:border-ink'
    }`;
  const allCount = stats ? Object.values(stats.by_status).reduce((a, b) => a + b, 0) || stats.total : null;

  return (
    <div className="space-y-4">
      <SectionTitle
        as="h1"
        sub={
          <>
            {loading && !data.total ? 'Loading…' : `${data.total} incident${data.total === 1 ? '' : 's'}${filtered ? ' match your filters' : ''}`}
            {sort === 'priority' && ' · critical & unresolved first'}
          </>
        }
      >
        All incidents
      </SectionTitle>

      <div className="card flex flex-col gap-3 p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(0,1fr))]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <label htmlFor="search" className="sr-only">
              Search incidents
            </label>
            <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-3" />
            <input
              id="search"
              type="search"
              className="input pl-10"
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
                {c.name}
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
          {trustOn && (
            <>
              <span className="mx-1 hidden h-6 w-px bg-black/15 sm:block" aria-hidden="true" />
              <button
                type="button"
                className={chipCls(maxTrust === '29')}
                aria-pressed={maxTrust === '29'}
                onClick={() => setParam({ max_trust: maxTrust === '29' ? '' : '29' })}
              >
                <Icon name="alert" className="h-3.5 w-3.5" /> Suspicious only
                {stats?.suspicious != null && <span className="tabular-nums opacity-80">{stats.suspicious}</span>}
              </button>
              <button
                type="button"
                className={chipCls(verification === 'Corroborated')}
                aria-pressed={verification === 'Corroborated'}
                onClick={() => setParam({ verification_status: verification === 'Corroborated' ? '' : 'Corroborated' })}
              >
                <Icon name="users" className="h-3.5 w-3.5" /> Corroborated
                {stats?.corroborated != null && <span className="tabular-nums opacity-80">{stats.corroborated}</span>}
              </button>
            </>
          )}
          {filtered && (
            <button
              type="button"
              className="ml-auto inline-flex min-h-[36px] items-center gap-1 text-sm font-bold text-brand hover:underline"
              onClick={() => {
                setSearch('');
                setParams(sort !== 'priority' ? { sort } : {}, { replace: true });
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {trustOn && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-black/10 pt-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
              <span className="text-[12px] font-black uppercase tracking-wide text-ink">Verification</span>
              <select
                className="input min-h-[38px] w-44 py-1"
                value={verification}
                onChange={(e) => setParam({ verification_status: e.target.value })}
                aria-label="Filter by verification"
              >
                <option value="">All</option>
                {VERIFICATION_STATUSES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2.5 text-sm font-bold text-ink">
              <button
                type="button"
                role="switch"
                aria-checked={group}
                onClick={() => setParam({ group: group ? '' : 'cluster' })}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300 ${group ? 'bg-indigo-600' : 'bg-black/20'}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${group ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
              Group by incident
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand"
                checked={showDuplicates}
                onChange={(e) => setParam({ duplicates: e.target.checked ? '1' : '' })}
              />
              Show duplicates
            </label>
            {hiddenDupes > 0 && (
              <span className="text-xs text-ink-3">
                {hiddenDupes} duplicate{hiddenDupes === 1 ? '' : 's'} hidden on this page
              </span>
            )}
          </div>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !loading && visible.length === 0 ? (
        <EmptyState
          icon={filtered ? 'search' : 'inbox'}
          title={filtered ? 'No incidents match' : 'No incidents yet'}
          message={filtered ? 'Try a different search or clear the filters.' : 'New public reports will appear here.'}
        />
      ) : (
        <div className="card overflow-visible p-0">
          <div className="p-2.5 md:p-0">
            <IncidentTable items={visible} loading={loading && data.items.length === 0} onStatus={onStatus} onDelete={setToDelete} expandable={group} />
          </div>
        </div>
      )}

      {data.total > 0 && !error && (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-2">
          <p className="tabular-nums">
            {from}–{to} of {data.total}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" className="btn" disabled={page <= 1 || loading} onClick={() => setParam({ page: page - 1 }, { keepPage: true })}>
              <Icon name="chevron-left" className="h-4 w-4" /> Prev
            </button>
            <span className="tabular-nums">
              Page {page} of {pages}
            </span>
            <button type="button" className="btn" disabled={page >= pages || loading} onClick={() => setParam({ page: page + 1 }, { keepPage: true })}>
              Next <Icon name="chevron-right" className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete this incident?"
        message={
          <>
            <strong className="text-ink">{toDelete?.ref_code}</strong> · {toDelete?.title}
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
