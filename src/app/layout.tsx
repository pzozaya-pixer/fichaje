import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fichaje.click - Control Horario",
  description: "Sistema de control horario de jornada laboral y geolocalización de empleados.",
  icons: {
    icon: "/fichaje/icono.png",
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
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for (var i = 0; i < registrations.length; i++) {
                    registrations[i].unregister().then(function(success) {
                      if (success) {
                        console.log('Stale Service Worker unregistered.');
                      }
                    });
                  }
                });
              }
            `
          }}
        />
        {children}
      </body>
    </html>
  );
}
