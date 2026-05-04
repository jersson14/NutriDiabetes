'use client';

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  onClick,
  className = '',
  icon: Icon,
  type = 'button',
  ...props
}) {
  const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1';

  const variants = {
    primary:   'bg-gradient-to-r from-[#0057B8] to-[#003D82] text-white shadow-[0_2px_10px_rgba(0,87,184,0.32)] hover:shadow-[0_6px_20px_rgba(0,87,184,0.42)] hover:-translate-y-px focus-visible:ring-blue-500',
    secondary: 'bg-white text-slate-700 border-[1.5px] border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-300',
    outline:   'bg-transparent text-[#0057B8] border-[1.5px] border-[#0057B8] hover:bg-blue-50 focus-visible:ring-blue-400',
    ghost:     'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300',
    danger:    'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_2px_8px_rgba(220,38,38,0.30)] hover:shadow-[0_6px_16px_rgba(220,38,38,0.40)] hover:-translate-y-px focus-visible:ring-red-400',
  };

  const sizes = {
    sm: 'text-sm  px-4 py-2',
    md: 'text-[15px] px-5 py-2.5',
    lg: 'text-base px-6 py-3.5',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${base}
        ${variants[variant] || variants.primary}
        ${sizes[size]   || sizes.md}
        ${disabled || loading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        Icon && <Icon size={16} className="flex-shrink-0" />
      )}
      {children}
    </button>
  );
}
