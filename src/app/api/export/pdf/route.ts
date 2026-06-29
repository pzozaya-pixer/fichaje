import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generatePDFReport } from '@/lib/exporters';
import { Role } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    // 1. Autenticación y Autorización
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return new NextResponse('No autorizado', { status: 401 });
    }

    // 2. Obtener parámetros de búsqueda
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    if (!userId) {
      return new NextResponse('Se requiere el ID del empleado', { status: 400 });
    }

    // SEGURIDAD: Un empleado normal solo puede descargar su propio PDF
    if (currentUser.role === Role.EMPLOYEE && currentUser.id !== userId) {
      return new NextResponse('Acceso denegado', { status: 403 });
    }

    // Fechas por defecto si no se especifican (mes actual)
    const today = new Date();
    const defaultStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const defaultEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    const start = startDateStr || defaultStart;
    const end = endDateStr || defaultEnd;

    // 3. Consultar datos del empleado
    const employee = await prisma.user.findUnique({
      where: { id: userId, companyId: currentUser.companyId },
      include: { department: true, workCenter: true },
    });

    if (!employee) {
      return new NextResponse('Empleado no encontrado', { status: 404 });
    }

    // 4. Consultar datos de fichajes del empleado
    const clockIns = await prisma.clockIn.findMany({
      where: {
        userId: employee.id,
        entryTime: {
          gte: new Date(start),
          lte: new Date(new Date(end).setHours(23, 59, 59, 999)),
        },
      },
      include: { workCenter: true },
      orderBy: { entryTime: 'asc' },
    });

    // 5. Formatear datos para el exportador
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
        employeeName: employee.name,
        departmentName: employee.department?.name || 'Sin asignar',
        workCenterName: c.workCenter?.name || employee.workCenter?.name || 'Sin asignar',
        entryTime: c.entryTime,
        exitTime: c.exitTime,
        breakMs,
        durationMs: Math.max(0, durationMs),
        isManual: c.isManual,
      };
    });

    // 6. Generar PDF
    const buffer = await generatePDFReport(
      currentUser.company.name,
      currentUser.company.cif,
      {
        name: employee.name,
        email: employee.email,
        department: employee.department?.name,
        workCenter: employee.workCenter?.name,
      },
      exportData,
      start,
      end
    );

    // 7. Retornar archivo PDF
    const cleanedName = employee.name.replace(/\s+/g, '_');
    const headers = new Headers();
    headers.append('Content-Disposition', `inline; filename="registro_${cleanedName}_${start}_al_${end}.pdf"`);
    headers.append('Content-Type', 'application/pdf');

    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error('Error al exportar PDF:', error);
    return new NextResponse('Error interno del servidor', { status: 500 });
  }
}
