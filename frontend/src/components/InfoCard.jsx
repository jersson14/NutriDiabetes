'use client';

export default function InfoCard({ title, children, className = '', icon }) {
  return (
    <div className={`bg-white border border-slate-200/80 rounded-2xl shadow-[0_2px_8px_rgba(15,28,60,0.06)] overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          {icon && <span className="text-base leading-none">{icon}</span>}
          <h3 className="font-semibold text-slate-700 text-sm tracking-wide">{title}</h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
