import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';

function formatDateDMA(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function formatDurationHM(ms: number): string {
  const totalMinutes = Math.floor(ms / (1000 * 60));
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Estructura de datos esperada para los fichajes en los exportadores
export interface ClockInExportData {
  employeeName: string;
  departmentName: string;
  workCenterName: string;
  entryTime: Date;
  exitTime: Date | null;
  breakMs: number;
  durationMs: number;
  isManual: boolean;
}

// GENERAR INFORME EXCEL (XLSX)
export async function generateExcelReport(
  companyName: string,
  cif: string,
  clockIns: ClockInExportData[],
  startDate: string,
  endDate: string
): Promise<Buffer> {
  const workbook = new Workbook();
  const worksheet = workbook.addWorksheet('Registro de Jornada');

  // Ajustar ancho de columnas
  worksheet.columns = [
    { header: 'Empleado', key: 'name', width: 25 },
    { header: 'Departamento', key: 'dept', width: 18 },
    { header: 'Centro de Trabajo', key: 'center', width: 22 },
    { header: 'Fecha', key: 'date', width: 12 },
    { header: 'Entrada', key: 'entry', width: 10 },
    { header: 'Salida', key: 'exit', width: 10 },
    { header: 'Pausas (min)', key: 'breaks', width: 12 },
    { header: 'Horas Trabajadas', key: 'hours', width: 18 },
    { header: 'Horas Extra', key: 'extra', width: 12 },
    { header: 'Tipo', key: 'type', width: 12 },
  ];

  // Título e Información de la Empresa
  worksheet.insertRow(1, []);
  worksheet.insertRow(2, ['REGISTRO DIARIO DE JORNADA (Real Decreto-ley 8/2019)']);
  worksheet.insertRow(3, [`Empresa: ${companyName}`, `CIF: ${cif}`]);
  worksheet.insertRow(4, [`Periodo: del ${startDate} al ${endDate}`]);
  worksheet.insertRow(5, []);

  // Combinar celdas de título
  worksheet.mergeCells('A2:J2');
  const titleCell = worksheet.getCell('A2');
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1A66FF' } };
  titleCell.alignment = { horizontal: 'center' };

  // Estilo de información de empresa
  worksheet.getRow(3).font = { bold: true };
  worksheet.getRow(4).font = { italic: true };

  // Fila de encabezados de la tabla (Fila 6)
  const headerRow = worksheet.getRow(6);
  headerRow.values = [
    'Empleado',
    'Departamento',
    'Centro de Trabajo',
    'Fecha',
    'Entrada',
    'Salida',
    'Pausas (min)',
    'Horas Trabajadas',
    'Horas Extra',
    'Tipo',
  ];

  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0B1120' }, // Color azul oscuro corporativo
    };
    cell.font = {
      color: { argb: 'FFFFFFFF' },
      bold: true,
      name: 'Arial',
      size: 11,
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 28;

  // Añadir los datos de los fichajes
  clockIns.forEach((f) => {
    const dateStr = formatDateDMA(f.entryTime);
    const entryStr = f.entryTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const exitStr = f.exitTime
      ? f.exitTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
      : 'Pendiente';

    const breaksMin = Math.round(f.breakMs / (1000 * 60));
    const hoursNet = formatDurationHM(f.durationMs);
    const extraHours = f.durationMs > 8 * 3600 * 1000 ? formatDurationHM(f.durationMs - 8 * 3600 * 1000) : '00:00';

    const row = worksheet.addRow({
      name: f.employeeName,
      dept: f.departmentName || '-',
      center: f.workCenterName || '-',
      date: dateStr,
      entry: entryStr,
      exit: exitStr,
      breaks: breaksMin,
      hours: hoursNet,
      extra: extraHours,
      type: f.isManual ? 'Manual' : 'Presencial (GPS)',
    });

    // Alinear celdas
    row.getCell('date').alignment = { horizontal: 'center' };
    row.getCell('entry').alignment = { horizontal: 'center' };
    row.getCell('exit').alignment = { horizontal: 'center' };
    row.getCell('breaks').alignment = { horizontal: 'right' };
    row.getCell('hours').alignment = { horizontal: 'right' };
    row.getCell('extra').alignment = { horizontal: 'right' };
    row.getCell('type').alignment = { horizontal: 'center' };

    // Bordes ligeros
    row.eachCell((cell) => {
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  });

  // Fila de Totales
  const totalRowIndex = worksheet.lastRow!.number + 1;
  worksheet.insertRow(totalRowIndex, []); // fila vacía
  
  const totalsRow = worksheet.addRow({
    name: 'TOTALES',
    hours: { formula: `SUM(H7:H${totalRowIndex - 1})` },
    extra: { formula: `SUM(I7:I${totalRowIndex - 1})` },
  });

  totalsRow.getCell('name').font = { bold: true };
  totalsRow.getCell('hours').font = { bold: true };
  totalsRow.getCell('extra').font = { bold: true };
  
  totalsRow.getCell('hours').alignment = { horizontal: 'right' };
  totalsRow.getCell('extra').alignment = { horizontal: 'right' };

  totalsRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF0B1120' } },
      bottom: { style: 'double', color: { argb: 'FF0B1120' } },
    };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// GENERAR INFORME PDF DE CONTROL HORARIO (LEGAL COMPLIANT)
export async function generatePDFReport(
  companyName: string,
  cif: string,
  employee: { name: string; email: string; department?: string; workCenter?: string },
  clockIns: ClockInExportData[],
  startDate: string,
  endDate: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // --- ENCABEZADO ---
    doc.fillColor('#0B1120').rect(0, 0, 595.28, 80).fill(); // Fondo oscuro superior
    
    doc.fillColor('#FFFFFF')
       .font('Helvetica-Bold')
       .fontSize(16)
       .text('REGISTRO DIARIO DE JORNADA', 40, 20);
       
    doc.fontSize(10)
       .font('Helvetica-Oblique')
       .text('Conforme al Real Decreto-ley 8/2019 y Art. 34.9 del Estatuto de los Trabajadores', 40, 42);

    // --- DATOS DE LA EMPRESA Y TRABAJADOR ---
    doc.fillColor('#0F172A').font('Helvetica').fontSize(10);
    
    // Cuadro de Empresa
    doc.roundedRect(40, 100, 240, 80, 8).strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.font('Helvetica-Bold').text('DATOS DE LA EMPRESA', 50, 110);
    doc.font('Helvetica').text(`Razón Social: ${companyName}`, 50, 128);
    doc.text(`CIF: ${cif}`, 50, 143);
    doc.text('Centro de Trabajo: Principal', 50, 158);

    // Cuadro de Trabajador
    doc.roundedRect(315, 100, 240, 80, 8).strokeColor('#E2E8F0').stroke();
    doc.font('Helvetica-Bold').text('DATOS DEL TRABAJADOR', 325, 110);
    doc.font('Helvetica').text(`Nombre: ${employee.name}`, 325, 128);
    doc.text(`Email: ${employee.email}`, 325, 143);
    doc.text(`Departamento: ${employee.department || '-'}`, 325, 158);

    // Rango de fechas
    doc.font('Helvetica-Bold')
       .fontSize(11)
       .text(`Periodo del informe: ${startDate} al ${endDate}`, 40, 200);

    // --- TABLA DE REGISTROS ---
    const tableTop = 225;
    const rowHeight = 20;

    // Encabezados de Tabla
    doc.fillColor('#F1F5F9').rect(40, tableTop, 515, rowHeight).fill();
    
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);
    doc.text('Fecha', 45, tableTop + 6);
    doc.text('Hora Entrada', 120, tableTop + 6);
    doc.text('Hora Salida', 200, tableTop + 6);
    doc.text('Pausas', 280, tableTop + 6);
    doc.text('Horas Netas', 350, tableTop + 6);
    doc.text('Horas Extra', 420, tableTop + 6);
    doc.text('Tipo', 490, tableTop + 6);

    let y = tableTop + rowHeight;
    let totalWorkedMs = 0;
    let totalExtraMs = 0;

    doc.font('Helvetica').fontSize(9);

    clockIns.forEach((f, index) => {
      // Control de salto de página si excede el espacio
      if (y > 700) {
        doc.addPage();
        y = 40; // reiniciar y en la nueva página
      }

      // Alternar color de fondo para legibilidad
      if (index % 2 === 0) {
        doc.fillColor('#F8FAFC').rect(40, y, 515, rowHeight).fill();
      }

      const dateStr = formatDateDMA(f.entryTime);
      const entryStr = f.entryTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      const exitStr = f.exitTime
        ? f.exitTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        : 'Pendiente';

      const breaksMin = Math.round(f.breakMs / (1000 * 60));
      const hoursNet = formatDurationHM(f.durationMs);
      const extraHours = f.durationMs > 8 * 3600 * 1000 ? formatDurationHM(f.durationMs - 8 * 3600 * 1000) : '00:00';

      totalWorkedMs += f.durationMs;
      if (f.durationMs > 8 * 3600 * 1000) {
        totalExtraMs += f.durationMs - 8 * 3600 * 1000;
      }

      doc.fillColor('#0F172A');
      doc.text(dateStr, 45, y + 6);
      doc.text(entryStr, 120, y + 6);
      doc.text(exitStr, 200, y + 6);
      doc.text(`${breaksMin} min`, 280, y + 6);
      doc.text(hoursNet, 350, y + 6);
      doc.text(extraHours, 420, y + 6);
      doc.text(f.isManual ? 'Manual' : 'Presencial', 490, y + 6);

      // Línea divisoria
      doc.strokeColor('#E2E8F0').lineWidth(0.5).moveTo(40, y + rowHeight).lineTo(555, y + rowHeight).stroke();

      y += rowHeight;
    });

    // Fila de Resumen Final
    doc.fillColor('#E2E8F0').rect(40, y, 515, rowHeight).fill();
    doc.fillColor('#0F172A').font('Helvetica-Bold');
    doc.text('TOTALES', 45, y + 6);
    doc.text(formatDurationHM(totalWorkedMs), 350, y + 6);
    doc.text(formatDurationHM(totalExtraMs), 420, y + 6);

    y += rowHeight + 30;

    // --- SECCIÓN DE FIRMAS (OBLIGATORIA POR LEY) ---
    if (y > 720) {
      doc.addPage();
      y = 40;
    }

    doc.strokeColor('#94A3B8').lineWidth(1).moveTo(40, y).lineTo(555, y).stroke();
    y += 15;

    doc.fillColor('#475569')
       .fontSize(8)
       .text('Los firmantes declaran la veracidad de los datos registrados en el presente documento, reflejo fiel de la jornada laboral diaria del trabajador.', 40, y);

    y += 40;

    // Líneas de firma
    doc.strokeColor('#64748B').lineWidth(0.8);
    doc.moveTo(60, y).lineTo(220, y).stroke();
    doc.moveTo(375, y).lineTo(535, y).stroke();

    y += 8;
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);
    doc.text('Firma de la Empresa', 60, y, { width: 160, align: 'center' });
    doc.text('Firma del Trabajador', 375, y, { width: 160, align: 'center' });

    doc.end();
  });
}
