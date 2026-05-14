'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const InstallCtx = createContext(null);

export function InstallProvider({ children }) {
  const [deferredPrompt,  setDeferredPrompt]  = useState(null);
  const [isInstalled,     setIsInstalled]     = useState(false);
  const [isIOS,           setIsIOS]           = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [showBanner,      setShowBanner]      = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Si ya está instalada (standalone) o el usuario ya la instaló antes
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      localStorage.getItem('pwa_installed') === '1'
    ) {
      setIsInstalled(true);
      return;
    }

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Si el evento llegó antes de que React montara (capturado en layout.js)
    if (window.__pwaPrompt) {
      setDeferredPrompt(window.__pwaPrompt);
      setHasNativePrompt(true);
    }

    // Escuchar si llega después de montar
    const handler = (e) => {
      e.preventDefault();
      window.__pwaPrompt = e;
      setDeferredPrompt(e);
      setHasNativePrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      localStorage.setItem('pwa_installed', '1');
      setIsInstalled(true);
      setDeferredPrompt(null);
      setHasNativePrompt(false);
      setShowBanner(false);
    });

    // Mostrar banner siempre a los 1.5s — sin importar sessionStorage ni nada
    const timer = setTimeout(() => setShowBanner(true), 1500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return false;
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa_installed', '1');
        setIsInstalled(true);
        setShowBanner(false);
      }
      setDeferredPrompt(null);
      setHasNativePrompt(false);
      window.__pwaPrompt = null;
      return outcome === 'accepted';
    } catch {
      return false;
    }
  };

  // "No, gracias" solo oculta en esta sesión — no guarda nada en storage
  const dismissBanner = () => setShowBanner(false);

  return (
    <InstallCtx.Provider value={{
      isInstalled, isIOS, hasNativePrompt, showBanner,
      triggerInstall, dismissBanner, canInstall: true,
    }}>
      {children}
    </InstallCtx.Provider>
  );
}

export const useInstall = () => useContext(InstallCtx);
