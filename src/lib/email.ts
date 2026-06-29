import nodemailer from 'nodemailer';

// Configurar el transportador de correo con las variables de entorno
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465', // true para 465, false para otros puertos
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASSWORD || '',
  },
  tls: {
    rejectUnauthorized: false, // Permitir certificados SSL autofirmados o de desarrollo
  },
});

export async function sendOTPEmail(email: string, name: string, otp: string) {
  // Si es una cuenta de demostración (@demo.com), imprimir en consola y saltarse el envío real
  if (email.toLowerCase().endsWith('@demo.com')) {
    console.log(`\n==========================================`);
    console.log(`[CUENTA DEMO] Código OTP para ${name} (${email}): ${otp}`);
    console.log(`==========================================\n`);
    return true;
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Control Horario" <noreply@example.com>',
    to: email,
    subject: `Tu código de acceso: ${otp}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1a66ff; text-align: center; font-family: 'Outfit', sans-serif;">Control Horario</h2>
        <p>Hola, <strong>${name}</strong>,</p>
        <p>Has solicitado acceder al sistema de fichaje. Utiliza el siguiente código de un solo uso (OTP) para iniciar sesión:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a; background-color: #f1f5f9; padding: 12px 24px; border-radius: 8px; border: 1px solid #cbd5e1; display: inline-block;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 14px; color: #64748b;">Este código es válido por 10 minutos. Si no has solicitado este código, puedes ignorar este correo de forma segura.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">Sistema de Registro de Jornada Laboral conforme al Real Decreto-ley 8/2019.</p>
      </div>
    `,
  };

  // Si no hay configuración SMTP, imprimir en consola para desarrollo
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.log(`\n--- [DESARROLLO] Correo OTP enviado a ${email} ---`);
    console.log(`Código OTP para ${name}: ${otp}`);
    console.log(`-----------------------------------------------\n`);
    return true;
  }

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error al enviar correo electrónico OTP:', error);
    // En desarrollo, aunque falle, logueamos en consola para permitir probar
    console.log(`\n--- [FALLO SMTP] Código OTP para ${name} (${email}): ${otp} ---\n`);
    return false;
  }
}
