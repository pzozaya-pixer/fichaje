import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateExcelReport } from '@/lib/exporters';
import { Role } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    // 1. Autenticación y Autorización
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== Role.ADMIN && currentUser.role !== Role.CONSULTANT)) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    // 2. Obtener parámetros de búsqueda
    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const departmentId = searchParams.get('departmentId');
    const workCenterId = searchParams.get('workCenterId');
    const search = searchParams.get('search');

    // Fechas por defecto si no se especifican (mes actual)
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const start = startDateStr || defaultStart;
    const end = endDateStr || defaultEnd;

    // 3. Consultar datos de fichajes
    const whereClause: any = {
      user: {
        companyId: currentUser.companyId,
      },
      entryTime: {
        gte: new Date(start),
        lte: new Date(new Date(end).setHours(23, 59, 59, 999)),
      },
    };

    if (departmentId && departmentId !== 'all') {
      whereClause.user.departmentId = departmentId;
    }
    if (workCenterId && workCenterId !== 'all') {
      whereClause.workCenterId = workCenterId;
    }
    if (search) {
      whereClause.user.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    const clockIns = await prisma.clockIn.findMany({
      where: whereClause,
      include: {
        user: {
          include: { department: true, workCenter: true },
        },
        workCenter: true,
      },
      orderBy: { entryTime: 'asc' },
    });

    // 4. Formatear datos para el exportador
    const exportData = clockIns.map((c) => {
      let durationMs = 0;
      let breakMs = 0;
      const breaks = (c.breaks as Array<{ start: string; end: string | null }>) || [];

      breaks.forEach((b) => {
        if (b.start && b.end) {
          breakMs += new Date(b.end).getTime() - new Date(b.start).getTime();
        }
      });

      if (c.exitTime) {
        durationMs = c.exitTime.getTime() - c.entryTime.getTime() - breakMs;
      } else {
        durationMs = new Date().getTime() - c.entryTime.getTime() - breakMs;
      }

      return {
        employeeName: c.user.name,
        departmentName: c.user.department?.name || 'Sin asignar',
        workCenterName: c.workCenter?.name || 'Sin asignar',
        entryTime: c.entryTime,
        exitTime: c.exitTime,
        breakMs,
        durationMs: Math.max(0, durationMs),
        isManual: c.isManual,
      };
    });

    // 5. Generar Excel
    const buffer = await generateExcelReport(
      currentUser.company.name,
      currentUser.company.cif,
      exportData,
      start,
      end
    );

    // 6. Retornar archivo
    const headers = new Headers();
    headers.append('Content-Disposition', `attachment; filename="registro-jornada_${start}_al_${end}.xlsx"`);
    headers.append('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    return new NextResponse('Error interno del servidor', { status: 500 });
  }
}
