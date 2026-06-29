'use server';

import { sendOTP, verifyOTP, logout } from '@/lib/auth';
import { prisma } from '@/lib/db';
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

export async function registerCompanyAction(data: {
  companyName: string;
  cif: string;
  adminName: string;
  email: string;
  phone?: string;
}) {
  const email = data.email.toLowerCase().trim();
  const companyName = data.companyName.trim();
  const cif = data.cif.trim();
  const adminName = data.adminName.trim();

  if (!email || !companyName || !cif || !adminName) {
    return { success: false, message: 'Todos los campos son obligatorios.' };
  }

  try {
    // Verificar si el correo ya está registrado
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { success: false, message: 'El correo electrónico ya está registrado.' };
    }

    // Crear la empresa y el usuario administrador en una transacción
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 15);

    await prisma.$transaction(async (tx) => {
      // 1. Crear empresa
      const company = await tx.company.create({
        data: {
          name: companyName,
          cif,
          subscriptionStatus: 'trialing',
          trialEndsAt,
        },
      });

      // 2. Crear configuración de jornada por defecto (Lunes a Viernes 8h)
      for (let i = 1; i <= 5; i++) {
        await tx.workdaySetting.create({
          data: {
            dayOfWeek: i,
            expectedHours: 8.0,
            companyId: company.id,
          },
        });
      }

      // 3. Crear usuario administrador
      await tx.user.create({
        data: {
          email,
          name: adminName,
          phone: data.phone || null,
          role: 'ADMIN',
          contractType: 'INDEFINIDO',
          companyId: company.id,
        },
      });
    });

    // Enviar OTP para el primer acceso
    await sendOTP(email);

    return { success: true, message: 'Empresa registrada con éxito. Se ha enviado un código OTP a tu correo.' };
  } catch (error) {
    console.error('Error al registrar empresa:', error);
    return { success: false, message: 'Ocurrió un error al registrar la empresa.' };
  }
}
