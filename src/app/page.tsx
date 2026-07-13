import React, { Suspense } from 'react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginClient from './LoginClient';

export default async function LoginPage() {
  // Si el usuario ya tiene sesión activa, redirigir automáticamente
  const user = await getCurrentUser();
  if (user) {
    if (user.role === 'ADMIN' || user.role === 'CONSULTANT') {
      redirect('/dashboard');
    } else {
      redirect('/movil');
    }
  }

  return (
    <main className="login-container">
      <Suspense fallback={
        <div className="login-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Cargando acceso...</p>
        </div>
      }>
        <LoginClient />
      </Suspense>
    </main>
  );
}
