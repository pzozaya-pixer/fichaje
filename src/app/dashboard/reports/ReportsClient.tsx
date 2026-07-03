'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, FileText, Download, Calendar, Users, Building, BarChart2 } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  workCenter: string;
}

interface ReportsClientProps {
  employees: Employee[];
  departments: Array<{ id: string; name: string }>;
  workCenters: Array<{ id: string; name: string }>;
  reportsData: {
    totalWorkedHours: number;
    totalOvertimeHours: number;
    activeEmployees: number;
    daysWorked: number;
  };
}

export default function ReportsClient({
  employees,
  departments,
  workCenters,
  reportsData,
}: ReportsClientProps) {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

  // Filtros Excel
  const [excelStart, setExcelStart] = useState(firstDay);
  const [excelEnd, setExcelEnd] = useState(lastDay);
  const [excelDept, setExcelDept] = useState('all');
  const [excelCenter, setExcelCenter] = useState('all');

  // Filtros PDF
  const [pdfEmployeeId, setPdfEmployeeId] = useState(employees[0]?.id || '');
  const [pdfStart, setPdfStart] = useState(firstDay);
  const [pdfEnd, setPdfEnd] = useState(lastDay);

  return (
    <>
      {/* CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Informes</h1>
          <p className="page-subtitle">Genera documentos oficiales en formato PDF y Excel para inspección laboral.</p>
        </div>
      </div>

      {/* TARJETAS RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
          <div style={{ padding: '10px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '8px' }}>
            <BarChart2 size={20} />
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Horas Totales</p>
            <p style={{ fontSize: '18px', fontWeight: 700 }}>{reportsData.totalWorkedHours}h</p>
          </div>
        </div>

        <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
          <div style={{ padding: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', borderRadius: '8px' }}>
            <Calendar size={20} />
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Balance</p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--warning)' }}>{reportsData.totalOvertimeHours}h</p>
          </div>
        </div>

        <div className="premium-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 20px' }}>
          <div style={{ padding: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', borderRadius: '8px' }}>
            <Users size={20} />
          </div>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Empleados Activos</p>
            <p style={{ fontSize: '18px', fontWeight: 700 }}>{reportsData.activeEmployees}</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '12px' }}>
        
        {/* PANEL EXCEL */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', color: 'var(--success)' }}>
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
                Informe General (Excel)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Exportación masiva de fichajes con filtros avanzados.
              </p>
            </div>
          </div>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha Inicio</label>
                <input
                  type="date"
                  className="form-input"
                  value={excelStart}
                  onChange={(e) => setExcelStart(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha Fin</label>
                <input
                  type="date"
                  className="form-input"
                  value={excelEnd}
                  onChange={(e) => setExcelEnd(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Departamento</label>
                <select
                  className="form-select"
                  value={excelDept}
                  onChange={(e) => setExcelDept(e.target.value)}
                >
                  <option value="all">Todos los departamentos</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Centro de Trabajo</label>
                <select
                  className="form-select"
                  value={excelCenter}
                  onChange={(e) => setExcelCenter(e.target.value)}
                >
                  <option value="all">Todos los centros</option>
                  {workCenters.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <a
              href={`/fichaje/api/export/excel?startDate=${excelStart}&endDate=${excelEnd}&departmentId=${excelDept}&workCenterId=${excelCenter}`}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Download size={18} />
              Descargar Informe Excel (.xlsx)
            </a>
          </form>
        </div>

        {/* PANEL PDF */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div style={{ padding: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', color: 'var(--danger)' }}>
              <FileText size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>
                Registro por Empleado (PDF)
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Hoja mensual individualizada y lista para firma digital/física.
              </p>
            </div>
          </div>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Seleccionar Empleado</label>
              <select
                className="form-select"
                value={pdfEmployeeId}
                onChange={(e) => setPdfEmployeeId(e.target.value)}
                style={{ width: '100%' }}
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.department})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha Inicio</label>
                <input
                  type="date"
                  className="form-input"
                  value={pdfStart}
                  onChange={(e) => setPdfStart(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Fecha Fin</label>
                <input
                  type="date"
                  className="form-input"
                  value={pdfEnd}
                  onChange={(e) => setPdfEnd(e.target.value)}
                />
              </div>
            </div>

            <a
              href={`/fichaje/api/export/pdf?userId=${pdfEmployeeId}&startDate=${pdfStart}&endDate=${pdfEnd}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ width: '100%', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <FileText size={18} />
              Generar Documento PDF (.pdf)
            </a>
          </form>
        </div>

      </div>
    </>
  );
}
