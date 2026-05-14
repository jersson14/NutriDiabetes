import './globals.css'
import Providers from './providers'
import InstallPrompt from '@/components/InstallPrompt'

export const metadata = {
  title: 'NutriDiabetes Perú | Recomendaciones Nutricionales DM2',
  description: 'Sistema inteligente de recomendaciones nutricionales para pacientes con Diabetes Mellitus Tipo 2, basado en la Tabla Peruana de Alimentos.',
  manifest: '/manifest.json',
  themeColor: '#005BAC',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
}

export default function RootLayout({ children }) {
  return (
    <html lang="es-PE">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#005BAC" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* Captura beforeinstallprompt ANTES de que React hidrate — el evento llega muy temprano */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__pwaPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__pwaPrompt = e;
          });
        `}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background">
        <Providers>
          {children}
          <InstallPrompt />
        </Providers>
      </body>
    </html>
  )
}
