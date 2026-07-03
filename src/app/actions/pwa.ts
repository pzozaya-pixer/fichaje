'use server';

import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// Fórmula de Haversine para calcular la distancia en metros entre dos puntos GPS
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radio de la Tierra en metros
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distancia en metros
}

// Obtener el estado del fichaje de hoy para el empleado
export async function getTodayStatus() {
  const user = await getCurrentUser();
  if (!user) throw new Error('No autorizado');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Buscar si hay un fichaje hoy
  const clockIn = await prisma.clockIn.findFirst({
    where: {
      userId: user.id,
      entryTime: {
        gte: today,
        lt: tomorrow,
      },
    },
    orderBy: {
      entryTime: 'desc',
    },
  });

  if (!clockIn) {
    return {
      hasClockedIn: false,
      isActive: false,
      clockIn: null,
      workedTimeMs: 0,
      isOnBreak: false,
    };
  }

  // Calcular tiempo trabajado y estado de pausas
  let workedTimeMs = 0;
  let isOnBreak = false;
  const breaks = (clockIn.breaks as Array<{ start: string; end: string | null }>) || [];

  if (clockIn.exitTime) {
    // Fichaje completado
    workedTimeMs = clockIn.exitTime.getTime() - clockIn.entryTime.getTime();
    
    // Restar las pausas completadas
    breaks.forEach((b) => {
      if (b.start && b.end) {
        workedTimeMs -= new Date(b.end).getTime() - new Date(b.start).getTime();
      }
    });
  } else {
    // Fichaje activo (en curso)
    const now = new Date();
    workedTimeMs = now.getTime() - clockIn.entryTime.getTime();
    
    // Restar pausas completadas y verificar si está en pausa actualmente
    breaks.forEach((b) => {
      if (b.start) {
        if (b.end) {
          workedTimeMs -= new Date(b.end).getTime() - new Date(b.start).getTime();
        } else {
          // Está en pausa activa ahora mismo
          isOnBreak = true;
          workedTimeMs -= now.getTime() - new Date(b.start).getTime();
        }
      }
    });
  }

  return {
    hasClockedIn: true,
    isActive: !clockIn.exitTime,
    clockIn,
    workedTimeMs: Math.max(0, workedTimeMs),
    isOnBreak,
  };
}

// Acción para Fichar Entrada
export async function clockInAction(lat: number, lng: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: 'Sesión no válida.' };

  // Validar restricción de horario (+/- 5 minutos de margen)
  if (user.weeklySchedule && !user.allowOutsideSchedule) {
    const today = new Date();
    const dayKey = String(today.getDay());
    const schedule = user.weeklySchedule as Record<string, { enabled: boolean; start: string; end: string }>;
    const daySched = schedule[dayKey];

    if (!daySched || !daySched.enabled) {
      return {
        success: false,
        message: 'No tienes jornada laboral programada para hoy. Contacta con tu administrador para fichar fuera de horario.',
      };
    }

    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const [startH, startM] = daySched.start.split(':').map(Number);
    const startMinutes = startH * 60 + startM;

    if (Math.abs(currentMinutes - startMinutes) > 5) {
      return {
        success: false,
        message: `Fichaje denegado: solo puedes fichar la entrada dentro del margen de 5 minutos de tu horario programado (${daySched.start}). Para fichar fuera de este rango, solicita autorización a tu administrador.`,
      };
    }
  }

  if (!user.workCenter) {
    return { success: false, message: 'No tienes un centro de trabajo asignado. Contacta con RRHH.' };
  }

  const center = user.workCenter;
  
  // Calcular distancia a la geocerca del centro de trabajo
  const distance = getDistance(lat, lng, center.latitude, center.longitude);
  const isWithinGeofence = distance <= center.radius;

  // Como la geocerca es restrictiva, bloqueamos el fichaje si está fuera
  if (!isWithinGeofence) {
    return {
      success: false,
      message: `Fuera de la zona permitida. Distancia: ${Math.round(distance)}m (Máximo permitido: ${center.radius}m de ${center.name}).`,
    };
  }

  // Verificar si ya tiene un fichaje activo hoy
  const todayStatus = await getTodayStatus();
  if (todayStatus.isActive) {
    return { success: false, message: 'Ya tienes un fichaje activo en curso.' };
  }

  try {
    await prisma.clockIn.create({
      data: {
        userId: user.id,
        workCenterId: center.id,
        entryTime: new Date(),
        entryLat: lat,
        entryLng: lng,
        entryDistance: distance,
        entryInZone: true,
        status: 'IN_PROGRESS',
      },
    });

    revalidatePath('/movil');
    return { success: true, message: 'Fichaje de entrada registrado correctamente.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al registrar el fichaje.' };
  }
}

// Acción para Fichar Salida
export async function clockOutAction(lat: number, lng: number) {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: 'Sesión no válida.' };

  // Validar restricción de horario (+/- 5 minutos de margen)
  if (user.weeklySchedule && !user.allowOutsideSchedule) {
    const today = new Date();
    const dayKey = String(today.getDay());
    const schedule = user.weeklySchedule as Record<string, { enabled: boolean; start: string; end: string }>;
    const daySched = schedule[dayKey];

    if (!daySched || !daySched.enabled) {
      return {
        success: false,
        message: 'No tienes jornada laboral programada para hoy. Contacta con tu administrador para fichar fuera de horario.',
      };
    }

    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    const [endH, endM] = daySched.end.split(':').map(Number);
    const endMinutes = endH * 60 + endM;

    if (Math.abs(currentMinutes - endMinutes) > 5) {
      return {
        success: false,
        message: `Fichaje denegado: solo puedes fichar la salida dentro del margen de 5 minutos de tu horario programado (${daySched.end}). Para fichar fuera de este rango, solicita autorización a tu administrador.`,
      };
    }
  }

  if (!user.workCenter) {
    return { success: false, message: 'No tienes un centro de trabajo asignado.' };
  }

  const center = user.workCenter;

  // Buscar el fichaje activo
  const activeClockIn = await prisma.clockIn.findFirst({
    where: {
      userId: user.id,
      exitTime: null,
    },
  });

  if (!activeClockIn) {
    return { success: false, message: 'No tienes ningún fichaje activo para finalizar.' };
  }

  // Calcular distancia a la geocerca
  const distance = getDistance(lat, lng, center.latitude, center.longitude);
  const isWithinGeofence = distance <= center.radius;

  if (!isWithinGeofence) {
    return {
      success: false,
      message: `Fuera de la zona permitida. Distancia: ${Math.round(distance)}m (Máximo: ${center.radius}m de ${center.name}).`,
    };
  }

  try {
    // Cerrar cualquier pausa que haya quedado abierta
    let breaks = (activeClockIn.breaks as Array<{ start: string; end: string | null }>) || [];
    let updatedBreaks = false;
    breaks = breaks.map((b) => {
      if (b.start && !b.end) {
        updatedBreaks = true;
        return { ...b, end: new Date().toISOString() };
      }
      return b;
    });

    await prisma.clockIn.update({
      where: { id: activeClockIn.id },
      data: {
        exitTime: new Date(),
        exitLat: lat,
        exitLng: lng,
        exitDistance: distance,
        exitInZone: true,
        breaks: (updatedBreaks ? updatedBreaks : activeClockIn.breaks) as any,
        status: 'COMPLETED',
      },
    });

    revalidatePath('/movil');
    return { success: true, message: 'Fichaje de salida registrado correctamente.' };
  } catch (error) {
    console.error(error);
    return { success: false, message: 'Error al registrar la salida.' };
  }
}

// Acción para Iniciar Pausa / Break
export async function startBreakAction() {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: 'Sesión no válida.' };

  const activeClockIn = await prisma.clockIn.findFirst({
    where: {
      userId: user.id,
      exitTime: null,
    },
  });

  if (!activeClockIn) {
    return { success: false, message: 'No tienes un fichaje activo.' };
  }

  const breaks = (activeClockIn.breaks as Array<{ start: string; end: string | null }>) || [];
  
  // Verificar si ya está en pausa
  if (breaks.some((b) => !b.end)) {
    return { success: false, message: 'Ya te encuentras en una pausa.' };
  }

  try {
    const newBreak = { start: new Date().toISOString(), end: null };
    await prisma.clockIn.update({
      where: { id: activeClockIn.id },
      data: {
        breaks: [...breaks, newBreak],
      },
    });

    revalidatePath('/movil');
    return { success: true, message: 'Pausa iniciada.' };
  } catch (error) {
    return { success: false, message: 'Error al iniciar la pausa.' };
  }
}

// Acción para Finalizar Pausa / Break
export async function endBreakAction() {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: 'Sesión no válida.' };

  const activeClockIn = await prisma.clockIn.findFirst({
    where: {
      userId: user.id,
      exitTime: null,
    },
  });

  if (!activeClockIn) {
    return { success: false, message: 'No tienes un fichaje activo.' };
  }

  let breaks = (activeClockIn.breaks as Array<{ start: string; end: string | null }>) || [];
  const activeBreakIndex = breaks.findIndex((b) => !b.end);

  if (activeBreakIndex === -1) {
    return { success: false, message: 'No tienes ninguna pausa activa.' };
  }

  try {
    breaks[activeBreakIndex].end = new Date().toISOString();

    await prisma.clockIn.update({
      where: { id: activeClockIn.id },
      data: {
        breaks,
      },
    });

    revalidatePath('/movil');
    return { success: true, message: 'Pausa finalizada.' };
  } catch (error) {
    return { success: false, message: 'Error al finalizar la pausa.' };
  }
}

// Obtener fichajes del empleado dentro de un rango de fechas
export async function getMyFichajes(startDate?: Date, endDate?: Date) {
  const user = await getCurrentUser();
  if (!user) throw new Error('No autorizado');

  const whereClause: any = { userId: user.id };

  if (startDate || endDate) {
    whereClause.entryTime = {};
    if (startDate) whereClause.entryTime.gte = startDate;
    if (endDate) whereClause.entryTime.lte = endDate;
  }

  const fichajes = await prisma.clockIn.findMany({
    where: whereClause,
    orderBy: { entryTime: 'desc' },
  });

  // Mapear duraciones
  return fichajes.map((f) => {
    let durationMs = 0;
    let breakMs = 0;
    const breaks = (f.breaks as Array<{ start: string; end: string | null }>) || [];
    let hasActiveBreak = false;
    let activeBreakStart: Date | null = null;

    breaks.forEach((b) => {
      if (b.start) {
        if (b.end) {
          breakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
        } else {
          hasActiveBreak = true;
          activeBreakStart = new Date(b.start);
        }
      }
    });

    if (f.exitTime) {
      durationMs = f.exitTime.getTime() - f.entryTime.getTime() - breakMs;
    } else {
      const now = new Date();
      durationMs = now.getTime() - f.entryTime.getTime() - breakMs;
      if (hasActiveBreak && activeBreakStart) {
        // Restar el tiempo transcurrido en la pausa activa
        durationMs -= now.getTime() - (activeBreakStart as Date).getTime();
      }
    }

    return {
      ...f,
      durationMs: Math.max(0, durationMs),
      breakMs,
    };
  });
}

// Obtener resumen estadístico del mes en curso para el empleado
export async function getMySummary() {
  const user = await getCurrentUser();
  if (!user) throw new Error('No autorizado');

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

  const fichajes = await getMyFichajes(startOfMonth, endOfMonth);

  let totalWorkedMs = 0;
  let totalBreakMs = 0;
  let daysWorked = 0;

  fichajes.forEach((f) => {
    totalWorkedMs += f.durationMs;
    totalBreakMs += f.breakMs;
    if (f.status === 'COMPLETED') {
      daysWorked++;
    }
  });

  // Supongamos 8h diarias previstas por día laborable
  const hoursWorked = totalWorkedMs / (1000 * 60 * 60);
  const targetHours = 20 * 8; // 20 días hábiles de media * 8h
  const progressPercentage = Math.min(100, Math.round((hoursWorked / targetHours) * 100));

  // Balance (cualquier tiempo por encima de 8h diarias o acumulado)
  // Calculamos el exceso diario
  let extraHours = 0;
  fichajes.forEach((f) => {
    const hours = f.durationMs / (1000 * 60 * 60);
    if (hours > 8) {
      extraHours += hours - 8;
    }
  });

  return {
    hoursWorked: parseFloat(hoursWorked.toFixed(2)),
    targetHours,
    progressPercentage,
    extraHours: parseFloat(extraHours.toFixed(2)),
    daysWorked,
    totalDaysInMonth: 20, // aproximado para el diseño
    totalBreakHours: parseFloat((totalBreakMs / (1000 * 60 * 60)).toFixed(2)),
  };
}
