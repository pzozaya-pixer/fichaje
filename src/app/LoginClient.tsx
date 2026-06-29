'use client';

import React, { useState, useEffect, useRef } from 'react';
import { requestOtpAction, verifyOtpAction, registerCompanyAction } from './actions/auth';
import { Clock, Mail, ShieldAlert, Loader2, Building, User, Phone } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginClient() {
  const router = useRouter();
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
  const [adminName, setAdminName] = useState('');
  const [phone, setPhone] = useState('');

  // Cargar el correo guardado en el dispositivo al iniciar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedEmail = localStorage.getItem('fichaje_saved_email');
      if (savedEmail) {
        setEmail(savedEmail);
      }
    }
  }, []);

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
          if (res.role === 'ADMIN' || res.role === 'CONSULTANT') {
            router.push('/dashboard');
          } else {
            router.push('/pwa');
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
      const res = await verifyOtpAction(email, otpCode);
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

          <button type="submit" disabled={loading} className="login-submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
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

          <button type="submit" disabled={loading} className="login-submit-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
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
    </div>
  );
}
