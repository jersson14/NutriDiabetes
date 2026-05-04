'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ icon: Icon, label, value, subtitle, trend, color = 'blue', onClick }) {
  const configs = {
    blue:   { icon: 'bg-blue-100   text-blue-600',   accent: 'bg-blue-500',   ring: 'hover:ring-blue-100' },
    green:  { icon: 'bg-emerald-100 text-emerald-600', accent: 'bg-emerald-500', ring: 'hover:ring-emerald-100' },
    red:    { icon: 'bg-red-100    text-red-500',     accent: 'bg-red-500',    ring: 'hover:ring-red-100' },
    orange: { icon: 'bg-amber-100  text-amber-600',   accent: 'bg-amber-500',  ring: 'hover:ring-amber-100' },
    purple: { icon: 'bg-purple-100 text-purple-600',  accent: 'bg-purple-500', ring: 'hover:ring-purple-100' },
  };

  const cfg = configs[color] || configs.blue;

  return (
    <div
      onClick={onClick}
      className={`
        relative bg-white border border-slate-200/80 rounded-2xl p-5 overflow-hidden
        shadow-[0_2px_8px_rgba(15,28,60,0.06)]
        hover:shadow-[0_6px_20px_rgba(15,28,60,0.10)] hover:-translate-y-0.5
        transition-all duration-200 cursor-pointer group
        ring-2 ring-transparent ${cfg.ring}
      `}
    >
      {/* Top accent stripe */}
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${cfg.accent} rounded-t-2xl`} />

      <div className="flex items-start justify-between mb-3 mt-1">
        {Icon && (
          <div className={`${cfg.icon} p-2.5 rounded-xl group-hover:scale-105 transition-transform`}>
            <Icon size={19} />
          </div>
        )}
        {trend !== undefined && trend !== null && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${
            trend > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {trend > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900 tracking-tight leading-none">{value}</p>
      {subtitle && <p className="text-slate-400 text-xs mt-2 font-medium">{subtitle}</p>}
    </div>
  );
}
