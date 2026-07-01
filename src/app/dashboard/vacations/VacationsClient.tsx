'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Check,
  X,
  Plus,
  Loader2,
  Printer,
  CalendarCheck,
  User,
  Users,
  AlertCircle,
  FileText,
  Edit2,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { resolveVacation, assignVacationDirect, updateEmployeeAllocatedDays } from '@/app/actions/vacations';

interface Vacation {
  id: string;
  startDate: string;
  endDate: string;
  type: 'NATURALES' | 'LABORABLES' | 'CONVENIO';
  daysCount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    vacationDaysAllocated: number;
  };
  resolvedBy: { name: string } | null;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  vacationDaysAllocated: number;
}

interface VacationsClientProps {
  initialVacations: Vacation[];
  employees: Employee[];
  holidays: string[]; // Formato YYYY-MM-DD
}

export default function VacationsClient({ initialVacations, employees: initialEmployees, holidays }: VacationsClientProps) {
  const [vacations, setVacations] = useState<Vacation[]>(initialVacations);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [activeTab, setActiveTab] = useState<0 | 1 | 2 | 3>(0);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Estados para asignación directa (Tab 2)
  const [assignEmployeeId, setAssignEmployeeId] = useState(employees[0]?.id || '');
  const [assignStart, setAssignStart] = useState('');
  const [assignEnd, setAssignEnd] = useState('');
  const [assignType, setAssignType] = useState<'NATURALES' | 'LABORABLES' | 'CONVENIO'>('NATURALES');
  const [assignDays, setAssignDays] = useState(0);
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState('');

  // Estados para editar cupo anual (Tab 1)
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingDaysValue, setEditingDaysValue] = useState(30);
  const [editLoading, setEditLoading] = useState(false);

  // Estados para informe individual (Tab 1)
  const [selectedReportEmployeeId, setSelectedReportEmployeeId] = useState<string | null>(null);

  // Función de cálculo de días según el tipo
  const getDaysDifference = (startStr: string, endStr: string, type: 'NATURALES' | 'LABORABLES' | 'CONVENIO') => {
    if (!startStr || !endStr) return 0;
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (start > end) return 0;

    let count = 0;
    let curr = new Date(start);
    while (curr <= end) {
      if (type === 'NATURALES') {
        count++;
      } else {
        // LABORABLES o CONVENIO: Excluir fines de semana (0=Domingo, 6=Sábado)
        const dayOfWeek = curr.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // Excluir festivos de la empresa
        const dateISO = curr.toISOString().split('T')[0];
        const isHoliday = holidays.includes(dateISO);
        
        if (!isWeekend && !isHoliday) {
          count++;
        }
      }
      curr.setDate(curr.getDate() + 1);
    }
    return count;
  };

  // Calcular automáticamente los días al rellenar el formulario de asignación directa
  useEffect(() => {
    if (assignStart && assignEnd) {
      setAssignDays(getDaysDifference(assignStart, assignEnd, assignType));
    } else {
      setAssignDays(0);
    }
  }, [assignStart, assignEnd, assignType]);

  // Manejar Aprobación / Rechazo
  const handleResolve = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setActionLoadingId(id);
    try {
      const res = await resolveVacation(id, status);
      if (res.success) {
        setVacations(vacations.map((v) => (v.id === id ? { ...v, status, resolvedBy: { name: 'Tú' } } : v)));
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('Error al resolver la solicitud.');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Guardar asignación directa
  const handleAssignDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmployeeId || !assignStart || !assignEnd || assignDays <= 0) return;
    setAssignLoading(true);
    setAssignSuccess('');
    try {
      const res = await assignVacationDirect(assignEmployeeId, assignStart, assignEnd, assignType, assignDays, assignNotes);
      if (res.success) {
        setAssignSuccess('Vacaciones asignadas y aprobadas correctamente.');
        
        // Consultar de nuevo localmente o insertar
        const empObj = employees.find(e => e.id === assignEmployeeId);
        const newVacation: Vacation = {
          id: Math.random().toString(),
          startDate: new Date(`${assignStart}T00:00:00`).toISOString(),
          endDate: new Date(`${assignEnd}T23:59:59.999`).toISOString(),
          type: assignType,
          daysCount: assignDays,
          status: 'APPROVED',
          notes: assignNotes || 'Asignado directamente por RRHH',
          createdAt: new Date().toISOString(),
          user: {
            id: assignEmployeeId,
            name: empObj?.name || 'Empleado',
            email: empObj?.email || '',
            vacationDaysAllocated: empObj?.vacationDaysAllocated || 30
          },
          resolvedBy: { name: 'Administrador' }
        };
        setVacations([newHolidayToVacation(newVacation), ...vacations]);
        
        // Reset
        setAssignStart('');
        setAssignEnd('');
        setAssignNotes('');
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('Error al asignar las vacaciones.');
    } finally {
      setAssignLoading(false);
    }
  };

  const newHolidayToVacation = (v: Vacation): Vacation => v;

  // Actualizar cupo anual de días de vacaciones
  const handleUpdateAllocatedDays = async (employeeId: string) => {
    setEditLoading(true);
    try {
      const res = await updateEmployeeAllocatedDays(employeeId, editingDaysValue);
      if (res.success) {
        setEmployees(employees.map(e => e.id === employeeId ? { ...e, vacationDaysAllocated: editingDaysValue } : e));
        setVacations(vacations.map(v => v.user.id === employeeId ? { ...v, user: { ...v.user, vacationDaysAllocated: editingDaysValue } } : v));
        setEditingEmployeeId(null);
      } else {
        alert(res.message);
      }
    } catch (err) {
      alert('Error al actualizar el cupo.');
    } finally {
      setEditLoading(false);
    }
  };

  // Calcular métricas de un empleado
  const getEmployeeMetrics = (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    const empVacations = vacations.filter(v => v.user.id === employeeId);
    const approved = empVacations.filter(v => v.status === 'APPROVED').reduce((sum, v) => sum + v.daysCount, 0);
    const pending = empVacations.filter(v => v.status === 'PENDING').reduce((sum, v) => sum + v.daysCount, 0);
    const allocated = emp?.vacationDaysAllocated || 30;
    
    return {
      allocated,
      approved,
      pending,
      remaining: Math.max(0, allocated - approved)
    };
  };

  const pendingRequests = vacations.filter((v) => v.status === 'PENDING');
  const selectedReportEmployee = employees.find(e => e.id === selectedReportEmployeeId);
  const selectedReportVacations = vacations.filter(v => v.user.id === selectedReportEmployeeId);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'UTC'
    });
  };

  const translateType = (type: string) => {
    switch (type) {
      case 'NATURALES': return 'Naturales';
      case 'LABORABLES': return 'Laborables';
      case 'CONVENIO': return 'Días Convenio';
      default: return type;
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* CABECERA (NO SE IMPRIME) */}
      <div className="page-header no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Gestión de Vacaciones</h1>
          <p className="page-subtitle">Aprobación de tramos, asignación directa y consulta de informes imprimibles.</p>
        </div>
      </div>

      {/* PESTAÑAS DE NAVEGACIÓN (NO SE IMPRIMEN) */}
      <div className="no-print" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '16px' }}>
        <button
          onClick={() => { setActiveTab(0); setSelectedReportEmployeeId(null); }}
          style={{
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 0 && !selectedReportEmployeeId ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 0 && !selectedReportEmployeeId ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={16} />
          Solicitudes Pendientes
          {pendingRequests.length > 0 && (
            <span style={{ backgroundColor: 'var(--danger)', color: 'white', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: 700 }}>
              {pendingRequests.length}
            </span>
          )}
        </button>

        <button
          onClick={() => { setActiveTab(1); setSelectedReportEmployeeId(null); }}
          style={{
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 1 && !selectedReportEmployeeId ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 1 && !selectedReportEmployeeId ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          Resumen de Empleados
        </button>

        <button
          onClick={() => { setActiveTab(2); setSelectedReportEmployeeId(null); }}
          style={{
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 2 && !selectedReportEmployeeId ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 2 && !selectedReportEmployeeId ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={16} />
          Asignar Directamente
        </button>

        <button
          onClick={() => { setActiveTab(3); setSelectedReportEmployeeId(null); }}
          style={{
            padding: '12px 8px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeTab === 3 && !selectedReportEmployeeId ? 'var(--primary)' : 'var(--text-secondary)',
            borderBottom: activeTab === 3 && !selectedReportEmployeeId ? '2px solid var(--primary)' : '2px solid transparent',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CalendarCheck size={16} />
          Historial Completo
        </button>
      </div>

      {/* DETALLE DEL INFORME (IMPRIMIBLE) */}
      {selectedReportEmployeeId && selectedReportEmployee && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Botones de Cabecera del Informe (no-print) */}
          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={() => setSelectedReportEmployeeId(null)}
              className="btn btn-secondary"
              style={{ fontSize: '13px' }}
            >
              &larr; Volver al Listado
            </button>
            <button
              onClick={() => window.print()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
            >
              <Printer size={16} />
              Imprimir Informe
            </button>
          </div>

          {/* CUERPO DEL INFORME (SE IMPRIME) */}
          <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ borderBottom: '2px solid var(--primary)', paddingBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontFamily: 'var(--font-title)', fontWeight: 800 }}>
                  Informe de Control de Vacaciones
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Documento corporativo de tramos de vacaciones y días de descanso consumidos.
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Fichaje.click</span>
              </div>
            </div>

            {/* Ficha de Empleado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', padding: '16px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Empleado</p>
                <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>{selectedReportEmployee.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{selectedReportEmployee.email}</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Cupo de Días Asignado</p>
                <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--text-primary)' }}>{getEmployeeMetrics(selectedReportEmployeeId).allocated} días</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Días Consumidos</p>
                <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--success)' }}>{getEmployeeMetrics(selectedReportEmployeeId).approved} días</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Días Disponibles</p>
                <p style={{ fontWeight: 700, fontSize: '18px', color: 'var(--primary)' }}>{getEmployeeMetrics(selectedReportEmployeeId).remaining} días</p>
              </div>
            </div>

            {/* Listado de Tramos Solicitados / Aprobados */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Tramos de Vacaciones Registrados
              </h3>

              <div className="table-container" style={{ margin: 0 }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Fecha de Inicio</th>
                      <th>Fecha de Fin</th>
                      <th>Tipo</th>
                      <th>Días Solicitados</th>
                      <th>Estado</th>
                      <th>Comentarios / Notas</th>
                      <th>Resuelto por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReportVacations.map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{formatDate(v.startDate)}</td>
                        <td style={{ fontWeight: 600 }}>{formatDate(v.endDate)}</td>
                        <td>{translateType(v.type)}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{v.daysCount} días</td>
                        <td>
                          <span
                            className={`badge ${v.status === 'APPROVED' ? 'badge-success' : v.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}
                            style={{
                              backgroundColor: v.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.1)' : v.status === 'PENDING' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: v.status === 'APPROVED' ? '#15803d' : v.status === 'PENDING' ? '#d97706' : '#b91c1c',
                              border: '1px solid currentColor',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                          >
                            {v.status === 'APPROVED' ? 'Aprobado' : v.status === 'PENDING' ? 'Pendiente' : 'Rechazado'}
                          </span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {v.notes ? `"${v.notes}"` : '-'}
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {v.resolvedBy?.name || '-'}
                        </td>
                      </tr>
                    ))}
                    {selectedReportVacations.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          No hay tramos registrados para este empleado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Firma e Inspección Legal */}
            <div style={{ marginTop: '48px', display: 'flex', justifyContent: 'space-between', padding: '0 40px', fontSize: '12px' }}>
              <div style={{ textAlign: 'center', width: '200px', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                Firma del Empleado
              </div>
              <div style={{ textAlign: 'center', width: '200px', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                Firma de la Empresa / RRHH
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDOS DE LAS PESTAÑAS (NO SE IMPRIMEN) */}
      {!selectedReportEmployeeId && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* TAB 0: SOLICITUDES PENDIENTES */}
          {activeTab === 0 && (
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Clock size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Solicitudes Pendientes de Aprobación</h3>
              </div>

              {pendingRequests.length > 0 ? (
                <div className="table-container" style={{ margin: 0 }}>
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Fecha de Inicio</th>
                        <th>Fecha de Fin</th>
                        <th>Tipo de Día</th>
                        <th>Días Calculados</th>
                        <th>Notas / Justificación</th>
                        <th style={{ textAlign: 'right' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingRequests.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{v.user.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{v.user.email}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{formatDate(v.startDate)}</td>
                          <td style={{ fontWeight: 600 }}>{formatDate(v.endDate)}</td>
                          <td>
                            <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
                              {translateType(v.type)}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{v.daysCount} días</td>
                          <td style={{ maxWidth: '240px', fontSize: '13px', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                            {v.notes ? `"${v.notes}"` : '-'}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={() => handleResolve(v.id, 'APPROVED')}
                                disabled={actionLoadingId === v.id}
                                className="btn btn-secondary"
                                style={{
                                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                                  color: '#16a34a',
                                  borderColor: 'rgba(34, 197, 94, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 12px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                }}
                              >
                                {actionLoadingId === v.id ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                                Aprobar
                              </button>

                              <button
                                onClick={() => handleResolve(v.id, 'REJECTED')}
                                disabled={actionLoadingId === v.id}
                                className="btn btn-secondary"
                                style={{
                                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  borderColor: 'rgba(239, 68, 68, 0.2)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '6px 12px',
                                  fontSize: '13px',
                                  fontWeight: 500,
                                }}
                              >
                                {actionLoadingId === v.id ? <Loader2 className="animate-spin" size={14} /> : <X size={14} />}
                                Rechazar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                  <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '50%', color: 'var(--success)' }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <p style={{ fontWeight: 600, margin: 0 }}>¡Todo al día!</p>
                  <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', margin: 0 }}>
                    No hay solicitudes de vacaciones pendientes de aprobación en este momento.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: RESUMEN DE EMPLEADOS */}
          {activeTab === 1 && (
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Users size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Saldo de Vacaciones de los Empleados</h3>
              </div>

              <div className="table-container" style={{ margin: 0 }}>
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Empleado</th>
                      <th>Cupo Asignado (Anual)</th>
                      <th>Aprobadas (Consumido)</th>
                      <th>Pendiente Aprobación</th>
                      <th>Disponible</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => {
                      const metrics = getEmployeeMetrics(emp.id);
                      const isEditing = editingEmployeeId === emp.id;
                      return (
                        <tr key={emp.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{emp.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{emp.email}</span>
                            </div>
                          </td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input
                                  type="number"
                                  className="form-input"
                                  value={editingDaysValue}
                                  onChange={(e) => setEditingDaysValue(parseInt(e.target.value) || 0)}
                                  style={{ width: '70px', padding: '6px' }}
                                />
                                <button
                                  onClick={() => handleUpdateAllocatedDays(emp.id)}
                                  disabled={editLoading}
                                  className="btn btn-primary"
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                >
                                  {editLoading ? <Loader2 className="animate-spin" size={12} /> : 'Guardar'}
                                </button>
                                <button
                                  onClick={() => setEditingEmployeeId(null)}
                                  className="btn btn-secondary"
                                  style={{ padding: '6px 10px', fontSize: '12px' }}
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 600 }}>{metrics.allocated} días</span>
                                <button
                                  onClick={() => {
                                    setEditingEmployeeId(emp.id);
                                    setEditingDaysValue(metrics.allocated);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }}
                                  title="Editar cupo anual"
                                >
                                  <Edit2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--success)' }}>{metrics.approved} días</td>
                          <td style={{ fontWeight: 600, color: 'var(--warning)' }}>{metrics.pending} días</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{metrics.remaining} días</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedReportEmployeeId(emp.id)}
                              className="btn btn-secondary"
                              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '6px 12px', marginLeft: 'auto' }}
                            >
                              <Printer size={14} />
                              Ver Informe / Imprimir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ASIGNAR DIRECTAMENTE */}
          {activeTab === 2 && (
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <Plus size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Asignar Tramo de Vacaciones a Empleado</h3>
              </div>

              {assignSuccess && (
                <div className="pwa-geo-status in-range" style={{ margin: 0, backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#15803d', borderLeft: '4px solid #22c55e' }}>
                  <span>{assignSuccess}</span>
                </div>
              )}

              <form onSubmit={handleAssignDirect} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Seleccionar Empleado *</label>
                  <select
                    className="form-select"
                    value={assignEmployeeId}
                    onChange={(e) => setAssignEmployeeId(e.target.value)}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label">Fecha de Inicio *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={assignStart}
                      onChange={(e) => setAssignStart(e.target.value)}
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label">Fecha de Fin *</label>
                    <input
                      type="date"
                      required
                      className="form-input"
                      value={assignEnd}
                      onChange={(e) => setAssignEnd(e.target.value)}
                      style={{ padding: '8px 12px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Tipo de Vacaciones *</label>
                  <select
                    className="form-select"
                    value={assignType}
                    onChange={(e) => setAssignType(e.target.value as any)}
                    style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}
                  >
                    <option value="NATURALES">Naturales (Cuenta fines de semana)</option>
                    <option value="LABORABLES">Laborables (Excluye fines de semana y festivos)</option>
                    <option value="CONVENIO">Días de Convenio (Excluye fines de semana y festivos)</option>
                  </select>
                </div>

                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Días consumidos calculados:</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Se calculan automáticamente según el tipo y los festivos registrados.</p>
                  </div>
                  <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-title)' }}>
                    {assignDays} {assignDays === 1 ? 'día' : 'días'}
                  </span>
                </div>

                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label className="form-label">Notas / Justificación (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej. Vacaciones de verano aprobadas"
                    className="form-input"
                    value={assignNotes}
                    onChange={(e) => setAssignNotes(e.target.value)}
                    style={{ padding: '8px 12px' }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={assignLoading || assignDays <= 0}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', alignSelf: 'flex-start', cursor: 'pointer' }}
                >
                  {assignLoading ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  Asignar y Aprobar Tramo
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: HISTORIAL COMPLETO */}
          {activeTab === 3 && (
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <CalendarCheck size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Historial General de Vacaciones</h3>
              </div>

              {vacations.length > 0 ? (
                <div className="table-container" style={{ margin: 0 }}>
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Empleado</th>
                        <th>Inicio</th>
                        <th>Fin</th>
                        <th>Tipo</th>
                        <th>Días</th>
                        <th>Estado</th>
                        <th>Comentarios</th>
                        <th>Resuelto por</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vacations.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{v.user.name}</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{v.user.email}</span>
                            </div>
                          </td>
                          <td style={{ fontWeight: 600 }}>{formatDate(v.startDate)}</td>
                          <td style={{ fontWeight: 600 }}>{formatDate(v.endDate)}</td>
                          <td>{translateType(v.type)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{v.daysCount} días</td>
                          <td>
                            <span
                              className={`badge ${v.status === 'APPROVED' ? 'badge-success' : v.status === 'PENDING' ? 'badge-warning' : 'badge-danger'}`}
                              style={{
                                backgroundColor: v.status === 'APPROVED' ? 'rgba(34, 197, 94, 0.1)' : v.status === 'PENDING' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: v.status === 'APPROVED' ? '#15803d' : v.status === 'PENDING' ? '#d97706' : '#b91c1c',
                                border: '1px solid currentColor',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 700
                              }}
                            >
                              {v.status === 'APPROVED' ? 'Aprobado' : v.status === 'PENDING' ? 'Pendiente' : 'Rechazado'}
                            </span>
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {v.notes ? `"${v.notes}"` : '-'}
                          </td>
                          <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {v.resolvedBy?.name || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                  No se han registrado solicitudes ni tramos de vacaciones en la empresa.
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
