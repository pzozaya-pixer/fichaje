import React from 'react';
export const dynamic = 'force-dynamic';
import { getClockIns, getEmployees, getDepartments, getWorkCenters } from '@/app/actions/admin';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import FichajesClient from './FichajesClient';

export default async function FichajesPage() {
  const user = await getCurrentUser();
  if (user?.role === 'CONSULTANT') {
    redirect('/dashboard/reports');
  }

  const clockIns = await getClockIns();
  const employees = await getEmployees();
  const departments = await getDepartments();
  const workCenters = await getWorkCenters();

  return (
    <FichajesClient
      initialClockIns={clockIns.map((c) => ({
        id: c.id,
        userId: c.userId,
        employeeName: c.user.name,
        employeeEmail: c.user.email,
        departmentName: c.user.department?.name || 'Sin asignar',
        workCenterName: c.workCenter?.name || 'Sin asignar',
        entryTime: c.entryTime.toISOString(),
        exitTime: c.exitTime ? c.exitTime.toISOString() : null,
        breaks: (c.breaks as any[]) || [],
        durationMs: c.durationMs,
        breakMs: c.breakMs,
        isManual: c.isManual,
        status: c.status,
        auditLogs: c.auditLogs.map((log) => ({
          id: log.id,
          changeDate: log.changeDate.toISOString(),
          fieldName: log.fieldName,
          oldValue: log.oldValue,
          newValue: log.newValue,
          reason: log.reason,
          editedByName: log.editedBy.name,
        })),
      }))}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
      }))}
      departments={departments}
      workCenters={workCenters}
    />
  );
}
