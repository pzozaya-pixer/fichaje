'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  clockInAction,
  clockOutAction,
  startBreakAction,
  endBreakAction,
} from '@/app/actions/pwa';
import { logoutAction } from '@/app/actions/auth';
import {
  Clock,
  Calendar,
  User,
  Menu,
  MapPin,
  Play,
  Square,
  Coffee,
  RefreshCw,
  ChevronRight,
  LogOut,
  Bell,
  Globe,
  HelpCircle,
  FileText,
  Shield,
  CheckCircle,
  AlertTriangle,
  Award,
  BookOpen,
  CalendarCheck,
  Loader2,
  Plus,
  X
} from 'lucide-react';
import { requestVacation } from '@/app/actions/vacations';

interface MovilVacation {
  id: string;
  startDate: string;
  endDate: string;
  type: 'NATURALES' | 'LABORABLES' | 'CONVENIO';
  daysCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes: string;
}

interface MovilHoliday {
  date: string;
  name: string;
}

interface MovilClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    contractType: string;
    department: string;
    weeklySchedule?: any;
    workCenter: {
      name: string;
      latitude: number;
      longitude: number;
      radius: number;
    } | null;
  };
  initialTodayStatus: {
    hasClockedIn: boolean;
    isActive: boolean;
    clockIn: any;
    workedTimeMs: number;
    isOnBreak: boolean;
  };
  initialFichajes: any[];
  initialSummary: any;
  initialVacations: MovilVacation[];
  vacationSummary: {
    allocated: number;
    approved: number;
    pending: number;
    remaining: number;
  };
  holidays: MovilHoliday[];
}

export default function MovilClient({
  user,
  initialTodayStatus,
  initialFichajes,
  initialSummary,
  initialVacations,
  vacationSummary,
  holidays,
}: MovilClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(0);
  const [todayStatus, setTodayStatus] = useState(initialTodayStatus);
  const [fichajes, setFichajes] = useState(initialFichajes);
  const [summary, setSummary] = useState(initialSummary);
  const [vacations, setVacations] = useState<MovilVacation[]>(initialVacations);
  const [vacSummary, setVacSummary] = useState(vacationSummary);
  const [currentLegalDoc, setCurrentLegalDoc] = useState<string | null>(null);

  // Estados de Geolocalización (GPS)
  const [gpsPermission, setGpsPermission] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [isGpsModalOpen, setIsGpsModalOpen] = useState(false);
  const [gpsModalMode, setGpsModalMode] = useState<'enable' | 'disable'>('enable');

  const updateGpsPermissionState = async () => {
    if (typeof window === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
      setGpsPermission('unknown');
      return;
    }
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      setGpsPermission(result.state);
      result.onchange = () => {
        setGpsPermission(result.state);
      };
    } catch (err) {
      setGpsPermission('unknown');
    }
  };

  useEffect(() => {
    updateGpsPermissionState();
  }, []);

  // Auto-refresh when PWA gains focus or is resumed from background
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFocus = () => {
      console.log('App focused or resumed, refreshing router...');
      router.refresh();
    };

    window.addEventListener('focus', handleFocus);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  const handleToggleGps = () => {
    if (gpsPermission === 'granted') {
      setGpsModalMode('disable');
      setIsGpsModalOpen(true);
    } else {
      if (!navigator.geolocation) {
        alert('La geolocalización no es compatible con este dispositivo.');
        return;
      }
      getCurrentPositionWithFallback(
        (pos) => {
          setGpsPermission('granted');
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setCoords({ lat, lng });
          if (user.workCenter) {
            const dist = getDistance(lat, lng, user.workCenter.latitude, user.workCenter.longitude);
            setDistance(Math.round(dist));
            setIsWithinGeofence(dist <= user.workCenter.radius);
          }
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setGpsPermission('denied');
            setGpsModalMode('enable');
            setIsGpsModalOpen(true);
          } else {
            alert('No se pudo obtener la señal GPS.');
          }
        },
        5000
      );
    }
  };

  // Estados para solicitar vacaciones (formulario)
  const [vacStart, setVacStart] = useState('');
  const [vacEnd, setVacEnd] = useState('');
  const [vacType, setVacType] = useState<'NATURALES' | 'LABORABLES' | 'CONVENIO'>('NATURALES');
  const [vacDaysPreview, setVacDaysPreview] = useState(0);
  const [vacNotes, setVacNotes] = useState('');
  const [vacLoading, setVacLoading] = useState(false);
  const [vacSuccessMsg, setVacSuccessMsg] = useState('');

  // Estados de Geolocalización
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [checkingGps, setCheckingGps] = useState(false);

  // Obtener ubicación con reintento y fallback en caso de timeout (clave para interiores)
  const getCurrentPositionWithFallback = (
    onSuccess: (position: GeolocationPosition) => void,
    onError: (error: GeolocationPositionError) => void,
    highAccuracyTimeout = 10000
  ) => {
    const optionsHigh = { enableHighAccuracy: true, timeout: highAccuracyTimeout, maximumAge: 0 };
    const optionsLow = { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.TIMEOUT) {
          console.warn("GPS de alta precisión agotado. Reintentando con baja precisión (redes/celular)...");
          navigator.geolocation.getCurrentPosition(onSuccess, onError, optionsLow);
        } else {
          onError(err);
        }
      },
      optionsHigh
    );
  };

  // Reloj en tiempo real
  const [liveWorkedTimeMs, setLiveWorkedTimeMs] = useState(todayStatus.workedTimeMs);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  // Estado del Calendario
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date>(new Date());



  // Efecto para el reloj en tiempo real
  useEffect(() => {
    setLiveWorkedTimeMs(todayStatus.workedTimeMs);

    if (!todayStatus.isActive || todayStatus.isOnBreak) {
      return;
    }

    const stateLoadedAt = Date.now();
    const interval = setInterval(() => {
      const elapsedSinceStateLoad = Date.now() - stateLoadedAt;
      setLiveWorkedTimeMs(todayStatus.workedTimeMs + elapsedSinceStateLoad);
    }, 1000);

    return () => clearInterval(interval);
  }, [todayStatus.isActive, todayStatus.isOnBreak, todayStatus.workedTimeMs]);

  // Función para obtener ubicación GPS y calcular distancia
  const checkGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('La geolocalización no es compatible con este dispositivo.');
      return;
    }

    setCheckingGps(true);
    setGpsError('');

    getCurrentPositionWithFallback(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        if (user.workCenter) {
          const dist = getDistance(
            lat,
            lng,
            user.workCenter.latitude,
            user.workCenter.longitude
          );
          setDistance(Math.round(dist));
          setIsWithinGeofence(dist <= user.workCenter.radius);
        }
        setCheckingGps(false);
      },
      (error) => {
        console.error(error);
        setCheckingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Permiso de GPS denegado. Actívalo en los ajustes del navegador o del dispositivo.');
          setGpsModalMode('enable');
          setIsGpsModalOpen(true);
        } else {
          setGpsError('No se pudo obtener la señal GPS.');
        }
      }
    );
  };

  // Fórmula de Haversine local para el cliente
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Acciones de fichaje
  const triggerClockIn = async () => {
    setCheckingGps(true);
    setActionLoading(true);
    setActionMessage({ type: '', text: '' });

    if (!navigator.geolocation) {
      setActionMessage({ type: 'error', text: 'La geolocalización no es compatible con este dispositivo.' });
      setActionLoading(false);
      setCheckingGps(false);
      return;
    }

    getCurrentPositionWithFallback(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        // Calcular distancia localmente para actualizar la UI antes de recargar
        if (user.workCenter) {
          const dist = getDistance(lat, lng, user.workCenter.latitude, user.workCenter.longitude);
          setDistance(Math.round(dist));
          setIsWithinGeofence(dist <= user.workCenter.radius);
        }

        try {
          const res = await clockInAction(lat, lng);
          if (res.success) {
            setActionMessage({ type: 'success', text: res.message });
            await refreshData();
          } else {
            setActionMessage({ type: 'error', text: res.message });
          }
        } catch (err) {
          setActionMessage({ type: 'error', text: 'Error al registrar el fichaje.' });
        } finally {
          setActionLoading(false);
          setCheckingGps(false);
        }
      },
      (error) => {
        console.error(error);
        setActionLoading(false);
        setCheckingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setActionMessage({ type: 'error', text: 'Permiso de GPS denegado. Actívalo para poder fichar.' });
          setGpsModalMode('enable');
          setIsGpsModalOpen(true);
        } else {
          setActionMessage({ type: 'error', text: 'No se pudo obtener la ubicación GPS para fichar.' });
        }
      }
    );
  };

  const triggerClockOut = async () => {
    setCheckingGps(true);
    setActionLoading(true);
    setActionMessage({ type: '', text: '' });

    if (!navigator.geolocation) {
      setActionMessage({ type: 'error', text: 'La geolocalización no es compatible con este dispositivo.' });
      setActionLoading(false);
      setCheckingGps(false);
      return;
    }

    getCurrentPositionWithFallback(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        if (user.workCenter) {
          const dist = getDistance(lat, lng, user.workCenter.latitude, user.workCenter.longitude);
          setDistance(Math.round(dist));
          setIsWithinGeofence(dist <= user.workCenter.radius);
        }

        try {
          const res = await clockOutAction(lat, lng);
          if (res.success) {
            setActionMessage({ type: 'success', text: res.message });
            await refreshData();
          } else {
            setActionMessage({ type: 'error', text: res.message });
          }
        } catch (err) {
          setActionMessage({ type: 'error', text: 'Error al registrar la salida.' });
        } finally {
          setActionLoading(false);
          setCheckingGps(false);
        }
      },
      (error) => {
        console.error(error);
        setActionLoading(false);
        setCheckingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setActionMessage({ type: 'error', text: 'Permiso de GPS denegado. Actívalo para poder registrar la salida.' });
          setGpsModalMode('enable');
          setIsGpsModalOpen(true);
        } else {
          setActionMessage({ type: 'error', text: 'No se pudo obtener la ubicación GPS para registrar la salida.' });
        }
      }
    );
  };

  const triggerBreakToggle = async () => {
    setCheckingGps(true);
    setActionLoading(true);
    setActionMessage({ type: '', text: '' });

    if (!navigator.geolocation) {
      setActionMessage({ type: 'error', text: 'La geolocalización no es compatible con este dispositivo.' });
      setActionLoading(false);
      setCheckingGps(false);
      return;
    }

    getCurrentPositionWithFallback(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setCoords({ lat, lng });

        if (user.workCenter) {
          const dist = getDistance(lat, lng, user.workCenter.latitude, user.workCenter.longitude);
          setDistance(Math.round(dist));
          setIsWithinGeofence(dist <= user.workCenter.radius);
        }

        try {
          const res = todayStatus.isOnBreak ? await endBreakAction() : await startBreakAction();
          if (res.success) {
            setActionMessage({ type: 'success', text: res.message });
            await refreshData();
          } else {
            setActionMessage({ type: 'error', text: res.message });
          }
        } catch (err) {
          setActionMessage({ type: 'error', text: 'Error en la pausa.' });
        } finally {
          setActionLoading(false);
          setCheckingGps(false);
        }
      },
      (error) => {
        console.error(error);
        setActionLoading(false);
        setCheckingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setActionMessage({ type: 'error', text: 'Permiso de GPS denegado. Actívalo para registrar la pausa.' });
          setGpsModalMode('enable');
          setIsGpsModalOpen(true);
        } else {
          setActionMessage({ type: 'error', text: 'No se pudo obtener la ubicación GPS para la pausa.' });
        }
      }
    );
  };

  // Actualizar datos de la vista
  const refreshData = async () => {
    router.refresh();
    // En una app real, llamaríamos a funciones para recargar el estado del cliente
    // Para simplificar, refrescamos la página
    window.location.reload();
  };

  // Formateador de milisegundos a formato readable (HH:MM:SS)
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatShortTime = (ms: number) => {
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatDateDMA = (dateVal: string | Date | number) => {
    const d = new Date(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const formatHoursDecimal = (hoursDecimal: number) => {
    const totalMinutes = Math.round(hoursDecimal * 60);
    if (totalMinutes === 0) return '00:00';
    const isNegative = totalMinutes < 0;
    const absMinutes = Math.abs(totalMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return isNegative ? `-${formatted}` : `+${formatted}`;
  };

  // --- VACACIONES HELPERS ---
  const getDaysDifference = (startStr: string, endStr: string, type: 'NATURALES' | 'LABORABLES' | 'CONVENIO') => {
    if (!startStr || !endStr) return 0;
    const start = new Date(`${startStr}T00:00:00`);
    const end = new Date(`${endStr}T00:00:00`);
    if (start > end) return 0;

    let count = 0;
    let curr = new Date(start);
    const holidayDatesOnly = holidays.map((h) => h.date);

    while (curr <= end) {
      if (type === 'NATURALES') {
        count++;
      } else {
        const dayOfWeek = curr.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, '0');
        const day = String(curr.getDate()).padStart(2, '0');
        const dateISO = `${year}-${month}-${day}`;
        
        const isHoliday = holidayDatesOnly.includes(dateISO);

        if (!isWeekend && !isHoliday) {
          count++;
        }
      }
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  };

  useEffect(() => {
    if (vacStart && vacEnd) {
      setVacDaysPreview(getDaysDifference(vacStart, vacEnd, vacType));
    } else {
      setVacDaysPreview(0);
    }
  }, [vacStart, vacEnd, vacType]);

  const handleRequestVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vacStart || !vacEnd || vacDaysPreview <= 0) return;
    setVacLoading(true);
    setVacSuccessMsg('');
    try {
      const res = await requestVacation(vacStart, vacEnd, vacType, vacDaysPreview, vacNotes);
      if (res.success && (res as any).vacation) {
        setVacSuccessMsg('Solicitud enviada correctamente. Esperando aprobación.');
        const serverVac = (res as any).vacation;
        const newVac: MovilVacation = {
          id: serverVac.id,
          startDate: serverVac.startDate,
          endDate: serverVac.endDate,
          type: serverVac.type,
          daysCount: serverVac.daysCount,
          status: serverVac.status,
          notes: serverVac.notes,
        };
        setVacations([newVac, ...vacations]);
        setVacSummary({
          ...vacSummary,
          pending: vacSummary.pending + vacDaysPreview,
          remaining: Math.max(0, vacSummary.remaining - vacDaysPreview) // temporal visual
        });
        setVacStart('');
        setVacEnd('');
        setVacNotes('');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('Error al enviar la solicitud.');
    } finally {
      setVacLoading(false);
    }
  };

  const getSelectedDaySpecialDetails = () => {
    const year = selectedCalendarDate.getFullYear();
    const month = String(selectedCalendarDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedCalendarDate.getDate()).padStart(2, '0');
    const dateISO = `${year}-${month}-${day}`;

    const holiday = holidays.find((h) => h.date === dateISO);

    const vacation = vacations.find((v) => {
      const vStart = v.startDate.split('T')[0];
      const vEnd = v.endDate.split('T')[0];
      return dateISO >= vStart && dateISO <= vEnd;
    });

    return { holiday, vacation };
  };

  const translateType = (type: string) => {
    switch (type) {
      case 'NATURALES': return 'Naturales';
      case 'LABORABLES': return 'Laborables';
      case 'CONVENIO': return 'Días Convenio';
      default: return type;
    }
  };

  // --- CALENDARIO HELPERS ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Domingo, 1 = Lunes...
    const totalDays = new Date(year, month + 1, 0).getDate();
    
    // Ajustar primer día a lunes (0 = Lunes, 6 = Domingo)
    const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

    return { totalDays, adjustedFirstDay };
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const renderCalendar = () => {
    const { totalDays, adjustedFirstDay } = getDaysInMonth(currentDate);
    const days = [];

    // Celdas vacías del mes anterior
    for (let i = 0; i < adjustedFirstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Celdas del mes
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const dateStr = date.toLocaleDateString('es-ES');
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(d).padStart(2, '0');
      const dateISO = `${year}-${month}-${day}`;

      // Comprobar si hay fichajes este día
      const hasClockInThisDay = fichajes.some(
        (f) => new Date(f.entryTime).toLocaleDateString('es-ES') === dateStr
      );

      // Comprobar si es Festivo
      const holidayObj = holidays.find((h) => h.date === dateISO);
      const isHoliday = !!holidayObj;

      // Comprobar si es vacaciones (aprobadas o pendientes)
      const vacationObj = vacations.find((v) => {
        const vStart = v.startDate.split('T')[0];
        const vEnd = v.endDate.split('T')[0];
        return dateISO >= vStart && dateISO <= vEnd;
      });

      const isSelected = selectedCalendarDate.toLocaleDateString('es-ES') === dateStr;
      const isToday = new Date().toLocaleDateString('es-ES') === dateStr;

      // Determinar color de fondo y texto del día
      let bgColor = 'transparent';
      let textColor = 'var(--pwa-text-primary)';
      let borderStyle = 'none';

      if (isSelected) {
        bgColor = 'var(--primary)';
        textColor = 'white';
      } else if (isToday) {
        bgColor = 'var(--pwa-bg-tertiary)';
        borderStyle = '1px solid var(--primary)';
      } else if (vacationObj) {
        if (vacationObj.status === 'APPROVED') {
          bgColor = 'rgba(34, 197, 94, 0.2)'; // Verde translúcido
          textColor = '#4ade80';
        } else if (vacationObj.status === 'PENDING') {
          bgColor = 'rgba(245, 158, 11, 0.2)'; // Amarillo/Naranja translúcido
          textColor = '#fbbf24';
        }
      } else if (isHoliday) {
        bgColor = 'rgba(139, 92, 246, 0.2)'; // Púrpura translúcido
        textColor = '#a78bfa';
      }

      days.push(
        <button
          key={`day-${d}`}
          onClick={() => setSelectedCalendarDate(date)}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '42px',
            width: '100%',
            borderRadius: '50%',
            fontWeight: isSelected || isToday || vacationObj || isHoliday ? '700' : '400',
            backgroundColor: bgColor,
            color: textColor,
            border: borderStyle,
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {d}
          {hasClockInThisDay && !isSelected && (
            <span
              style={{
                position: 'absolute',
                bottom: '4px',
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: 'var(--success)',
              }}
            ></span>
          )}
        </button>
      );
    }

    return days;
  };

  const getSelectedDayDetails = () => {
    const dateStr = selectedCalendarDate.toLocaleDateString('es-ES');
    const dayFichajes = fichajes.filter(
      (f) => new Date(f.entryTime).toLocaleDateString('es-ES') === dateStr
    );

    return dayFichajes;
  };

  // Porcentaje de la jornada de hoy (prevista 8h = 28,800,000 ms)
  const targetMs = 8 * 60 * 60 * 1000;
  const progressPercent = Math.min(100, Math.round((liveWorkedTimeMs / targetMs) * 100));

  // Circunferencia del círculo SVG (r=50, c=2*pi*r = 314.16)
  const strokeDashoffset = 314.16 - (progressPercent / 100) * 314.16;

  return (
    <div className="pwa-layout">
      {/* CABECERA PWA */}
      <header className="pwa-header">
        <div className="pwa-user-badge">
          <div className="pwa-user-avatar">
            {user.name.charAt(0)}
          </div>
          <div className="pwa-user-info">
            <h3>{user.name}</h3>
            <p>{user.department} • {user.role === 'ADMIN' ? 'Administrador' : 'Empleado'}</p>
          </div>
        </div>
        <button
          onClick={checkGpsLocation}
          className="pwa-break-btn"
          style={{ width: 'auto', padding: '8px', marginTop: 0 }}
        >
          <RefreshCw size={18} className={checkingGps ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* CUERPO PRINCIPAL SEGÚN TAB */}
      <main className="pwa-main">
        {actionMessage.text && (
          <div
            className={`pwa-geo-status ${
              actionMessage.type === 'success' ? 'in-range' : 'out-range'
            }`}
            style={{ margin: 0 }}
          >
            {actionMessage.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* TAB 0: MI JORNADA */}
        {activeTab === 0 && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
                Mi jornada
              </h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)', margin: 0 }}>
                  {formatDateDMA(new Date())}
                </p>
                {/* Horario de hoy */}
                {(() => {
                  const schedule = user.weeklySchedule || {
                    '1': { enabled: true, start: '09:00', end: '18:00' },
                    '2': { enabled: true, start: '09:00', end: '18:00' },
                    '3': { enabled: true, start: '09:00', end: '18:00' },
                    '4': { enabled: true, start: '09:00', end: '18:00' },
                    '5': { enabled: true, start: '09:00', end: '18:00' },
                    '6': { enabled: false, start: '09:00', end: '18:00' },
                    '0': { enabled: false, start: '09:00', end: '18:00' },
                  };
                  const today = new Date();
                  const dayKey = String(today.getDay());
                  const parsed = typeof schedule === 'string'
                    ? JSON.parse(schedule)
                    : schedule;
                  const dayData = parsed[dayKey];
                  if (dayData && dayData.enabled) {
                    return (
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 600, 
                        color: 'var(--primary)', 
                        backgroundColor: 'rgba(26, 102, 255, 0.08)', 
                        padding: '3px 8px', 
                        borderRadius: '12px' 
                      }}>
                        Hoy: {dayData.start} - {dayData.end}
                      </span>
                    );
                  } else {
                    return (
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: 600, 
                        color: 'var(--pwa-text-secondary)', 
                        backgroundColor: 'rgba(0, 0, 0, 0.05)', 
                        padding: '3px 8px', 
                        borderRadius: '12px',
                        fontStyle: 'italic'
                      }}>
                        Hoy: No laborable
                      </span>
                    );
                  }
                })()}
              </div>
            </div>

            {/* Tarjeta de Ubicación GPS */}
            <div className="pwa-card">
              <div className="pwa-card-title">
                <MapPin size={18} style={{ color: 'var(--primary)' }} />
                <span>Ubicación (GPS)</span>
              </div>

              {user.workCenter ? (
                <>
                  {coords === null && !checkingGps ? (
                    <div className="pwa-geo-status in-range" style={{ margin: 0, backgroundColor: 'rgba(59, 130, 246, 0.08)', color: '#2563eb', borderLeft: '4px solid #3b82f6', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={18} style={{ color: '#2563eb' }} />
                      <span style={{ fontSize: '13px' }}>Ubicación GPS: Se validará al fichar</span>
                    </div>
                  ) : checkingGps ? (
                    <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>
                      Obteniendo señal GPS...
                    </p>
                  ) : gpsError ? (
                    <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
                      <AlertTriangle size={18} />
                      <span>{gpsError}</span>
                    </div>
                  ) : (
                    <div
                      className={`pwa-geo-status ${isWithinGeofence ? 'in-range' : 'out-range'}`}
                      style={{ margin: 0 }}
                    >
                      {isWithinGeofence ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
                      <div>
                        <p style={{ fontWeight: 600 }}>
                          {isWithinGeofence ? 'Dentro del rango permitido' : 'Fuera del rango permitido'}
                        </p>
                        <p style={{ fontSize: '11px', opacity: 0.9 }}>
                          Distancia: {distance !== null ? `${distance}m` : 'calculando...'} (Radio
                          máx: {user.workCenter.radius}m de {user.workCenter.name})
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>
                  No tienes ningún centro de trabajo asignado.
                </p>
              )}
            </div>

            {/* Botones de Fichaje */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!todayStatus.hasClockedIn || !todayStatus.isActive ? (
                <button
                  disabled={actionLoading || checkingGps}
                  onClick={triggerClockIn}
                  className="pwa-clock-btn clock-in"
                >
                  <Play size={20} fill="white" />
                  Fichar Entrada
                </button>
              ) : (
                <>
                  <button
                    disabled={actionLoading || checkingGps}
                    onClick={triggerClockOut}
                    className="pwa-clock-btn clock-out"
                  >
                    <Square size={20} fill="white" />
                    Fichar Salida
                  </button>

                  <button
                    disabled={actionLoading}
                    onClick={triggerBreakToggle}
                    className="pwa-break-btn"
                  >
                    <Coffee size={18} />
                    {todayStatus.isOnBreak ? 'Finalizar Pausa' : 'Iniciar Pausa'}
                  </button>
                </>
              )}
            </div>

            {/* Jornada de Hoy Detalle */}
            {todayStatus.hasClockedIn && (
              <div className="pwa-card">
                <div className="pwa-card-title">
                  <Clock size={18} />
                  <span>Jornada de hoy</span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '14px',
                    borderBottom: '1px solid var(--pwa-border)',
                    paddingBottom: '8px',
                  }}
                >
                  <div>
                    <p style={{ color: 'var(--pwa-text-secondary)', fontSize: '11px' }}>Entrada</p>
                    <p style={{ fontWeight: 600, color: 'var(--success)' }}>
                      {new Date(todayStatus.clockIn.entryTime).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--pwa-text-secondary)', fontSize: '11px' }}>Pausas</p>
                    <p style={{ fontWeight: 600 }}>
                      {todayStatus.clockIn.breaks
                        ? `${(todayStatus.clockIn.breaks as any[]).length}`
                        : '0'}
                    </p>
                  </div>
                  <div>
                    <p style={{ color: 'var(--pwa-text-secondary)', fontSize: '11px' }}>Salida</p>
                    <p style={{ fontWeight: 600 }}>
                      {todayStatus.clockIn.exitTime
                        ? new Date(todayStatus.clockIn.exitTime).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Pendiente'}
                    </p>
                  </div>
                </div>

                {/* Tiempo Trabajado Anillo */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-around',
                    marginTop: '20px',
                  }}
                >
                  <div className="pwa-progress-circle">
                    <svg>
                      <circle className="circle-bg" cx="60" cy="60" r="50" />
                      <circle
                        className="circle-progress"
                        cx="60"
                        cy="60"
                        r="50"
                        strokeDasharray="314.16"
                        strokeDashoffset={strokeDashoffset}
                      />
                    </svg>
                    <div className="pwa-progress-text">
                      <span className="percentage">{progressPercent}%</span>
                      <span className="label">completado</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ fontSize: '11px', color: 'var(--pwa-text-secondary)' }}>
                      Tiempo trabajado
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
                      {formatTime(liveWorkedTimeMs)}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--pwa-text-secondary)' }}>
                      de 8h 00m previstas
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Últimos Fichajes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
                Mis últimos fichajes
              </h3>
              <div className="pwa-fichaje-list">
                {fichajes.slice(0, 3).map((f) => (
                  <div key={f.id} className="pwa-fichaje-row">
                    <div className="pwa-fichaje-info">
                      <p className="pwa-fichaje-time">
                        {new Date(f.entryTime).toLocaleTimeString('es-ES', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        -{' '}
                        {f.exitTime
                          ? new Date(f.exitTime).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'En curso'}
                      </p>
                      <p className="pwa-fichaje-date">
                        {formatDateDMA(f.entryTime)}
                      </p>
                    </div>
                    <span className="pwa-fichaje-duration">
                      {f.exitTime ? formatShortTime(f.durationMs) : formatShortTime(liveWorkedTimeMs)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* TAB 1: MIS FICHAJES */}
        {activeTab === 1 && (
          <>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
              Mis fichajes
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="pwa-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ fontSize: '11px', color: 'var(--pwa-text-secondary)' }}>Horas trabajadas</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
                  {formatHoursDecimal(summary.hoursWorked)}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--pwa-text-secondary)' }}>Este mes</p>
              </div>
              <div className="pwa-card" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <p style={{ fontSize: '11px', color: 'var(--pwa-text-secondary)' }}>Balance</p>
                <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)' }}>
                  {formatHoursDecimal(summary.extraHours)}
                </p>
                <p style={{ fontSize: '10px', color: 'var(--pwa-text-secondary)' }}>Pendientes</p>
              </div>
            </div>

            <div className="pwa-fichaje-list">
              {fichajes.map((f) => (
                <div key={f.id} className="pwa-fichaje-row">
                  <div className="pwa-fichaje-info">
                    <p className="pwa-fichaje-time">
                      {new Date(f.entryTime).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {f.exitTime
                        ? new Date(f.exitTime).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'En curso'}
                    </p>
                    <p className="pwa-fichaje-date">
                      {formatDateDMA(f.entryTime)}
                      {f.isManual && (
                        <span style={{ marginLeft: '8px', color: 'var(--warning)', fontSize: '10px' }}>
                          (Manual)
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p className="pwa-fichaje-duration">
                      {f.exitTime ? formatShortTime(f.durationMs) : formatShortTime(liveWorkedTimeMs)}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--pwa-text-secondary)' }}>
                      Pausa: {Math.round(f.breakMs / (1000 * 60))} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* TAB 2: CALENDARIO Y VACACIONES */}
        {activeTab === 2 && (
          <>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
              Calendario y Vacaciones
            </h2>

            {/* RESUMEN DE SALDO DE VACACIONES */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
              <div style={{ backgroundColor: 'var(--pwa-bg-secondary)', border: '1px solid var(--pwa-border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: 'var(--pwa-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cupo Anual</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'white', marginTop: '2px' }}>{vacSummary.allocated}d</p>
              </div>
              <div style={{ backgroundColor: 'var(--pwa-bg-secondary)', border: '1px solid var(--pwa-border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: 'var(--pwa-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Consumidos</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#4ade80', marginTop: '2px' }}>{vacSummary.approved}d</p>
              </div>
              <div style={{ backgroundColor: 'var(--pwa-bg-secondary)', border: '1px solid var(--pwa-border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: 'var(--pwa-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disponibles</p>
                <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)', marginTop: '2px' }}>{vacSummary.remaining}d</p>
              </div>
            </div>

            {/* Leyenda de Colores */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: 'var(--pwa-text-secondary)', justifyContent: 'center', marginTop: '4px', padding: '4px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }}></span>
                <span>Fichado</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8b5cf6' }}></span>
                <span>Festivo</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }}></span>
                <span>Aprobada</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                <span>Pendiente</span>
              </div>
            </div>

            {/* Controles de Mes */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--pwa-bg-secondary)',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--pwa-border)',
                marginTop: '4px'
              }}
            >
              <button onClick={handlePrevMonth} style={{ padding: '4px 8px', color: 'var(--primary)', fontWeight: 'bold' }}>
                &lt;
              </button>
              <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={handleNextMonth} style={{ padding: '4px 8px', color: 'var(--primary)', fontWeight: 'bold' }}>
                &gt;
              </button>
            </div>

            {/* Grid del Calendario */}
            <div className="pwa-card" style={{ padding: '16px' }}>
              {/* Cabeceras de días de la semana */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '12px',
                  color: 'var(--pwa-text-secondary)',
                  marginBottom: '10px',
                }}
              >
                <div>L</div>
                <div>M</div>
                <div>X</div>
                <div>J</div>
                <div>V</div>
                <div>S</div>
                <div>D</div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                {renderCalendar()}
              </div>
            </div>

            {/* Detalles del día seleccionado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--pwa-text-secondary)' }}>
                Detalle del {formatDateDMA(selectedCalendarDate)}
              </h3>

              {/* Detalles especiales (Festivos / Vacaciones) */}
              {(() => {
                const { holiday, vacation } = getSelectedDaySpecialDetails();
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {holiday && (
                      <div style={{ padding: '12px', backgroundColor: 'rgba(139, 92, 246, 0.12)', borderLeft: '4px solid #8b5cf6', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, textTransform: 'uppercase' }}>Festivo de la Empresa</span>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'white' }}>{holiday.name}</span>
                      </div>
                    )}
                    {vacation && (
                      <div style={{
                        padding: '12px',
                        backgroundColor: vacation.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                        borderLeft: vacation.status === 'APPROVED' ? '4px solid #22c55e' : '4px solid #f59e0b',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        <span style={{
                          fontSize: '11px',
                          color: vacation.status === 'APPROVED' ? '#4ade80' : '#fbbf24',
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          Vacaciones ({vacation.status === 'APPROVED' ? 'Aprobadas' : 'Pendientes'})
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '14px', color: 'white' }}>
                          Tipo: {translateType(vacation.type)} ({vacation.daysCount} {vacation.daysCount === 1 ? 'día' : 'días'})
                        </span>
                        {vacation.notes && <span style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)', fontStyle: 'italic' }}>"{vacation.notes}"</span>}
                      </div>
                    )}
                  </div>
                );
              })()}

              {getSelectedDayDetails().length === 0 ? (
                // Ocultar este banner vacío si ya mostramos que es festivo o vacaciones
                !getSelectedDaySpecialDetails().holiday && !getSelectedDaySpecialDetails().vacation && (
                  <div className="pwa-card" style={{ textAlign: 'center', padding: '24px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>
                      No hay registros de fichaje para este día.
                    </p>
                  </div>
                )
              ) : (
                getSelectedDayDetails().map((f) => (
                  <div key={f.id} className="pwa-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--pwa-border)', paddingBottom: '8px' }}>
                      <span style={{ fontWeight: 600 }}>Registro Diario</span>
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                        {formatShortTime(f.durationMs)}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '13px' }}>
                      <div>
                        <p style={{ color: 'var(--pwa-text-secondary)', fontSize: '11px' }}>Entrada</p>
                        <p style={{ fontWeight: 500 }}>
                          {new Date(f.entryTime).toLocaleTimeString('es-ES', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div>
                        <p style={{ color: 'var(--pwa-text-secondary)', fontSize: '11px' }}>Pausas</p>
                        <p style={{ fontWeight: 500 }}>
                          {Math.round(f.breakMs / (1000 * 60))} min
                        </p>
                      </div>
                      <div>
                        <p style={{ color: 'var(--pwa-text-secondary)', fontSize: '11px' }}>Salida</p>
                        <p style={{ fontWeight: 500 }}>
                          {f.exitTime
                            ? new Date(f.exitTime).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Pendiente'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* FORMULARIO DE SOLICITUD DE VACACIONES */}
            <div className="pwa-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--pwa-border)', paddingBottom: '8px' }}>
                <CalendarCheck size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Solicitar Tramo de Vacaciones</h3>
              </div>

              {vacSuccessMsg && (
                <div style={{ padding: '10px 12px', backgroundColor: 'rgba(34, 197, 94, 0.12)', borderLeft: '3px solid #22c55e', borderRadius: '6px', color: '#4ade80', fontSize: '13px' }}>
                  {vacSuccessMsg}
                </div>
              )}

              <form onSubmit={handleRequestVacation} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)' }}>Fecha de Inicio</label>
                    <input
                      type="date"
                      required
                      value={vacStart}
                      onChange={(e) => setVacStart(e.target.value)}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid var(--pwa-border)',
                        backgroundColor: 'var(--pwa-bg-tertiary)',
                        color: 'white',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)' }}>Fecha de Fin</label>
                    <input
                      type="date"
                      required
                      value={vacEnd}
                      onChange={(e) => setVacEnd(e.target.value)}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid var(--pwa-border)',
                        backgroundColor: 'var(--pwa-bg-tertiary)',
                        color: 'white',
                        fontSize: '13px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)' }}>Tipo de Días</label>
                  <select
                    value={vacType}
                    onChange={(e) => setVacType(e.target.value as any)}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--pwa-border)',
                      backgroundColor: 'var(--pwa-bg-tertiary)',
                      color: 'white',
                      fontSize: '13px',
                      width: '100%'
                    }}
                  >
                    <option value="NATURALES">Naturales (Calendario completo)</option>
                    <option value="LABORABLES">Laborables (Excluye sábados/domingos y festivos)</option>
                    <option value="CONVENIO">Días de Convenio (Excluye sábados/domingos y festivos)</option>
                  </select>
                </div>

                {vacDaysPreview > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--pwa-bg-tertiary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--pwa-border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)' }}>Días a consumir estimados:</span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary)' }}>{vacDaysPreview} {vacDaysPreview === 1 ? 'día' : 'días'}</span>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)' }}>Notas / Comentarios (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. Vacaciones de verano"
                    value={vacNotes}
                    onChange={(e) => setVacNotes(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid var(--pwa-border)',
                      backgroundColor: 'var(--pwa-bg-tertiary)',
                      color: 'white',
                      fontSize: '13px'
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={vacLoading || vacDaysPreview <= 0}
                  style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 16px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '4px'
                  }}
                >
                  {vacLoading ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
                  Enviar Solicitud
                </button>
              </form>
            </div>

            {/* HISTORIAL DE SOLICITUDES PERSONALES */}
            <div className="pwa-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600 }}>Mis Solicitudes</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {vacations.map((v) => (
                  <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--pwa-bg-secondary)', border: '1px solid var(--pwa-border)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        {formatDateDMA(new Date(v.startDate))} al {formatDateDMA(new Date(v.endDate))}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--pwa-text-secondary)' }}>
                        {translateType(v.type)} &bull; {v.daysCount} {v.daysCount === 1 ? 'día' : 'días'}
                      </span>
                      {v.notes && <span style={{ fontSize: '11px', color: 'var(--pwa-text-tertiary)', fontStyle: 'italic' }}>"{v.notes}"</span>}
                    </div>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        backgroundColor: v.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.12)' : v.status === 'PENDING' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                        color: v.status === 'APPROVED' ? '#4ade80' : v.status === 'PENDING' ? '#fbbf24' : '#f87171',
                        border: '1px solid currentColor'
                      }}
                    >
                      {v.status === 'APPROVED' ? 'Aprobado' : v.status === 'PENDING' ? 'Pendiente' : 'Rechazado'}
                    </span>
                  </div>
                ))}
                {vacations.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--pwa-text-secondary)', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>
                    No has solicitado vacaciones todavía.
                  </p>
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB 3: MÁS (PROFILE, OVERTIME, SETTINGS) */}
        {activeTab === 3 && (
          <>
            {/* Perfil del Empleado */}
            <div className="pwa-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '24px' }}>
              <div className="pwa-user-avatar" style={{ width: '72px', height: '72px', fontSize: '26px' }}>
                {user.name.charAt(0)}
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'var(--font-title)' }}>
                {user.name}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)', marginTop: '-8px' }}>
                {user.department}
              </p>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px', borderTop: '1px solid var(--pwa-border)', paddingTop: '16px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--pwa-text-secondary)' }}>Email</span>
                  <span style={{ fontWeight: 500 }}>{user.email}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--pwa-text-secondary)' }}>Teléfono</span>
                  <span style={{ fontWeight: 500 }}>{user.phone || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--pwa-text-secondary)' }}>Contrato</span>
                  <span style={{ fontWeight: 500, textTransform: 'capitalize' }}>
                    {user.contractType.toLowerCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Resumen del Mes */}
            <div className="pwa-card">
              <div className="pwa-card-title">
                <Award size={18} style={{ color: 'var(--primary)' }} />
                <span>Resumen mensual</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--pwa-text-secondary)' }}>Días trabajados</span>
                  <span style={{ fontWeight: 600 }}>{summary.daysWorked} de {summary.totalDaysInMonth} hábiles</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--pwa-text-secondary)' }}>Horas acumuladas</span>
                  <span style={{ fontWeight: 600 }}>{formatHoursDecimal(summary.hoursWorked)} / {summary.targetHours}:00</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--pwa-text-secondary)' }}>Balance</span>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{formatHoursDecimal(summary.extraHours)}</span>
                </div>
              </div>
            </div>

            {/* Horario Semanal */}
            <div className="pwa-card">
              <div className="pwa-card-title">
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                <span>Mi horario semanal</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                {(() => {
                  const schedule = user.weeklySchedule || {
                    '1': { enabled: true, start: '09:00', end: '18:00' },
                    '2': { enabled: true, start: '09:00', end: '18:00' },
                    '3': { enabled: true, start: '09:00', end: '18:00' },
                    '4': { enabled: true, start: '09:00', end: '18:00' },
                    '5': { enabled: true, start: '09:00', end: '18:00' },
                    '6': { enabled: false, start: '09:00', end: '18:00' },
                    '0': { enabled: false, start: '09:00', end: '18:00' },
                  };
                  const parsed = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
                  return Object.entries(parsed as Record<string, { enabled: boolean; start: string; end: string }>)
                    .sort(([a], [b]) => {
                      const order = ['1', '2', '3', '4', '5', '6', '0'];
                      return order.indexOf(a) - order.indexOf(b);
                    })
                    .map(([dayKey, dayData]) => {
                      const dayNames: Record<string, string> = {
                        '1': 'Lunes',
                        '2': 'Martes',
                        '3': 'Miércoles',
                        '4': 'Jueves',
                        '5': 'Viernes',
                        '6': 'Sábado',
                        '0': 'Domingo',
                      };
                      return (
                        <div key={dayKey} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '6px', borderBottom: '1px solid var(--pwa-border)', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 500, color: dayData.enabled ? 'var(--pwa-text-primary)' : 'var(--pwa-text-secondary)' }}>
                            {dayNames[dayKey]}
                          </span>
                          <span>
                            {dayData.enabled ? (
                              <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                {dayData.start} - {dayData.end}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--pwa-text-secondary)', fontStyle: 'italic' }}>
                                No laborable
                              </span>
                            )}
                          </span>
                        </div>
                      );
                    });
                })()}
              </div>
            </div>

            {/* Ajustes de la Aplicación */}
            <div className="pwa-card" style={{ padding: '10px 20px' }}>
              <div className="pwa-card-title" style={{ padding: '10px 0 6px', borderBottom: '1px solid var(--pwa-border)' }}>
                <span>Ajustes</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Bell size={18} />
                    <span>Notificaciones</span>
                  </div>
                  <input type="checkbox" defaultChecked style={{ width: '18px', height: '18px' }} />
                </div>

                <div 
                  onClick={handleToggleGps}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 0', 
                    borderBottom: '1px solid var(--pwa-border)', 
                    fontSize: '14px',
                    cursor: 'pointer' 
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MapPin size={18} style={{ color: gpsPermission === 'granted' ? 'var(--primary)' : 'var(--pwa-text-secondary)' }} />
                    <span>Permiso de ubicación (GPS)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      color: gpsPermission === 'granted' ? 'var(--success)' : 'var(--pwa-text-secondary)', 
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {gpsPermission === 'granted' ? 'Concedido' : gpsPermission === 'denied' ? 'Denegado' : 'Solicitar'}
                    </span>
                    <div style={{
                      width: '36px',
                      height: '20px',
                      backgroundColor: gpsPermission === 'granted' ? 'var(--primary)' : 'var(--pwa-bg-tertiary)',
                      borderRadius: '10px',
                      position: 'relative',
                      transition: 'all 0.2s ease',
                      border: '1px solid var(--pwa-border)'
                    }}>
                      <div style={{
                        width: '14px',
                        height: '14px',
                        backgroundColor: 'white',
                        borderRadius: '50%',
                        position: 'absolute',
                        top: '2px',
                        left: gpsPermission === 'granted' ? '18px' : '3px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                      }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Globe size={18} />
                    <span>Idioma</span>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>Español</span>
                </div>
                <a href="#" onClick={(e) => { e.preventDefault(); setCurrentLegalDoc('aviso'); }} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <BookOpen size={18} />
                    <span>Aviso legal</span>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--pwa-text-secondary)' }} />
                </a>

                <a href="#" onClick={(e) => { e.preventDefault(); setCurrentLegalDoc('privacidad'); }} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Shield size={18} />
                    <span>Política de privacidad</span>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--pwa-text-secondary)' }} />
                </a>

                <a href="#" onClick={(e) => { e.preventDefault(); setCurrentLegalDoc('cookies'); }} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <HelpCircle size={18} />
                    <span>Política de cookies</span>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--pwa-text-secondary)' }} />
                </a>

                <a href="#" onClick={(e) => { e.preventDefault(); setCurrentLegalDoc('terminos'); }} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <FileText size={18} />
                    <span>Términos de uso</span>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--pwa-text-secondary)' }} />
                </a>

                <a href="#" onClick={(e) => { e.preventDefault(); setCurrentLegalDoc('dpa'); }} style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <CheckCircle size={18} />
                    <span>DPA (Tratamiento de Datos)</span>
                  </div>
                  <ChevronRight size={16} style={{ marginLeft: 'auto', color: 'var(--pwa-text-secondary)' }} />
                </a>
              </div>
              <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--pwa-text-tertiary)', padding: '16px 0 8px' }}>
                Versión 1.0.0
              </p>
            </div>

            {/* Cerrar Sesión */}
            <form action={logoutAction}>
              <button type="submit" className="pwa-clock-btn clock-out">
                <LogOut size={18} />
                Cerrar Sesión
              </button>
            </form>
          </>
        )}
      </main>

      {/* BARRA DE NAVEGACIÓN INFERIOR */}
      <nav className="pwa-nav-bar">
        <button onClick={() => setActiveTab(0)} className={`pwa-nav-item ${activeTab === 0 ? 'active' : ''}`}>
          <Clock size={22} />
          <span>Mi jornada</span>
        </button>
        <button onClick={() => setActiveTab(1)} className={`pwa-nav-item ${activeTab === 1 ? 'active' : ''}`}>
          <FileText size={22} />
          <span>Mis fichajes</span>
        </button>
        <button onClick={() => setActiveTab(2)} className={`pwa-nav-item ${activeTab === 2 ? 'active' : ''}`}>
          <Calendar size={22} />
          <span>Calendario</span>
        </button>
        <button onClick={() => setActiveTab(3)} className={`pwa-nav-item ${activeTab === 3 ? 'active' : ''}`}>
          <Menu size={22} />
          <span>Más</span>
        </button>
      </nav>

      {/* MODAL PARA DOCUMENTOS LEGALES */}
      {currentLegalDoc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--pwa-bg-secondary)',
              border: '1px solid var(--pwa-border)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Cabecera Modal */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--pwa-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: 0 }}>
                {currentLegalDoc === 'aviso' && 'Aviso Legal'}
                {currentLegalDoc === 'privacidad' && 'Política de Privacidad'}
                {currentLegalDoc === 'cookies' && 'Política de Cookies'}
                {currentLegalDoc === 'terminos' && 'Términos de Uso'}
                {currentLegalDoc === 'dpa' && 'DPA (Anexo de Tratamiento de Datos - RGPD)'}
              </h3>
              <button
                onClick={() => setCurrentLegalDoc(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--pwa-text-secondary)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Contenido Modal */}
            <div
              style={{
                padding: '20px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--pwa-text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {currentLegalDoc === 'aviso' && (
                <>
                  <p><strong>1. Datos Identificativos:</strong> En cumplimiento del deber de información recogido en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSI-CE), se hace constar que el titular de la plataforma es la entidad titular de Fichaje App.</p>
                  <p><strong>2. Propiedad Intelectual:</strong> Todos los derechos de propiedad intelectual e industrial sobre el software, diseño, código fuente y contenidos de esta aplicación pertenecen a Fichaje App o a sus licenciantes. Queda prohibida su reproducción o distribución sin consentimiento previo.</p>
                  <p><strong>3. Condiciones de Uso:</strong> El usuario se compromete a hacer un uso adecuado de la aplicación de control horario, garantizando la veracidad de los datos aportados en el registro y en los marcajes de jornada.</p>
                </>
              )}

              {currentLegalDoc === 'privacidad' && (
                <>
                  <p><strong>1. Responsable del Tratamiento:</strong> La empresa contratante de Fichaje App actúa como Responsable del Tratamiento de los datos de sus empleados. Fichaje App actúa como Encargado del Tratamiento.</p>
                  <p><strong>2. Finalidad del Tratamiento:</strong> Los datos de geolocalización, registro de jornada, nombre y datos de contacto se tratarán exclusivamente para cumplir con la obligación legal de registro horario establecida en el Estatuto de los Trabajadores (art. 34.9).</p>
                  <p><strong>3. Derechos:</strong> Los trabajadores pueden ejercitar sus derechos de acceso, rectificación, supresión y limitación del tratamiento dirigiéndose al administrador de su respectiva empresa.</p>
                </>
              )}

              {currentLegalDoc === 'cookies' && (
                <>
                  <p><strong>Uso de Cookies:</strong> Esta aplicación utiliza únicamente cookies técnicas y de sesión que son estrictamente necesarias para el correcto funcionamiento del sistema de autenticación, mantener la sesión activa y asegurar la integridad de la plataforma.</p>
                  <p>No se utilizan cookies de seguimiento publicitario ni de análisis de terceros que requieran consentimiento explícito bajo la normativa vigente.</p>
                </>
              )}

              {currentLegalDoc === 'terminos' && (
                <>
                  <p><strong>1. Descripción del Servicio:</strong> Fichaje App es una plataforma SaaS de registro y control de jornada laboral orientada a cumplir con la normativa española de control horario.</p>
                  <p><strong>2. Suscripción y Licenciamiento:</strong> La plataforma ofrece un periodo de prueba gratuito de 15 días. Posteriormente, el acceso requiere una suscripción mensual o anual activa vinculada al número de empleados.</p>
                  <p><strong>3. Modificaciones del Servicio:</strong> Nos reservamos el derecho de modificar o actualizar las funcionalidades del software para adaptarlas a cambios legislativos o mejoras de rendimiento.</p>
                </>
              )}

              {currentLegalDoc === 'dpa' && (
                <>
                  <p><strong>DPA (Data Processing Agreement):</strong> Este anexo regula el tratamiento de datos de carácter personal en cumplimiento del Artículo 28 del Reglamento General de Protección de Datos (RGPD) y la LOPDGDD 3/2018.</p>
                  <p><strong>Obligaciones del Encargado (Fichaje App):</strong></p>
                  <ul>
                    <li>Tratar los datos personales únicamente siguiendo instrucciones documentadas del Responsable (la Empresa).</li>
                    <li>Garantizar que las personas autorizadas para tratar los datos se comprometen a respetar la confidencialidad.</li>
                    <li>Implementar las medidas técnicas y organizativas necesarias para garantizar un nivel de seguridad adecuado al riesgo.</li>
                    <li>Eliminar o devolver todos los datos personales una vez finalice la prestación de los servicios de tratamiento.</li>
                  </ul>
                </>
              )}
            </div>

            {/* Botón Aceptar/Cerrar */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--pwa-border)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentLegalDoc(null)}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE INSTRUCCIONES DE GPS */}
      {isGpsModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="pwa-card" style={{
            maxWidth: '450px',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '24px',
            backgroundColor: 'var(--pwa-bg-secondary)',
            border: '1px solid var(--pwa-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--pwa-border)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  {gpsModalMode === 'enable' ? 'Activar Permiso GPS' : 'Desactivar Permiso GPS'}
                </h3>
              </div>
              <button 
                onClick={() => setIsGpsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--pwa-text-secondary)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              {gpsModalMode === 'enable' 
                ? 'Para poder fichar en tu centro de trabajo, la aplicación requiere acceso a tu ubicación GPS. Sigue estas instrucciones para activarlo en tu dispositivo:'
                : 'Debido a las políticas de seguridad del navegador, las aplicaciones web no pueden revocar permisos de ubicación programáticamente. Debes desactivarlo desde los ajustes de tu teléfono:'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
              <div style={{ backgroundColor: 'var(--pwa-bg-tertiary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--pwa-border)' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>En Dispositivos iOS (iPhone)</p>
                <ol style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)', margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Abre la aplicación <strong>Ajustes</strong>.</li>
                  <li>Ve a <strong>Privacidad y seguridad &gt; Localización</strong>.</li>
                  <li>Selecciona tu navegador (ej. <strong>Safari</strong> o <strong>Chrome</strong>).</li>
                  <li>Cambia la opción a <strong>{gpsModalMode === 'enable' ? 'Cuando se use la app' : 'Nunca'}</strong>.</li>
                </ol>
              </div>

              <div style={{ backgroundColor: 'var(--pwa-bg-tertiary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--pwa-border)' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>En Dispositivos Android</p>
                <ol style={{ fontSize: '12px', color: 'var(--pwa-text-secondary)', margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <li>Abre los <strong>Ajustes / Configuración</strong> del teléfono.</li>
                  <li>Entra en <strong>Aplicaciones</strong> y selecciona tu navegador.</li>
                  <li>Ve a <strong>Permisos &gt; Ubicación</strong>.</li>
                  <li>Selecciona la opción <strong>{gpsModalMode === 'enable' ? 'Permitir solo si la app está en uso' : 'Denegar'}</strong>.</li>
                </ol>
              </div>
            </div>

            <button 
              onClick={() => setIsGpsModalOpen(false)}
              className="btn btn-primary"
              style={{ padding: '10px 16px', fontSize: '13px', fontWeight: 600, width: '100%', marginTop: '8px', cursor: 'pointer' }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
