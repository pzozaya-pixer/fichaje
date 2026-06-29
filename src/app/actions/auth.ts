'use server';

import { sendOTP, verifyOTP, logout } from '@/lib/auth';
import { redirect } from 'next/navigation';

export async function requestOtpAction(prevState: any, formData: FormData) {
  const email = formData.get('email') as string;

  if (!email) {
    return { success: false, message: 'El correo electrónico es obligatorio.' };
  }

  const result = await sendOTP(email);
  return result;
}

export async function verifyOtpAction(email: string, otpCode: string) {
  if (!email || !otpCode) {
    return { success: false, message: 'Todos los campos son obligatorios.' };
  }

  const result = await verifyOTP(email, otpCode);

  if (result.success) {
    if (result.role === 'ADMIN' || result.role === 'CONSULTANT') {
      redirect('/dashboard');
    } else {
      redirect('/pwa');
    }
  }

  return result;
}

export async function logoutAction() {
  await logout();
  redirect('/');
}
