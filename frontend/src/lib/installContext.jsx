'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const InstallCtx = createContext(null);

// Clave en sessionStorage — se resetea al cerrar el tab/navegador
const DISMISSED_KEY = 'pwa_install_dismissed';

export function InstallProvider({ children }) {
  const [deferredPrompt,  setDeferredPrompt]  = useState(null);
  const [isInstalled,     setIsInstalled]     = useState(false);
  const [isIOS,           setIsIOS]           = useState(false);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [showBanner,      setShowBanner]      = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Ya instalada como standalone — nunca mostrar
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Ya descartada en esta sesión — no molestar de nuevo
    if (sessionStorage.getItem(DISMISSED_KEY)) return;

    // Detectar iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    // Mostrar banner tras 1.5s siempre
    const timer = setTimeout(() => setShowBanner(true), 1500);

    // Chrome / Edge / Android — captura el prompt nativo
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setHasNativePrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowBanner(false);
    });

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
    setShowBanner(false);
  };

  // "No, gracias" — no volver a mostrar en esta sesión del navegador
  const dismissBanner = () => {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setShowBanner(false);
  };

  return (
    <InstallCtx.Provider value={{
      isInstalled,
      isIOS,
      hasNativePrompt,
      showBanner,
      triggerInstall,
      dismissBanner,
      canInstall: true,
    }}>
      {children}
    </InstallCtx.Provider>
  );
}

export const useInstall = () => useContext(InstallCtx);
