'use client';

export default function Badge({ children, variant = 'blue', size = 'md', icon: Icon }) {
  const variants = {
    blue:   'bg-blue-50   text-blue-700   border border-blue-200/80',
    green:  'bg-emerald-50 text-emerald-700 border border-emerald-200/80',
    red:    'bg-red-50    text-red-600    border border-red-200/80',
    yellow: 'bg-amber-50  text-amber-700  border border-amber-200/80',
    orange: 'bg-orange-50 text-orange-700 border border-orange-200/80',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200/80',
    gray:   'bg-slate-100 text-slate-600  border border-slate-200/80',
  };

  const sizes = {
    sm: 'text-[10px] px-2    py-0.5',
    md: 'text-xs    px-2.5  py-1',
    lg: 'text-sm    px-3    py-1.5',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full ${variants[variant] || variants.blue} ${sizes[size] || sizes.md}`}>
      {Icon && <Icon size={11} />}
      {children}
    </span>
  );
}
