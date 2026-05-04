'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Home, UtensilsCrossed, Droplet, MessageCircle, User } from 'lucide-react';

const navItems = [
  { href: '/dashboard', icon: Home,            label: 'Inicio'  },
  { href: '/alimentos', icon: UtensilsCrossed,  label: 'Comidas' },
  { href: '/glucosa',   icon: Droplet,          label: 'Glucosa' },
  { href: '/chat',      icon: MessageCircle,    label: 'Chat IA' },
  { href: '/perfil',    icon: User,             label: 'Perfil'  },
];

export default function NavBar() {
  const router   = useRouter();
  const pathname = usePathname();

  return (
    <>
      {/* ── DESKTOP: sidebar vertical izquierdo ── */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 xl:w-56 flex-col z-50
        bg-white border-r border-slate-200/80 shadow-[2px_0_12px_rgba(15,28,60,0.06)]">

        {/* Logo */}
        <div className="px-3 xl:px-5 py-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0057B8] to-[#003D82] flex items-center justify-center flex-shrink-0 shadow-[0_2px_8px_rgba(0,87,184,0.35)]">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
                <rect x="10" y="2" width="4" height="20" rx="1.5" fill="white" opacity="0.9"/>
                <rect x="2" y="10" width="20" height="4" rx="1.5" fill="white"/>
              </svg>
            </div>
            <div className="hidden xl:block min-w-0">
              <p className="font-bold text-slate-900 text-sm leading-tight">NutriDiabetes</p>
              <p className="text-[10px] text-[#00965A] font-semibold uppercase tracking-wider">Perú · DM2</p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-2 xl:px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`
                  w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group
                  ${isActive
                    ? 'bg-blue-50 text-[#0057B8]'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }
                `}
                title={label}
              >
                <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} className="flex-shrink-0" />
                <span className={`hidden xl:block text-sm leading-none ${isActive ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
                {isActive && <span className="hidden xl:block ml-auto w-1.5 h-1.5 rounded-full bg-[#0057B8]" />}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="hidden xl:block px-5 py-4 border-t border-slate-100">
          <p className="text-[10px] text-slate-400 leading-snug">
            Respaldado por<br />
            <span className="font-semibold text-slate-500">TPCA 2025 · CENAN/INS</span>
          </p>
        </div>
      </aside>

      {/* ── TABLET: top horizontal bar ── */}
      <nav className="hidden sm:flex lg:hidden fixed top-0 left-0 right-0 z-50
        bg-white/95 backdrop-blur-md border-b border-slate-200/80
        shadow-[0_2px_12px_rgba(15,28,60,0.08)]">
        <div className="flex items-center gap-1 px-4 py-2 mx-auto max-w-4xl w-full">
          {/* Mini logo */}
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0057B8] to-[#003D82] flex items-center justify-center flex-shrink-0 mr-3">
            <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
              <rect x="10" y="2" width="4" height="20" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="2" y="10" width="20" height="4" rx="1.5" fill="white"/>
            </svg>
          </div>
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname?.startsWith(href);
            return (
              <button
                key={href}
                onClick={() => router.push(href)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                    ? 'bg-blue-50 text-[#0057B8] font-semibold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }
                `}
              >
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── MOBILE: bottom navigation ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-white/96 backdrop-blur-md border-t border-slate-200/70 shadow-[0_-4px_24px_rgba(15,28,60,0.08)]">
          <div className="safe-area-bottom">
            <div className="flex justify-around items-stretch px-1 py-1">
              {navItems.map(({ href, icon: Icon, label }) => {
                const isActive = pathname?.startsWith(href);
                return (
                  <button
                    key={href}
                    onClick={() => router.push(href)}
                    className={`
                      relative flex flex-col items-center gap-1
                      px-2 py-2.5 rounded-xl transition-all duration-200
                      flex-1
                      ${isActive ? 'text-[#0057B8]' : 'text-slate-400 hover:text-slate-600'}
                    `}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <span className="absolute top-1 left-1/2 -translate-x-1/2 w-5 h-0.5 rounded-full bg-[#0057B8]" />
                    )}
                    <div className={`p-1.5 rounded-xl transition-all ${isActive ? 'bg-blue-50' : ''}`}>
                      <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
                    </div>
                    <span className={`text-[9px] leading-none ${isActive ? 'font-bold' : 'font-medium'}`}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
