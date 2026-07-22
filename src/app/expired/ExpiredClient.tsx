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
  activeEmployeesCount: number;
  prices: {
    basic_monthly: string;
    basic_annual: string;
    pro_monthly: string;
    pro_annual: string;
    business_monthly: string;
    business_annual: string;
  };
}

export default function ExpiredClient({ company, isAdmin, activeEmployeesCount, prices }: ExpiredClientProps) {
  const [loading, setLoading] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  // Cantidades para planes Pro y Business basadas en el número actual de empleados
  const [proQty, setProQty] = useState(Math.max(7, Math.min(49, activeEmployeesCount)));
  const [businessQty, setBusinessQty] = useState(Math.max(50, activeEmployeesCount));

  // Helpers para cálculo de precios dinámicos
  const parsePrice = (priceStr: string): number => {
    const normalized = priceStr.replace(',', '.');
    const match = normalized.replace(/[^0-9.]/g, '');
    return parseFloat(match) || 0;
  };

  const getCurrencySymbol = (priceStr: string): string => {
    return priceStr.includes('€') ? '€' : priceStr.replace(/[0-9.]/g, '').trim();
  };

  const calculateTotal = (unitPriceStr: string, qty: number): string => {
    const unitPrice = parsePrice(unitPriceStr);
    const total = unitPrice * qty;
    const symbol = getCurrencySymbol(unitPriceStr);
    return symbol === '€' ? `${total.toFixed(2).replace('.', ',')}€` : `${symbol}${total.toFixed(2)}`;
  };

  const handleSubscribe = async (tier: 'basic' | 'pro' | 'business', qty: number) => {
    setLoading(true);
    try {
      const res = await subscribeAction(company.id, company.email, tier, billingPeriod, qty);
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
    <div className="login-card" style={{ maxWidth: isAdmin ? '1080px' : '460px', width: '92%', padding: '32px' }}>
      <div className="login-header" style={{ marginBottom: '24px' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
            <p style={{ fontSize: '14px', color: 'var(--pwa-text-secondary)', lineHeight: 1.5 }}>
              Actualmente tienes <strong>{activeEmployeesCount}</strong> {activeEmployeesCount === 1 ? 'empleado registrado' : 'empleados registrados'}. 
              Para reactivar el acceso de tu equipo, selecciona un plan de suscripción según tu volumen de plantilla:
            </p>

            {/* Selector de Periodo */}
            <div style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '12px', 
              marginTop: '16px', 
              background: 'var(--pwa-bg-tertiary)', 
              padding: '6px 12px', 
              borderRadius: '20px', 
              border: '1px solid var(--pwa-border)' 
            }}>
              <button 
                type="button" 
                onClick={() => setBillingPeriod('monthly')} 
                style={{ 
                  background: billingPeriod === 'monthly' ? 'var(--primary)' : 'none', 
                  border: 'none', 
                  color: billingPeriod === 'monthly' ? 'white' : 'var(--pwa-text-secondary)',
                  padding: '6px 16px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                Mensual
              </button>
              <button 
                type="button" 
                onClick={() => setBillingPeriod('annual')} 
                style={{ 
                  background: billingPeriod === 'annual' ? 'var(--primary)' : 'none', 
                  border: 'none', 
                  color: billingPeriod === 'annual' ? 'white' : 'var(--pwa-text-secondary)',
                  padding: '6px 16px',
                  borderRadius: '16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                Anual <span style={{ color: 'var(--green)', fontSize: '11px', fontWeight: 800 }}>-15%</span>
              </button>
            </div>
          </div>

          {/* Grid de Planes */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
            gap: '24px', 
            marginTop: '12px' 
          }}>
            {/* 1. PLAN BASIC */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              backgroundColor: 'var(--pwa-bg-tertiary)', 
              border: '1px solid var(--pwa-border)', 
              borderRadius: '16px', 
              padding: '24px'
            }}>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'white' }}>Plan Basic</h4>
                <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)', marginTop: '4px', margin: 0 }}>Ideal para pequeñas empresas.</p>
              </div>
              
              <p style={{ fontSize: '32px', fontWeight: 800, margin: 0, color: 'white' }}>
                {billingPeriod === 'monthly' ? prices.basic_monthly : prices.basic_annual}
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--pwa-text-secondary)' }}>
                  {billingPeriod === 'monthly' ? ' / mes' : ' / año'}
                </span>
              </p>

              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--pwa-text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Hasta <strong>6 empleados</strong> activos</li>
                <li><strong>1 centro</strong> de trabajo</li>
                <li>Control de jornada web y móvil</li>
                <li>Informes mensuales PDF / Excel</li>
                <li>Soporte técnico por email</li>
              </ul>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleSubscribe('basic', 1)}
                className="pwa-clock-btn clock-in"
                style={{ marginTop: 'auto', padding: '12px', fontSize: '14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                <span>Contratar Basic</span>
              </button>
            </div>

            {/* 2. PLAN PRO */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              backgroundColor: 'var(--pwa-bg-tertiary)', 
              border: '1.5px solid var(--primary)', 
              borderRadius: '16px', 
              padding: '24px',
              position: 'relative'
            }}>
              <span style={{ 
                position: 'absolute', 
                top: '-12px', 
                left: '20px', 
                backgroundColor: 'var(--primary)', 
                color: 'white', 
                fontSize: '11px', 
                fontWeight: 700, 
                padding: '2px 10px', 
                borderRadius: '12px' 
              }}>
                RECOMENDADO
              </span>

              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'white' }}>Plan Pro</h4>
                <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)', marginTop: '4px', margin: 0 }}>Para empresas en crecimiento.</p>
              </div>

              <p style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'white' }}>
                {billingPeriod === 'monthly' ? prices.pro_monthly : prices.pro_annual}
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--pwa-text-secondary)' }}>
                  {billingPeriod === 'monthly' ? ' / emp. / mes' : ' / emp. / año'}
                </span>
              </p>

              {/* Selector de cantidad */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pwa-text-secondary)' }}>
                  Empleados a contratar:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={7}
                    max={49}
                    value={proQty}
                    onChange={(e) => setProQty(Math.max(7, Math.min(49, parseInt(e.target.value) || 7)))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--pwa-border)',
                      fontSize: '14px',
                      width: '85px',
                      backgroundColor: 'var(--pwa-bg-primary)',
                      color: 'white',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>
                    (Rango 7 - 49)
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--primary)' }}>
                Total: {calculateTotal(billingPeriod === 'monthly' ? prices.pro_monthly : prices.pro_annual, proQty)}
                <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--pwa-text-secondary)' }}>
                  {billingPeriod === 'monthly' ? ' / mes' : ' / año'}
                </span>
              </p>

              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--pwa-text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Hasta <strong>49 empleados</strong> activos</li>
                <li><strong>Hasta 2 centros</strong> de trabajo</li>
                <li>Fichaje con GPS (Geolocalización)</li>
                <li>Gestión de vacaciones y ausencias</li>
                <li>Soporte técnico prioritario</li>
              </ul>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleSubscribe('pro', proQty)}
                className="pwa-clock-btn clock-in"
                style={{ marginTop: 'auto', padding: '12px', fontSize: '14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                <span>Contratar Pro</span>
              </button>
            </div>

            {/* 3. PLAN BUSINESS */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '16px', 
              backgroundColor: 'var(--pwa-bg-tertiary)', 
              border: '1px solid var(--pwa-border)', 
              borderRadius: '16px', 
              padding: '24px'
            }}>
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'white' }}>Plan Business</h4>
                <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)', marginTop: '4px', margin: 0 }}>Para grandes organizaciones.</p>
              </div>

              <p style={{ fontSize: '28px', fontWeight: 800, margin: 0, color: 'white' }}>
                {billingPeriod === 'monthly' ? prices.business_monthly : prices.business_annual}
                <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--pwa-text-secondary)' }}>
                  {billingPeriod === 'monthly' ? ' / emp. / mes' : ' / emp. / año'}
                </span>
              </p>

              {/* Selector de cantidad */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--pwa-text-secondary)' }}>
                  Empleados a contratar:
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="number"
                    min={50}
                    value={businessQty}
                    onChange={(e) => setBusinessQty(Math.max(50, parseInt(e.target.value) || 50))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--pwa-border)',
                      fontSize: '14px',
                      width: '85px',
                      backgroundColor: 'var(--pwa-bg-primary)',
                      color: 'white',
                      textAlign: 'center'
                    }}
                  />
                  <span style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>
                    (Mínimo 50)
                  </span>
                </div>
              </div>

              <p style={{ fontSize: '18px', fontWeight: 700, margin: '4px 0', color: 'var(--primary)' }}>
                Total: {calculateTotal(billingPeriod === 'monthly' ? prices.business_monthly : prices.business_annual, businessQty)}
                <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--pwa-text-secondary)' }}>
                  {billingPeriod === 'monthly' ? ' / mes' : ' / año'}
                </span>
              </p>

              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--pwa-text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <li>Empleados <strong>ilimitados</strong></li>
                <li>Centros de trabajo <strong>ilimitados</strong></li>
                <li>Todas las funciones del Plan Pro</li>
                <li>API de integración y backups auto</li>
                <li>Soporte 24/7 y asistencia telefónica</li>
              </ul>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleSubscribe('business', businessQty)}
                className="pwa-clock-btn clock-in"
                style={{ marginTop: 'auto', padding: '12px', fontSize: '14px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <CreditCard size={16} />}
                <span>Contratar Business</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'center' }}>
          <p style={{ fontSize: '14px', color: 'var(--pwa-text-secondary)' }}>
            El acceso de los trabajadores ha sido suspendido temporalmente. Por favor, ponte en contacto con el responsable de tu empresa (RRHH) para que reactive la suscripción del servicio.
          </p>
        </div>
      )}

      <form action={logoutAction} style={{ marginTop: '24px', borderTop: '1px solid var(--pwa-border)', paddingTop: '16px' }}>
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
