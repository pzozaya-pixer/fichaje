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

  // Guardar callbacks en referencias para evitar re-renderizados infinitos
  const onVerifyRef = useRef(onVerify);
  const onErrorRef = useRef(onError);
  const onExpireRef = useRef(onExpire);

  // Mantener las referencias sincronizadas con las funciones más recientes
  useEffect(() => {
    onVerifyRef.current = onVerify;
    onErrorRef.current = onError;
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detectar si estamos en desarrollo local o red local y usar la clave de prueba de Cloudflare en su lugar
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || 
                        hostname === '127.0.0.1' || 
                        hostname.endsWith('.local') || 
                        hostname.startsWith('192.168.') || 
                        hostname.startsWith('10.') || 
                        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);
    const activeSiteKey = isLocalhost ? '1x00000000000000000000AA' : siteKey;

    console.log(`Turnstile: Renderizando widget para el host "${hostname}" (isLocalhost=${isLocalhost}). Usando sitekey: ${activeSiteKey}`);

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
            callback: (token: string) => {
              console.log('Turnstile: Token verificado en cliente.');
              onVerifyRef.current(token);
            },
            'error-callback': () => {
              console.error('Turnstile: Error en el widget del cliente.');
              if (onErrorRef.current) onErrorRef.current();
            },
            'expired-callback': () => {
              console.warn('Turnstile: Token expirado en el cliente.');
              if (onExpireRef.current) onExpireRef.current();
            },
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
  }, [siteKey]);

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
