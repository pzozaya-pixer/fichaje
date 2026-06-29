'use client';

import React, { useState } from 'react';
import { manualClockIn, saveClockInEdit } from '@/app/actions/admin';
import {
  Calendar,
  Search,
  Filter,
  FileSpreadsheet,
  Plus,
  Edit2,
  X,
  Loader2,
  History,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface AuditLog {
  id: string;
  changeDate: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  reason: string;
  editedByName: string;
}

interface ClockInRecord {
  id: string;
  userId: string;
  employeeName: string;
  employeeEmail: string;
  departmentName: string;
  workCenterName: string;
  entryTime: string;
  exitTime: string | null;
  breaks: any[];
  durationMs: number;
  breakMs: number;
  isManual: boolean;
  status: string;
  auditLogs: AuditLog[];
}

interface FichajesClientProps {
  initialClockIns: ClockInRecord[];
  employees: Array<{ id: string; name: string; email: string }>;
  departments: Array<{ id: string; name: string }>;
  workCenters: Array<{ id: string; name: string }>;
}

export default function FichajesClient({
  initialClockIns,
  employees,
  departments,
  workCenters,
}: FichajesClientProps) {
  const [clockIns, setClockIns] = useState<ClockInRecord[]>(initialClockIns);
  
  // Estados de filtros
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [departmentId, setDepartmentId] = useState('all');
  const [workCenterId, setWorkCenterId] = useState('all');
  const [search, setSearch] = useState('');

  // Expandir registros de auditoría
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Modales
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Formulario de Fichaje Manual
  const [manualUserId, setManualUserId] = useState(employees[0]?.id || '');
  const [manualEntryTime, setManualEntryTime] = useState('');
  const [manualExitTime, setManualExitTime] = useState('');
  const [manualReason, setManualReason] = useState('');

  // Formulario de Edición
  const [editingRecord, setEditingRecord] = useState<ClockInRecord | null>(null);
  const [editEntryTime, setEditEntryTime] = useState('');
  const [editExitTime, setEditExitTime] = useState('');
  const [editReason, setEditReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Formateadores auxiliares
  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  // Abrir modal de fichaje manual
  const openManualModal = () => {
    setManualUserId(employees[0]?.id || '');
    // Poner por defecto la fecha y hora de hoy
    const now = new Date();
    const offset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - offset).toISOString().slice(0, 16);
    
    setManualEntryTime(localISOTime);
    setManualExitTime('');
    setManualReason('');
    setError('');
    setIsManualModalOpen(true);
  };

  // Abrir modal de edición
  const openEditModal = (record: ClockInRecord) => {
    setEditingRecord(record);
    
    // Convertir ISO a formato datetime-local compatible (YYYY-MM-DDThh:mm)
    const entryDate = new Date(record.entryTime);
    const entryLocal = new Date(entryDate.getTime() - entryDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    let exitLocal = '';
    if (record.exitTime) {
      const exitDate = new Date(record.exitTime);
      exitLocal = new Date(exitDate.getTime() - exitDate.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }

    setEditEntryTime(entryLocal);
    setEditExitTime(exitLocal);
    setEditReason('');
    setError('');
    setIsEditModalOpen(true);
  };

  // Enviar Fichaje Manual
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUserId || !manualEntryTime || !manualReason) {
      setError('Empleado, Entrada y Motivo son campos obligatorios.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await manualClockIn({
        userId: manualUserId,
        entryTime: new Date(manualEntryTime).toISOString(),
        exitTime: manualExitTime ? new Date(manualExitTime).toISOString() : null,
        reason: manualReason,
      });

      if (res.success) {
        window.location.reload();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Error al guardar el fichaje manual.');
    } finally {
      setLoading(false);
    }
  };

  // Enviar Edición
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || !editEntryTime || !editReason) {
      setError('Entrada y Motivo son obligatorios.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await saveClockInEdit(
        editingRecord.id,
        {
          entryTime: new Date(editEntryTime).toISOString(),
          exitTime: editExitTime ? new Date(editExitTime).toISOString() : null,
          breaks: editingRecord.breaks, // Mantenemos las pausas intactas en esta pantalla simple
        },
        editReason
      );

      if (res.success) {
        window.location.reload();
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Error al actualizar el fichaje.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrado de Fichajes
  const filteredClockIns = clockIns.filter((c) => {
    // Filtro por búsqueda de nombre
    if (search && !c.employeeName.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    // Filtro por departamento
    if (departmentId !== 'all' && c.departmentName !== departments.find((d) => d.id === departmentId)?.name) {
      return false;
    }
    // Filtro por centro de trabajo
    if (workCenterId !== 'all' && c.workCenterName !== workCenters.find((w) => w.id === workCenterId)?.name) {
      return false;
    }
    // Filtro por fechas
    const entryDateObj = new Date(c.entryTime);
    if (startDate && entryDateObj < new Date(startDate)) {
      return false;
    }
    if (endDate) {
      const endLimit = new Date(endDate);
      endLimit.setHours(23, 59, 59, 999);
      if (entryDateObj > endLimit) {
        return false;
      }
    }
    return true;
  });

  return (
    <>
      {/* CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fichajes</h1>
          <p className="page-subtitle">Visualiza, audita y gestiona el registro de jornada diaria de tus empleados.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={openManualModal} className="btn btn-secondary">
            <Plus size={18} />
            Fichar por empleado
          </button>
          <a
            href={`/api/export/excel?startDate=${startDate}&endDate=${endDate}&departmentId=${departmentId}&workCenterId=${workCenterId}&search=${search}`}
            className="btn btn-primary"
          >
            <FileSpreadsheet size={18} />
            Exportar Excel
          </a>
        </div>
      </div>

      {/* BARRA DE FILTROS */}
      <div className="premium-card" style={{ padding: '20px 24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
        
        <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
          <label className="form-label">Buscar Empleado</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px', paddingTop: '8px', paddingBottom: '8px' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0, width: '150px' }}>
          <label className="form-label">Fecha Inicio</label>
          <input
            type="date"
            className="form-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, width: '150px' }}>
          <label className="form-label">Fecha Fin</label>
          <input
            type="date"
            className="form-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ paddingTop: '8px', paddingBottom: '8px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0, width: '180px' }}>
          <label className="form-label">Departamento</label>
          <select
            className="form-select"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            style={{ width: '100%', paddingTop: '8px', paddingBottom: '8px' }}
          >
            <option value="all">Todos</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0, width: '180px' }}>
          <label className="form-label">Centro de Trabajo</label>
          <select
            className="form-select"
            value={workCenterId}
            onChange={(e) => setWorkCenterId(e.target.value)}
            style={{ width: '100%', paddingTop: '8px', paddingBottom: '8px' }}
          >
            <option value="all">Todos</option>
            {workCenters.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

      </div>

      {/* TABLA DE FICHAJES */}
      <div className="table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Departamento</th>
              <th>Centro</th>
              <th>Fecha</th>
              <th>Entrada</th>
              <th>Salida</th>
              <th>Pausas</th>
              <th>Horas Netas</th>
              <th>Tipo</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredClockIns.map((c) => (
              <React.Fragment key={c.id}>
                <tr>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{c.employeeName}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.employeeEmail}</span>
                    </div>
                  </td>
                  <td>{c.departmentName}</td>
                  <td>{c.workCenterName}</td>
                  <td>{formatDate(c.entryTime)}</td>
                  <td>
                    <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                      {formatTime(c.entryTime)}
                    </span>
                  </td>
                  <td>
                    {c.exitTime ? (
                      <span style={{ fontWeight: 500 }}>{formatTime(c.exitTime)}</span>
                    ) : (
                      <span className="badge badge-warning">En curso</span>
                    )}
                  </td>
                  <td>{Math.round(c.breakMs / (1000 * 60))} min</td>
                  <td style={{ fontWeight: 700 }}>{formatDuration(c.durationMs)}</td>
                  <td>
                    <span className={`badge ${c.isManual ? 'badge-warning' : 'badge-info'}`}>
                      {c.isManual ? 'Manual' : 'GPS'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      {c.auditLogs.length > 0 && (
                        <button
                          onClick={() => setExpandedRowId(expandedRowId === c.id ? null : c.id)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', color: 'var(--accent)' }}
                          title="Ver historial de auditoría"
                        >
                          <History size={14} />
                        </button>
                      )}
                      <button onClick={() => openEditModal(c)} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                        <Edit2 size={14} />
                        Editar
                      </button>
                    </div>
                  </td>
                </tr>

                {/* HISTORIAL DE AUDITORÍA EXPANDIBLE */}
                {expandedRowId === c.id && c.auditLogs.length > 0 && (
                  <tr>
                    <td colSpan={10} style={{ backgroundColor: 'var(--bg-primary)', padding: '16px 24px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <History size={16} />
                          Historial de Modificaciones (Auditoría Legal)
                        </h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {c.auditLogs.map((log) => (
                            <div key={log.id} style={{ fontSize: '12px', padding: '10px 14px', backgroundColor: 'white', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                                Modificado por <strong>{log.editedByName}</strong> el{' '}
                                {new Date(log.changeDate).toLocaleString('es-ES')}
                              </p>
                              <p style={{ margin: '4px 0 0', fontWeight: 500 }}>
                                Campo: <code style={{ backgroundColor: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>{log.fieldName}</code> | 
                                Valor anterior: <span style={{ textDecoration: 'line-through', color: 'var(--danger)' }}>{log.oldValue}</span> | 
                                Nuevo valor: <span style={{ color: 'var(--success)' }}>{log.newValue}</span>
                              </p>
                              <p style={{ margin: '6px 0 0', color: 'var(--text-primary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <AlertCircle size={14} style={{ color: 'var(--warning)' }} />
                                Justificación: {log.reason}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}

            {filteredClockIns.length === 0 && (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  No se encontraron registros de fichaje.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL FICHAJE MANUAL */}
      {isManualModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="premium-card" style={{ maxWidth: '480px', width: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
                Fichaje Manual por el Administrador
              </h3>
              <button onClick={() => setIsManualModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Seleccionar Empleado</label>
                <select className="form-select" value={manualUserId} onChange={(e) => setManualUserId(e.target.value)}>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Fecha y Hora Entrada</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    required
                    value={manualEntryTime}
                    onChange={(e) => setManualEntryTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha y Hora Salida (Opcional)</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={manualExitTime}
                    onChange={(e) => setManualExitTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Justificación del Fichaje Manual (Requerido por Ley)</label>
                <textarea
                  className="form-input"
                  required
                  rows={3}
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Ej. Olvido de teléfono por parte del empleado / Fallo de cobertura GPS..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsManualModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Fichar Entrada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR FICHAJE */}
      {isEditModalOpen && editingRecord && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="premium-card" style={{ maxWidth: '480px', width: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
                Editar Registro de Jornada
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '14px', color: 'var(--text-secondary)', padding: '10px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                <p>Empleado: <strong>{editingRecord.employeeName}</strong></p>
                <p>Fecha Original: <strong>{formatDate(editingRecord.entryTime)}</strong></p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Nueva Entrada</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    required
                    value={editEntryTime}
                    onChange={(e) => setEditEntryTime(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Nueva Salida (Opcional)</label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={editExitTime}
                    onChange={(e) => setEditExitTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Motivo de la Modificación (Requerido por Ley)</label>
                <textarea
                  className="form-input"
                  required
                  rows={3}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Ej. Corrección por error de fichaje del empleado al salir de pausa..."
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
