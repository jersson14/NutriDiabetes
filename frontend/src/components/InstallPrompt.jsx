'use client';
import { useState } from 'react';
import { useInstall } from '@/lib/installContext';

const LogoNutri = () => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mg1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#00C96D" /><stop offset="100%" stopColor="#008647" />
      </linearGradient>
      <linearGradient id="mg2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#3387D6" /><stop offset="100%" stopColor="#005BAC" />
      </linearGradient>
    </defs>
    <path d="M50 88 C15 88, 10 45, 25 25 C35 10, 45 18, 50 28 C55 18, 65 10, 75 25 C90 45, 85 88, 50 88 Z" fill="url(#mg1)" />
    <path d="M48 26 C43 5, 68 0, 70 20 C70 20, 55 25, 48 26 Z" fill="url(#mg2)" />
    <path d="M22 55 L38 55 L45 38 L55 72 L62 55 L78 55" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function InstallPrompt() {
  const { isInstalled, hasNativePrompt, showBanner, triggerInstall, dismissBanner } = useInstall();
  const [installing, setInstalling] = useState(false);

  if (isInstalled || !showBanner) return null;

  const handleInstall = async () => {
    if (!hasNativePrompt) return;
    setInstalling(true);
    await triggerInstall();
    setInstalling(false);
  };

  return (
    <div
      className="fixed bottom-4 left-3 right-3 z-[100] max-w-sm mx-auto"
      style={{ animation: 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}
    >
      <div className="bg-[#1a1f3a] rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 px-4 py-3.5">

        {/* Icono app */}
        <div className="w-14 h-14 bg-gradient-to-br from-[#0057B8] to-[#006E41] rounded-2xl p-2.5 flex-shrink-0 shadow-lg">
          <LogoNutri />
        </div>

        {/* Texto */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm leading-tight">Instalar NutriDiabetes</p>
          <p className="text-white/55 text-xs mt-0.5 leading-tight">Accede rápido desde tu pantalla de inicio</p>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={dismissBanner}
            className="text-white/45 hover:text-white/70 text-xs font-medium transition-colors px-1"
          >
            No, gracias
          </button>

          <button
            onClick={handleInstall}
            disabled={installing || !hasNativePrompt}
            title={!hasNativePrompt ? 'Chrome está preparando la instalación...' : 'Instalar app'}
            className="bg-[#0057B8] hover:bg-[#004FA3] active:scale-95 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/40 cursor-pointer disabled:cursor-wait"
          >
            {installing ? (
              <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {installing ? '...' : 'Instalar'}
          </button>
        </div>
      </div>
    </div>
  );
}
