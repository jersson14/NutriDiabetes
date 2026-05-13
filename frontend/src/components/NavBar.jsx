'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Home, UtensilsCrossed, Droplet, MessageCircle, User, Shield, Download } from 'lucide-react';
import { useInstall } from '@/lib/installContext';

const BASE_NAV = [
  { href: '/dashboard', icon: Home,            label: 'Inicio'  },
  { href: '/comidas',   icon: UtensilsCrossed,  label: 'Comidas' },
  { href: '/glucosa',   icon: Droplet,          label: 'Glucosa' },
  { href: '/chat',      icon: MessageCircle,    label: 'Chat IA' },
  { href: '/perfil',    icon: User,             label: 'Perfil'  },
];

export default function NavBar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const { canInstall, isInstalled, triggerInstall } = useInstall() || {};

  useEffect(() => {
    try {
      const u = localStorage.getItem('user');
      if (u) setIsAdmin(JSON.parse(u).rol === 'ADMINISTRADOR');
    } catch {}
  }, []);

  const showInstallBtn = canInstall && !isInstalled;

  const navItems = isAdmin
    ? [...BASE_NAV, { href: '/admin', icon: Shield, label: 'Admin' }]
    : BASE_NAV;

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
            const isActive = pathname?.startsWith(href) || (href === '/comidas' && pathname?.startsWith('/alimentos'));
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
        <div className="px-3 xl:px-5 py-4 border-t border-slate-100 space-y-3">
          {/* Botón instalar app */}
          {showInstallBtn && (
            <button
              onClick={triggerInstall}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl
                bg-gradient-to-r from-[#0057B8] to-[#003D82] text-white
                hover:from-[#004FA3] hover:to-[#003070]
                transition-all active:scale-95 shadow-sm group"
              title="Instalar app"
            >
              <Download size={16} className="flex-shrink-0" />
              <span className="hidden xl:block text-xs font-semibold leading-none">
                Instalar app
              </span>
            </button>
          )}
          <p className="hidden xl:block text-[10px] text-slate-400 leading-snug">
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
            const isActive = pathname?.startsWith(href) || (href === '/comidas' && pathname?.startsWith('/alimentos'));
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
          {/* Botón instalar app (tablet) */}
          {showInstallBtn && (
            <button
              onClick={triggerInstall}
              className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold
                text-white bg-[#0057B8] hover:bg-[#004FA3] transition-all active:scale-95"
              title="Instalar app"
            >
              <Download size={14} />
              Instalar
            </button>
          )}
        </div>
      </nav>

      {/* ── MOBILE: bottom navigation ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50">
        <div className="bg-white/96 backdrop-blur-md border-t border-slate-200/70 shadow-[0_-4px_24px_rgba(15,28,60,0.08)]">
          <div className="safe-area-bottom">
            <div className="flex justify-around items-stretch px-1 py-1">
              {navItems.map(({ href, icon: Icon, label }) => {
                const isActive = pathname?.startsWith(href) || (href === '/comidas' && pathname?.startsWith('/alimentos'));
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

              {/* Botón instalar app (mobile) — solo cuando disponible */}
              {showInstallBtn && (
                <button
                  onClick={triggerInstall}
                  className="relative flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl transition-all duration-200 flex-1 text-[#0057B8]"
                >
                  <div className="p-1.5 rounded-xl bg-blue-50">
                    <Download size={19} strokeWidth={2} />
                  </div>
                  <span className="text-[9px] leading-none font-bold">Instalar</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
