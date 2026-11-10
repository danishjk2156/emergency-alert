import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { IncidentCreate } from '../types';
import { createIncident } from '../api/incidents';
import IncidentForm from '../components/IncidentForm';

export default function ReportIncidentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (data: IncidentCreate) => {
    setLoading(true);
    try {
      const incident = await createIncident(data);
      navigate(`/incidents/${incident.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create incident report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">🚨 Report Incident</h1>
          <p className="text-[var(--text-secondary)] mt-1">Submit a new emergency incident report</p>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6">
        <IncidentForm onSubmit={handleSubmit} loading={loading} />
      </div>
    </div>
  );
}
