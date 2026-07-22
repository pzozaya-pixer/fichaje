'use client';

import React, { useState, useEffect, useRef } from 'react';
import { requestOtpAction, verifyOtpAction, registerCompanyAction } from './actions/auth';
import { Clock, Mail, ShieldAlert, Loader2, Building, User, Phone, Users } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Turnstile from './components/Turnstile';

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Estados para el formulario de registro
  const [companyName, setCompanyName] = useState('');
  const [cif, setCif] = useState('');
  const [employees, setEmployees] = useState('');
  const [adminName, setAdminName] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [currentLegalDoc, setCurrentLegalDoc] = useState<string | null>(null);

  // Estados para tokens de Cloudflare Turnstile
  const [loginTurnstileToken, setLoginTurnstileToken] = useState<string | null>(null);
  const [registerTurnstileToken, setRegisterTurnstileToken] = useState<string | null>(null);

  // Limpiar tokens al cambiar de pestaña
  useEffect(() => {
    setLoginTurnstileToken(null);
    setRegisterTurnstileToken(null);
  }, [activeTab]);

  // Cargar el correo guardado en el dispositivo al iniciar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('fichaje_saved_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, []);

  // Pre-rellenar formulario si viene desde la landing con parámetros de registro
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const emailParam = searchParams.get('email');
    const companyParam = searchParams.get('companyName');
    const cifParam = searchParams.get('cif');
    const adminParam = searchParams.get('adminName');
    const phoneParam = searchParams.get('phone');
    const employeesParam = searchParams.get('employees');

    if (tabParam === 'register' || emailParam || companyParam || cifParam || adminParam || employeesParam) {
      setActiveTab('register');
    }
    if (emailParam) setEmail(emailParam);
    if (companyParam) setCompanyName(companyParam);
    if (cifParam) setCif(cifParam);
    if (adminParam) setAdminName(adminParam);
    if (phoneParam) setPhone(phoneParam);
    if (employeesParam) setEmployees(employeesParam);
  }, [searchParams]);

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Enviar el correo para solicitar el código OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Guardar el correo en el dispositivo del empleado
    if (typeof window !== 'undefined') {
      localStorage.setItem('fichaje_saved_email', email);
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await requestOtpAction(null, new FormData(e.target as HTMLFormElement));
      if (res.success) {
        if (res.immediate) {
          // Redirigir inmediatamente según el rol del usuario
          if (redirectTo) {
            const target = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
            router.push(target);
          } else if (res.role === 'ADMIN' || res.role === 'CONSULTANT') {
            router.push('/dashboard');
          } else {
            router.push('/movil');
          }
        } else {
          setStep(2);
          setMessage('Te hemos enviado un código de acceso a tu correo.');
        }
      } else {
        setError(res.message || 'Error al iniciar sesión.');
      }
    } catch (err) {
      setError('Ocurrió un error al iniciar sesión. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Enviar el registro de nueva empresa
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !cif || !adminName || !email) {
      setError('Todos los campos obligatorios deben ser completados.');
      return;
    }

    if (!acceptedLegal) {
      setError('Debes leer y aceptar el Aviso Legal, la Política de Privacidad, la Política de Cookies, los Términos de Uso y el DPA para poder crear tu cuenta.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Guardar el correo en el dispositivo del empleado
      if (typeof window !== 'undefined') {
        localStorage.setItem('fichaje_saved_email', email);
      }

      const res = await registerCompanyAction({
        companyName,
        cif,
        adminName,
        email,
        phone,
        employees,
        turnstileToken: registerTurnstileToken || undefined,
      });

      if (res.success) {
        setStep(2);
        setActiveTab('login'); // Volver a la pestaña de login para verificar el OTP
        setMessage(res.message);
      } else {
        setError(res.message);
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al registrar la empresa. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Manejar el cambio en cada celda del código OTP
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pastedCode = value.slice(0, 6).split('');
      const newOtp = [...otp];
      for (let i = 0; i < 6; i++) {
        if (pastedCode[i]) newOtp[i] = pastedCode[i];
      }
      setOtp(newOtp);
      inputRefs[5].current?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  // Retroceder con Backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  // Verificar el código OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join('');
    if (otpCode.length < 6) {
      setError('Por favor, introduce los 6 dígitos del código.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await verifyOtpAction(email, otpCode, redirectTo);
      if (res && !res.success) {
        setError(res.message);
      }
    } catch (err) {
      setError('Error al verificar el código. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-card">
      <div className="login-header">
        <div className="login-logo text-gradient">
          <Clock size={32} />
          <span>Fichaje.click</span>
        </div>
        <p className="login-subtitle">
          {step === 2
            ? 'Introduce el código de 6 dígitos enviado a tu correo'
            : activeTab === 'login'
            ? 'Introduce tu correo para acceder al registro de jornada'
            : 'Registra tu empresa para iniciar la prueba gratuita de 15 días'}
        </p>
      </div>

      {redirectTo && redirectTo.includes('movil') && step === 1 && (
        <div className="pwa-geo-status in-range" style={{ margin: '0 0 16px 0', backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderLeft: '4px solid #22c55e', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span>📲 Accediendo a la versión móvil. Inicia sesión para continuar.</span>
        </div>
      )}

      {error && (
        <div className="pwa-geo-status out-range" style={{ margin: '0 0 16px 0' }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="pwa-geo-status in-range" style={{ margin: '0 0 16px 0' }}>
          <span>{message}</span>
        </div>
      )}

      {/* Selector de Pestañas (Solo si no estamos verificando el OTP) */}
      {step === 1 && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--pwa-border)', marginBottom: '20px' }}>
          <button
            type="button"
            onClick={() => {
              setActiveTab('login');
              setError('');
              setMessage('');
            }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              color: activeTab === 'login' ? 'var(--primary)' : 'var(--pwa-text-secondary)',
              borderBottom: activeTab === 'login' ? '2px solid var(--primary)' : 'none',
              fontWeight: activeTab === 'login' ? 700 : 500,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Iniciar Sesión
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('register');
              setError('');
              setMessage('');
            }}
            style={{
              flex: 1,
              padding: '12px',
              background: 'none',
              border: 'none',
              color: activeTab === 'register' ? 'var(--primary)' : 'var(--pwa-text-secondary)',
              borderBottom: activeTab === 'register' ? '2px solid var(--primary)' : 'none',
              fontWeight: activeTab === 'register' ? 700 : 500,
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Crear Cuenta
          </button>
        </div>
      )}

      {step === 2 ? (
        // FORMULARIO PASO 2: VERIFICACIÓN OTP
        <form onSubmit={handleVerifyOtp} className="form-group" style={{ margin: 0, gap: '16px' }}>
          <div className="login-otp-grid">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="login-otp-input"
                autoFocus={index === 0}
              />
            ))}
          </div>

          <button type="submit" disabled={loading} className="login-submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Verificando...</span>
              </>
            ) : (
              <span>Iniciar Sesión</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep(1);
              setOtp(['', '', '', '', '', '']);
              setError('');
            }}
            className="pwa-break-btn"
            style={{ marginTop: 0 }}
          >
            Atrás (Cambiar datos)
          </button>
        </form>
      ) : activeTab === 'login' ? (
        // FORMULARIO ACCESO (LOGIN)
        <form onSubmit={handleRequestOtp} className="form-group" style={{ margin: 0, gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Correo Electrónico</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--pwa-text-secondary)',
                }}
              />
              <input
                type="email"
                name="email"
                required
                className="form-input"
                placeholder="nombre@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', backgroundColor: 'var(--pwa-bg-tertiary)', border: '1px solid var(--pwa-border)', color: 'white' }}
              />
            </div>
          </div>

          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onVerify={setLoginTurnstileToken}
              onExpire={() => setLoginTurnstileToken(null)}
              onError={() => setLoginTurnstileToken(null)}
            />
          )}

          <button type="submit" disabled={loading || !loginTurnstileToken} className="login-submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Accediendo...</span>
              </>
            ) : (
              <span>Acceder</span>
            )}
          </button>
        </form>
      ) : (
        // FORMULARIO REGISTRO DE NUEVA EMPRESA
        <form onSubmit={handleRegister} className="form-group" style={{ margin: 0, gap: '16px' }}>
          {/* Nombre de la Empresa */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nombre de la Empresa / Entidad *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Building
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--pwa-text-secondary)',
                }}
              />
              <input
                type="text"
                required
                className="form-input"
                placeholder="Mi Empresa S.L."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', backgroundColor: 'var(--pwa-bg-tertiary)', border: '1px solid var(--pwa-border)', color: 'white' }}
              />
            </div>
          </div>

          {/* CIF / NIF */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">CIF / NIF *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Building
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--pwa-text-secondary)',
                }}
              />
              <input
                type="text"
                required
                className="form-input"
                placeholder="B12345678"
                value={cif}
                onChange={(e) => setCif(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', backgroundColor: 'var(--pwa-bg-tertiary)', border: '1px solid var(--pwa-border)', color: 'white' }}
              />
            </div>
          </div>

          {/* Nombre del Administrador */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Nombre del Administrador *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <User
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--pwa-text-secondary)',
                }}
              />
              <input
                type="text"
                required
                className="form-input"
                placeholder="Nombre Completo"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', backgroundColor: 'var(--pwa-bg-tertiary)', border: '1px solid var(--pwa-border)', color: 'white' }}
              />
            </div>
          </div>

          {/* Correo Electrónico */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Correo Electrónico *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--pwa-text-secondary)',
                }}
              />
              <input
                type="email"
                required
                className="form-input"
                placeholder="admin@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', backgroundColor: 'var(--pwa-bg-tertiary)', border: '1px solid var(--pwa-border)', color: 'white' }}
              />
            </div>
          </div>

          {/* Teléfono */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Teléfono (Opcional)</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Phone
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--pwa-text-secondary)',
                }}
              />
              <input
                type="tel"
                className="form-input"
                placeholder="600111222"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', backgroundColor: 'var(--pwa-bg-tertiary)', border: '1px solid var(--pwa-border)', color: 'white' }}
              />
            </div>
          </div>

          {/* Número de Empleados */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Número de Empleados *</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Users
                size={18}
                style={{
                  position: 'absolute',
                  left: '14px',
                  color: 'var(--pwa-text-secondary)',
                }}
              />
              <select
                required
                className="form-input"
                value={employees}
                onChange={(e) => setEmployees(e.target.value)}
                style={{ width: '100%', paddingLeft: '44px', backgroundColor: 'var(--pwa-bg-tertiary)', border: '1px solid var(--pwa-border)', color: 'white', height: '42px' }}
              >
                <option value="" style={{ backgroundColor: 'var(--pwa-bg-secondary)' }}>Selecciona una opción</option>
                <option value="1-5" style={{ backgroundColor: 'var(--pwa-bg-secondary)' }}>1 a 5 empleados</option>
                <option value="6-49" style={{ backgroundColor: 'var(--pwa-bg-secondary)' }}>6 a 49 empleados</option>
                <option value="50+" style={{ backgroundColor: 'var(--pwa-bg-secondary)' }}>50 empleados en adelante</option>
              </select>
            </div>
          </div>

          {/* Aceptación de Términos y Condiciones */}
          <div className="form-group" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', margin: '16px 0 8px 0' }}>
            <input
              type="checkbox"
              required
              id="legal-checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              style={{ marginTop: '3px', width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
            <label htmlFor="legal-checkbox" style={{ fontSize: '13px', color: 'var(--pwa-text-secondary)', lineHeight: '1.4', cursor: 'pointer' }}>
              He leído y acepto el{' '}
              <button type="button" onClick={() => setCurrentLegalDoc('aviso')} style={{ color: 'var(--primary)', background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                Aviso legal
              </button>
              , la{' '}
              <button type="button" onClick={() => setCurrentLegalDoc('privacidad')} style={{ color: 'var(--primary)', background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                Política de privacidad
              </button>
              , la{' '}
              <button type="button" onClick={() => setCurrentLegalDoc('cookies')} style={{ color: 'var(--primary)', background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                Política de cookies
              </button>
              , los{' '}
              <button type="button" onClick={() => setCurrentLegalDoc('terminos')} style={{ color: 'var(--primary)', background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                Términos de uso
              </button>{' '}
              y el{' '}
              <button type="button" onClick={() => setCurrentLegalDoc('dpa')} style={{ color: 'var(--primary)', background: 'none', border: 'none', padding: 0, font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                DPA (Acuerdo de Tratamiento de Datos)
              </button>
              .
            </label>
          </div>

          {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
            <Turnstile
              siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              onVerify={setRegisterTurnstileToken}
              onExpire={() => setRegisterTurnstileToken(null)}
              onError={() => setRegisterTurnstileToken(null)}
            />
          )}

          <button type="submit" disabled={loading || !registerTurnstileToken} className="login-submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>Registrando...</span>
              </>
            ) : (
              <span>Comenzar Prueba de 15 Días</span>
            )}
          </button>
        </form>
      )}

      {/* MODAL PARA DOCUMENTOS LEGALES */}
      {currentLegalDoc && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--pwa-bg-secondary)',
              border: '1px solid var(--pwa-border)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            }}
          >
            {/* Cabecera Modal */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--pwa-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'white', margin: 0 }}>
                {currentLegalDoc === 'aviso' && 'Aviso Legal'}
                {currentLegalDoc === 'privacidad' && 'Política de Privacidad'}
                {currentLegalDoc === 'cookies' && 'Política de Cookies'}
                {currentLegalDoc === 'terminos' && 'Términos de Uso'}
                {currentLegalDoc === 'dpa' && 'DPA (Anexo de Tratamiento de Datos - RGPD)'}
              </h3>
              <button
                onClick={() => setCurrentLegalDoc(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--pwa-text-secondary)',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {/* Contenido Modal */}
            <div
              style={{
                padding: '20px',
                overflowY: 'auto',
                fontSize: '13px',
                lineHeight: '1.6',
                color: 'var(--pwa-text-secondary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {currentLegalDoc === 'aviso' && (
                <>
                  <p><strong>1. Datos Identificativos:</strong> En cumplimiento del deber de información recogido en el artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico (LSSI-CE), se hace constar que el titular de la plataforma es la entidad titular de Fichaje App.</p>
                  <p><strong>2. Propiedad Intelectual:</strong> Todos los derechos de propiedad intelectual e industrial sobre el software, diseño, código fuente y contenidos de esta aplicación pertenecen a Fichaje App o a sus licenciantes. Queda prohibida su reproducción o distribución sin consentimiento previo.</p>
                  <p><strong>3. Condiciones de Uso:</strong> El usuario se compromete a hacer un uso adecuado de la aplicación de control horario, garantizando la veracidad de los datos aportados en el registro y en los marcajes de jornada.</p>
                </>
              )}

              {currentLegalDoc === 'privacidad' && (
                <>
                  <p><strong>1. Responsable del Tratamiento:</strong> La empresa contratante de Fichaje App actúa como Responsable del Tratamiento de los datos de sus empleados. Fichaje App actúa como Encargado del Tratamiento.</p>
                  <p><strong>2. Finalidad del Tratamiento:</strong> Los datos de geolocalización, registro de jornada, nombre y datos de contacto se tratarán exclusivamente para cumplir con la obligación legal de registro horario establecida en el Estatuto de los Trabajadores (art. 34.9).</p>
                  <p><strong>3. Derechos:</strong> Los trabajadores pueden ejercitar sus derechos de acceso, rectificación, supresión y limitación del tratamiento dirigiéndose al administrador de su respectiva empresa.</p>
                </>
              )}

              {currentLegalDoc === 'cookies' && (
                <>
                  <p><strong>Uso de Cookies:</strong> Esta aplicación utiliza únicamente cookies técnicas y de sesión que son estrictamente necesarias para el correcto funcionamiento del sistema de autenticación, mantener la sesión activa y asegurar la integridad de la plataforma.</p>
                  <p>No se utilizan cookies de seguimiento publicitario ni de análisis de terceros que requieran consentimiento explícito bajo la normativa vigente.</p>
                </>
              )}

              {currentLegalDoc === 'terminos' && (
                <>
                  <p><strong>1. Descripción del Servicio:</strong> Fichaje App es una plataforma SaaS de registro y control de jornada laboral orientada a cumplir con la normativa española de control horario.</p>
                  <p><strong>2. Suscripción y Licenciamiento:</strong> La plataforma ofrece un periodo de prueba gratuito de 15 días. Posteriormente, el acceso requiere una suscripción mensual o anual activa vinculada al número de empleados.</p>
                  <p><strong>3. Modificaciones del Servicio:</strong> Nos reservamos el derecho de modificar o actualizar las funcionalidades del software para adaptarlas a cambios legislativos o mejoras de rendimiento.</p>
                </>
              )}

              {currentLegalDoc === 'dpa' && (
                <>
                  <p><strong>DPA (Data Processing Agreement):</strong> Este anexo regula el tratamiento de datos de carácter personal en cumplimiento del Artículo 28 del Reglamento General de Protección de Datos (RGPD) y la LOPDGDD 3/2018.</p>
                  <p><strong>Obligaciones del Encargado (Fichaje App):</strong></p>
                  <ul>
                    <li>Tratar los datos personales únicamente siguiendo instrucciones documentadas del Responsable (la Empresa).</li>
                    <li>Garantizar que las personas autorizadas para tratar los datos se comprometen a respetar la confidencialidad.</li>
                    <li>Implementar las medidas técnicas y organizativas necesarias para garantizar un nivel de seguridad adecuado al riesgo.</li>
                    <li>Eliminar o devolver todos los datos personales una vez finalice la prestación de los servicios de tratamiento.</li>
                  </ul>
                </>
              )}
            </div>

            {/* Botón Aceptar/Cerrar */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--pwa-border)',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentLegalDoc(null)}
                className="btn btn-primary"
                style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
