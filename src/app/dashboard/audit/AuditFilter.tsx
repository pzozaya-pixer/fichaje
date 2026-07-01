'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, Filter, X } from 'lucide-react';

export default function AuditFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sincronizar el estado local con los parámetros de la URL
  useEffect(() => {
    setStartDate(searchParams.get('startDate') || '');
    setEndDate(searchParams.get('endDate') || '');
  }, [searchParams]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    
    if (startDate) {
      params.set('startDate', startDate);
    }
    if (endDate) {
      params.set('endDate', endDate);
    }
    
    router.push(`/dashboard/audit?${params.toString()}`);
  };

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
    router.push('/dashboard/audit');
  };

  return (
    <form
      onSubmit={handleFilter}
      className="premium-card no-print"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'flex-end',
        padding: '16px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
      }}
    >
      <div className="form-group" style={{ flex: '1 1 200px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <Calendar size={14} style={{ color: 'var(--primary)' }} />
          Fecha de Inicio
        </label>
        <input
          type="date"
          className="form-input"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-primary)',
          }}
        />
      </div>

      <div className="form-group" style={{ flex: '1 1 200px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
          <Calendar size={14} style={{ color: 'var(--primary)' }} />
          Fecha de Fin
        </label>
        <input
          type="date"
          className="form-input"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          style={{
            padding: '8px 12px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-primary)',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          type="submit"
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <Filter size={14} />
          Filtrar
        </button>

        {(startDate || endDate) && (
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--danger)',
              borderColor: 'rgba(239, 68, 68, 0.2)',
              backgroundColor: 'rgba(239, 68, 68, 0.04)',
              cursor: 'pointer',
            }}
          >
            <X size={14} />
            Limpiar Filtros
          </button>
        )}
      </div>
    </form>
  );
}
