import { PrismaClient, Role, ContractType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando sembrado de la base de datos...');

  // 1. Limpiar base de datos
  await prisma.auditLog.deleteMany({});
  await prisma.clockIn.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.workCenter.deleteMany({});
  await prisma.department.deleteMany({});
  await prisma.workdaySetting.deleteMany({});
  await prisma.company.deleteMany({});

  // 2. Crear Empresa Demo con 15 días de prueba
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 15);

  const company = await prisma.company.create({
    data: {
      name: 'Empresa Demo S.L.',
      cif: 'B12345678',
      subscriptionStatus: 'trialing',
      trialEndsAt,
    },
  });

  console.log(`Empresa creada: ${company.name} (Prueba hasta ${company.trialEndsAt.toLocaleDateString()})`);

  // 3. Crear Centros de Trabajo (Multicentro)
  // Ubicación de prueba: Puerta del Sol, Madrid (para simular fácil)
  const centralMadrid = await prisma.workCenter.create({
    data: {
      name: 'Oficina Central Madrid',
      address: 'Puerta del Sol, 1, 28013 Madrid',
      latitude: 40.416775,
      longitude: -3.703790,
      radius: 100, // 100 metros de geocerca
      companyId: company.id,
    },
  });

  const delegacionBarcelona = await prisma.workCenter.create({
    data: {
      name: 'Delegación Barcelona',
      address: 'Plaça de Catalunya, 1, 08002 Barcelona',
      latitude: 41.385063,
      longitude: 2.173403,
      radius: 50, // 50 metros de geocerca
      companyId: company.id,
    },
  });

  console.log('Centros de trabajo creados:', centralMadrid.name, ',', delegacionBarcelona.name);

  // 4. Crear Departamentos
  const depDesarrollo = await prisma.department.create({
    data: { name: 'Desarrollo', companyId: company.id },
  });
  const depMarketing = await prisma.department.create({
    data: { name: 'Marketing', companyId: company.id },
  });
  const depAdmin = await prisma.department.create({
    data: { name: 'Administración', companyId: company.id },
  });
  const depSoporte = await prisma.department.create({
    data: { name: 'Soporte', companyId: company.id },
  });

  console.log('Departamentos creados.');

  // 5. Configurar Horas Laborales Esperadas (Lunes a Viernes 8h)
  for (let i = 1; i <= 5; i++) {
    await prisma.workdaySetting.create({
      data: {
        dayOfWeek: i,
        expectedHours: 8.0,
        companyId: company.id,
      },
    });
  }

  // 6. Crear Usuarios
  // Administrador (RRHH)
  const admin = await prisma.user.create({
    data: {
      email: 'admin@demo.com',
      name: 'Pablo Admin',
      phone: '600111222',
      role: Role.ADMIN,
      contractType: ContractType.INDEFINIDO,
      companyId: company.id,
      workCenterId: centralMadrid.id,
      departmentId: depAdmin.id,
    },
  });

  // Empleado 1: Carlos Martínez (Desarrollo)
  const carlos = await prisma.user.create({
    data: {
      email: 'carlos@demo.com',
      name: 'Carlos Martínez',
      phone: '600123456',
      role: Role.EMPLOYEE,
      contractType: ContractType.INDEFINIDO,
      companyId: company.id,
      workCenterId: centralMadrid.id,
      departmentId: depDesarrollo.id,
    },
  });

  // Empleado 2: Ana García (Marketing)
  const ana = await prisma.user.create({
    data: {
      email: 'ana@demo.com',
      name: 'Ana García',
      phone: '600789012',
      role: Role.EMPLOYEE,
      contractType: ContractType.TEMPORAL,
      companyId: company.id,
      workCenterId: centralMadrid.id,
      departmentId: depMarketing.id,
    },
  });

  // Inspector / Consultor (Solo lectura)
  const inspector = await prisma.user.create({
    data: {
      email: 'inspector@demo.com',
      name: 'Juan Inspector',
      phone: '600999888',
      role: Role.CONSULTANT,
      contractType: ContractType.INDEFINIDO,
      companyId: company.id,
      workCenterId: centralMadrid.id,
    },
  });

  console.log('Usuarios creados:');
  console.log(`- Administrador: ${admin.email} (Código OTP se logueará en consola)`);
  console.log(`- Empleado: ${carlos.email} (Carlos Martínez)`);
  console.log(`- Empleado 2: ${ana.email} (Ana García)`);
  console.log(`- Consultor/Inspector: ${inspector.email} (Solo lectura)`);

  // 7. Crear algunos fichajes históricos para Carlos Martínez (mes en curso)
  console.log('Creando fichajes históricos para Carlos...');
  const today = new Date();
  
  // Crear fichajes para los últimos 5 días laborables (excluyendo hoy)
  for (let i = 1; i <= 5; i++) {
    const entryDate = new Date(today);
    entryDate.setDate(today.getDate() - i);
    
    // Saltarse fines de semana
    if (entryDate.getDay() === 0 || entryDate.getDay() === 6) continue;
    
    entryDate.setHours(9, 2, 0, 0); // Entrada a las 09:02
    
    const exitDate = new Date(entryDate);
    exitDate.setHours(17, 58, 0, 0); // Salida a las 17:58 (8h 56m trabajadas, con 30m de pausa = 8h 26m netas)
    
    const breakStart = new Date(entryDate);
    breakStart.setHours(13, 0, 0, 0);
    
    const breakEnd = new Date(entryDate);
    breakEnd.setHours(13, 30, 0, 0);

    await prisma.clockIn.create({
      data: {
        userId: carlos.id,
        workCenterId: centralMadrid.id,
        entryTime: entryDate,
        exitTime: exitDate,
        breaks: [
          { start: breakStart.toISOString(), end: breakEnd.toISOString() }
        ],
        entryLat: 40.416770,
        entryLng: -3.703795,
        entryDistance: 1.2,
        entryInZone: true,
        exitLat: 40.416780,
        exitLng: -3.703785,
        exitDistance: 2.1,
        exitInZone: true,
        status: 'COMPLETED',
      }
    });
  }

  console.log('Sembrado completado con éxito.');
}

main()
  .catch((e) => {
    console.error('Error durante el sembrado:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
