'use client';

import React, { useState, useEffect } from 'react';
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
  subscription: {
    stripeProductId: string | null;
    status: string;
    trialEndsAt: string;
  };
}

export default function EmployeesClient({
  initialEmployees,
  departments,
  workCenters,
  subscription,
}: EmployeesClientProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [search, setSearch] = useState('');
  
  // Sub-tabs state
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'scheduler'>('list');

  // Scheduler parameters
  const [schedMode, setSchedMode] = useState<'employee' | 'center_day'>('employee');
  const [selectedSchedEmployeeId, setSelectedSchedEmployeeId] = useState(initialEmployees[0]?.id || '');
  const [selectedWorkCenterId, setSelectedWorkCenterId] = useState('all');
  const [selectedDayKey, setSelectedDayKey] = useState<string>('1'); // '1' = Lunes

  // Unified batch schedule state: map employeeId -> weeklySchedule
  const [schedBatchSchedules, setSchedBatchSchedules] = useState<Record<string, Record<string, { enabled: boolean; start: string; end: string }>>>({});
  const [modifiedEmpIds, setModifiedEmpIds] = useState<Set<string>>(new Set());

  const [dragState, setDragState] = useState<{
    employeeId: string;
    dayKey: string;
    mode: 'left' | 'right' | 'center';
    startX: number;
    initialStartMins: number;
    initialEndMins: number;
    containerWidth: number;
  } | null>(null);

  const selectedEmp = employees.find(e => e.id === selectedSchedEmployeeId);

  // Initialize and reload schedules when employees prop updates
  useEffect(() => {
    const batch: Record<string, Record<string, { enabled: boolean; start: string; end: string }>> = {};
    employees.forEach((emp) => {
      if (emp.weeklySchedule) {
        try {
          batch[emp.id] = typeof emp.weeklySchedule === 'string'
            ? JSON.parse(emp.weeklySchedule)
            : emp.weeklySchedule;
        } catch (e) {
          batch[emp.id] = {
            '1': { enabled: true, start: '09:00', end: '18:00' },
            '2': { enabled: true, start: '09:00', end: '18:00' },
            '3': { enabled: true, start: '09:00', end: '18:00' },
            '4': { enabled: true, start: '09:00', end: '18:00' },
            '5': { enabled: true, start: '09:00', end: '18:00' },
            '6': { enabled: false, start: '09:00', end: '18:00' },
            '0': { enabled: false, start: '09:00', end: '18:00' },
          };
        }
      } else {
        batch[emp.id] = {
          '1': { enabled: true, start: '09:00', end: '18:00' },
          '2': { enabled: true, start: '09:00', end: '18:00' },
          '3': { enabled: true, start: '09:00', end: '18:00' },
          '4': { enabled: true, start: '09:00', end: '18:00' },
          '5': { enabled: true, start: '09:00', end: '18:00' },
          '6': { enabled: false, start: '09:00', end: '18:00' },
          '0': { enabled: false, start: '09:00', end: '18:00' },
        };
      }
    });
    setSchedBatchSchedules(batch);
  }, [employees]);

  useEffect(() => {
    if (!dragState) return;

    console.log('Registered global drag listeners for', dragState.employeeId, dragState.dayKey, dragState.mode);

    const handleMove = (clientX: number) => {
      const deltaX = clientX - dragState.startX;
      const deltaMins = Math.round((deltaX / dragState.containerWidth) * 1440);
      const snappedDelta = Math.round(deltaMins / 15) * 15;

      let newStart = dragState.initialStartMins;
      let newEnd = dragState.initialEndMins;

      if (dragState.mode === 'left') {
        newStart = Math.max(0, Math.min(dragState.initialEndMins - 15, dragState.initialStartMins + snappedDelta));
      } else if (dragState.mode === 'right') {
        newEnd = Math.max(dragState.initialStartMins + 15, Math.min(1440, dragState.initialEndMins + snappedDelta));
      } else if (dragState.mode === 'center') {
        const duration = dragState.initialEndMins - dragState.initialStartMins;
        newStart = Math.max(0, Math.min(1440 - duration, dragState.initialStartMins + snappedDelta));
        newEnd = newStart + duration;
      }

      setSchedBatchSchedules((prev) => {
        const empSchedule = prev[dragState.employeeId] || {};
        return {
          ...prev,
          [dragState.employeeId]: {
            ...empSchedule,
            [dragState.dayKey]: {
              ...empSchedule[dragState.dayKey],
              start: minutesToTime(newStart),
              end: minutesToTime(newEnd)
            }
          }
        };
      });

      setModifiedEmpIds((prev) => {
        if (prev.has(dragState.employeeId)) return prev;
        const next = new Set(prev);
        next.add(dragState.employeeId);
        return next;
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        handleMove(touch.clientX);
      }
    };

    const handleRelease = () => {
      console.log('Drag Release');
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleRelease);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleRelease);

    return () => {
      console.log('Cleaned up global drag listeners');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleRelease);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleRelease);
    };
  }, [dragState]);

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
    const activeEmployeesCount = employees.filter((e) => e.role === Role.EMPLOYEE && e.isActive).length;
    const limit = subscription.stripeProductId
      ? (subscription.stripeProductId.includes('pro') || subscription.stripeProductId === 'prod_pro_monthly' || subscription.stripeProductId === 'prod_pro_annual' ? 50 : 
         subscription.stripeProductId.includes('business') || subscription.stripeProductId === 'prod_business_monthly' || subscription.stripeProductId === 'prod_business_annual' ? Infinity : 10)
      : 10;
    const planName = subscription.stripeProductId
      ? (subscription.stripeProductId.includes('pro') || subscription.stripeProductId === 'prod_pro_monthly' || subscription.stripeProductId === 'prod_pro_annual' ? 'Pro' : 
         subscription.stripeProductId.includes('business') || subscription.stripeProductId === 'prod_business_monthly' || subscription.stripeProductId === 'prod_business_annual' ? 'Business' : 'Básica')
      : 'Básica';

    if (activeEmployeesCount >= limit) {
      alert(`Has alcanzado el límite de ${limit} empleados activos para tu Plan ${planName}. Por favor, mejora tu suscripción en Configuración para añadir más.`);
      return;
    }

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

  const startDrag = (clientX: number, employeeId: string, dayKey: string, mode: 'left' | 'right' | 'center') => {
    console.log('startDrag initiated:', employeeId, dayKey, mode, 'clientX:', clientX);
    const trackElement = document.getElementById(`track-${employeeId}-${dayKey}`);
    if (!trackElement) {
      console.error('trackElement not found for', employeeId, dayKey);
      return;
    }

    const rect = trackElement.getBoundingClientRect();
    const empScheds = schedBatchSchedules[employeeId] || {};
    const daySched = empScheds[dayKey] || { enabled: false, start: '09:00', end: '18:00' };

    const startMins = timeToMinutes(daySched.start);
    const endMins = timeToMinutes(daySched.end);

    console.log('Initial drag values - startMins:', startMins, 'endMins:', endMins, 'width:', rect.width);

    setDragState({
      employeeId,
      dayKey,
      mode,
      startX: clientX,
      initialStartMins: startMins,
      initialEndMins: endMins,
      containerWidth: rect.width
    });
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    employeeId: string,
    dayKey: string,
    mode: 'left' | 'right' | 'center'
  ) => {
    if (e.button !== 0) return; // Only drag on left click
    startDrag(e.clientX, employeeId, dayKey, mode);
  };

  const handleTouchStart = (
    e: React.TouchEvent<HTMLDivElement>,
    employeeId: string,
    dayKey: string,
    mode: 'left' | 'right' | 'center'
  ) => {
    const touch = e.touches[0];
    if (touch) {
      startDrag(touch.clientX, employeeId, dayKey, mode);
    }
  };

  const handleSaveScheduler = async () => {
    setLoading(true);
    setError('');

    try {
      if (schedMode === 'employee') {
        const emp = employees.find(e => e.id === selectedSchedEmployeeId);
        if (!emp) {
          setLoading(false);
          return;
        }

        await saveEmployee({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          phone: emp.phone || '',
          role: emp.role as any,
          contractType: emp.contractType as any,
          isActive: emp.isActive,
          departmentId: emp.departmentId || undefined,
          workCenterId: emp.workCenterId || undefined,
          dailyContractedHours: emp.dailyContractedHours,
          monthlyContractedHours: emp.monthlyContractedHours,
          weeklySchedule: schedBatchSchedules[emp.id],
          allowOutsideSchedule: emp.allowOutsideSchedule,
        });
      } else {
        // Modo B: Save all modified employees tracked by modifiedEmpIds
        if (modifiedEmpIds.size === 0) {
          alert('No se han detectado cambios para guardar.');
          setLoading(false);
          return;
        }

        const modifiedList = employees.filter(emp => modifiedEmpIds.has(emp.id));
        console.log('Guardando lote de empleados modificados. Total:', modifiedList.length);

        for (const emp of modifiedList) {
          const scheduleToSave = schedBatchSchedules[emp.id] || emp.weeklySchedule || {
            '1': { enabled: true, start: '09:00', end: '18:00' },
            '2': { enabled: true, start: '09:00', end: '18:00' },
            '3': { enabled: true, start: '09:00', end: '18:00' },
            '4': { enabled: true, start: '09:00', end: '18:00' },
            '5': { enabled: true, start: '09:00', end: '18:00' },
            '6': { enabled: false, start: '09:00', end: '18:00' },
            '0': { enabled: false, start: '09:00', end: '18:00' },
          };

          await saveEmployee({
            id: emp.id,
            name: emp.name,
            email: emp.email,
            phone: emp.phone || '',
            role: emp.role as any,
            contractType: emp.contractType as any,
            isActive: emp.isActive,
            departmentId: emp.departmentId || undefined,
            workCenterId: emp.workCenterId || undefined,
            dailyContractedHours: emp.dailyContractedHours,
            monthlyContractedHours: emp.monthlyContractedHours,
            weeklySchedule: scheduleToSave,
            allowOutsideSchedule: emp.allowOutsideSchedule,
          });
        }
      }
      
      setModifiedEmpIds(new Set());
      alert('Planificación guardada con éxito.');
      window.location.reload();
    } catch (err: any) {
      console.error('Error al guardar la planificación:', err);
      setError(err.message || 'Error al guardar la planificación.');
    } finally {
      setLoading(false);
    }
  };

  const handleDaySchedToggle = (employeeId: string, dayKey: string, enabled: boolean) => {
    setSchedBatchSchedules(prev => {
      const empSchedule = prev[employeeId] || {};
      return {
        ...prev,
        [employeeId]: {
          ...empSchedule,
          [dayKey]: {
            ...empSchedule[dayKey],
            enabled
          }
        }
      };
    });

    setModifiedEmpIds(prev => {
      if (prev.has(employeeId)) return prev;
      const next = new Set(prev);
      next.add(employeeId);
      return next;
    });
  };

  // Filtrar empleados según búsqueda
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(search.toLowerCase()) ||
      emp.email.toLowerCase().includes(search.toLowerCase()) ||
      emp.departmentName.toLowerCase().includes(search.toLowerCase())
  );

  const activeEmployeesCount = employees.filter((e) => e.role === Role.EMPLOYEE && e.isActive).length;
  const limit = subscription.stripeProductId
    ? (subscription.stripeProductId.includes('pro') || subscription.stripeProductId === 'prod_pro_monthly' || subscription.stripeProductId === 'prod_pro_annual' ? 50 : 
       subscription.stripeProductId.includes('business') || subscription.stripeProductId === 'prod_business_monthly' || subscription.stripeProductId === 'prod_business_annual' ? Infinity : 10)
    : 10;
  const planName = subscription.stripeProductId
    ? (subscription.stripeProductId.includes('pro') || subscription.stripeProductId === 'prod_pro_monthly' || subscription.stripeProductId === 'prod_pro_annual' ? 'Pro' : 
       subscription.stripeProductId.includes('business') || subscription.stripeProductId === 'prod_business_monthly' || subscription.stripeProductId === 'prod_business_annual' ? 'Business' : 'Básica')
    : 'Básica';
  const limitReached = activeEmployeesCount >= limit;

  return (
    <>
      {/* CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Empleados</h1>
          <p className="page-subtitle">Gestiona la plantilla de empleados, sus contratos, roles y centros.</p>
        </div>
        {activeSubTab === 'list' && (
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus size={18} />
            Nuevo empleado
          </button>
        )}
      </div>

      {/* BANNER DE LÍMITE DE EMPLEADOS */}
      <div 
        className="premium-card" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '12px 20px', 
          backgroundColor: limitReached ? 'rgba(239, 68, 68, 0.06)' : 'rgba(34, 197, 94, 0.06)',
          borderLeft: limitReached ? '4px solid var(--danger)' : '4px solid var(--success)',
          marginBottom: '24px',
          borderRadius: '8px',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1px solid ' + (limitReached ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)')
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>
            {limitReached ? '⚠️' : 'ℹ️'}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            Límite de empleados: <strong>{activeEmployeesCount}</strong> de <strong>{limit === Infinity ? 'ilimitados' : limit}</strong> activos en tu <strong>Plan {planName}</strong>.
            {limitReached && ' Has alcanzado el límite de empleados permitido por tu plan.'}
          </span>
        </div>
        {limitReached && (
          <a 
            href="/fichaje/dashboard/config#planes"
            className="btn btn-primary"
            style={{ 
              fontSize: '13px', 
              padding: '6px 12px', 
              textDecoration: 'none',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)' 
            }}
          >
            Mejorar Plan
          </a>
        )}
      </div>

      {/* SUB-TABS (SUBMENU) */}
      <div className="premium-card" style={{ padding: '6px 12px', display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('list')}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeSubTab === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
            backgroundColor: activeSubTab === 'list' ? 'rgba(26, 102, 255, 0.08)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Alta y Mantenimiento
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('scheduler')}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 600,
            color: activeSubTab === 'scheduler' ? 'var(--primary)' : 'var(--text-secondary)',
            backgroundColor: activeSubTab === 'scheduler' ? 'rgba(26, 102, 255, 0.08)' : 'transparent',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          Planificador Horario
        </button>
      </div>

      {activeSubTab === 'list' ? (
        <>
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
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                      No se encontraron empleados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* PLANIFICADOR HORARIO INTERACTIVO (ARRASTRABLE) */
        <div className="premium-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {error && (
            <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
              <span>{error}</span>
            </div>
          )}
          
          {/* SELECCIÓN DE MODO Y FILTROS */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
              <label className="form-label">Modo de Planificación</label>
              <select
                className="form-select"
                value={schedMode}
                onChange={(e) => setSchedMode(e.target.value as any)}
                style={{ width: '100%' }}
              >
                <option value="employee">Por Empleado (Semanal)</option>
                <option value="center_day">Por Centro y Día (Diario)</option>
              </select>
            </div>

            {schedMode === 'employee' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '240px' }}>
                <label className="form-label">Seleccionar Empleado</label>
                <select
                  className="form-select"
                  value={selectedSchedEmployeeId}
                  onChange={(e) => setSelectedSchedEmployeeId(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.departmentName})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '200px' }}>
                  <label className="form-label">Centro de Trabajo</label>
                  <select
                    className="form-select"
                    value={selectedWorkCenterId}
                    onChange={(e) => setSelectedWorkCenterId(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="all">Todos los centros</option>
                    {workCenters.map((wc) => (
                      <option key={wc.id} value={wc.id}>{wc.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '180px' }}>
                  <label className="form-label">Día de la Semana</label>
                  <select
                    className="form-select"
                    value={selectedDayKey}
                    onChange={(e) => setSelectedDayKey(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="1">Lunes</option>
                    <option value="2">Martes</option>
                    <option value="3">Miércoles</option>
                    <option value="4">Jueves</option>
                    <option value="5">Viernes</option>
                    <option value="6">Sábado</option>
                    <option value="0">Domingo</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* RENDERIZADO DE LAS FILAS DE LA LÍNEA DE TIEMPO */}
          {(() => {
            const schedulerRows = (() => {
              if (schedMode === 'employee') {
                if (!selectedEmp) return [];
                return [
                  { employeeId: selectedEmp.id, dayKey: '1', label: 'Lunes', subtitle: '' },
                  { employeeId: selectedEmp.id, dayKey: '2', label: 'Martes', subtitle: '' },
                  { employeeId: selectedEmp.id, dayKey: '3', label: 'Miércoles', subtitle: '' },
                  { employeeId: selectedEmp.id, dayKey: '4', label: 'Jueves', subtitle: '' },
                  { employeeId: selectedEmp.id, dayKey: '5', label: 'Viernes', subtitle: '' },
                  { employeeId: selectedEmp.id, dayKey: '6', label: 'Sábado', subtitle: '' },
                  { employeeId: selectedEmp.id, dayKey: '0', label: 'Domingo', subtitle: '' },
                ];
              } else {
                const filtered = employees.filter(emp => {
                  if (selectedWorkCenterId !== 'all' && emp.workCenterId !== selectedWorkCenterId) {
                    return false;
                  }
                  return true;
                });
                return filtered.map(emp => ({
                  employeeId: emp.id,
                  dayKey: selectedDayKey,
                  label: emp.name,
                  subtitle: emp.departmentName
                }));
              }
            })();

            if (schedulerRows.length === 0) {
              return (
                <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '12px', textAlign: 'center' }}>
                  No hay empleados disponibles con los filtros seleccionados.
                </p>
              );
            }

            const weeklyHours = (() => {
              if (!selectedEmp) return 0;
              const empSchedule = schedBatchSchedules[selectedEmp.id];
              if (!empSchedule) return 0;
              let totalMins = 0;
              Object.values(empSchedule).forEach(day => {
                if (day.enabled) {
                  const startMins = timeToMinutes(day.start);
                  const endMins = timeToMinutes(day.end);
                  if (endMins >= startMins) {
                    totalMins += (endMins - startMins);
                  } else {
                    totalMins += (1440 - startMins) + endMins;
                  }
                }
              });
              return totalMins / 60;
            })();

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {schedMode === 'employee' 
                      ? `Horario Semanal de ${selectedEmp?.name} (${weeklyHours.toLocaleString('es-ES', { maximumFractionDigits: 2 })} horas asignadas)`
                      : `Planificación Diaria (${selectedDayKey === '1' ? 'Lunes' : selectedDayKey === '2' ? 'Martes' : selectedDayKey === '3' ? 'Miércoles' : selectedDayKey === '4' ? 'Jueves' : selectedDayKey === '5' ? 'Viernes' : selectedDayKey === '6' ? 'Sábado' : 'Domingo'})`}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                    * Arrastra los bordes de la barra para ajustar entrada/salida. Arrastra el centro para desplazar el bloque.
                  </span>
                </div>

                {/* Timeline headers (00:00 to 24:00) */}
                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: '180px', paddingRight: '12px' }}>
                  <div style={{ position: 'relative', width: '100%', height: '20px', borderBottom: '1.5px solid var(--border-color)' }}>
                    {Array.from({ length: 13 }).map((_, idx) => {
                      const hour = idx * 2;
                      const hourStr = `${hour.toString().padStart(2, '0')}:00`;
                      return (
                        <span 
                          key={idx}
                          style={{
                            position: 'absolute',
                            left: `${(hour / 24) * 100}%`,
                            transform: 'translateX(-50%)',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            top: '-4px'
                          }}
                        >
                          {hourStr}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Rows wrapper */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {schedulerRows.map((row) => {
                    const empScheds = schedBatchSchedules[row.employeeId] || {};
                    const daySched = empScheds[row.dayKey] || { enabled: false, start: '09:00', end: '18:00' };
                    const startMins = timeToMinutes(daySched.start);
                    const endMins = timeToMinutes(daySched.end);
                    
                    return (
                      <div 
                        key={`${row.employeeId}-${row.dayKey}`} 
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '16px' 
                        }}
                      >
                        {/* Checkbox and Label */}
                        <div style={{ width: '160px', display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flexShrink: 0 }}>
                          <input
                            type="checkbox"
                            style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                            checked={daySched.enabled}
                            onChange={(e) => handleDaySchedToggle(row.employeeId, row.dayKey, e.target.checked)}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ 
                              fontSize: '14px', 
                              fontWeight: daySched.enabled ? 600 : 400, 
                              color: daySched.enabled ? 'var(--text-primary)' : 'var(--text-secondary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {row.label}
                            </span>
                            {row.subtitle && (
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {row.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Drag Track Container */}
                        <div 
                          id={`track-${row.employeeId}-${row.dayKey}`}
                          style={{
                            position: 'relative',
                            height: '42px',
                            backgroundColor: daySched.enabled ? '#f1f5f9' : '#f8fafc',
                            borderRadius: '6px',
                            border: '1.5px solid',
                            borderColor: daySched.enabled ? '#cbd5e1' : '#f1f5f9',
                            flexGrow: 1,
                            boxShadow: daySched.enabled ? 'inset 0 1px 2px rgba(0,0,0,0.05)' : 'none',
                            opacity: daySched.enabled ? 1 : 0.5
                          }}
                        >
                          {/* Grid Lines inside the track */}
                          {Array.from({ length: 13 }).map((_, idx) => (
                            <div 
                              key={idx}
                              style={{
                                position: 'absolute',
                                left: `${(idx * 2 / 24) * 100}%`,
                                top: 0,
                                bottom: 0,
                                width: '1px',
                                backgroundColor: '#e2e8f0',
                                pointerEvents: 'none'
                              }}
                            />
                          ))}

                          {/* Active working block */}
                          {daySched.enabled && (
                            <div
                              style={{
                                position: 'absolute',
                                left: `${(startMins / 1440) * 100}%`,
                                width: `${((endMins - startMins) / 1440) * 100}%`,
                                top: '4px',
                                bottom: '4px',
                                backgroundColor: 'rgba(26, 102, 255, 0.1)',
                                border: '1.5px solid var(--primary)',
                                borderRadius: '4px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'grab',
                                userSelect: 'none',
                                touchAction: 'none',
                                boxShadow: '0 2px 4px rgba(26, 102, 255, 0.15)'
                              }}
                              onMouseDown={(e) => handleMouseDown(e, row.employeeId, row.dayKey, 'center')}
                              onTouchStart={(e) => handleTouchStart(e, row.employeeId, row.dayKey, 'center')}
                              onDragStart={(e) => e.preventDefault()}
                            >
                              {/* Left Handle */}
                              <div
                                style={{
                                  width: '8px',
                                  height: '100%',
                                  cursor: 'ew-resize',
                                  backgroundColor: 'var(--primary)',
                                  borderRadius: '2px 0 0 2px',
                                  opacity: 0.8,
                                  touchAction: 'none'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  handleMouseDown(e, row.employeeId, row.dayKey, 'left');
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  handleTouchStart(e, row.employeeId, row.dayKey, 'left');
                                }}
                              />

                              {/* Display text in center */}
                              <span style={{ 
                                fontSize: '11px', 
                                fontWeight: 700, 
                                color: 'var(--primary)', 
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                padding: '0 4px'
                              }}>
                                {daySched.start} - {daySched.end}
                              </span>

                              {/* Right Handle */}
                              <div
                                style={{
                                  width: '8px',
                                  height: '100%',
                                  cursor: 'ew-resize',
                                  backgroundColor: 'var(--primary)',
                                  borderRadius: '0 2px 2px 0',
                                  opacity: 0.8,
                                  touchAction: 'none'
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  handleMouseDown(e, row.employeeId, row.dayKey, 'right');
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  handleTouchStart(e, row.employeeId, row.dayKey, 'right');
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <button 
                    type="button" 
                    onClick={() => {
                      const batch: Record<string, Record<string, { enabled: boolean; start: string; end: string }>> = {};
                      employees.forEach((emp) => {
                        if (emp.weeklySchedule) {
                          try {
                            batch[emp.id] = typeof emp.weeklySchedule === 'string'
                              ? JSON.parse(emp.weeklySchedule)
                              : emp.weeklySchedule;
                          } catch (e) {
                            batch[emp.id] = {
                              '1': { enabled: true, start: '09:00', end: '18:00' },
                              '2': { enabled: true, start: '09:00', end: '18:00' },
                              '3': { enabled: true, start: '09:00', end: '18:00' },
                              '4': { enabled: true, start: '09:00', end: '18:00' },
                              '5': { enabled: true, start: '09:00', end: '18:00' },
                              '6': { enabled: false, start: '09:00', end: '18:00' },
                              '0': { enabled: false, start: '09:00', end: '18:00' },
                            };
                          }
                        } else {
                          batch[emp.id] = {
                            '1': { enabled: true, start: '09:00', end: '18:00' },
                            '2': { enabled: true, start: '09:00', end: '18:00' },
                            '3': { enabled: true, start: '09:00', end: '18:00' },
                            '4': { enabled: true, start: '09:00', end: '18:00' },
                            '5': { enabled: true, start: '09:00', end: '18:00' },
                            '6': { enabled: false, start: '09:00', end: '18:00' },
                            '0': { enabled: false, start: '09:00', end: '18:00' },
                          };
                        }
                      });
                      setSchedBatchSchedules(batch);
                      setModifiedEmpIds(new Set());
                    }} 
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    Descartar Cambios
                  </button>
                  <button 
                    type="button" 
                    onClick={handleSaveScheduler} 
                    disabled={loading} 
                    className="btn btn-primary"
                  >
                    {loading ? <Loader2 className="animate-spin" size={16} /> : null}
                    Guardar Planificación
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

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

function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(1440, mins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
