'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  saveWorkCenter,
  deleteWorkCenter,
  saveDepartment,
  requestCompanyDeletionOtp,
  confirmCompanyDeletion,
  updateCompanyBillingInfo,
  downloadBackupAction,
  updateCompanyBackupSettingsAction
} from '@/app/actions/admin';
import { subscribeAction, openBillingPortalAction, cancelSubscriptionAction } from '@/app/actions/stripe';
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
  Info,
  X,
  Database,
  Download
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
    stripeSubscriptionId?: string;
  };
  company: {
    name: string;
    cif: string;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    backupActive: boolean;
    backupFrequency: string;
    backupEmail: string;
  };
  companyId: string;
  companyEmail: string;
  monthlyPrice: string;
  annualPrice: string;
}

export default function ConfigClient({
  initialWorkCenters,
  initialDepartments,
  subscription,
  company,
  companyId,
  companyEmail,
  monthlyPrice,
  annualPrice,
}: ConfigClientProps) {
  const searchParams = useSearchParams();
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(initialWorkCenters);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  
  // Mensajes de Stripe Checkout
  const [stripeStatus, setStripeStatus] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  // Estados para baja de empresa
  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);
  const [deletionOtp, setDeletionOtp] = useState('');
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionError, setDeletionError] = useState('');
  const [deletionMessage, setDeletionMessage] = useState('');

  const handleRequestDeletion = async () => {
    if (!confirm('¿Estás seguro de que deseas iniciar el proceso de baja? Se borrarán permanentemente la empresa, todos los empleados y el historial de fichajes de forma irreversible.')) {
      return;
    }

    setDeletionLoading(true);
    setDeletionError('');
    setDeletionMessage('');

    try {
      const res = await requestCompanyDeletionOtp();
      if (res.success) {
        setDeletionMessage(res.message);
        setIsDeletionModalOpen(true);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Error al solicitar el código de baja.');
    } finally {
      setDeletionLoading(false);
    }
  };

  const handleConfirmDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletionOtp || deletionOtp.length < 6) {
      setDeletionError('Introduce el código de 6 dígitos.');
      return;
    }

    setDeletionLoading(true);
    setDeletionError('');

    try {
      const res = await confirmCompanyDeletion(deletionOtp);
      if (res.success) {
        alert('Empresa dada de baja con éxito. Todos tus datos han sido eliminados.');
        window.location.href = '/fichaje'; // Redirigir al inicio
      } else {
        setDeletionError(res.message || 'Código incorrecto o expirado.');
      }
    } catch (err: any) {
      setDeletionError('Ocurrió un error al procesar la baja de la empresa.');
    } finally {
      setDeletionLoading(false);
    }
  };

  // Estados para datos de facturación
  const [companyName, setCompanyName] = useState(company.name);
  const [companyCif, setCompanyCif] = useState(company.cif);
  const [billingAddress, setBillingAddress] = useState(company.address);
  const [billingCity, setBillingCity] = useState(company.city);
  const [billingProvince, setBillingProvince] = useState(company.province);
  const [billingPostalCode, setBillingPostalCode] = useState(company.postalCode);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState('');

  // Estados para copias de seguridad
  const [backupActive, setBackupActive] = useState(company.backupActive);
  const [backupFrequency, setBackupFrequency] = useState(company.backupFrequency);
  const [backupEmail, setBackupEmail] = useState(company.backupEmail || companyEmail);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState('');

  const handleSaveBackupSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackupLoading(true);
    setBackupSuccess('');

    try {
      const res = await updateCompanyBackupSettingsAction({
        active: backupActive,
        frequency: backupFrequency,
        email: backupEmail,
      });

      if (res.success) {
        setBackupSuccess(res.message);
        setTimeout(() => setBackupSuccess(''), 4000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Error al guardar la configuración de copia de seguridad.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await downloadBackupAction();
      if (res.success && res.backupJson && res.filename) {
        const blob = new Blob([res.backupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        alert(res.message || 'No se pudo descargar la copia de seguridad.');
      }
    } catch (err) {
      alert('Error al descargar la copia de seguridad.');
    }
  };

  const handleSaveBillingInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !companyCif) {
      alert('Razón social y CIF/NIF son obligatorios.');
      return;
    }

    setBillingLoading(true);
    setBillingSuccess('');

    try {
      const res = await updateCompanyBillingInfo({
        name: companyName,
        cif: companyCif,
        address: billingAddress,
        city: billingCity,
        province: billingProvince,
        postalCode: billingPostalCode,
      });

      if (res.success) {
        setBillingSuccess(res.message);
        setTimeout(() => setBillingSuccess(''), 4000);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Error al guardar los datos de facturación.');
    } finally {
      setBillingLoading(false);
    }
  };

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

  const handleCancelSubscription = async () => {
    if (!confirm('¿Estás seguro de que deseas cancelar tu suscripción activa en Stripe? Tu cuenta y datos seguirán estando disponibles, pero la suscripción se cancelará inmediatamente.')) {
      return;
    }

    setStripeLoading(true);
    try {
      const res = await cancelSubscriptionAction();
      if (res.success) {
        alert(res.message || 'Suscripción cancelada correctamente.');
        window.location.reload();
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      alert('Ocurrió un error al intentar cancelar la suscripción.');
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

  const hasActiveSubscription =
    !!subscription.stripeSubscriptionId ||
    subscription.status === 'active' ||
    subscription.status === 'past_due';

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
                <p style={{ fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', color: hasActiveSubscription ? 'var(--success)' : 'var(--warning)' }}>
                  {subscription.status === 'trialing' ? 'Periodo de Prueba' : hasActiveSubscription ? 'Suscripción Activa' : 'Expirada/Inactiva'}
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
            {!hasActiveSubscription ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                  Al suscribirte, activarás el acceso ilimitado para tu empresa. Puedes elegir entre pago mensual o anual:
                </p>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                  {/* Plan Mensual */}
                  <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-primary)' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700 }}>Plan Mensual</h4>
                    <p style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
                      {monthlyPrice} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ mes</span>
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
                      {annualPrice} <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>/ año</span>
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Equivalente a {(parseFloat(annualPrice.replace(/[^0-9.]/g, '')) / 12 || 24.16).toFixed(2)}€/mes. Un solo cargo anual.</p>
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
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    disabled={stripeLoading}
                    onClick={handleOpenBilling}
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignSelf: 'flex-start' }}
                  >
                    {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                    Gestionar Suscripción y Facturas
                  </button>

                  <button
                    disabled={stripeLoading}
                    onClick={handleCancelSubscription}
                    className="btn"
                    style={{
                      backgroundColor: 'rgba(239, 68, 68, 0.08)',
                      color: 'var(--danger)',
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      display: 'inline-flex',
                      alignSelf: 'flex-start',
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                    Cancelar Suscripción
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DATOS DE FACTURACIÓN DE LA EMPRESA */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <Building size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Datos de Facturación (Aparecen en tus facturas)</h3>
          </div>

          {billingSuccess && (
            <div className="pwa-geo-status in-range" style={{ margin: 0, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', borderLeft: '4px solid #22c55e' }}>
              <span>{billingSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveBillingInfo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="responsive-grid-2">
              <div className="form-group">
                <label className="form-label">Razón Social *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Ej. Mi Empresa S.L."
                />
              </div>
              <div className="form-group">
                <label className="form-label">CIF / NIF *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={companyCif}
                  onChange={(e) => setCompanyCif(e.target.value)}
                  placeholder="Ej. B12345678"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Dirección Fiscal</label>
              <input
                type="text"
                className="form-input"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Ej. Calle Mayor 12, Piso 3"
              />
            </div>

            <div className="responsive-grid-3">
              <div className="form-group">
                <label className="form-label">Población</label>
                <input
                  type="text"
                  className="form-input"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                  placeholder="Ej. Madrid"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Provincia</label>
                <input
                  type="text"
                  className="form-input"
                  value={billingProvince}
                  onChange={(e) => setBillingProvince(e.target.value)}
                  placeholder="Ej. Madrid"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Código Postal</label>
                <input
                  type="text"
                  className="form-input"
                  value={billingPostalCode}
                  onChange={(e) => setBillingPostalCode(e.target.value)}
                  placeholder="Ej. 28001"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={billingLoading}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {billingLoading ? <Loader2 className="animate-spin" size={16} /> : null}
              Guardar Datos de Facturación
            </button>
          </form>
        </div>

        {/* COPIAS DE SEGURIDAD Y BACKUP DE DATOS */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Database size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Copia de Seguridad y Backup de Datos</h3>
            </div>
            <button
              onClick={handleDownloadBackup}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              Descargar Backup Completo (JSON)
            </button>
          </div>

          {backupSuccess && (
            <div className="pwa-geo-status in-range" style={{ margin: 0, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', borderLeft: '4px solid #22c55e' }}>
              <span>{backupSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveBackupSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
              Configura el envío automático de copias de seguridad de todos tus datos (empleados, fichajes y registros) por correo electrónico.
            </p>

            <div className="responsive-grid-3" style={{ alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label">Envío Automático</label>
                <select className="form-select" value={backupActive ? 'true' : 'false'} onChange={(e) => setBackupActive(e.target.value === 'true')}>
                  <option value="false">Desactivado</option>
                  <option value="true">Activo</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Frecuencia</label>
                <select className="form-select" value={backupFrequency} onChange={(e) => setBackupFrequency(e.target.value)} disabled={!backupActive}>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Correo de Destino</label>
                <input
                  type="email"
                  required
                  className="form-input"
                  value={backupEmail}
                  onChange={(e) => setBackupEmail(e.target.value)}
                  disabled={!backupActive}
                  placeholder="ejemplo@empresa.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={backupLoading}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              {backupLoading ? <Loader2 className="animate-spin" size={16} /> : null}
              Guardar Configuración de Backup
            </button>
          </form>
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

        {/* ZONA DE PELIGRO: BAJA DE EMPRESA */}
        <div className="premium-card" style={{ marginTop: '24px', border: '1px solid var(--danger)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: 'var(--danger)' }}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600, color: 'var(--danger)' }}>
                Zona de Peligro: Dar de baja la empresa
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Elimina permanentemente tu cuenta de empresa, todos los empleados y el historial de fichajes de forma irreversible.
              </p>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Al iniciar el proceso de baja, recibirás un código de verificación en tu correo electrónico administrativo para confirmar la eliminación de todos los datos.
          </p>

          <button
            onClick={handleRequestDeletion}
            disabled={deletionLoading}
            className="btn"
            style={{
              backgroundColor: 'var(--danger)',
              color: 'white',
              border: 'none',
              alignSelf: 'flex-start',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              padding: '10px 16px',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600
            }}
          >
            {deletionLoading ? <Loader2 className="animate-spin" size={16} /> : null}
            Solicitar Baja de Empresa
          </button>
        </div>

      </div>

      {/* MODAL CONFIRMACIÓN DE BAJA */}
      {isDeletionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="premium-card" style={{ maxWidth: '420px', width: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-title)', fontWeight: 700, color: 'var(--danger)' }}>
                Confirmar Baja de Empresa
              </h3>
              <button onClick={() => setIsDeletionModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '14px', color: '#991b1b', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', padding: '12px', borderRadius: '4px', margin: 0 }}>
              Introduce el código OTP enviado a tu correo. Al pulsar "Eliminar permanentemente", se borrarán de forma irreversible la empresa y todos sus empleados y fichajes.
            </p>

            {deletionError && (
              <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
                <span>{deletionError}</span>
              </div>
            )}

            {deletionMessage && (
              <div className="pwa-geo-status in-range" style={{ margin: 0, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', borderLeft: '4px solid #22c55e' }}>
                <span>{deletionMessage}</span>
              </div>
            )}

            <form onSubmit={handleConfirmDeletion} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Código de Verificación (OTP)</label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  className="form-input"
                  placeholder="123456"
                  value={deletionOtp}
                  onChange={(e) => setDeletionOtp(e.target.value)}
                  style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '4px', fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsDeletionModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={deletionLoading} className="btn" style={{ backgroundColor: 'var(--danger)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                  {deletionLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Eliminar permanentemente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
