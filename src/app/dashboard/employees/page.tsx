import React from 'react';
export const dynamic = 'force-dynamic';
import { getEmployees, getDepartments, getWorkCenters } from '@/app/actions/admin';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmployeesClient from './EmployeesClient';

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (user?.role === 'CONSULTANT') {
    redirect('/dashboard/reports');
  }

  const employees = await getEmployees();
  const departments = await getDepartments();
  const workCenters = await getWorkCenters();

  return (
    <EmployeesClient
      initialEmployees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone || '',
        role: e.role,
        contractType: e.contractType,
        isActive: e.isActive,
        departmentId: e.departmentId || '',
        workCenterId: e.workCenterId || '',
        departmentName: e.department?.name || 'Sin asignar',
        workCenterName: e.workCenter?.name || 'Sin asignar',
        dailyContractedHours: e.dailyContractedHours,
        monthlyContractedHours: e.monthlyContractedHours,
      }))}
      departments={departments}
      workCenters={workCenters}
    />
  );
}
