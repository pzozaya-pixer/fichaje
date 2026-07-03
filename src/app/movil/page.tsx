import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { getTodayStatus, getMyFichajes, getMySummary } from '@/app/actions/pwa';
import { getMyVacations } from '@/app/actions/vacations';
import { getHolidays } from '@/app/actions/holidays';
import { redirect } from 'next/navigation';
import MovilClient from './MovilClient';

export default async function PWAPage() {
  const user = await getCurrentUser();

  // Redirigir si no está autenticado
  if (!user) {
    redirect('/?redirectTo=movil/');
  }

  // Redirigir si la suscripción de la empresa ha expirado
  if (user.isSubscriptionExpired) {
    redirect('/expired');
  }

  // Cargar datos en el servidor
  const todayStatus = await getTodayStatus();
  const myFichajes = await getMyFichajes();
  const summary = await getMySummary();
  const vacationsData = await getMyVacations();
  const holidays = await getHolidays();

  return (
    <MovilClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        contractType: user.contractType,
        department: user.department?.name || 'Sin asignar',
        weeklySchedule: user.weeklySchedule || null,
        workCenter: user.workCenter
          ? {
              name: user.workCenter.name,
              latitude: user.workCenter.latitude,
              longitude: user.workCenter.longitude,
              radius: user.workCenter.radius,
            }
          : null,
      }}
      initialTodayStatus={todayStatus}
      initialFichajes={myFichajes}
      initialSummary={summary}
      initialVacations={vacationsData.vacations.map((v) => ({
        id: v.id,
        startDate: v.startDate.toISOString(),
        endDate: v.endDate.toISOString(),
        type: v.type,
        daysCount: v.daysCount,
        status: v.status,
        notes: v.notes || '',
      }))}
      vacationSummary={vacationsData.summary}
      holidays={holidays.map((h) => ({
        date: h.date.toISOString().split('T')[0],
        name: h.name,
      }))}
    />
  );
}
