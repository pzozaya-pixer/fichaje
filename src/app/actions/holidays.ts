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
    const parsedDate = new Date(`${dateStr}T00:00:00Z`);
    
    const newHoliday = await prisma.holiday.create({
      data: {
        date: parsedDate,
        name,
        companyId: user.companyId,
      },
    });

    revalidatePath('/dashboard/config');
    revalidatePath('/movil');
    return { 
      success: true, 
      message: 'Festivo creado correctamente.',
      holiday: {
        id: newHoliday.id,
        date: newHoliday.date.toISOString(),
        name: newHoliday.name
      }
    };
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

// Importar festivos en lote
export async function importHolidays(holidaysList: { date: string; name: string }[]) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, message: 'No autorizado.' };
  }

  if (!Array.isArray(holidaysList) || holidaysList.length === 0) {
    return { success: false, message: 'La lista de festivos a importar está vacía o es inválida.' };
  }

  try {
    const dataToInsert = holidaysList.map((h) => ({
      date: new Date(`${h.date}T00:00:00Z`),
      name: h.name.trim(),
      companyId: user.companyId,
    }));

    const result = await prisma.holiday.createMany({
      data: dataToInsert,
      skipDuplicates: true,
    });

    const updatedHolidays = await prisma.holiday.findMany({
      where: { companyId: user.companyId },
      orderBy: { date: 'asc' },
    });

    revalidatePath('/dashboard/config');
    revalidatePath('/movil');

    return {
      success: true,
      message: `Se han importado ${result.count} festivos correctamente.`,
      count: result.count,
      holidays: updatedHolidays.map((h) => ({
        id: h.id,
        date: h.date.toISOString(),
        name: h.name,
      })),
    };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al importar los festivos.' };
  }
}
