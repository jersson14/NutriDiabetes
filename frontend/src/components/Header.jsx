'use client';

import { useState } from 'react';
import { LogOut, MessageCircle, X, Menu, ChevronRight, Stethoscope } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Header({ title, subtitle, variant = 'blue', showChat = true, showLogout = true }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const gradients = {
    blue:   'from-[#0057B8] via-[#004FA5] to-[#003D82]',
    green:  'from-[#00965A] via-[#007A4D] to-[#006E41]',
    purple: 'from-[#7C3AED] via-[#6D28D9] to-[#5B21B6]',
    orange: 'from-[#D97706] via-[#C26A05] to-[#B45309]',
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    /* safe-area-top en el header raíz cubre el notch de iOS sin crear div extra */
    <header className={`bg-gradient-to-r ${gradients[variant]} relative overflow-hidden safe-area-top`}>

      {/* Dot-grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      {/* Fade suave hacia el fondo de la página — se reduce para no cubrir el título */}
      <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#EEF2F7] to-transparent" />

      {/* Contenido — pb-16 (64 px) da espacio suficiente por encima del card superpuesto */}
      <div className="relative px-5 pt-6 pb-16 sm:px-8 sm:pt-7 sm:pb-20">
        <div className="flex items-center justify-between max-w-7xl mx-auto">

          {/* Brand + title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex w-10 h-10 rounded-xl bg-white/15 border border-white/20 items-center justify-center flex-shrink-0 backdrop-blur-sm">
              <Stethoscope size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight leading-tight drop-shadow-sm truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-white/65 mt-0.5 text-xs sm:text-sm font-medium truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Desktop action buttons */}
          <div className="hidden sm:flex items-center gap-2">
            {showChat && (
              <button
                onClick={() => router.push('/chat')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/90 hover:text-white rounded-xl border border-white/20 hover:bg-white/15 active:bg-white/10 transition-all backdrop-blur-sm"
              >
                <MessageCircle size={15} />
                <span>Chat IA</span>
              </button>
            )}
            {showLogout && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white/60 hover:text-white rounded-xl hover:bg-white/10 transition-all"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
                <span className="hidden lg:inline">Salir</span>
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="sm:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-all"
            aria-label="Menú"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {/* Mobile dropdown */}
        {menuOpen && (
          <div className="sm:hidden mt-3 flex flex-col gap-2 animate-slide-down">
            {showChat && (
              <button
                onClick={() => { router.push('/chat'); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 text-white/90 bg-white/10 hover:bg-white/15 rounded-xl text-sm font-medium transition-all border border-white/10"
              >
                <MessageCircle size={17} />
                <span>Chat Nutricional IA</span>
                <ChevronRight size={14} className="ml-auto opacity-60" />
              </button>
            )}
            {showLogout && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 text-white/70 hover:text-white bg-white/5 hover:bg-red-500/20 rounded-xl text-sm font-medium transition-all border border-white/10"
              >
                <LogOut size={17} />
                <span>Cerrar Sesión</span>
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
