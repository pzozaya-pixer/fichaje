import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getVacationsAdmin } from '@/app/actions/vacations';
import { getHolidays } from '@/app/actions/holidays';
import VacationsClient from './VacationsClient';

export default async function VacationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const vacations = await getVacationsAdmin();
  const holidays = await getHolidays();

  // Obtener empleados activos de la empresa
  const employees = await prisma.user.findMany({
    where: {
      companyId: user.companyId,
      role: 'EMPLOYEE',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      vacationDaysAllocated: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <VacationsClient
      initialVacations={vacations.map((v) => ({
        id: v.id,
        startDate: v.startDate.toISOString(),
        endDate: v.endDate.toISOString(),
        type: v.type,
        daysCount: v.daysCount,
        status: v.status,
        notes: v.notes || '',
        createdAt: v.createdAt.toISOString(),
        user: {
          id: v.user.id,
          name: v.user.name,
          email: v.user.email,
          vacationDaysAllocated: v.user.vacationDaysAllocated,
        },
        resolvedBy: v.resolvedBy ? { name: v.resolvedBy.name } : null,
      }))}
      employees={employees}
      holidays={holidays.map((h) => h.date.toISOString().split('T')[0])}
    />
  );
}
