import { useEffect, useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Clock, User, Send, Trash2 } from 'lucide-react';
import type { Incident, IncidentStatus } from '../types';
import { getIncident, updateIncident, addIncidentUpdate, deleteIncident } from '../api/incidents';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import SeverityBadge from '../components/SeverityBadge';

const statusOptions: { value: IncidentStatus; label: string }[] = [
  { value: 'reported', label: 'Reported' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newStatus, setNewStatus] = useState<IncidentStatus | ''>('');

  useEffect(() => {
    if (id) {
      getIncident(parseInt(id))
        .then((inc) => {
          setIncident(inc);
          setNewStatus(inc.status);
        })
        .catch(() => navigate('/incidents'))
        .finally(() => setLoading(false));
    }
  }, [id, navigate]);

  const handleStatusUpdate = async () => {
    if (!incident || !newStatus || newStatus === incident.status) return;
    try {
      const updated = await updateIncident(incident.id, { status: newStatus });
      setIncident(updated);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!incident || !comment.trim()) return;
    setSubmitting(true);
    try {
      const update = await addIncidentUpdate(incident.id, { message: comment });
      setIncident({
        ...incident,
        updates: [...(incident.updates || []), update],
      });
      setComment('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!incident || !confirm('Are you sure you want to delete this incident?')) return;
    await deleteIncident(incident.id);
    navigate('/incidents');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-red-500 border-t-transparent" />
      </div>
    );
  }

  if (!incident) return null;

  const canManage = user?.role === 'admin' || user?.role === 'responder';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{incident.title}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Incident #{incident.id}</p>
        </div>
        {canManage && (
          <button
            onClick={handleDelete}
            className="p-2 rounded-lg text-red-400 hover:bg-red-600/10 transition-colors"
            title="Delete incident"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {/* Incident Details */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <StatusBadge status={incident.status} />
          <SeverityBadge severity={incident.severity} />
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 capitalize">
            {incident.category.replace('_', ' ')}
          </span>
        </div>

        <p className="text-[var(--text-secondary)] mb-6 leading-relaxed">{incident.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <User size={16} />
            <span>Reported by: <strong className="text-[var(--text-secondary)]">{incident.reported_by}</strong></span>
          </div>
          {incident.assigned_to && (
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <User size={16} />
              <span>Assigned to: <strong className="text-[var(--text-secondary)]">{incident.assigned_to}</strong></span>
            </div>
          )}
          {incident.location.address && (
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <MapPin size={16} />
              <span>{incident.location.address}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-[var(--text-muted)]">
            <Clock size={16} />
            <span>{new Date(incident.created_at).toLocaleString()}</span>
          </div>
          {incident.location.latitude !== 0 && (
            <div className="flex items-center gap-2 text-[var(--text-muted)]">
              <MapPin size={16} />
              <span>
                {incident.location.latitude.toFixed(4)}, {incident.location.longitude.toFixed(4)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Status Update Controls */}
      {canManage && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-4">
            Update Status
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as IncidentStatus)}
              className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] flex-1"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleStatusUpdate}
              disabled={newStatus === incident.status}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-6">
          Updates Timeline
        </h3>

        {incident.updates && incident.updates.length > 0 ? (
          <div className="space-y-4">
            {incident.updates.map((update) => (
              <div
                key={update.id}
                className="flex gap-4 p-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-color)]"
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <User size={14} className="text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[var(--text-primary)]">{update.author}</span>
                    <span className="text-xs text-[var(--text-muted)]">
                      {new Date(update.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{update.message}</p>
                  {update.status_change && (
                    <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-blue-900/30 text-blue-400">
                      Status changed to: {update.status_change}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[var(--text-muted)] text-sm">No updates yet.</p>
        )}

        {/* Add Comment */}
        <form onSubmit={handleAddComment} className="mt-6 flex gap-3">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-blue-500"
            placeholder="Add a comment or update..."
          />
          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white p-2.5 rounded-lg transition-colors"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
