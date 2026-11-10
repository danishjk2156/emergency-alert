import type { ReactNode } from 'react';

interface StatsCardProps {
  icon: ReactNode;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendColor?: string;
}

export default function StatsCard({ icon, label, value, trend, trendColor }: StatsCardProps) {
  const trendColors = {
    up: trendColor || 'text-emerald-400',
    down: trendColor || 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-6 hover:bg-[var(--bg-card-hover)] transition-colors duration-200">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 rounded-lg bg-slate-800/50 text-slate-300">{icon}</div>
        {trend && (
          <span className={`text-sm font-medium ${trendColors[trend]}`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-[var(--text-primary)] mb-1">{value}</div>
      <div className="text-sm text-[var(--text-secondary)]">{label}</div>
    </div>
  );
}
