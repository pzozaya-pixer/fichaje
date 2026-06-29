'use server';

import React from 'react';
import { getReportsData, getEmployees } from '@/app/actions/admin';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const reportsData = await getReportsData();
  const employees = await getEmployees();

  return (
    <DashboardClient
      initialData={reportsData}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
      }))}
    />
  );
}
