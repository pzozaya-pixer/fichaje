'use client';

import React, { useState } from 'react';
import {
  Clock,
  Users,
  Calendar,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Download,
  AlertCircle,
  AlertTriangle
} from 'lucide-react';

interface DashboardClientProps {
  initialData: {
    totalWorkedHours: number;
    workedHoursProgress: number;
    totalOvertimeHours: number;
    overtimeProgress: number;
    activeEmployees: number;
    daysWorked: number;
    chartData: Array<{ day: string; hours: number }>;
  };
  employees: Array<{ id: string; name: string; email: string }>;
  subscription: {
    status: string;
    trialEndsAt: string;
    stripeSubscriptionId?: string;
  };
  companyCreatedAt: string;
}

export default function DashboardClient({ 
  initialData, 
  employees,
  subscription,
  companyCreatedAt
}: DashboardClientProps) {
  const [data, setData] = useState(initialData);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(employees[0]?.id || '');
  
  // Rango de fechas para los informes rápidos (por defecto, mes actual)
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
  
  const [reportStart, setReportStart] = useState(firstDay);
  const [reportEnd, setReportEnd] = useState(lastDay);

  // --- CÁLCULO DE COORDENADAS PARA EL GRÁFICO SVG ---
  const chartWidth = 600;
  const chartHeight = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const points = data.chartData;
  const maxHours = Math.max(...points.map((p) => p.hours), 8) + 2;

  const getCoordinates = () => {
    if (points.length === 0) return [];
    
    const usableWidth = chartWidth - paddingLeft - paddingRight;
    const usableHeight = chartHeight - paddingTop - paddingBottom;

    return points.map((p, i) => {
      const x = paddingLeft + (i * usableWidth) / Math.max(1, points.length - 1);
      const y = chartHeight - paddingBottom - (p.hours * usableHeight) / maxHours;
      return { x, y, label: p.day, value: p.hours };
    });
  };

  const coordsList = getCoordinates();
  
  // Construir el path de la línea
  const linePath = coordsList.reduce((path, point, i) => {
    return i === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`;
  }, '');

  // Construir el path del área rellena (con gradiente)
  const areaPath = coordsList.length > 0
    ? `${linePath} L ${coordsList[coordsList.length - 1].x} ${chartHeight - paddingBottom} L ${coordsList[0].x} ${chartHeight - paddingBottom} Z`
    : '';

  const isTrialActive = new Date(subscription.trialEndsAt) > new Date();
  const trialDaysRemaining = Math.max(
    0,
    Math.ceil((new Date(subscription.trialEndsAt).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
  );

  const hasActiveSubscription =
    !!subscription.stripeSubscriptionId ||
    subscription.status === 'active' ||
    subscription.status === 'past_due';

  const companyRegDate = new Date(companyCreatedAt).toLocaleDateString('es-ES', {
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
      {/* PÁGINA CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Inicio</h1>
          <p className="page-subtitle">Panel de control de jornada laboral y estadísticas generales.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {isTrialActive ? (
            <span className="badge badge-warning" style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} />
              Periodo de prueba: {trialDaysRemaining} {trialDaysRemaining === 1 ? 'día restante' : 'días restantes'} libre de pago
            </span>
          ) : hasActiveSubscription ? (
            <span className="badge badge-success" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Suscripción Activa
            </span>
          ) : (
            <span className="badge badge-danger" style={{ padding: '8px 16px', fontSize: '13px' }}>
              Suscripción Expirada
            </span>
          )}
        </div>
      </div>

      {/* AVISO DE VENCIMIENTO DEL TRIAL (Inicio) */}
      {isTrialActive && trialDaysRemaining <= 3 && (
        <div 
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            padding: '16px', 
            backgroundColor: 'rgba(239, 68, 68, 0.08)', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
            <AlertTriangle size={18} />
            <span style={{ fontSize: '14px', fontWeight: 700 }}>¡Atención! Tu periodo de prueba gratuito finaliza en {trialDaysRemaining} {trialDaysRemaining === 1 ? 'día' : 'días'}</span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            Tu periodo de prueba libre de pago finaliza el **{trialEndDate}** (alta registrada el {companyRegDate}). Si tienes una suscripción activa y deseas evitar cargos automáticos, debes darla de baja antes de esta fecha.
          </p>
          {hasActiveSubscription ? (
            <a 
              href="/dashboard/config#planes" 
              style={{ 
                fontSize: '13px', 
                color: 'var(--danger)', 
                fontWeight: 600, 
                textDecoration: 'underline',
                alignSelf: 'flex-start'
              }}
            >
              Gestionar o dar de baja la suscripción en Configuración &rarr;
            </a>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
              No tienes ninguna suscripción activa contratada. Tu periodo de prueba finalizará y la cuenta se pausará automáticamente sin realizar ningún cargo. Si deseas continuar usando el servicio de forma ilimitada, puedes contratar un plan en <a href="/dashboard/config#planes" style={{ textDecoration: 'underline', color: 'var(--primary)' }}>Configuración</a>.
            </p>
          )}
        </div>
      )}

      {/* TARJETAS DE MÉTRICAS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
        
        {/* Horas Trabajadas */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Horas trabajadas</span>
            <Clock size={20} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
              {data.totalWorkedHours}h
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>este mes</span>
          </div>
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Progreso del objetivo</span>
              <span>{data.workedHoursProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${data.workedHoursProgress}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '3px' }}></div>
            </div>
          </div>
        </div>

        {/* Horas Extra */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Horas extra</span>
            <TrendingUp size={20} style={{ color: 'var(--warning)' }} />
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-title)', color: 'var(--warning)' }}>
              {data.totalOvertimeHours}h
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>este mes</span>
          </div>
          <div style={{ marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              <span>Límite mensual</span>
              <span>{data.overtimeProgress}%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${data.overtimeProgress}%`, height: '100%', backgroundColor: 'var(--warning)', borderRadius: '3px' }}></div>
            </div>
          </div>
        </div>

        {/* Empleados Activos */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Empleados activos</span>
            <Users size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
              {data.activeEmployees}
            </span>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Fichando en múltiples centros
            </p>
          </div>
        </div>

        {/* Fichajes Realizados */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>Días trabajados</span>
            <Calendar size={20} style={{ color: 'var(--success)' }} />
          </div>
          <div>
            <span style={{ fontSize: '28px', fontWeight: 800, fontFamily: 'var(--font-title)' }}>
              {data.daysWorked}
            </span>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Fichajes totales registrados
            </p>
          </div>
        </div>

      </div>

      {/* GRÁFICO DE HORAS TRABAJADAS (SVG PREMIUM) */}
      <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
          Gráfico de horas trabajadas (Diario)
        </h3>
        
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', minWidth: '550px', height: 'auto' }}>
            <defs>
              {/* Gradiente para el área */}
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.00" />
              </linearGradient>
            </defs>

            {/* Líneas de Guía Horizontal (Y Axis Grid) */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const usableHeight = chartHeight - paddingTop - paddingBottom;
              const y = chartHeight - paddingBottom - ratio * usableHeight;
              const val = Math.round(ratio * maxHours);
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={chartWidth - paddingRight}
                    y2={y}
                    stroke="var(--border-light)"
                    strokeWidth="1"
                    strokeDasharray="4"
                  />
                  <text
                    x={paddingLeft - 10}
                    y={y + 4}
                    fill="var(--text-secondary)"
                    fontSize="10"
                    textAnchor="end"
                  >
                    {val}h
                  </text>
                </g>
              );
            })}

            {/* Área Rellena */}
            {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}

            {/* Línea del Gráfico */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Puntos y Etiquetas */}
            {coordsList.map((pt, i) => (
              <g key={i} className="chart-point-group">
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="4"
                  fill="white"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                />
                {/* Etiqueta del día en el eje X */}
                {i % 2 === 0 && (
                  <text
                    x={pt.x}
                    y={chartHeight - 10}
                    fill="var(--text-secondary)"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* INFORMES DISPONIBLES */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        
        {/* Exportador a Excel */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: 'var(--success)' }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
                Exportar registro a Excel
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Genera un libro XLSX con el registro de jornada consolidado.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
            <div className="form-group">
              <label className="form-label">Fecha Inicio</label>
              <input
                type="date"
                className="form-input"
                value={reportStart}
                onChange={(e) => setReportStart(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Fecha Fin</label>
              <input
                type="date"
                className="form-input"
                value={reportEnd}
                onChange={(e) => setReportEnd(e.target.value)}
              />
            </div>
          </div>

          <a
            href={`/fichaje/api/export/excel?startDate=${reportStart}&endDate=${reportEnd}`}
            download
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'auto' }}
          >
            <Download size={18} />
            Descargar Excel personalizado
          </a>
        </div>

        {/* Generador de PDF Individual */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: 'var(--danger)' }}>
              <FileText size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
                Fichajes por empleado (PDF)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Genera el documento legal firmado para inspección.
              </p>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '8px' }}>
            <label className="form-label">Seleccionar Empleado</label>
            <select
              className="form-select"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
              style={{ width: '100%' }}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <a
            href={`/fichaje/api/export/pdf?userId=${selectedEmployeeId}&startDate=${reportStart}&endDate=${reportEnd}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <FileText size={18} />
            Generar PDF legal
          </a>
        </div>

      </div>
    </>
  );
}
