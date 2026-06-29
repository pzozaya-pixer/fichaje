'use server';

import React from 'react';
import { getEmployees, getDepartments, getWorkCenters, getReportsData } from '@/app/actions/admin';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { FileSpreadsheet, FileText, BarChart2, Calendar, Users, Briefcase } from 'lucide-react';
import ReportsClient from './ReportsClient';

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const employees = await getEmployees();
  const departments = await getDepartments();
  const workCenters = await getWorkCenters();
  const reportsData = await getReportsData();

  return (
    <ReportsClient
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        department: e.department?.name || 'Sin asignar',
        workCenter: e.workCenter?.name || 'Sin asignar',
      }))}
      departments={departments}
      workCenters={workCenters}
      reportsData={reportsData}
    />
  );
}
