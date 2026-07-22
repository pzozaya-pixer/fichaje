'use client';

import React, { useEffect, useRef } from 'react';

interface TurnstileProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export default function Turnstile({ siteKey, onVerify, onError, onExpire }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar si estamos en desarrollo local y usar la clave de prueba de Cloudflare en su lugar
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const activeSiteKey = isLocalhost ? '1x00000000000000000000AA' : siteKey;

    // Cargar script de Turnstile si no se ha cargado ya
    if (!document.getElementById('cloudflare-turnstile-script')) {
      const script = document.createElement('script');
      script.id = 'cloudflare-turnstile-script';
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    // Renderizar el widget de Turnstile cuando el script de Cloudflare esté listo
    let widgetId: string | null = null;
    const renderWidget = () => {
      if ((window as any).turnstile && containerRef.current) {
        try {
          widgetId = (window as any).turnstile.render(containerRef.current, {
            sitekey: activeSiteKey,
            theme: 'dark',
            callback: onVerify,
            'error-callback': onError,
            'expired-callback': onExpire,
          });
        } catch (e) {
          console.error('Error rendering Turnstile widget:', e);
        }
      } else {
        setTimeout(renderWidget, 100);
      }
    };

    renderWidget();

    return () => {
      // Limpiar el widget al desmontar el componente
      if ((window as any).turnstile && containerRef.current) {
        try {
          (window as any).turnstile.remove(containerRef.current);
        } catch (e) {
          // Ignorar errores de desmontaje
        }
      }
    };
  }, [siteKey, onVerify, onError, onExpire]);

  return (
    <div 
      ref={containerRef} 
      className="turnstile-container" 
      style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        width: '100%', 
        minHeight: '65px',
        marginTop: '8px',
        marginBottom: '4px'
      }} 
    />
  );
}
