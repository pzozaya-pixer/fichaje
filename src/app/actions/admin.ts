'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser, generateOTP } from '@/lib/auth';
import { Role, ContractType } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { stripe } from '@/lib/stripe';

// Middleware interno para verificar si el usuario es Administrador
async function checkAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== Role.ADMIN) {
    throw new Error('No autorizado. Se requieren permisos de administrador.');
  }
  return user;
}

// Middleware interno para verificar si es Administrador o Consultor (solo lectura)
async function checkAdminOrConsultant() {
  const user = await getCurrentUser();
  if (!user || (user.role !== Role.ADMIN && user.role !== Role.CONSULTANT)) {
    throw new Error('No autorizado.');
  }
  return user;
}

// --- GESTIÓN DE EMPLEADOS ---

export async function getEmployees() {
  const admin = await checkAdminOrConsultant();
  return prisma.user.findMany({
    where: { companyId: admin.companyId },
    include: { department: true, workCenter: true },
    orderBy: { name: 'asc' },
  });
}

export async function saveEmployee(data: {
  id?: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  contractType: ContractType;
  isActive: boolean;
  departmentId?: string;
  workCenterId?: string;
  dailyContractedHours?: number;
  monthlyContractedHours?: number;
}) {
  const admin = await checkAdmin();

  const employeeData = {
    email: data.email.toLowerCase().trim(),
    name: data.name.trim(),
    phone: data.phone || null,
    role: data.role,
    contractType: data.contractType,
    isActive: data.isActive,
    companyId: admin.companyId,
    departmentId: data.departmentId || null,
    workCenterId: data.workCenterId || null,
    dailyContractedHours: data.dailyContractedHours !== undefined ? data.dailyContractedHours : 8.0,
    monthlyContractedHours: data.monthlyContractedHours !== undefined ? data.monthlyContractedHours : 160.0,
  };

  if (data.id) {
    // Actualizar
    const result = await prisma.user.update({
      where: { id: data.id, companyId: admin.companyId },
      data: employeeData,
    });
    revalidatePath('/dashboard/employees');
    return result;
  } else {
    // Crear nuevo
    const result = await prisma.user.create({
      data: employeeData,
    });
    revalidatePath('/dashboard/employees');
    return result;
  }
}

// --- GESTIÓN DE CENTROS DE TRABAJO (MULTICENTRO) ---

export async function getWorkCenters() {
  const admin = await checkAdminOrConsultant();
  return prisma.workCenter.findMany({
    where: { companyId: admin.companyId },
    orderBy: { name: 'asc' },
  });
}

// Función auxiliar para geolocalizar una dirección usando OpenStreetMap Nominatim
async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
      {
        headers: {
          'User-Agent': 'FichajeApp/1.0 (controlhorario@agenciapixer.es)',
        },
      }
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        latitude: parseFloat(data[0].lat),
        longitude: parseFloat(data[0].lon),
      };
    }
    return null;
  } catch (error) {
    console.error('Error al geolocalizar la dirección:', error);
    return null;
  }
}

export async function saveWorkCenter(data: {
  id?: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  radius: number;
}) {
  const admin = await checkAdmin();

  let latitude = data.latitude || 0;
  let longitude = data.longitude || 0;

  // Si hay una dirección, buscar sus coordenadas GPS mediante geocodificación
  if (data.address && data.address.trim().length > 0) {
    const coords = await geocodeAddress(data.address);
    if (coords) {
      latitude = coords.latitude;
      longitude = coords.longitude;
    } else {
      throw new Error('No se pudo geolocalizar la dirección ingresada. Por favor, verifica que esté escrita correctamente.');
    }
  }

  const centerData = {
    name: data.name.trim(),
    address: data.address ? data.address.trim() : null,
    latitude,
    longitude,
    radius: data.radius,
    companyId: admin.companyId,
  };

  if (data.id) {
    const result = await prisma.workCenter.update({
      where: { id: data.id, companyId: admin.companyId },
      data: centerData,
    });
    revalidatePath('/dashboard/config');
    return result;
  } else {
    const result = await prisma.workCenter.create({
      data: centerData,
    });
    revalidatePath('/dashboard/config');
    return result;
  }
}

export async function deleteWorkCenter(id: string) {
  const admin = await checkAdmin();
  await prisma.workCenter.delete({
    where: { id, companyId: admin.companyId },
  });
  revalidatePath('/dashboard/config');
  return { success: true };
}

// --- GESTIÓN DE DEPARTAMENTOS ---

export async function getDepartments() {
  const admin = await checkAdminOrConsultant();
  return prisma.department.findMany({
    where: { companyId: admin.companyId },
    orderBy: { name: 'asc' },
  });
}

export async function saveDepartment(name: string, id?: string) {
  const admin = await checkAdmin();
  if (id) {
    const result = await prisma.department.update({
      where: { id, companyId: admin.companyId },
      data: { name: name.trim() },
    });
    revalidatePath('/dashboard/config');
    return result;
  } else {
    const result = await prisma.department.create({
      data: { name: name.trim(), companyId: admin.companyId },
    });
    revalidatePath('/dashboard/config');
    return result;
  }
}

// --- GESTIÓN E HISTORIAL DE FICHAJES ---

export async function getClockIns(filters?: {
  startDate?: string;
  endDate?: string;
  departmentId?: string;
  workCenterId?: string;
  search?: string;
}) {
  const admin = await checkAdminOrConsultant();
  const whereClause: any = {
    user: {
      companyId: admin.companyId,
    },
  };

  if (filters) {
    if (filters.startDate || filters.endDate) {
      whereClause.entryTime = {};
      if (filters.startDate) {
        whereClause.entryTime.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Asegurar que abarque todo el día
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.entryTime.lte = end;
      }
    }
    if (filters.departmentId && filters.departmentId !== 'all') {
      whereClause.user.departmentId = filters.departmentId;
    }
    if (filters.workCenterId && filters.workCenterId !== 'all') {
      whereClause.workCenterId = filters.workCenterId;
    }
    if (filters.search) {
      whereClause.user.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }
  }

  const clockIns = await prisma.clockIn.findMany({
    where: whereClause,
    include: {
      user: {
        include: { department: true },
      },
      workCenter: true,
      auditLogs: {
        include: { editedBy: true },
      },
    },
    orderBy: { entryTime: 'desc' },
  });

  // Calcular tiempos netos trabajados
  return clockIns.map((f) => {
    let durationMs = 0;
    let breakMs = 0;
    const breaks = (f.breaks as Array<{ start: string; end: string | null }>) || [];

    breaks.forEach((b) => {
      if (b.start && b.end) {
        breakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
      }
    });

    if (f.exitTime) {
      durationMs = f.exitTime.getTime() - f.entryTime.getTime() - breakMs;
    } else {
      durationMs = new Date().getTime() - f.entryTime.getTime() - breakMs;
    }

    return {
      ...f,
      durationMs: Math.max(0, durationMs),
      breakMs,
    };
  });
}

// MODIFICACIÓN DE FICHAJE (CON AUDITORÍA - LEGISLACIÓN ESPAÑOLA)
export async function saveClockInEdit(
  clockInId: string,
  data: {
    entryTime: string;
    exitTime: string | null;
    breaks: Array<{ start: string; end: string | null }>;
  },
  reason: string
) {
  const admin = await checkAdmin();

  if (!reason || reason.trim().length < 5) {
    return { success: false, message: 'Es obligatorio indicar un motivo justificado de más de 5 caracteres.' };
  }

  // Buscar el fichaje original
  const original = await prisma.clockIn.findUnique({
    where: { id: clockInId },
  });

  if (!original) {
    return { success: false, message: 'Fichaje no encontrado.' };
  }

  const newEntry = new Date(data.entryTime);
  const newExit = data.exitTime ? new Date(data.exitTime) : null;

  try {
    const auditLogsToCreate = [];

    // Comparar fecha de entrada
    if (original.entryTime.getTime() !== newEntry.getTime()) {
      auditLogsToCreate.push({
        clockInId,
        editedById: admin.id,
        fieldName: 'entryTime',
        oldValue: original.entryTime.toISOString(),
        newValue: newEntry.toISOString(),
        reason,
      });
    }

    // Comparar fecha de salida
    const oldExitTime = original.exitTime ? original.exitTime.getTime() : 0;
    const newExitTime = newExit ? newExit.getTime() : 0;

    if (oldExitTime !== newExitTime) {
      auditLogsToCreate.push({
        clockInId,
        editedById: admin.id,
        fieldName: 'exitTime',
        oldValue: original.exitTime ? original.exitTime.toISOString() : 'null',
        newValue: newExit ? newExit.toISOString() : 'null',
        reason,
      });
    }

    // Comparar pausas (Breaks)
    const oldBreaksStr = JSON.stringify(original.breaks || []);
    const newBreaksStr = JSON.stringify(data.breaks || []);

    if (oldBreaksStr !== newBreaksStr) {
      auditLogsToCreate.push({
        clockInId,
        editedById: admin.id,
        fieldName: 'breaks',
        oldValue: oldBreaksStr,
        newValue: newBreaksStr,
        reason,
      });
    }

    // Realizar la actualización y crear logs de auditoría en una transacción
    await prisma.$transaction([
      prisma.clockIn.update({
        where: { id: clockInId },
        data: {
          entryTime: newEntry,
          exitTime: newExit,
          breaks: data.breaks,
          status: newExit ? 'COMPLETED' : 'IN_PROGRESS',
        },
      }),
      ...auditLogsToCreate.map((log) => prisma.auditLog.create({ data: log })),
    ]);

    revalidatePath('/dashboard/fichajes');
    return { success: true, message: 'Fichaje actualizado y registrado en la auditoría con éxito.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al actualizar el fichaje.' };
  }
}

// FICHAJE MANUAL POR EL ADMINISTRADOR (CON AUDITORÍA)
export async function manualClockIn(data: {
  userId: string;
  entryTime: string;
  exitTime: string | null;
  reason: string;
}) {
  const admin = await checkAdmin();

  if (!data.reason || data.reason.trim().length < 5) {
    return { success: false, message: 'Es obligatorio indicar un motivo justificativo.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: data.userId, companyId: admin.companyId },
  });

  if (!user) {
    return { success: false, message: 'Empleado no encontrado.' };
  }

  try {
    const entryTime = new Date(data.entryTime);
    const exitTime = data.exitTime ? new Date(data.exitTime) : null;

    // Crear el fichaje manual
    const clockIn = await prisma.clockIn.create({
      data: {
        userId: user.id,
        workCenterId: user.workCenterId,
        entryTime,
        exitTime,
        isManual: true,
        entryInZone: true,
        exitInZone: true,
        status: exitTime ? 'COMPLETED' : 'IN_PROGRESS',
      },
    });

    // Registrar en el historial de auditoría el motivo de la creación manual
    await prisma.auditLog.create({
      data: {
        clockInId: clockIn.id,
        editedById: admin.id,
        fieldName: 'creation',
        oldValue: '',
        newValue: 'manual',
        reason: `Fichaje manual creado por Administrador. Motivo: ${data.reason}`,
      },
    });

    revalidatePath('/dashboard/fichajes');
    return { success: true, message: 'Fichaje manual creado correctamente.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al crear el fichaje manual.' };
  }
}

// --- INFORMES Y ESTADÍSTICAS DEL PANEL ---

export async function getReportsData() {
  const admin = await checkAdminOrConsultant();
  
  // Obtenemos los fichajes de este mes
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  const fichajes = await getClockIns({
    startDate: startOfMonth.toISOString(),
    endDate: endOfMonth.toISOString(),
  });

  const totalEmployees = await prisma.user.count({
    where: { companyId: admin.companyId, isActive: true, role: Role.EMPLOYEE },
  });

  let totalWorkedMs = 0;
  let totalOvertimeMs = 0;

  fichajes.forEach((f) => {
    totalWorkedMs += f.durationMs;
    // Si la jornada dura más de 8h, se considera horas extra
    const hours = f.durationMs / (1000 * 60 * 60);
    if (hours > 8) {
      totalOvertimeMs += (hours - 8) * 1000 * 60 * 60;
    }
  });

  // Generar datos para el gráfico de líneas (horas trabajadas por día en el mes)
  // Agrupar por día
  const daysMap: { [key: string]: number } = {};
  
  // Rellenar días del mes transcurridos
  for (let d = 1; d <= today.getDate(); d++) {
    const dateStr = `${d} Jun`; // Simplificado para visualización
    daysMap[dateStr] = 0;
  }

  fichajes.forEach((f) => {
    const day = f.entryTime.getDate();
    const dateStr = `${day} Jun`;
    if (daysMap[dateStr] !== undefined) {
      daysMap[dateStr] += f.durationMs / (1000 * 60 * 60);
    }
  });

  const chartData = Object.keys(daysMap).map((day) => ({
    day,
    hours: parseFloat(daysMap[day].toFixed(1)),
  }));

  const totalWorkedHours = totalWorkedMs / (1000 * 60 * 60);
  const totalOvertimeHours = totalOvertimeMs / (1000 * 60 * 60);

  return {
    totalWorkedHours: parseFloat(totalWorkedHours.toFixed(1)),
    workedHoursProgress: Math.min(100, Math.round((totalWorkedHours / (totalEmployees * 160)) * 100)) || 0, // Objetivo de 160h/mes por empleado
    totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(1)),
    overtimeProgress: Math.min(100, Math.round((totalOvertimeHours / (totalEmployees * 10)) * 100)) || 0, // Ejemplo de límite de 10h/mes
    activeEmployees: totalEmployees,
    daysWorked: fichajes.length,
    chartData,
  };
}

export async function requestCompanyDeletionOtp() {
  const admin = await checkAdmin();

  try {
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await prisma.user.update({
      where: { id: admin.id },
      data: {
        otpCode: otp,
        otpExpiresAt,
      },
    });

    // Enviar correo personalizado de baja
    const transporter = require('nodemailer').createTransport({
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASSWORD || '',
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@example.com',
      to: admin.email,
      subject: 'Confirmación de baja de empresa - Fichaje.click',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #ef4444; text-align: center;">Confirmación de Baja de Empresa</h2>
          <p>Hola, <strong>${admin.name}</strong>.</p>
          <p>Has solicitado dar de baja tu empresa (<strong>${admin.company.name}</strong>) en Fichaje.click.</p>
          <p style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; color: #991b1b; font-weight: bold;">
            ADVERTENCIA: Esta acción eliminará permanentemente la empresa, todos sus centros de trabajo, departamentos, datos de empleados y todo el historial de fichajes de forma irreversible.
          </p>
          <p>Para confirmar esta acción, introduce el siguiente código OTP en la aplicación:</p>
          <div style="text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #ef4444; background-color: #f1f5f9; padding: 12px 24px; border-radius: 6px; display: inline-block;">${otp}</span>
          </div>
          <p>Este código expirará en 10 minutos.</p>
          <p>Si no has solicitado esta baja, por favor ignora este correo y ponte en contacto con soporte inmediatamente.</p>
        </div>
      `,
    };

    // Si es una cuenta demo, omitir envío real y loguear
    if (admin.email.endsWith('@demo.com')) {
      console.log(`\n--- [BAJA EMPRESA] Código OTP de baja para ${admin.email}: ${otp} ---\n`);
    } else {
      await transporter.sendMail(mailOptions);
    }

    return { success: true, message: 'Código de confirmación enviado a tu correo.' };
  } catch (error) {
    console.error('Error al solicitar OTP de baja:', error);
    return { success: false, message: 'Ocurrió un error al procesar la solicitud.' };
  }
}

export async function confirmCompanyDeletion(otpCode: string) {
  const admin = await checkAdmin();

  try {
    const user = await prisma.user.findUnique({
      where: { id: admin.id },
    });

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      return { success: false, message: 'Código no solicitado.' };
    }

    if (new Date() > user.otpExpiresAt) {
      return { success: false, message: 'El código ha expirado.' };
    }

    if (user.otpCode !== otpCode) {
      return { success: false, message: 'Código incorrecto.' };
    }

    const companyId = admin.companyId;

    // Si la empresa tiene una suscripción de Stripe activa, cancelarla
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });

    if (company && company.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(company.stripeSubscriptionId);
        console.log(`[STRIPE] Suscripción ${company.stripeSubscriptionId} cancelada con éxito al dar de baja la empresa ${companyId}`);
      } catch (stripeError) {
        console.error('[STRIPE] Error al cancelar la suscripción durante la baja:', stripeError);
      }
    }

    // Eliminar la empresa (esto desencadena el borrado en cascada de todos los datos!)
    await prisma.company.delete({
      where: { id: companyId },
    });

    // Eliminar la cookie de sesión
    const cookieStore = await cookies();
    cookieStore.delete('auth_session');

    return { success: true };
  } catch (error) {
    console.error('Error al confirmar baja de empresa:', error);
    return { success: false, message: 'Ocurrió un error al procesar la baja de la empresa.' };
  }
}
