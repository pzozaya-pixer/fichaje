'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { saveWorkCenter, deleteWorkCenter, saveDepartment } from '@/app/actions/admin';
import { subscribeAction, openBillingPortalAction } from '@/app/actions/stripe';
import {
  MapPin,
  Building,
  CreditCard,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Info
} from 'lucide-react';

interface WorkCenter {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
}

interface Department {
  id: string;
  name: string;
}

interface ConfigClientProps {
  initialWorkCenters: WorkCenter[];
  initialDepartments: Department[];
  subscription: {
    status: string;
    trialEndsAt: string;
    stripeCustomerId: string;
  };
  companyId: string;
  companyEmail: string;
}

export default function ConfigClient({
  initialWorkCenters,
  initialDepartments,
  subscription,
  companyId,
  companyEmail,
}: ConfigClientProps) {
  const searchParams = useSearchParams();
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(initialWorkCenters);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  
  // Mensajes de Stripe Checkout
  const [stripeStatus, setStripeStatus] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  // Formulario de Centro de Trabajo
  const [isCenterFormOpen, setIsCenterFormOpen] = useState(false);
  const [editingCenter, setEditingCenter] = useState<WorkCenter | null>(null);
  const [centerName, setCenterName] = useState('');
  const [centerAddress, setCenterAddress] = useState('');
  const [centerLat, setCenterLat] = useState(40.416775); // Madrid por defecto
  const [centerLng, setCenterLng] = useState(-3.703790);
  const [centerRadius, setCenterRadius] = useState(100);

  // Formulario de Departamentos
  const [isDeptFormOpen, setIsDeptFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptName, setDeptName] = useState('');

  const [loading, setLoading] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [error, setError] = useState('');

  // Detectar respuesta de Stripe en la URL
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'success') {
      setStripeStatus({ type: 'success', text: '¡Suscripción procesada con éxito! Tu cuenta está activa.' });
    } else if (status === 'cancel') {
      setStripeStatus({ type: 'error', text: 'El proceso de suscripción ha sido cancelado.' });
    }
  }, [searchParams]);

  // --- ACCIONES CENTROS DE TRABAJO ---
  const handleOpenCenterCreate = () => {
    setEditingCenter(null);
    setCenterName('');
    setCenterAddress('');
    setCenterLat(40.416775);
    setCenterLng(-3.703790);
    setCenterRadius(100);
    setIsCenterFormOpen(true);
  };

  const handleOpenCenterEdit = (center: WorkCenter) => {
    setEditingCenter(center);
    setCenterName(center.name);
    setCenterAddress(center.address);
    setCenterLat(center.latitude);
    setCenterLng(center.longitude);
    setCenterRadius(center.radius);
    setIsCenterFormOpen(true);
  };

  const handleSaveCenter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerName || !centerRadius) {
      setError('El nombre y el radio del centro son obligatorios.');
      return;
    }
    if (!centerAddress && (!centerLat || !centerLng)) {
      setError('Debes introducir una dirección o ingresar las coordenadas GPS manualmente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await saveWorkCenter({
        id: editingCenter?.id,
        name: centerName,
        address: centerAddress,
        latitude: centerLat ? parseFloat(centerLat as any) : undefined,
        longitude: centerLng ? parseFloat(centerLng as any) : undefined,
        radius: parseInt(centerRadius as any),
      });
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el centro.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCenter = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este centro de trabajo? Todos los empleados asignados se quedarán sin centro.')) {
      return;
    }

    try {
      await deleteWorkCenter(id);
      window.location.reload();
    } catch (err: any) {
      alert('Error al eliminar el centro de trabajo.');
    }
  };

  // --- ACCIONES DEPARTAMENTOS ---
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName) return;

    setLoading(true);

    try {
      await saveDepartment(deptName, editingDept?.id);
      window.location.reload();
    } catch (err: any) {
      alert('Error al guardar el departamento.');
    } finally {
      setLoading(false);
    }
  };

  // --- ACCIONES STRIPE ---
  const handleSubscribe = async (plan: 'monthly' | 'annual') => {
    setStripeLoading(true);
    try {
      await subscribeAction(companyId, companyEmail, plan);
    } catch (err: any) {
      alert(err.message || 'Error al iniciar suscripción de Stripe.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleOpenBilling = async () => {
    setStripeLoading(true);
    try {
      await openBillingPortalAction(companyId);
    } catch (err: any) {
      alert(err.message || 'Error al abrir el portal de facturación.');
    } finally {
      setStripeLoading(false);
    }
  };

  // Renderizar información de suscripción
  const isTrialActive = new Date(subscription.trialEndsAt) > new Date();
  const trialDaysRemaining = Math.max(
    0,
    Math.ceil((new Date(subscription.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  );

  return (
    <>
      {/* CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Configuración</h1>
          <p className="page-subtitle">Gestiona centros de trabajo, departamentos y suscripción de Stripe.</p>
        </div>
      </div>

      {stripeStatus.text && (
        <div className={`pwa-geo-status ${stripeStatus.type === 'success' ? 'in-range' : 'out-range'}`} style={{ margin: 0 }}>
          {stripeStatus.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{stripeStatus.text}</span>
        </div>
      )}

      {error && (
        <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }}>
        
        {/* SECCIÓN 1: FACTURACIÓN Y PLANES (STRIPE) */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <CreditCard size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Planes y Suscripción (Stripe)</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Estado actual */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Estado de suscripción</p>
                <p style={{ fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', color: subscription.status === 'active' ? 'var(--success)' : 'var(--warning)' }}>
                  {subscription.status === 'trialing' ? 'Periodo de Prueba' : subscription.status === 'active' ? 'Suscripción Activa' : 'Expirada/Inactiva'}
                </p>
              </div>
              
              {subscription.status === 'trialing' && (
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Días de prueba restantes</p>
                  <p style={{ fontSize: '18px', fontWeight: 700 }}>{trialDaysRemaining} días</p>
                </div>
              )}
            </div>

            {/* Opciones de Pago */}
            {subscription.status !== 'active' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Al suscribirte, activarás el acceso ilimitado para tu empresa. Puedes elegir entre pago mensual o anual:
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  {/* Plan Mensual */}
                  <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-primary)' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Plan Mensual</h4>
                    <p style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
                      29€ <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ mes</span>
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pago recurrente mensual. Cancele cuando quiera.</p>
                    <button
                      disabled={stripeLoading}
                      onClick={() => handleSubscribe('monthly')}
                      className="btn btn-primary"
                      style={{ marginTop: 'auto', width: '100%' }}
                    >
                      {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                      Suscribirse Mensual
                    </button>
                  </div>

                  {/* Plan Anual */}
                  <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '2px solid var(--primary)', position: 'relative' }}>
                    <span className="badge badge-success" style={{ position: 'absolute', top: '-12px', right: '16px' }}>¡AHORRA 2 MESES!</span>
                    <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Plan Anual</h4>
                    <p style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
                      290€ <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ año</span>
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Equivalente a 24.16€/mes. Un solo cargo anual.</p>
                    <button
                      disabled={stripeLoading}
                      onClick={() => handleSubscribe('annual')}
                      className="btn btn-primary"
                      style={{ marginTop: 'auto', width: '100%', background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' }}
                    >
                      {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                      Suscribirse Anual
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Tu suscripción está gestionada a través de Stripe. Puedes ver tus facturas anteriores, actualizar tu tarjeta de crédito o cancelar la suscripción accediendo al portal de clientes de Stripe.
                </p>
                <button
                  disabled={stripeLoading}
                  onClick={handleOpenBilling}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignSelf: 'flex-start' }}
                >
                  {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Gestionar Suscripción y Facturas
                </button>
              </div>
            )}
          </div>
        </div>

        {/* SECCIÓN 2: CENTROS DE TRABAJO (MULTICENTRO) */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MapPin size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Centros de Trabajo y Geocercas</h3>
            </div>
            {!isCenterFormOpen && (
              <button onClick={handleOpenCenterCreate} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                <Plus size={14} />
                Añadir Centro
              </button>
            )}
          </div>

          {/* Formulario de creación/edición de Centro */}
          {isCenterFormOpen && (
            <form onSubmit={handleSaveCenter} style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 700 }}>
                {editingCenter ? 'Editar Centro' : 'Nuevo Centro de Trabajo'}
              </h4>
              
              <div className="form-group">
                <label className="form-label">Nombre del Centro</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  placeholder="Ej. Oficina Central Madrid"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Dirección Física</label>
                <input
                  type="text"
                  className="form-input"
                  value={centerAddress}
                  onChange={(e) => setCenterAddress(e.target.value)}
                  placeholder="Calle Gran Vía 15, Madrid"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Latitud (GPS)</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-input"
                    required
                    value={centerLat}
                    onChange={(e) => setCenterLat(parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitud (GPS)</label>
                  <input
                    type="number"
                    step="0.000001"
                    className="form-input"
                    required
                    value={centerLng}
                    onChange={(e) => setCenterLng(parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Radio (Metros)</label>
                  <input
                    type="number"
                    className="form-input"
                    required
                    value={centerRadius}
                    onChange={(e) => setCenterRadius(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', padding: '8px 12px', backgroundColor: 'rgba(26, 102, 255, 0.08)', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <Info size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span>
                  La geocerca es restrictiva. Los empleados asignados a este centro solo podrán fichar si su GPS está a menos de <strong>{centerRadius}m</strong> de estas coordenadas.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsCenterFormOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Guardar Centro
                </button>
              </div>
            </form>
          )}

          {/* Listado de Centros */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {workCenters.map((center) => (
              <div key={center.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <div>
                  <h4 style={{ fontWeight: 600 }}>{center.name}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {center.address || 'Sin dirección'} | Geocerca: {center.radius}m
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    GPS: {center.latitude}, {center.longitude}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleOpenCenterEdit(center)} className="btn btn-secondary" style={{ padding: '6px' }}>
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDeleteCenter(center.id)} className="btn btn-secondary" style={{ padding: '6px', color: 'var(--danger)' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}

            {workCenters.length === 0 && (
              <p style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                No tienes centros de trabajo creados. Debes crear al menos uno para permitir que tus empleados fichen.
              </p>
            )}
          </div>
        </div>

        {/* SECCIÓN 3: DEPARTAMENTOS */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Building size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Departamentos</h3>
            </div>
            {!isDeptFormOpen && (
              <button
                onClick={() => {
                  setEditingDept(null);
                  setDeptName('');
                  setIsDeptFormOpen(true);
                }}
                className="btn btn-secondary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
                <Plus size={14} />
                Añadir Dpto
              </button>
            )}
          </div>

          {/* Formulario Departamento */}
          {isDeptFormOpen && (
            <form onSubmit={handleSaveDept} style={{ padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">Nombre del Departamento</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="Ej. Desarrollo, Marketing..."
                  style={{ width: '100%', paddingTop: '8px', paddingBottom: '8px' }}
                />
              </div>
              <button type="button" onClick={() => setIsDeptFormOpen(false)} className="btn btn-secondary" style={{ padding: '8px 12px' }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                {loading ? <Loader2 className="animate-spin" size={14} /> : null}
                Guardar
              </button>
            </form>
          )}

          {/* Listado de Departamentos */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {departments.map((dept) => (
              <div
                key={dept.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '14px',
                  fontWeight: 500,
                }}
              >
                <span>{dept.name}</span>
                <button
                  onClick={() => {
                    setEditingDept(dept);
                    setDeptName(dept.name);
                    setIsDeptFormOpen(true);
                  }}
                  style={{ color: 'var(--text-secondary)', padding: '2px', display: 'flex', alignItems: 'center' }}
                >
                  <Edit2 size={12} />
                </button>
              </div>
            ))}
            {departments.length === 0 && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No hay departamentos creados.</p>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
