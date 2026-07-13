import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import AdminSidebar from './AdminSidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Redirigir si no está autenticado
  if (!user) {
    redirect('/');
  }

  // Redirigir si es un empleado (los empleados solo acceden a la PWA)
  if (user.role === 'EMPLOYEE') {
    redirect('/movil');
  }

  // Redirigir si el periodo de prueba o suscripción ha expirado
  if (user.isSubscriptionExpired) {
    redirect('/expired');
  }

  return (
    <div className="admin-layout">
      <AdminSidebar user={user} logoutAction={logoutAction} />

      {/* CONTENIDO PRINCIPAL */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
