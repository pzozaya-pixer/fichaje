'use client';

import React, { useState, useRef } from 'react';
import { requestOtpAction, verifyOtpAction } from './actions/auth';
import { Clock, Mail, ShieldAlert, Loader2 } from 'lucide-react';

export default function LoginClient() {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await requestOtpAction(null, new FormData(e.target as HTMLFormElement));
      if (res.success) {
        setStep(2);
        setMessage('Te hemos enviado un código de acceso a tu correo.');
      } else {
        setError(res.message);
      }
    } catch (err) {
      setError('Ocurrió un error al enviar el correo. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  // Manejar el cambio en cada celda del código OTP
  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Si pegan un código completo
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

    // Mover al siguiente input
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
          {step === 1
            ? 'Introduce tu correo para acceder al registro de jornada'
            : 'Introduce el código de 6 dígitos enviado a tu correo'}
        </p>
      </div>

      {error && (
        <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
          <ShieldAlert size={18} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="pwa-geo-status in-range" style={{ margin: 0 }}>
          <span>{message}</span>
        </div>
      )}

      {step === 1 ? (
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
                <span>Enviando...</span>
              </>
            ) : (
              <span>Solicitar Código de Acceso</span>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} className="form-group" style={{ margin: 0, gap: '16px' }}>
          <div className="login-otp-grid">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                maxLength={6} // Permite pegar
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
            Atrás (Cambiar correo)
          </button>
        </form>
      )}
    </div>
  );
}
