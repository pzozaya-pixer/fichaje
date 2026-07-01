'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Obtener los festivos de la empresa
export async function getHolidays() {
  const user = await getCurrentUser();
  if (!user) throw new Error('No autenticado');

  return prisma.holiday.findMany({
    where: { companyId: user.companyId },
    orderBy: { date: 'asc' },
  });
}

// Crear un festivo
export async function createHoliday(dateStr: string, name: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, message: 'No autorizado.' };
  }

  try {
    const parsedDate = new Date(`${dateStr}T00:00:00`);
    
    await prisma.holiday.create({
      data: {
        date: parsedDate,
        name,
        companyId: user.companyId,
      },
    });

    revalidatePath('/dashboard/config');
    revalidatePath('/movil');
    return { success: true, message: 'Festivo creado correctamente.' };
  } catch (error: any) {
    console.error(error);
    if (error.code === 'P2002') {
      return { success: false, message: 'Ya existe un festivo registrado para esta fecha.' };
    }
    return { success: false, message: 'Error al crear el festivo.' };
  }
}

// Eliminar un festivo
export async function deleteHoliday(id: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, message: 'No autorizado.' };
  }

  try {
    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday || holiday.companyId !== user.companyId) {
      return { success: false, message: 'Festivo no encontrado.' };
    }

    await prisma.holiday.delete({ where: { id } });

    revalidatePath('/dashboard/config');
    revalidatePath('/movil');
    return { success: true, message: 'Festivo eliminado correctamente.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al eliminar el festivo.' };
  }
}
