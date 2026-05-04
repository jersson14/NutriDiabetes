'use client';

import { ChevronRight } from 'lucide-react';

export default function ActionCard({ icon: Icon, title, description, onClick, variant = 'primary', className = '' }) {
  const configs = {
    primary:   { icon: 'bg-blue-50   text-blue-600',   accent: 'bg-blue-600',   ring: 'hover:ring-blue-100'   },
    secondary: { icon: 'bg-emerald-50 text-emerald-600', accent: 'bg-emerald-600', ring: 'hover:ring-emerald-100' },
    accent:    { icon: 'bg-purple-50  text-purple-600',  accent: 'bg-purple-600',  ring: 'hover:ring-purple-100'  },
    warning:   { icon: 'bg-amber-50   text-amber-600',   accent: 'bg-amber-500',   ring: 'hover:ring-amber-100'   },
  };

  const cfg = configs[variant] || configs.primary;

  return (
    <button
      onClick={onClick}
      className={`
        group relative bg-white border border-slate-200/80 rounded-2xl p-5 text-left
        shadow-[0_2px_8px_rgba(15,28,60,0.06)]
        hover:shadow-[0_8px_24px_rgba(15,28,60,0.11)] hover:-translate-y-0.5
        active:translate-y-0 active:scale-[0.98]
        transition-all duration-200 overflow-hidden w-full
        ring-2 ring-transparent ${cfg.ring}
        ${className}
      `}
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-4 bottom-4 w-[3px] ${cfg.accent} rounded-full`} />

      <div className="pl-4">
        {/* Icon */}
        <div className={`inline-flex items-center justify-center w-10 h-10 ${cfg.icon} rounded-xl mb-3 group-hover:scale-105 transition-transform`}>
          {Icon && <Icon size={19} />}
        </div>

        <h3 className="font-bold text-slate-800 text-[15px] leading-tight">{title}</h3>
        <p className="text-slate-500 text-[13px] mt-0.5 leading-snug">{description}</p>
      </div>

      {/* Arrow indicator */}
      <ChevronRight
        size={15}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all duration-200"
      />
    </button>
  );
}
