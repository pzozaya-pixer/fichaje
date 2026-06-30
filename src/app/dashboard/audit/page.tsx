import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { ShieldAlert, User, Calendar, FileText } from 'lucide-react';

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  // Obtener todos los registros de auditoría de la empresa
  const logs = await prisma.auditLog.findMany({
    where: {
      clockIn: {
        user: {
          companyId: user.companyId,
        },
      },
    },
    include: {
      clockIn: {
        include: {
          user: true,
        },
      },
      editedBy: true,
    },
    orderBy: {
      changeDate: 'desc',
    },
  });

  const translateField = (field: string) => {
    switch (field) {
      case 'entryTime':
        return 'Hora de Entrada';
      case 'exitTime':
        return 'Hora de Salida';
      case 'breaks':
        return 'Pausas/Descansos';
      case 'creation':
        return 'Creación de Fichaje';
      default:
        return field;
      case 'deletion':
        return 'Eliminación de Fichaje';
    }
  };

  const formatDate = (date: Date) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hour}:${minute}`;
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Auditoría y Registro de Cambios</h1>
          <p className="page-subtitle">
            Registro legal obligatorio según el RD-Ley 8/2019 de todas las modificaciones manuales de jornada.
          </p>
        </div>
      </div>

      {/* AVISO LEGAL DE LA LEY ESPAÑOLA */}
      <div
        style={{
          padding: '16px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderLeft: '4px solid var(--primary)',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-start',
        }}
      >
        <ShieldAlert size={24} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
          <strong style={{ color: 'var(--text-primary)' }}>Cumplimiento del Real Decreto-Ley 8/2019:</strong>
          <p style={{ margin: '4px 0 0 0' }}>
            La ley española exige que el registro diario de jornada sea objetivo, fiable y que cualquier alteración o modificación manual quede plenamente documentada con su justificación correspondiente. Esta tabla constituye el historial de auditoría inalterable que debe estar a disposición de la Inspección de Trabajo y Seguridad Social.
          </p>
        </div>
      </div>

      {/* TABLA DE AUDITORÍA */}
      <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <FileText size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Historial de Modificaciones</h3>
        </div>

        {logs.length > 0 ? (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Empleado</th>
                  <th>Campo Modificado</th>
                  <th>Valor Anterior</th>
                  <th>Valor Nuevo</th>
                  <th>Motivo / Justificación</th>
                  <th>Modificado Por</th>
                  <th>Fecha del Cambio</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{log.clockIn.user.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{log.clockIn.user.email}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        {translateField(log.fieldName)}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {log.oldValue || '-'}
                    </td>
                    <td style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {log.newValue}
                    </td>
                    <td style={{ maxWidth: '240px', fontSize: '13px', fontStyle: 'italic', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>
                      "{log.reason}"
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                        <User size={14} style={{ color: 'var(--text-secondary)' }} />
                        <span>{log.editedBy.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        <span>{formatDate(log.changeDate)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', color: 'var(--text-secondary)' }}>
              <FileText size={32} />
            </div>
            <p style={{ fontWeight: 600, margin: 0 }}>No hay modificaciones registradas</p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '480px', margin: 0 }}>
              Todos los fichajes en tu empresa se han realizado de manera presencial y automática por los empleados. No se han realizado modificaciones manuales por parte de ningún administrador.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
