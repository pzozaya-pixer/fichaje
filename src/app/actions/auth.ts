'use server';

import { sendOTP, verifyOTP, logout, loginWithoutOTP } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

async function verifyTurnstileToken(token: string | null): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) {
    console.warn('TURNSTILE_SECRET_KEY no está configurada. Saltando verificación de Turnstile.');
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: secretKey,
        response: token,
      }),
    });

    const data = await response.json();
    return !!data.success;
  } catch (error) {
    console.error('Error al verificar el token de Turnstile:', error);
    return false;
  }
}

export async function requestOtpAction(prevState: any, formData: FormData): Promise<{
  success: boolean;
  message?: string;
  immediate?: boolean;
  role?: string;
}> {
  const email = formData.get('email') as string;
  const turnstileToken = formData.get('cf-turnstile-response') as string;

  if (!email) {
    return { success: false, message: 'El correo electrónico es obligatorio.' };
  }

  // Verificar Turnstile
  const isHuman = await verifyTurnstileToken(turnstileToken);
  if (!isHuman) {
    return { success: false, message: 'La verificación de seguridad de Turnstile falló. Inténtalo de nuevo.' };
  }

  // Intentar iniciar sesión inmediatamente sin OTP para usuarios registrados
  const result = await loginWithoutOTP(email);
  if (result.success) {
    return { success: true, immediate: true, role: result.role };
  }

  return result;
}

export async function verifyOtpAction(email: string, otpCode: string, redirectTo?: string | null) {
  if (!email || !otpCode) {
    return { success: false, message: 'Todos los campos son obligatorios.' };
  }

  const result = await verifyOTP(email, otpCode);

  if (result.success) {
    if (redirectTo) {
      const target = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
      redirect(target);
    } else if (result.role === 'ADMIN' || result.role === 'CONSULTANT') {
      redirect('/dashboard');
    } else {
      redirect('/movil');
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
  employees?: string;
  turnstileToken?: string;
}) {
  const email = data.email.toLowerCase().trim();
  const companyName = data.companyName.trim();
  const cif = data.cif.trim();
  const adminName = data.adminName.trim();
  const employees = data.employees;
  const turnstileToken = data.turnstileToken;

  console.log(`Registro de empresa con tramo de empleados: ${employees || 'no especificado'}`);

  if (!email || !companyName || !cif || !adminName) {
    return { success: false, message: 'Todos los campos son obligatorios.' };
  }

  // Verificar Turnstile
  const isHuman = await verifyTurnstileToken(turnstileToken || null);
  if (!isHuman) {
    return { success: false, message: 'La verificación de seguridad de Turnstile falló. Inténtalo de nuevo.' };
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

      // 4. Crear usuario inspector automático (con rol CONSULTANT)
      const domain = email.split('@')[1];
      const inspectorEmail = `inspector@${domain}`;

      if (inspectorEmail !== email) {
        await tx.user.create({
          data: {
            email: inspectorEmail,
            name: 'Inspector de Trabajo',
            role: 'CONSULTANT',
            contractType: 'INDEFINIDO',
            companyId: company.id,
          },
        });
      }
    });

    // Enviar OTP para el primer acceso
    await sendOTP(email);

    return { success: true, message: 'Empresa registrada con éxito. Se ha enviado un código OTP a tu correo.' };
  } catch (error) {
    console.error('Error al registrar empresa:', error);
    return { success: false, message: 'Ocurrió un error al registrar la empresa.' };
  }
}
