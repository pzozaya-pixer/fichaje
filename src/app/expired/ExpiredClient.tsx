'use client';

import React, { useState } from 'react';
import { subscribeAction } from '@/app/actions/stripe';
import { logoutAction } from '@/app/actions/auth';
import { ShieldAlert, CreditCard, LogOut, Loader2 } from 'lucide-react';

interface ExpiredClientProps {
  company: {
    id: string;
    name: string;
    email: string;
    trialEndsAt: string;
  };
  isAdmin: boolean;
}

export default function ExpiredClient({ company, isAdmin }: ExpiredClientProps) {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setLoading(true);
    try {
      const res = await subscribeAction(company.id, company.email, 'basic', plan);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        alert(res.error || 'Error al iniciar suscripción de Stripe.');
      }
    } catch (err: any) {
      alert('Error de comunicación con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const trialDate = new Date(company.trialEndsAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="login-card" style={{ maxWidth: '460px' }}>
      <div className="login-header">
        <div className="login-logo" style={{ color: 'var(--danger)' }}>
          <ShieldAlert size={42} />
        </div>
        <h2 style={{ fontSize: '22px', fontFamily: 'var(--font-title)', fontWeight: 700, marginTop: '16px' }}>
          Periodo de prueba finalizado
        </h2>
        <p className="login-subtitle" style={{ marginTop: '8px' }}>
          El periodo de prueba de 15 días para la empresa <strong>{company.name}</strong> finalizó el {trialDate}.
        </p>
      </div>

      {isAdmin ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ fontSize: '14px', textAlign: 'center', color: 'var(--pwa-text-secondary)' }}>
            Para reactivar el acceso al control horario para ti y todos tus empleados, por favor, suscríbete a uno de nuestros planes a través de Stripe:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Plan Mensual */}
            <button
              disabled={loading}
              onClick={() => handleSubscribe('monthly')}
              className="pwa-clock-btn clock-in"
              style={{ padding: '14px', fontSize: '15px' }}
            >
              <CreditCard size={18} />
              Plan Mensual (29€/mes)
            </button>

            {/* Plan Anual */}
            <button
              disabled={loading}
              onClick={() => handleSubscribe('annual')}
              className="pwa-clock-btn clock-in"
              style={{
                padding: '14px',
                fontSize: '15px',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
              }}
            >
              <CreditCard size={18} />
              Plan Anual (290€/año - 2 meses gratis)
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--pwa-text-secondary)' }}>
            El acceso de los trabajadores ha sido suspendido temporalmente. Por favor, ponte en contacto con el responsable de tu empresa (RRHH) para que reactive la suscripción del servicio.
          </p>
        </div>
      )}

      <form action={logoutAction} style={{ marginTop: '12px' }}>
        <button
          type="submit"
          className="pwa-break-btn"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <LogOut size={16} />
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
