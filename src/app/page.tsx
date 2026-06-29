'use server';

import React from 'react';
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
      redirect('/pwa');
    }
  }

  return (
    <main className="login-container">
      <LoginClient />
    </main>
  );
}
