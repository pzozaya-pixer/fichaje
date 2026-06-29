import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { getTodayStatus, getMyFichajes, getMySummary } from '@/app/actions/pwa';
import { redirect } from 'next/navigation';
import PWAClient from './PWAClient';

export default async function PWAPage() {
  const user = await getCurrentUser();

  // Redirigir si no está autenticado
  if (!user) {
    redirect('/');
  }

  // Redirigir si la suscripción de la empresa ha expirado
  if (user.isSubscriptionExpired) {
    redirect('/expired');
  }

  // Cargar datos en el servidor
  const todayStatus = await getTodayStatus();
  const myFichajes = await getMyFichajes();
  const summary = await getMySummary();

  return (
    <PWAClient
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        contractType: user.contractType,
        department: user.department?.name || 'Sin asignar',
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
    />
  );
}
