import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fichaje.click - Control Horario",
  description: "Sistema de control horario de jornada laboral y geolocalización de empleados.",
  manifest: "/fichaje/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fichaje.click",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a1128",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        {/* Registro del Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                function registerSW() {
                  navigator.serviceWorker.register('/fichaje/sw.js').then(
                    function(registration) {
                      console.log('PWA: ServiceWorker registrado con éxito. Scope:', registration.scope);
                    },
                    function(err) {
                      console.log('PWA: Error al registrar el ServiceWorker:', err);
                    }
                  );
                }
                if (document.readyState === 'complete') {
                  registerSW();
                } else {
                  window.addEventListener('load', registerSW);
                }
              }
            `,
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
