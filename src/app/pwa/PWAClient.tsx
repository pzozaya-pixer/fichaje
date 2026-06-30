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
  BookOpen
} from 'lucide-react';

interface PWAClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    role: string;
    contractType: string;
    department: string;
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
}

export default function PWAClient({
  user,
  initialTodayStatus,
  initialFichajes,
  initialSummary,
}: PWAClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(0);
  const [todayStatus, setTodayStatus] = useState(initialTodayStatus);
  const [fichajes, setFichajes] = useState(initialFichajes);
  const [summary, setSummary] = useState(initialSummary);
  const [currentLegalDoc, setCurrentLegalDoc] = useState<string | null>(null);

  // Estados de Geolocalización
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState('');
  const [distance, setDistance] = useState<number | null>(null);
  const [isWithinGeofence, setIsWithinGeofence] = useState(false);
  const [checkingGps, setCheckingGps] = useState(false);

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

    navigator.geolocation.getCurrentPosition(
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
          setGpsError('Permiso de GPS denegado. Actívalo en los ajustes del navegador.');
        } else {
          setGpsError('No se pudo obtener la señal GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
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

    navigator.geolocation.getCurrentPosition(
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
        } else {
          setActionMessage({ type: 'error', text: 'No se pudo obtener la ubicación GPS para fichar.' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
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

    navigator.geolocation.getCurrentPosition(
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
        } else {
          setActionMessage({ type: 'error', text: 'No se pudo obtener la ubicación GPS para registrar la salida.' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
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

    navigator.geolocation.getCurrentPosition(
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
        } else {
          setActionMessage({ type: 'error', text: 'No se pudo obtener la ubicación GPS para la pausa.' });
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
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
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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
      
      // Comprobar si hay fichajes este día
      const hasClockInThisDay = fichajes.some(
        (f) => new Date(f.entryTime).toLocaleDateString('es-ES') === dateStr
      );

      const isSelected = selectedCalendarDate.toLocaleDateString('es-ES') === dateStr;
      const isToday = new Date().toLocaleDateString('es-ES') === dateStr;

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
            fontWeight: isSelected || isToday ? '700' : '400',
            backgroundColor: isSelected
              ? 'var(--primary)'
              : isToday
              ? 'var(--pwa-bg-tertiary)'
              : 'transparent',
            color: isSelected ? 'white' : 'var(--pwa-text-primary)',
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
              <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>
                {formatDateDMA(new Date())}
              </p>
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
                <p style={{ fontSize: '11px', color: 'var(--pwa-text-secondary)' }}>Horas extra</p>
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

        {/* TAB 2: CALENDARIO */}
        {activeTab === 2 && (
          <>
            <h2 style={{ fontSize: '24px', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
              Calendario
            </h2>

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

              {getSelectedDayDetails().length === 0 ? (
                <div className="pwa-card" style={{ textAlign: 'center', padding: '24px' }}>
                  <p style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)' }}>
                    No hay registros de fichaje para este día.
                  </p>
                </div>
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
                  <span style={{ color: 'var(--pwa-text-secondary)' }}>Horas extra</span>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{formatHoursDecimal(summary.extraHours)}</span>
                </div>
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

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--pwa-border)', fontSize: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <MapPin size={18} />
                    <span>Permiso de ubicación (GPS)</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 'bold' }}>Concedido</span>
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
    </div>
  );
}
