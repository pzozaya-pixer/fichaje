process.env.TZ = process.env.TZ || 'Europe/Madrid';

import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { sendOTPEmail } from './email';

const JWT_SECRET = process.env.JWT_SECRET || 'secreto_por_defecto_desarrollo_123';
const COOKIE_NAME = 'auth_session';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  companyId: string;
}

// Genera un código OTP de 6 dígitos
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Firma un token JWT
export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// Verifica un token JWT
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Obtiene el usuario actual desde la cookie de sesión (para Server Components/Actions)
export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    const payload = verifyToken(token);
    if (!payload) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        company: true,
        department: true,
        workCenter: true,
      },
    });

    if (!user || !user.isActive) return null;

    // Verificar si el periodo de prueba de la empresa ha terminado y no ha pagado
    const now = new Date();
    if (
      user.company.subscriptionStatus === 'trialing' &&
      now > user.company.trialEndsAt
    ) {
      // Período de prueba expirado
      return { ...user, isSubscriptionExpired: true };
    } else if (
      user.company.subscriptionStatus !== 'active' &&
      user.company.subscriptionStatus !== 'trialing'
    ) {
      // Suscripción inactiva
      return { ...user, isSubscriptionExpired: true };
    }

    return { ...user, isSubscriptionExpired: false };
  } catch (error) {
    return null;
  }
}

// Envía un código OTP a un usuario por correo
export async function sendOTP(email: string): Promise<{ success: boolean; message: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true },
    });

    if (!user) {
      return { success: false, message: 'El correo electrónico no está registrado.' };
    }

    if (!user.isActive) {
      return { success: false, message: 'Esta cuenta de usuario está desactivada.' };
    }

    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: otp,
        otpExpiresAt,
      },
    });

    await sendOTPEmail(user.email, user.name, otp);

    return { success: true, message: 'Código OTP enviado con éxito.' };
  } catch (error) {
    console.error('Error al enviar OTP:', error);
    return { success: false, message: 'Ocurrió un error al procesar la solicitud.' };
  }
}

// Verifica el código OTP y crea la sesión
export async function verifyOTP(email: string, code: string): Promise<{ success: boolean; message: string; role?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: true },
    });

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      return { success: false, message: 'Código no solicitado o expirado.' };
    }

    if (new Date() > user.otpExpiresAt) {
      return { success: false, message: 'El código ha expirado. Solicita uno nuevo.' };
    }

    if (user.otpCode !== code) {
      return { success: false, message: 'Código incorrecto.' };
    }

    // Limpiar el código OTP de la base de datos
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiresAt: null,
      },
    });

    // Crear token de sesión
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    // Establecer la cookie de sesión
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 365 días (1 año)
      path: '/',
    });

    return { success: true, message: 'Sesión iniciada con éxito.', role: user.role };
  } catch (error) {
    console.error('Error al verificar OTP:', error);
    return { success: false, message: 'Ocurrió un error al verificar el código.' };
  }
}

// Cierra la sesión del usuario
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return { success: true };
}

// Inicia sesión de manera inmediata sin requerir código OTP (para usuarios existentes)
export async function loginWithoutOTP(email: string): Promise<{ success: boolean; message: string; role?: string }> {
  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { company: true },
    });

    if (!user) {
      return { success: false, message: 'El correo electrónico no está registrado.' };
    }

    if (!user.isActive) {
      return { success: false, message: 'Esta cuenta de usuario está desactivada.' };
    }

    // Crear token de sesión
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    });

    // Establecer la cookie de sesión por 1 año
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 365 días (1 año)
      path: '/',
    });

    return { success: true, message: 'Sesión iniciada con éxito.', role: user.role };
  } catch (error) {
    console.error('Error en login sin OTP:', error);
    return { success: false, message: 'Ocurrió un error al iniciar sesión.' };
  }
}
