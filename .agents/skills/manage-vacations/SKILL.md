---
name: manage-vacations
description: Guía y referencias técnicas sobre el sistema de control de vacaciones, festivos de empresa y prevención de desfases de huso horario en fichajes y calendarios.
---

# Sistema de Vacaciones, Festivos y Huso Horario

Este skill recopila la arquitectura técnica, modelos de base de datos, API de acciones del servidor y mejores prácticas del sistema de control de vacaciones y festivos.

---

## 1. Modelos de Base de Datos (`prisma/schema.prisma`)

El sistema se apoya en los siguientes elementos del esquema de Prisma:

```prisma
enum VacationStatus {
  PENDING   // Solicitud en espera de aprobación por administrador
  APPROVED  // Solicitud aprobada (cuenta como días consumidos)
  REJECTED  // Solicitud rechazada
}

enum VacationType {
  NATURALES  // Cuenta fines de semana y festivos
  LABORABLES // Excluye fines de semana y festivos de la empresa
  CONVENIO   // Días de convenio (excluye fines de semana y festivos)
}

model Holiday {
  id        String   @id @default(uuid())
  date      DateTime // Almacenado estrictamente en UTC medianoche (00:00:00Z)
  name      String
  companyId String
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([date, companyId]) // Evita duplicar festivos por fecha/empresa
}

model Vacation {
  id           String         @id @default(uuid())
  startDate    DateTime       // Inicio del tramo (UTC medianoche: 00:00:00Z)
  endDate      DateTime       // Fin del tramo (UTC medianoche: 23:59:59.999Z)
  type         VacationType
  daysCount    Int            // Total de días consumidos (calculados por cliente/servidor)
  status       VacationStatus @default(PENDING)
  notes        String?
  userId       String
  user         User           @relation("UserVacations", fields: [userId], references: [id], onDelete: Cascade)
  companyId    String
  company      Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  resolvedById String?
  resolvedBy   User?          @relation("ResolvedVacations", fields: [resolvedById], references: [id])
  createdAt    DateTime       @default(now())
}
```

*Adicionalmente, el modelo `User` contiene el campo `vacationDaysAllocated` (Int, por defecto 30) para gestionar los cupos de descanso de manera individual.*

---

## 2. Regla de Oro: Evitar Desfases de Huso Horario (Timezone Shift)

El bug más común al trabajar con fechas en Javascript y bases de datos es el desfase de 1 día debido al huso horario (ej. una fecha que se convierte de local `00:00:00` en España a UTC `22:00:00` del día anterior).

### A. Al parsear y guardar en el Servidor:
Forzar siempre la zona horaria UTC (`Z` o `+00:00`) al inicializar los objetos Date para guardar valores exactos:
```typescript
// Correcto (UTC medianoche):
const start = new Date(`${startDateStr}T00:00:00Z`);
const end = new Date(`${endDateStr}T23:59:59.999Z`);

// Incorrecto (Se parsea en zona local del servidor y se desfasa al guardar en UTC):
const start = new Date(`${startDateStr}T00:00:00`); 
```

### B. Al comparar en el Cliente (Calendario):
Para comparar la celda del calendario del cliente con las fechas de la base de datos (formato `YYYY-MM-DD`), **no utilizar `.toISOString()`** sobre fechas locales porque aplicará la conversión horaria del navegador. Construir el string manualmente con getters locales:
```typescript
// Correcto (Timezone-proof):
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const dateISO = `${year}-${month}-${day}`; // Siempre coincide con el string de la DB

// Incorrecto (Provoca saltos de día dependiendo de la hora local del dispositivo):
const dateISO = date.toISOString().split('T')[0]; 
```

---

## 3. Acciones del Servidor (Server Actions API)

### Gestionar Festivos (`src/app/actions/holidays.ts`)
* `createHoliday(dateStr, name)`: Crea un festivo en UTC medianoche. Devuelve el objeto creado con su ID de base de datos.
* `deleteHoliday(id)`: Borra un festivo corporativo por ID.
* `importHolidays(holidaysList)`: Importación masiva que acepta un array de `{ date, name }` e inserta los registros omitiendo duplicados (`skipDuplicates: true`).

### Gestionar Vacaciones (`src/app/actions/vacations.ts`)
* `requestVacation(startDate, endDate, type, daysCount, notes)`: Solicita un tramo (estado `PENDING`), validando que no se superponga con otras solicitudes aprobadas o pendientes.
* `assignVacationDirect(employeeId, start, end, type, days, notes)`: Asignación directa e inmediata por el administrador (estado `APPROVED`).
* `resolveVacation(id, status)`: Cambia el estado de una solicitud (`APPROVED` o `REJECTED`).
* `updateEmployeeAllocatedDays(employeeId, days)`: Modifica el cupo total de vacaciones anuales asignado a un empleado.

---

## 4. Estilos y Estructura de Impresión (Layout)

La ficha de vacaciones de los empleados cuenta con una vista optimizada para impresión en papel o PDF. 
Para que el reporte de vacaciones se imprima limpio (sin menús laterales, barras de navegación ni botones), se utiliza la clase CSS `.no-print` sobre los elementos que se desean ocultar:

```css
@media print {
  .no-print,
  .admin-sidebar,
  .page-header {
    display: none !important;
  }
  .premium-card {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    background: transparent !important;
  }
}
```
