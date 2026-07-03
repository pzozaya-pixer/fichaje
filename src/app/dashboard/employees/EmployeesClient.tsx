'use client';

import React, { useState } from 'react';
import { saveEmployee } from '@/app/actions/admin';
import { Plus, Search, Edit2, X, Loader2, ShieldCheck, UserCheck } from 'lucide-react';
import { Role, ContractType } from '@prisma/client';

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  contractType: ContractType;
  isActive: boolean;
  departmentId: string;
  workCenterId: string;
  departmentName: string;
  workCenterName: string;
  dailyContractedHours: number;
  monthlyContractedHours: number;
  weeklySchedule?: any;
  allowOutsideSchedule: boolean;
}

interface EmployeesClientProps {
  initialEmployees: Employee[];
  departments: Array<{ id: string; name: string }>;
  workCenters: Array<{ id: string; name: string }>;
}

export default function EmployeesClient({
  initialEmployees,
  departments,
  workCenters,
}: EmployeesClientProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [search, setSearch] = useState('');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  
  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>(Role.EMPLOYEE);
  const [contractType, setContractType] = useState<ContractType>(ContractType.INDEFINIDO);
  const [isActive, setIsActive] = useState(true);
  const [departmentId, setDepartmentId] = useState('');
  const [workCenterId, setWorkCenterId] = useState('');
  const [dailyContractedHours, setDailyContractedHours] = useState<number | string>(8.0);
  const [monthlyContractedHours, setMonthlyContractedHours] = useState<number | string>(160.0);
  const [allowOutsideSchedule, setAllowOutsideSchedule] = useState(false);

  const [weeklySchedule, setWeeklySchedule] = useState<Record<string, { enabled: boolean; start: string; end: string }>>({
    '1': { enabled: true, start: '09:00', end: '18:00' },
    '2': { enabled: true, start: '09:00', end: '18:00' },
    '3': { enabled: true, start: '09:00', end: '18:00' },
    '4': { enabled: true, start: '09:00', end: '18:00' },
    '5': { enabled: true, start: '09:00', end: '18:00' },
    '6': { enabled: false, start: '09:00', end: '18:00' },
    '0': { enabled: false, start: '09:00', end: '18:00' },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDayScheduleChange = (dayKey: string, field: 'enabled' | 'start' | 'end', value: any) => {
    setWeeklySchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }));
  };

  // Abrir modal para crear
  const openCreateModal = () => {
    setEditingEmployee(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole(Role.EMPLOYEE);
    setContractType(ContractType.INDEFINIDO);
    setIsActive(true);
    setDepartmentId(departments[0]?.id || '');
    setWorkCenterId(workCenters[0]?.id || '');
    setDailyContractedHours(8.0);
    setMonthlyContractedHours(160.0);
    setAllowOutsideSchedule(false);
    setWeeklySchedule({
      '1': { enabled: true, start: '09:00', end: '18:00' },
      '2': { enabled: true, start: '09:00', end: '18:00' },
      '3': { enabled: true, start: '09:00', end: '18:00' },
      '4': { enabled: true, start: '09:00', end: '18:00' },
      '5': { enabled: true, start: '09:00', end: '18:00' },
      '6': { enabled: false, start: '09:00', end: '18:00' },
      '0': { enabled: false, start: '09:00', end: '18:00' },
    });
    setError('');
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const openEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setName(emp.name);
    setEmail(emp.email);
    setPhone(emp.phone);
    setRole(emp.role);
    setContractType(emp.contractType);
    setIsActive(emp.isActive);
    setDepartmentId(emp.departmentId);
    setWorkCenterId(emp.workCenterId);
    setDailyContractedHours(emp.dailyContractedHours);
    setMonthlyContractedHours(emp.monthlyContractedHours);
    setAllowOutsideSchedule(emp.allowOutsideSchedule || false);
    
    if (emp.weeklySchedule) {
      try {
        const parsed = typeof emp.weeklySchedule === 'string'
          ? JSON.parse(emp.weeklySchedule)
          : emp.weeklySchedule;
        setWeeklySchedule(parsed);
      } catch (e) {
        setWeeklySchedule({
          '1': { enabled: true, start: '09:00', end: '18:00' },
          '2': { enabled: true, start: '09:00', end: '18:00' },
          '3': { enabled: true, start: '09:00', end: '18:00' },
          '4': { enabled: true, start: '09:00', end: '18:00' },
          '5': { enabled: true, start: '09:00', end: '18:00' },
          '6': { enabled: false, start: '09:00', end: '18:00' },
          '0': { enabled: false, start: '09:00', end: '18:00' },
        });
      }
    } else {
      setWeeklySchedule({
        '1': { enabled: true, start: '09:00', end: '18:00' },
        '2': { enabled: true, start: '09:00', end: '18:00' },
        '3': { enabled: true, start: '09:00', end: '18:00' },
        '4': { enabled: true, start: '09:00', end: '18:00' },
        '5': { enabled: true, start: '09:00', end: '18:00' },
        '6': { enabled: false, start: '09:00', end: '18:00' },
        '0': { enabled: false, start: '09:00', end: '18:00' },
      });
    }

    setError('');
    setIsModalOpen(true);
  };

  // Enviar formulario
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setError('Nombre y Correo son campos obligatorios.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await saveEmployee({
        id: editingEmployee?.id,
        name,
        email,
        phone,
        role,
        contractType,
        isActive,
        departmentId: departmentId || undefined,
        workCenterId: workCenterId || undefined,
        dailyContractedHours: parseFloat(dailyContractedHours as any),
        monthlyContractedHours: parseFloat(monthlyContractedHours as any),
        weeklySchedule: weeklySchedule,
        allowOutsideSchedule: allowOutsideSchedule,
      });

      // Recargar localmente (en una app real revalidatePath hace esto, pero actualizamos el estado para feedback inmediato)
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error al guardar el empleado.');
    } finally {
      setLoading(false);
    }
  };

  // Filtrar empleados según búsqueda
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.departmentName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Empleados</h1>
          <p className="page-subtitle">Gestiona la plantilla de empleados, sus contratos, roles y centros.</p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary">
          <Plus size={18} />
          Nuevo empleado
        </button>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="premium-card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', maxWidth: '360px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Buscar empleado o departamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '40px' }}
          />
        </div>
      </div>

      {/* TABLA DE EMPLEADOS */}
      <div className="table-container">
        <table className="premium-table">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Departamento</th>
              <th>Contrato</th>
              <th style={{ textAlign: 'center' }}>H. Diarias</th>
              <th style={{ textAlign: 'center' }}>H. Mensuales</th>
              <th>Horario</th>
              <th>Centro de Trabajo</th>
              <th>Rol</th>
              <th>Estado</th>
              <th style={{ textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.id}>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600 }}>{emp.name}</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{emp.email}</span>
                  </div>
                </td>
                <td>{emp.departmentName}</td>
                <td>
                  <span style={{ textTransform: 'capitalize' }}>
                    {emp.contractType.toLowerCase()}
                  </span>
                </td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{emp.dailyContractedHours}h</td>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{emp.monthlyContractedHours}h</td>
                <td>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {formatScheduleSummary(emp.weeklySchedule)}
                  </span>
                </td>
                <td>{emp.workCenterName}</td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 500 }}>
                    {emp.role === Role.ADMIN ? (
                      <ShieldCheck size={16} style={{ color: 'var(--primary)' }} />
                    ) : emp.role === Role.CONSULTANT ? (
                      <UserCheck size={16} style={{ color: 'var(--accent)' }} />
                    ) : null}
                    {emp.role === Role.ADMIN
                      ? 'Administrador'
                      : emp.role === Role.CONSULTANT
                      ? 'Consultor'
                      : 'Empleado'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${emp.isActive ? 'badge-success' : 'badge-danger'}`}>
                    {emp.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button onClick={() => openEditModal(emp)} className="btn btn-secondary" style={{ padding: '6px 10px' }}>
                    <Edit2 size={14} />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {filteredEmployees.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                  No se encontraron empleados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL CREAR / EDITAR */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div className="premium-card" style={{ maxWidth: '520px', width: '100%', backgroundColor: 'white', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '90vh', overflowY: 'auto' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontFamily: 'var(--font-title)', fontWeight: 700 }}>
                {editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--text-secondary)' }}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Nombre Completo</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Ana García"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input
                  type="email"
                  className="form-input"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@empresa.com"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Teléfono</label>
                  <input
                    type="text"
                    className="form-input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="600123456"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol del Usuario</label>
                  <select className="form-select" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                    <option value={Role.EMPLOYEE}>Empleado</option>
                    <option value={Role.ADMIN}>Administrador</option>
                    <option value={Role.CONSULTANT}>Consultor (Solo lectura)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Departamento</label>
                  <select className="form-select" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Centro de Trabajo</label>
                  <select className="form-select" value={workCenterId} onChange={(e) => setWorkCenterId(e.target.value)}>
                    <option value="">Sin asignar</option>
                    {workCenters.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Tipo de Contrato</label>
                  <select className="form-select" value={contractType} onChange={(e) => setOriginalContractType(e.target.value as ContractType)}>
                    <option value={ContractType.INDEFINIDO}>Indefinido</option>
                    <option value={ContractType.TEMPORAL}>Temporal</option>
                    <option value={ContractType.PRACTICAS}>En Prácticas</option>
                    <option value={ContractType.AUTONOMO}>Autónomo</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estado de la Cuenta</label>
                  <select className="form-select" value={isActive ? 'true' : 'false'} onChange={(e) => setIsActive(e.target.value === 'true')}>
                    <option value="true">Activa (Puede fichar)</option>
                    <option value="false">Inactiva (Acceso bloqueado)</option>
                  </select>
                </div>
              </div>

              {/* Horas Contratadas */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Horas Diarias Contratadas *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="24"
                    required
                    className="form-input"
                    value={dailyContractedHours}
                    onChange={(e) => setDailyContractedHours(e.target.value)}
                    placeholder="Ej. 8"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Horas Mensuales Contratadas *</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="744"
                    required
                    className="form-input"
                    value={monthlyContractedHours}
                    onChange={(e) => setMonthlyContractedHours(e.target.value)}
                    placeholder="Ej. 160"
                  />
                </div>
              </div>

              {/* Autorización de Fichaje fuera de horario */}
              <div className="form-group" style={{ marginTop: '4px' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    checked={allowOutsideSchedule}
                    onChange={(e) => setAllowOutsideSchedule(e.target.checked)}
                  />
                  <span>Autorizar fichar fuera de horario (+/- 5 min)</span>
                </label>
              </div>

              {/* Horario semanal específico */}
              <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Horario semanal específico
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { key: '1', label: 'Lunes' },
                    { key: '2', label: 'Martes' },
                    { key: '3', label: 'Miércoles' },
                    { key: '4', label: 'Jueves' },
                    { key: '5', label: 'Viernes' },
                    { key: '6', label: 'Sábado' },
                    { key: '0', label: 'Domingo' }
                  ].map((day) => {
                    const daySched = weeklySchedule[day.key] || { enabled: false, start: '09:00', end: '18:00' };
                    return (
                      <div key={day.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                          <input
                            type="checkbox"
                            style={{ width: '16px', height: '16px' }}
                            checked={daySched.enabled}
                            onChange={(e) => handleDayScheduleChange(day.key, 'enabled', e.target.checked)}
                          />
                          <span style={{ fontSize: '14px', fontWeight: daySched.enabled ? 600 : 400 }}>
                            {day.label}
                          </span>
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: daySched.enabled ? 1 : 0.5 }}>
                          <input
                            type="time"
                            className="form-input"
                            style={{ width: '100px', padding: '4px 8px', fontSize: '13px', minHeight: 'auto' }}
                            disabled={!daySched.enabled}
                            value={daySched.start}
                            onChange={(e) => handleDayScheduleChange(day.key, 'start', e.target.value)}
                          />
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>a</span>
                          <input
                            type="time"
                            className="form-input"
                            style={{ width: '100px', padding: '4px 8px', fontSize: '13px', minHeight: 'auto' }}
                            disabled={!daySched.enabled}
                            value={daySched.end}
                            onChange={(e) => handleDayScheduleChange(day.key, 'end', e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                  Guardar empleado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  // Helper local para evitar un error en setOriginalContractType
  function setOriginalContractType(val: ContractType) {
    setContractType(val);
  }
}

function formatScheduleSummary(schedule: any): string {
  if (!schedule) return 'Por defecto (8h/día)';
  try {
    const parsed = typeof schedule === 'string' ? JSON.parse(schedule) : schedule;
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    const enabledDays = Object.entries(parsed)
      .filter(([_, data]: any) => data.enabled)
      .map(([dayKey, data]: any) => ({
        dayNum: Number(dayKey),
        name: dayNames[Number(dayKey)],
        start: data.start,
        end: data.end
      }));
      
    if (enabledDays.length === 0) return 'No laborable';
    
    const sortOrder = [1, 2, 3, 4, 5, 6, 0];
    enabledDays.sort((a, b) => sortOrder.indexOf(a.dayNum) - sortOrder.indexOf(b.dayNum));
    
    const groups: string[] = [];
    let i = 0;
    while (i < enabledDays.length) {
      let startIdx = i;
      let endIdx = i;
      const currentHours = `${enabledDays[i].start}-${enabledDays[i].end}`;
      
      while (
        endIdx + 1 < enabledDays.length &&
        `${enabledDays[endIdx + 1].start}-${enabledDays[endIdx + 1].end}` === currentHours &&
        sortOrder.indexOf(enabledDays[endIdx + 1].dayNum) === sortOrder.indexOf(enabledDays[endIdx].dayNum) + 1
      ) {
        endIdx++;
      }
      
      if (startIdx === endIdx) {
        groups.push(`${enabledDays[startIdx].name}: ${currentHours}`);
      } else {
        groups.push(`${enabledDays[startIdx].name}-${enabledDays[endIdx].name}: ${currentHours}`);
      }
      i = endIdx + 1;
    }
    
    return groups.join(', ');
  } catch (e) {
    return 'Por defecto (8h/día)';
  }
}
