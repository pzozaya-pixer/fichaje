'use server';

import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ExpiredClient from './ExpiredClient';

export default async function ExpiredPage() {
  const user = await getCurrentUser();

  // Si no está autenticado, volver al login
  if (!user) {
    redirect('/');
  }

  // Si su suscripción está bien, redirigir al sitio correspondiente
  if (!user.isSubscriptionExpired) {
    if (user.role === 'ADMIN' || user.role === 'CONSULTANT') {
      redirect('/dashboard');
    } else {
      redirect('/pwa');
    }
  }

  return (
    <main className="login-container">
      <ExpiredClient
        company={{
          id: user.companyId,
          name: user.company.name,
          email: user.email,
          trialEndsAt: user.company.trialEndsAt.toISOString(),
        }}
        isAdmin={user.role === 'ADMIN'}
      />
    </main>
  );
}
