'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { VacationStatus, VacationType } from '@prisma/client';

// Solicitar vacaciones (Empleado)
export async function requestVacation(
  startDateStr: string,
  endDateStr: string,
  type: 'NATURALES' | 'LABORABLES' | 'CONVENIO',
  daysCount: number,
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: 'No autenticado.' };

  try {
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59.999`);

    if (start > end) {
      return { success: false, message: 'La fecha de inicio debe ser anterior a la de fin.' };
    }

    // Comprobar si hay solicitudes superpuestas aprobadas o pendientes para este empleado
    const overlapping = await prisma.vacation.findFirst({
      where: {
        userId: user.id,
        status: { in: [VacationStatus.PENDING, VacationStatus.APPROVED] },
        OR: [
          {
            startDate: { lte: end },
            endDate: { gte: start },
          },
        ],
      },
    });

    if (overlapping) {
      return {
        success: false,
        message: `Ya tienes una solicitud pendiente o aprobada que se superpone con este rango (${overlapping.status === 'APPROVED' ? 'Aprobada' : 'Pendiente'}).`,
      };
    }

    await prisma.vacation.create({
      data: {
        startDate: start,
        endDate: end,
        type: type as VacationType,
        daysCount,
        notes: notes || null,
        userId: user.id,
        companyId: user.companyId,
        status: VacationStatus.PENDING,
      },
    });

    revalidatePath('/movil');
    revalidatePath('/dashboard/vacations');
    return { success: true, message: 'Solicitud de vacaciones enviada correctamente.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al enviar la solicitud.' };
  }
}

// Obtener las vacaciones de un empleado
export async function getMyVacations() {
  const user = await getCurrentUser();
  if (!user) throw new Error('No autenticado');

  const vacations = await prisma.vacation.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'desc' },
  });

  // Calcular el saldo
  const approved = vacations
    .filter((v) => v.status === VacationStatus.APPROVED)
    .reduce((sum, v) => sum + v.daysCount, 0);

  const pending = vacations
    .filter((v) => v.status === VacationStatus.PENDING)
    .reduce((sum, v) => sum + v.daysCount, 0);

  const allocated = user.vacationDaysAllocated || 30;

  return {
    vacations,
    summary: {
      allocated,
      approved,
      pending,
      remaining: Math.max(0, allocated - approved),
    },
  };
}

// Obtener todas las vacaciones para el Administrador (RRHH)
export async function getVacationsAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') throw new Error('No autorizado');

  return prisma.vacation.findMany({
    where: { companyId: user.companyId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          vacationDaysAllocated: true,
        },
      },
      resolvedBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { startDate: 'desc' },
  });
}

// Aprobar o rechazar solicitud de vacaciones (Admin)
export async function resolveVacation(id: string, status: 'APPROVED' | 'REJECTED') {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, message: 'No autorizado.' };
  }

  try {
    const vacation = await prisma.vacation.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!vacation || vacation.companyId !== user.companyId) {
      return { success: false, message: 'Solicitud no encontrada.' };
    }

    if (vacation.status !== VacationStatus.PENDING) {
      return { success: false, message: 'Esta solicitud ya ha sido resuelta.' };
    }

    await prisma.vacation.update({
      where: { id },
      data: {
        status: status as VacationStatus,
        resolvedById: user.id,
      },
    });

    revalidatePath('/movil');
    revalidatePath('/dashboard/vacations');
    return { success: true, message: `Solicitud ${status === 'APPROVED' ? 'aprobada' : 'rechazada'} correctamente.` };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al resolver la solicitud.' };
  }
}

// Asignar vacaciones directamente (Admin)
export async function assignVacationDirect(
  employeeId: string,
  startDateStr: string,
  endDateStr: string,
  type: 'NATURALES' | 'LABORABLES' | 'CONVENIO',
  daysCount: number,
  notes?: string
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, message: 'No autorizado.' };
  }

  try {
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59.999`);

    if (start > end) {
      return { success: false, message: 'La fecha de inicio debe ser anterior a la de fin.' };
    }

    // Guardar directamente como APPROVED
    await prisma.vacation.create({
      data: {
        startDate: start,
        endDate: end,
        type: type as VacationType,
        daysCount,
        notes: notes || 'Asignado directamente por RRHH',
        userId: employeeId,
        companyId: user.companyId,
        status: VacationStatus.APPROVED,
        resolvedById: user.id,
      },
    });

    revalidatePath('/movil');
    revalidatePath('/dashboard/vacations');
    return { success: true, message: 'Vacaciones asignadas correctamente.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al asignar las vacaciones.' };
  }
}

// Actualizar cupo de días de vacaciones de un empleado (Admin)
export async function updateEmployeeAllocatedDays(employeeId: string, days: number) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, message: 'No autorizado.' };
  }

  try {
    const emp = await prisma.user.findUnique({ where: { id: employeeId } });
    if (!emp || emp.companyId !== user.companyId) {
      return { success: false, message: 'Empleado no encontrado.' };
    }

    await prisma.user.update({
      where: { id: employeeId },
      data: {
        vacationDaysAllocated: days,
      },
    });

    revalidatePath('/dashboard/vacations');
    revalidatePath('/movil');
    return { success: true, message: 'Cupo de vacaciones actualizado correctamente.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al actualizar el cupo.' };
  }
}
