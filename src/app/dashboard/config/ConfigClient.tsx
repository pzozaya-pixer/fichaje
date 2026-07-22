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
  updateCompanyBackupSettingsAction,
  restoreBackupAction
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
  Download,
  Upload,
  QrCode,
  Printer,
  Calendar
} from 'lucide-react';
import { createHoliday, deleteHoliday, importHolidays } from '@/app/actions/holidays';

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

interface Holiday {
  id: string;
  date: string;
  name: string;
}

interface ConfigClientProps {
  initialWorkCenters: WorkCenter[];
  initialDepartments: Department[];
  initialHolidays: Holiday[];
  subscription: {
    status: string;
    trialEndsAt: string;
    stripeCustomerId: string;
    stripeSubscriptionId?: string;
    stripeProductId?: string | null;
    subscriptionQuantity?: number | null;
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
    createdAt: string;
  };
  companyId: string;
  companyEmail: string;
  monthlyPrice: string;
  annualPrice: string;
  prices: {
    basic_monthly: string;
    basic_annual: string;
    pro_monthly: string;
    pro_annual: string;
    business_monthly: string;
    business_annual: string;
  };
  activeEmployeesCount: number;
}

export default function ConfigClient({
  initialWorkCenters,
  initialDepartments,
  initialHolidays,
  subscription,
  company,
  companyId,
  companyEmail,
  monthlyPrice,
  annualPrice,
  prices,
  activeEmployeesCount,
}: ConfigClientProps) {
  const searchParams = useSearchParams();
  
  const getCentersLimit = (productId?: string | null) => {
    if (!productId) return 1;
    if (productId === 'prod_Un8zZdgvmqcuay' || productId === 'prod_Un91TCtSLN7pzx') return 1;
    if (productId === 'prod_UqIRZsZjb7aYTG') return 2;
    if (productId === 'prod_UqIpPQX0ny7oOD') return Infinity;
    return 1;
  };
  
  const [webUrl, setWebUrl] = useState('https://app.fichaje.click/fichaje');
  const [movilUrl, setMovilUrl] = useState('https://app.fichaje.click/fichaje/movil/');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      setWebUrl(`${origin}/fichaje`);
      setMovilUrl(`${origin}/fichaje/movil/`);
    }
  }, []);

  const [workCenters, setWorkCenters] = useState<WorkCenter[]>(initialWorkCenters);
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [holidays, setHolidays] = useState<Holiday[]>(initialHolidays);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayLoading, setHolidayLoading] = useState(false);

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) return;
    setHolidayLoading(true);
    try {
      const res = await createHoliday(holidayDate, holidayName.trim());
      if (res.success && (res as any).holiday) {
        setHolidays([...holidays, (res as any).holiday].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setHolidayDate('');
        setHolidayName('');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('Error al guardar el festivo.');
    } finally {
      setHolidayLoading(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este festivo?')) return;
    try {
      const res = await deleteHoliday(id);
      if (res.success) {
        setHolidays(holidays.filter((h) => h.id !== id));
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('Error al eliminar el festivo.');
    }
  };

  const handleImportHolidays = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setHolidayLoading(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (!text) {
        setHolidayLoading(false);
        return;
      }

      let parsedList: { date: string; name: string }[] = [];

      try {
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          if (!Array.isArray(json)) {
            alert('El archivo JSON debe contener una lista de festivos.');
            setHolidayLoading(false);
            return;
          }
          parsedList = json.map((h: any) => {
            const dateVal = h.date || h.fecha;
            const nameVal = h.name || h.nombre;
            if (!dateVal || !nameVal) {
              throw new Error('Formato de objeto inválido en JSON. Debe incluir fecha/date y nombre/name.');
            }
            return { date: dateVal.trim(), name: nameVal.trim() };
          });
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split(/\r?\n/);
          if (lines.length <= 1) {
            alert('El archivo CSV está vacío.');
            setHolidayLoading(false);
            return;
          }
          let startIndex = 0;
          const firstLine = lines[0].toLowerCase();
          if (firstLine.includes('fecha') || firstLine.includes('date') || firstLine.includes('nombre') || firstLine.includes('name')) {
            startIndex = 1;
          }

          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(/[,;]/);
            if (parts.length >= 2) {
              const dateVal = parts[0].replace(/['"]/g, '').trim();
              const nameVal = parts[1].replace(/['"]/g, '').trim();
              if (dateVal && nameVal) {
                parsedList.push({ date: dateVal, name: nameVal });
              }
            }
          }
        } else {
          alert('Por favor, selecciona un archivo válido en formato .json o .csv.');
          setHolidayLoading(false);
          return;
        }

        if (parsedList.length === 0) {
          alert('No se encontraron registros de festivos válidos en el archivo.');
          setHolidayLoading(false);
          return;
        }

        const res = await importHolidays(parsedList);
        if (res.success && res.holidays) {
          setHolidays(res.holidays as any);
          alert(res.message);
        } else {
          alert(res.message);
        }
      } catch (err: any) {
        alert('Error al procesar el archivo: ' + err.message);
      } finally {
        setHolidayLoading(false);
        e.target.value = '';
      }
    };

    reader.readAsText(file);
  };
  
  // Mensajes de Stripe Checkout
  const [stripeStatus, setStripeStatus] = useState<{ type: 'success' | 'error' | ''; text: string }>({ type: '', text: '' });

  // Toggle de período de facturación: 'monthly' o 'annual'
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');

  // Estados para cantidad de empleados contratados
  const [proQty, setProQty] = useState(
    subscription.stripeProductId === 'prod_UqIRZsZjb7aYTG' && subscription.subscriptionQuantity
      ? subscription.subscriptionQuantity
      : Math.max(7, Math.min(49, activeEmployeesCount || 7))
  );

  const [businessQty, setBusinessQty] = useState(
    subscription.stripeProductId === 'prod_UqIpPQX0ny7oOD' && subscription.subscriptionQuantity
      ? subscription.subscriptionQuantity
      : Math.max(50, activeEmployeesCount || 50)
  );

  // Helpers para calcular totales dinámicos
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
    return symbol === '€' ? `${total.toFixed(2)}€` : `${symbol}${total.toFixed(2)}`;
  };

  // Helpers de cliente para mapeo de planes
  function getPlanNameClient(productId: string | null): string {
    if (!productId) return 'Basic';
    if (productId === 'prod_Un8zZdgvmqcuay' || productId === 'prod_Un91TCtSLN7pzx') return 'Basic';
    if (productId === 'prod_UqIRZsZjb7aYTG') return 'Pro';
    if (productId === 'prod_UqIpPQX0ny7oOD') return 'Business';
    return 'Basic';
  }

  const isPlanActive = (planName: 'basic' | 'pro' | 'business') => {
    if (!hasActiveSubscription) return false;
    const prodId = subscription.stripeProductId;
    if (planName === 'basic') {
      return !prodId || prodId === 'prod_Un8zZdgvmqcuay' || prodId === 'prod_Un91TCtSLN7pzx';
    }
    if (planName === 'pro') {
      return prodId === 'prod_UqIRZsZjb7aYTG';
    }
    if (planName === 'business') {
      return prodId === 'prod_UqIpPQX0ny7oOD';
    }
    return false;
  };

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

  // Estados para restauración
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'partial' | 'complete'>('partial');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [restoreError, setRestoreError] = useState('');

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFile) {
      alert('Por favor, selecciona un archivo JSON de copia de seguridad.');
      return;
    }

    const confirmMsg = restoreMode === 'complete'
      ? '¿Estás seguro de que deseas realizar una RESTAURACIÓN COMPLETA?\n\n¡ATENCIÓN! Se eliminarán todos los empleados, fichajes, centros y departamentos actuales de la empresa para reemplazarlos por los del backup. Esta acción es destructiva y no se puede deshacer.'
      : '¿Deseas realizar una restauración parcial (fusionar datos)?\n\nSe importarán los departamentos, centros, empleados y fichajes que falten en tu base de datos actual sin borrar la información que ya existe.';

    if (!confirm(confirmMsg)) return;

    setRestoreLoading(true);
    setRestoreSuccess('');
    setRestoreError('');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonText = event.target?.result as string;
          const res = await restoreBackupAction(jsonText, restoreMode);

          if (res.success) {
            setRestoreSuccess(res.message);
            setRestoreFile(null);
            const fileInput = document.getElementById('backup-file-input') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            setTimeout(() => setRestoreSuccess(''), 5000);
          } else {
            setRestoreError(res.message);
          }
        } catch (err: any) {
          setRestoreError('Error al leer el archivo JSON.');
        } finally {
          setRestoreLoading(false);
        }
      };
      reader.readAsText(restoreFile);
    } catch (err: any) {
      setRestoreError('Ocurrió un error al procesar el archivo.');
      setRestoreLoading(false);
    }
  };

  const printQrCode = (url: string, title: string) => {
    const printWindow = window.open('', '_blank', 'width=600,height=600');
    if (!printWindow) {
      alert('Por favor, permite las ventanas emergentes (popups) para poder imprimir el código QR.');
      return;
    }
    
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Imprimir QR - ${title}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              text-align: center;
            }
            h2 {
              margin-top: 0;
              margin-bottom: 5px;
              color: #0f172a;
              font-size: 24px;
            }
            p {
              color: #475569;
              margin-bottom: 25px;
              font-size: 14px;
              word-break: break-all;
            }
            img {
              border: 1px solid #e2e8f0;
              padding: 15px;
              border-radius: 8px;
              background-color: white;
            }
            @media print {
              body {
                height: auto;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          <p>${url}</p>
          <img src="${qrImageUrl}" alt="Código QR" width="300" height="300" />
          <script>
            const img = document.querySelector('img');
            if (img.complete) {
              window.print();
              window.close();
            } else {
              img.onload = function() {
                window.print();
                window.close();
              };
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
  const handleSubscribe = async (tier: 'basic' | 'pro' | 'business', period: 'monthly' | 'annual', quantity: number = 1) => {
    setStripeLoading(true);
    try {
      const res = await subscribeAction(companyId, companyEmail, tier, period, quantity);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        alert(res.error || 'Error al iniciar suscripción de Stripe.');
      }
    } catch (err: any) {
      alert('Error de comunicación con el servidor.');
    } finally {
      setStripeLoading(false);
    }
  };

  const handleOpenBilling = async () => {
    setStripeLoading(true);
    try {
      const res = await openBillingPortalAction(companyId);
      if (res.success && res.url) {
        window.location.href = res.url;
      } else {
        alert(res.error || 'Error al abrir el portal de facturación.');
      }
    } catch (err: any) {
      alert('Error de comunicación con el servidor.');
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

  const companyRegDate = new Date(company.createdAt).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const trialEndDate = new Date(subscription.trialEndsAt).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

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
        <div id="planes" className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <CreditCard size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Planes y Suscripción (Stripe)</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Estado actual */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Estado de suscripción</p>
                  <p style={{ fontSize: '18px', fontWeight: 700, textTransform: 'uppercase', color: hasActiveSubscription ? 'var(--success)' : 'var(--warning)' }}>
                    {subscription.status === 'trialing' || (isTrialActive && !hasActiveSubscription) 
                      ? 'Periodo de Prueba' 
                      : hasActiveSubscription 
                        ? `Suscripción Activa (${getPlanNameClient(subscription.stripeProductId || null)})` 
                        : 'Expirada/Inactiva'}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fecha de alta</p>
                  <p style={{ fontSize: '14px', fontWeight: 600, marginTop: '2px' }}>{companyRegDate}</p>
                </div>
                
                {isTrialActive && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Días restantes libres de pago</p>
                    <p style={{ 
                      fontSize: '18px', 
                      fontWeight: 700, 
                      color: trialDaysRemaining <= 3 ? 'var(--danger)' : 'var(--success)', 
                      marginTop: '2px' 
                    }}>
                      {trialDaysRemaining} {trialDaysRemaining === 1 ? 'día' : 'días'}
                    </p>
                  </div>
                )}
              </div>

              {/* AVISO DE CANCELACIÓN (Faltan 3 días o menos) */}
              {isTrialActive && trialDaysRemaining <= 3 && (
                <div 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    padding: '12px 16px', 
                    backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                    borderRadius: '6px',
                    marginTop: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
                    <AlertTriangle size={16} />
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>¡Atención! Tu periodo de prueba gratuito finaliza pronto</span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                    Tu acceso gratuito finaliza el **{trialEndDate}**. Recuerda que si tienes una suscripción de Stripe configurada y deseas evitar cargos automáticos, debes darla de baja antes de esta fecha.
                  </p>
                  {hasActiveSubscription ? (
                    <a 
                      href="#planes" 
                      onClick={(e) => {
                        e.preventDefault();
                        const el = document.getElementById('planes');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      style={{ 
                        fontSize: '13px', 
                        color: 'var(--danger)', 
                        fontWeight: 600, 
                        textDecoration: 'underline',
                        alignSelf: 'flex-start'
                      }}
                    >
                      Solicitar la baja de la suscripción ahora &rarr;
                    </a>
                  ) : (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                      No tienes ninguna suscripción activa contratada. Tu periodo de prueba simplemente finalizará y la cuenta se pausará, sin ningún cobro.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Opciones de Pago */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '8px' }}>
              
              {/* Selector Toggle de Facturación */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', fontWeight: billingPeriod === 'monthly' ? 700 : 500, color: billingPeriod === 'monthly' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  Facturación Mensual
                </span>
                <button
                  type="button"
                  onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'annual' : 'monthly')}
                  style={{
                    width: '46px',
                    height: '24px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--primary)',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    transition: 'background-color 0.3s',
                  }}
                >
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      backgroundColor: '#fff',
                      position: 'absolute',
                      left: billingPeriod === 'monthly' ? '2px' : '24px',
                      transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  />
                </button>
                <span style={{ fontSize: '14px', fontWeight: billingPeriod === 'annual' ? 700 : 500, color: billingPeriod === 'annual' ? 'var(--primary)' : 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Facturación Anual
                  <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: 'var(--success)', color: '#fff', borderRadius: '4px', fontWeight: 700 }}>
                    AHORRA 2 MESES
                  </span>
                </span>
              </div>

              {/* Grid de las 3 tarjetas de planes */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
                
                {/* 1. PLAN BÁSICA */}
                <div 
                  className="premium-card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '16px', 
                    backgroundColor: 'var(--bg-primary)',
                    border: isPlanActive('basic') ? '2px solid var(--success)' : '1px solid var(--border-color)',
                    position: 'relative',
                    boxShadow: isPlanActive('basic') ? '0 4px 12px rgba(34, 197, 94, 0.15)' : 'none'
                  }}
                >
                  {isPlanActive('basic') && (
                    <span 
                      style={{ 
                        position: 'absolute', 
                        top: '-12px', 
                        right: '16px', 
                        backgroundColor: 'var(--success)', 
                        color: '#fff', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '4px' 
                      }}
                    >
                      PLAN ACTIVO
                    </span>
                  )}
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Plan Basic</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>Ideal para pequeñas empresas.</p>
                  </div>
                  <p style={{ fontSize: '32px', fontWeight: 800, fontFamily: 'var(--font-title)', margin: 0 }}>
                    {billingPeriod === 'monthly' ? prices.basic_monthly : prices.basic_annual}
                    <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {billingPeriod === 'monthly' ? ' / mes' : ' / año'}
                    </span>
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li><strong>Hasta 6 empleados</strong> activos</li>
                    <li><strong>1 centro</strong> de trabajo</li>
                    <li>Control de jornada en tiempo real</li>
                    <li>Geolocalización GPS</li>
                    <li>Registro de ausencias y vacaciones</li>
                    <li>Informes obligatorios en PDF / Excel</li>
                  </ul>
                  <button
                    disabled={stripeLoading}
                    onClick={isPlanActive('basic') ? undefined : (hasActiveSubscription ? handleOpenBilling : () => handleSubscribe('basic', billingPeriod, 1))}
                    className="btn btn-primary"
                    style={{ 
                      marginTop: 'auto', 
                      width: '100%',
                      backgroundColor: isPlanActive('basic') ? 'var(--bg-secondary)' : undefined,
                      color: isPlanActive('basic') ? 'var(--success)' : undefined,
                      border: isPlanActive('basic') ? '1px solid var(--success)' : undefined,
                      cursor: isPlanActive('basic') ? 'default' : 'pointer'
                    }}
                  >
                    {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                    {isPlanActive('basic') ? '✓ Plan Activo' : (hasActiveSubscription ? 'Cambiar a Basic' : 'Suscribirse')}
                  </button>
                </div>

                {/* 2. PLAN PRO */}
                <div 
                  className="premium-card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '16px', 
                    backgroundColor: 'var(--bg-primary)',
                    border: isPlanActive('pro') ? '2px solid var(--success)' : '2px solid var(--primary)',
                    position: 'relative',
                    boxShadow: '0 4px 20px rgba(26, 102, 255, 0.08)'
                  }}
                >
                  <span 
                    style={{ 
                      position: 'absolute', 
                      top: '-12px', 
                      left: '16px', 
                      backgroundColor: 'var(--primary)', 
                      color: '#fff', 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: '4px' 
                    }}
                  >
                    RECOMENDADO
                  </span>
                  {isPlanActive('pro') && (
                    <span 
                      style={{ 
                        position: 'absolute', 
                        top: '-12px', 
                        right: '16px', 
                        backgroundColor: 'var(--success)', 
                        color: '#fff', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '4px' 
                      }}
                    >
                      PLAN ACTIVO
                    </span>
                  )}
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Plan Pro</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>Para empresas en crecimiento.</p>
                  </div>
                  <p style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-title)', margin: 0 }}>
                    {billingPeriod === 'monthly' ? prices.pro_monthly : prices.pro_annual}
                    <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {billingPeriod === 'monthly' ? ' / empleado / mes' : ' / empleado / año'}
                    </span>
                  </p>

                  {/* Selector de cantidad de empleados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Empleados a contratar ({proQty}):
                    </label>
                    <input
                      type="number"
                      min={7}
                      max={49}
                      value={proQty}
                      onChange={(e) => setProQty(Math.max(7, Math.min(49, parseInt(e.target.value) || 7)))}
                      disabled={hasActiveSubscription}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '14px',
                        width: '100%',
                        backgroundColor: hasActiveSubscription ? 'var(--bg-secondary)' : '#fff',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      Permite gestionar entre 7 y 49 empleados.
                    </p>
                  </div>

                  {/* Total de Pro dinámico */}
                  <p style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0 0 0', color: 'var(--primary)' }}>
                    Total: {calculateTotal(billingPeriod === 'monthly' ? prices.pro_monthly : prices.pro_annual, proQty)} 
                    <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {billingPeriod === 'monthly' ? ' / mes' : ' / año'}
                    </span>
                  </p>

                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li><strong>Hasta 49 empleados</strong> activos</li>
                    <li><strong>Hasta 2 centros</strong> de trabajo</li>
                    <li>Todas las funciones del Plan Basic</li>
                    <li>Copias de seguridad automáticas</li>
                    <li>Configuración de festivos nacionales</li>
                    <li>Soporte prioritario por email</li>
                  </ul>
                  <button
                    disabled={stripeLoading}
                    onClick={isPlanActive('pro') ? undefined : (hasActiveSubscription ? handleOpenBilling : () => handleSubscribe('pro', billingPeriod, proQty))}
                    className="btn btn-primary"
                    style={{ 
                      marginTop: 'auto', 
                      width: '100%',
                      background: isPlanActive('pro') ? 'var(--bg-secondary)' : 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
                      color: isPlanActive('pro') ? 'var(--success)' : undefined,
                      border: isPlanActive('pro') ? '1px solid var(--success)' : undefined,
                      cursor: isPlanActive('pro') ? 'default' : 'pointer'
                    }}
                  >
                    {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                    {isPlanActive('pro') ? '✓ Plan Activo' : (hasActiveSubscription ? 'Cambiar a Pro' : 'Suscribirse')}
                  </button>
                </div>

                {/* 3. PLAN BUSINESS */}
                <div 
                  className="premium-card" 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '16px', 
                    backgroundColor: 'var(--bg-primary)',
                    border: isPlanActive('business') ? '2px solid var(--success)' : '1px solid var(--border-color)',
                    position: 'relative',
                    boxShadow: isPlanActive('business') ? '0 4px 12px rgba(34, 197, 94, 0.15)' : 'none'
                  }}
                >
                  {isPlanActive('business') && (
                    <span 
                      style={{ 
                        position: 'absolute', 
                        top: '-12px', 
                        right: '16px', 
                        backgroundColor: 'var(--success)', 
                        color: '#fff', 
                        fontSize: '11px', 
                        fontWeight: 700, 
                        padding: '2px 8px', 
                        borderRadius: '4px' 
                      }}
                    >
                      PLAN ACTIVO
                    </span>
                  )}
                  <div>
                    <h4 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Plan Business</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>Para grandes organizaciones.</p>
                  </div>
                  <p style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-title)', margin: 0 }}>
                    {billingPeriod === 'monthly' ? prices.business_monthly : prices.business_annual}
                    <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {billingPeriod === 'monthly' ? ' / empleado / mes' : ' / empleado / año'}
                    </span>
                  </p>

                  {/* Selector de cantidad de empleados */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Empleados a contratar ({businessQty}):
                    </label>
                    <input
                      type="number"
                      min={50}
                      value={businessQty}
                      onChange={(e) => setBusinessQty(Math.max(50, parseInt(e.target.value) || 50))}
                      disabled={hasActiveSubscription}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        fontSize: '14px',
                        width: '100%',
                        backgroundColor: hasActiveSubscription ? 'var(--bg-secondary)' : '#fff',
                        color: 'var(--text-primary)'
                      }}
                    />
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                      Para organizaciones de 50 o más empleados.
                    </p>
                  </div>

                  {/* Total de Business dinámico */}
                  <p style={{ fontSize: '20px', fontWeight: 700, margin: '8px 0 0 0', color: 'var(--primary)' }}>
                    Total: {calculateTotal(billingPeriod === 'monthly' ? prices.business_monthly : prices.business_annual, businessQty)} 
                    <span style={{ fontSize: '13px', fontWeight: 400, color: 'var(--text-secondary)' }}>
                      {billingPeriod === 'monthly' ? ' / mes' : ' / año'}
                    </span>
                  </p>

                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <li><strong>De 50 empleados en adelante</strong></li>
                    <li><strong>Centros de trabajo ilimitados</strong></li>
                    <li>Todas las funciones del Plan Pro</li>
                    <li>Exportación de backups automatizados</li>
                    <li>Asignación de múltiples administradores</li>
                    <li>Soporte 24/7</li>
                  </ul>
                  <button
                    disabled={stripeLoading}
                    onClick={isPlanActive('business') ? undefined : (hasActiveSubscription ? handleOpenBilling : () => handleSubscribe('business', billingPeriod, businessQty))}
                    className="btn btn-primary"
                    style={{ 
                      marginTop: 'auto', 
                      width: '100%',
                      backgroundColor: isPlanActive('business') ? 'var(--bg-secondary)' : undefined,
                      color: isPlanActive('business') ? 'var(--success)' : undefined,
                      border: isPlanActive('business') ? '1px solid var(--success)' : undefined,
                      cursor: isPlanActive('business') ? 'default' : 'pointer'
                    }}
                  >
                    {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                    {isPlanActive('business') ? '✓ Plan Activo' : (hasActiveSubscription ? 'Cambiar a Business' : 'Suscribirse')}
                  </button>
                </div>

              </div>

              {/* Botón de gestión general para usuarios suscritos */}
              {hasActiveSubscription && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', width: '100%', margin: 0, marginBottom: '8px' }}>
                    Tu facturación se procesa de forma segura a través de Stripe. Desde aquí puedes actualizar tu medio de pago, ver facturas o dar de baja el servicio.
                  </p>
                  <button
                    disabled={stripeLoading}
                    onClick={handleOpenBilling}
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    {stripeLoading ? <Loader2 className="animate-spin" size={16} /> : null}
                    Gestionar Suscripción en Stripe
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
                      alignItems: 'center',
                      gap: '8px',
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
              )}
            </div>
          </div>
        </div>

        {/* DATOS DE FACTURACIÓN DE LA EMPRESA */}
        <div id="facturacion" className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
        <div id="backups" className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

          {/* RESTAURAR COPIA DE SEGURIDAD */}
          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Upload size={18} style={{ color: 'var(--primary)' }} />
              <h4 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Restaurar Copia de Seguridad</h4>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              Sube un archivo de copia de seguridad (.json) para restaurar los datos de tu empresa.
            </p>

            {restoreSuccess && (
              <div className="pwa-geo-status in-range" style={{ margin: 0, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', borderLeft: '4px solid #22c55e' }}>
                <span>{restoreSuccess}</span>
              </div>
            )}

            {restoreError && (
              <div className="pwa-geo-status out-range" style={{ margin: 0, backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderLeft: '4px solid var(--danger)' }}>
                <span>{restoreError}</span>
              </div>
            )}

            <form onSubmit={handleRestoreBackup} className="responsive-grid-3" style={{ alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label">Seleccionar Archivo (.json)</label>
                <input
                  id="backup-file-input"
                  type="file"
                  accept=".json"
                  required
                  className="form-input"
                  style={{ padding: '8px 12px' }}
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Restauración</label>
                <select
                  className="form-select"
                  value={restoreMode}
                  onChange={(e) => setRestoreMode(e.target.value as 'partial' | 'complete')}
                >
                  <option value="partial">Parcial (Fusionar sin borrar)</option>
                  <option value="complete">Completa (Sobrescribir todo)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={restoreLoading || !restoreFile}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
              >
                {restoreLoading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                Restaurar Datos
              </button>
            </form>
          </div>
        </div>

        {/* SECCIÓN: CÓDIGOS QR DE ACCESO */}
        <div id="qr" className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <QrCode size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Códigos QR de Acceso</h3>
          </div>
          
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Descarga o imprime estos códigos QR para facilitar el acceso de tus empleados a la plataforma desde sus dispositivos móviles.
          </p>

          <div className="responsive-grid-2" style={{ marginTop: '8px' }}>
            {/* QR 1: Acceso Web / Registro */}
            <div className="pwa-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <span style={{ 
                  backgroundColor: 'var(--primary-light)', 
                  color: 'var(--primary)', 
                  fontSize: '14px', 
                  fontWeight: 800, 
                  padding: '6px 16px', 
                  borderRadius: '20px', 
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  boxShadow: '0 2px 8px rgba(26, 102, 255, 0.15)'
                }}>
                  Web
                </span>
                <span style={{ fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>Plataforma (Registro / Admin)</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{webUrl}</span>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {webUrl && (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(webUrl)}`}
                    alt="QR Plataforma Web" 
                    width="180" 
                    height="180" 
                    style={{ display: 'block' }}
                  />
                )}
              </div>
              <button 
                onClick={() => printQrCode(webUrl, 'Plataforma Web (Registro / Admin)')}
                className="btn btn-secondary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Printer size={16} />
                Imprimir QR Web
              </button>
            </div>

            {/* QR 2: Acceso Versión Móvil */}
            <div className="pwa-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '24px', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <span style={{ 
                  backgroundColor: 'rgba(34, 197, 94, 0.15)', 
                  color: '#16a34a', 
                  fontSize: '14px', 
                  fontWeight: 800, 
                  padding: '6px 16px', 
                  borderRadius: '20px', 
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  boxShadow: '0 2px 8px rgba(34, 197, 94, 0.15)'
                }}>
                  Móvil
                </span>
                <span style={{ fontWeight: 600, fontSize: '15px', marginTop: '4px' }}>Versión de Fichaje Móvil</span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{movilUrl}</span>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                {movilUrl && (
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(movilUrl)}`}
                    alt="QR Versión Móvil" 
                    width="180" 
                    height="180" 
                    style={{ display: 'block' }}
                  />
                )}
              </div>
              <button 
                onClick={() => printQrCode(movilUrl, 'Versión de Fichaje Móvil')}
                className="btn btn-secondary" 
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <Printer size={16} />
                Imprimir QR Móvil
              </button>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: CENTROS DE TRABAJO (MULTICENTRO) */}
        <div id="centros" className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <MapPin size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
                Centros de Trabajo y Geocercas ({workCenters.length} / {getCentersLimit(subscription.stripeProductId) === Infinity ? 'Ilimitados' : getCentersLimit(subscription.stripeProductId)})
              </h3>
            </div>
            {!isCenterFormOpen && (
              <button 
                onClick={() => {
                  const limit = getCentersLimit(subscription.stripeProductId);
                  if (workCenters.length >= limit) {
                    alert(`Límite de centros de trabajo alcanzado. Tu plan actual permite hasta ${limit} centro(s) de trabajo. Por favor, actualiza tu suscripción en Configuración para añadir más centros.`);
                  } else {
                    handleOpenCenterCreate();
                  }
                }} 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', fontSize: '13px' }}
              >
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
        <div id="departamentos" className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        {/* SECCIÓN 4: FESTIVOS DE LA EMPRESA */}
        <div id="festivos" className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Calendar size={20} style={{ color: 'var(--primary)' }} />
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Días Festivos de la Empresa</h3>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label 
                className="btn btn-secondary" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '13px', 
                  padding: '8px 12px', 
                  cursor: 'pointer',
                  margin: 0
                }}
              >
                <Upload size={14} />
                Importar JSON / CSV
                <input 
                  type="file" 
                  accept=".json,.csv" 
                  onChange={handleImportHolidays} 
                  disabled={holidayLoading}
                  style={{ display: 'none' }} 
                />
              </label>
            </div>
          </div>

          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
            Configura los días festivos nacionales, locales o de convenio de tu empresa. Estos días no contarán como laborables en la solicitud de vacaciones de tus empleados.
          </p>

          <form onSubmit={handleCreateHoliday} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', backgroundColor: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div className="form-group" style={{ flex: '1 1 200px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 500 }}>Fecha del Festivo</label>
              <input
                type="date"
                required
                className="form-input"
                value={holidayDate}
                onChange={(e) => setHolidayDate(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)' }}
              />
            </div>
            <div className="form-group" style={{ flex: '2 1 300px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" style={{ fontSize: '13px', fontWeight: 500 }}>Nombre / Descripción</label>
              <input
                type="text"
                required
                placeholder="Ej. Año Nuevo, Festivo Local"
                className="form-input"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-secondary)' }}
              />
            </div>
            <button
              type="submit"
              disabled={holidayLoading}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', height: '40px', cursor: 'pointer' }}
            >
              {holidayLoading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Añadir
            </button>
          </form>

          {/* Listado de festivos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Festivos Registrados ({holidays.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
              {holidays.map((h) => {
                const hDate = new Date(h.date);
                const formattedDate = hDate.toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  timeZone: 'UTC' // Importante usar UTC para evitar desfases de huso horario
                });
                return (
                  <div
                    key={h.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{h.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formattedDate}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="btn-delete"
                      style={{
                        color: 'var(--danger)',
                        background: 'none',
                        border: 'none',
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      title="Eliminar festivo"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
              {holidays.length === 0 && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontStyle: 'italic', padding: '16px 0' }}>
                  No se han registrado festivos en la empresa.
                </p>
              )}
            </div>
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
