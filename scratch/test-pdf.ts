import { generatePDFReport } from '../src/lib/exporters';
import * as fs from 'fs';

async function test() {
  console.log('=== PROBANDO GENERACIÓN DE PDF ===');
  try {
    const buffer = await generatePDFReport(
      'Mi Empresa S.L.',
      'B12345678',
      {
        name: 'Empleado de Prueba',
        email: 'empleado@prueba.com',
        department: 'Administración',
        workCenter: 'Oficina Central',
      },
      [
        {
          employeeName: 'Empleado de Prueba',
          departmentName: 'Administración',
          workCenterName: 'Oficina Central',
          entryTime: new Date('2026-06-01T08:00:00'),
          exitTime: new Date('2026-06-01T17:00:00'),
          breakMs: 60 * 60 * 1000, // 1 hora de pausa
          durationMs: 8 * 60 * 60 * 1000, // 8 horas netas
          isManual: false,
        },
      ],
      '2026-06-01',
      '2026-06-30'
    );

    fs.writeFileSync('./scratch/test.pdf', buffer);
    console.log('   [OK] PDF generado con éxito en ./scratch/test.pdf');
  } catch (error: any) {
    console.error('   [ERROR] Error al generar el PDF:', error);
  }
}

test();
