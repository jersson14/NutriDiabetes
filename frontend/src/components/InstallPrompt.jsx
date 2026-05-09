'use client';
import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPrompt() {
  const [prompt, setPrompt]       = useState(null);
  const [visible, setVisible]     = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS]         = useState(false);
  const [showIOS, setShowIOS]     = useState(false);

  useEffect(() => {
    // Registrar Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Detectar si ya está instalada
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }

    // Detectar iOS (Safari no soporta beforeinstallprompt)
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Mostrar banner iOS si no se descartó
    if (ios && !localStorage.getItem('pwaIosDismissed')) {
      setTimeout(() => setShowIOS(true), 3000);
      return;
    }

    // Capturar evento de instalación (Chrome/Android)
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      if (!localStorage.getItem('pwaDismissed')) {
        setTimeout(() => setVisible(true), 2000);
      }
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setVisible(false);
    setPrompt(null);
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('pwaDismissed', '1');
  };

  const handleDismissIOS = () => {
    setShowIOS(false);
    localStorage.setItem('pwaIosDismissed', '1');
  };

  if (installed) return null;

  // Banner iOS
  if (isIOS && showIOS) {
    return (
      <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-50 animate-slide-up">
        <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 p-4 max-w-sm mx-auto">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-[#0057B8] to-[#00965A] rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
              🍎
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-slate-800 text-sm">Instala NutriDiabetes</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Toca <span className="font-semibold">⎙ Compartir</span> y luego{' '}
                <span className="font-semibold">"Agregar a inicio"</span> para instalar.
              </p>
            </div>
            <button onClick={handleDismissIOS} className="p-1 text-slate-300 hover:text-slate-500 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
          {/* Flecha apuntando hacia abajo (toolbar de Safari) */}
          <div className="flex justify-center mt-3">
            <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold bg-blue-50 px-3 py-1.5 rounded-full">
              <Smartphone size={13} />
              Disponible para instalar en tu iPhone
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Banner Chrome/Android
  if (!visible || !prompt) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-blue-100 overflow-hidden max-w-sm mx-auto">
        {/* Header azul */}
        <div className="bg-gradient-to-r from-[#0057B8] to-[#7C3AED] px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
            🍎
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-sm">NutriDiabetes Perú</p>
            <p className="text-white/60 text-[11px]">Instala la app en tu dispositivo</p>
          </div>
          <button onClick={handleDismiss} className="p-1 text-white/50 hover:text-white flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          <p className="text-xs text-slate-500 mb-3 leading-relaxed">
            Accede más rápido, sin abrir el navegador. Funciona incluso con conexión limitada.
          </p>
          <div className="grid grid-cols-3 gap-2 mb-3 text-center">
            {[
              { icon: '⚡', label: 'Más rápida' },
              { icon: '📴', label: 'Sin internet' },
              { icon: '🔔', label: 'Notificaciones' },
            ].map(f => (
              <div key={f.label} className="bg-slate-50 rounded-xl py-2 px-1">
                <p className="text-base">{f.icon}</p>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">{f.label}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 text-xs font-semibold text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
            >
              Ahora no
            </button>
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 text-xs font-bold text-white bg-[#0057B8] hover:bg-[#004FA3] rounded-xl flex items-center justify-center gap-1.5 transition-all active:scale-95"
            >
              <Download size={14} />
              Instalar app
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
