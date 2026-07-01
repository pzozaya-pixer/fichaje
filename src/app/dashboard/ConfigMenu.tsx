'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Settings,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Building,
  Database,
  QrCode,
  MapPin,
  Briefcase,
  Calendar
} from 'lucide-react';

export default function ConfigMenu() {
  const pathname = usePathname();
  const isActive = pathname.startsWith('/dashboard/config');
  const [isOpen, setIsOpen] = useState(isActive);
  const [activeHash, setActiveHash] = useState('');

  // Auto-expandir cuando la ruta de configuración esté activa
  useEffect(() => {
    if (isActive) {
      setIsOpen(true);
    }
  }, [isActive]);

  // Escuchar los cambios en el hash de la URL para resaltar la opción activa
  useEffect(() => {
    const handleHashChange = () => {
      setActiveHash(window.location.hash);
    };

    // Registrar estado inicial
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const toggleOpen = (e: React.MouseEvent) => {
    // Si ya estamos en la página de config, prevenimos navegación completa y solo abrimos/cerramos
    if (pathname === '/dashboard/config') {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  const isSubActive = (hash: string) => {
    return isActive && activeHash === hash;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <Link
        href="/dashboard/config"
        onClick={toggleOpen}
        className={`sidebar-item ${isActive ? 'active' : ''}`}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Settings size={18} />
          <span>Configuración</span>
        </div>
        {isOpen ? (
          <ChevronDown size={14} style={{ opacity: 0.7 }} />
        ) : (
          <ChevronRight size={14} style={{ opacity: 0.7 }} />
        )}
      </Link>

      {isOpen && (
        <div className="sidebar-sub-menu-container">
          <Link
            href="/dashboard/config#planes"
            className={`sidebar-sub-item ${isSubActive('#planes') ? 'active' : ''}`}
          >
            <CreditCard size={14} />
            <span>Suscripción</span>
          </Link>

          <Link
            href="/dashboard/config#facturacion"
            className={`sidebar-sub-item ${isSubActive('#facturacion') ? 'active' : ''}`}
          >
            <Building size={14} />
            <span>Facturación</span>
          </Link>

          <Link
            href="/dashboard/config#backups"
            className={`sidebar-sub-item ${isSubActive('#backups') ? 'active' : ''}`}
          >
            <Database size={14} />
            <span>Copias / Backups</span>
          </Link>

          <Link
            href="/dashboard/config#qr"
            className={`sidebar-sub-item ${isSubActive('#qr') ? 'active' : ''}`}
          >
            <QrCode size={14} />
            <span>Códigos QR</span>
          </Link>

          <Link
            href="/dashboard/config#centros"
            className={`sidebar-sub-item ${isSubActive('#centros') ? 'active' : ''}`}
          >
            <MapPin size={14} />
            <span>Centros y Zonas</span>
          </Link>

          <Link
            href="/dashboard/config#departamentos"
            className={`sidebar-sub-item ${isSubActive('#departamentos') ? 'active' : ''}`}
          >
            <Briefcase size={14} />
            <span>Departamentos</span>
          </Link>

          <Link
            href="/dashboard/config#festivos"
            className={`sidebar-sub-item ${isSubActive('#festivos') ? 'active' : ''}`}
          >
            <Calendar size={14} />
            <span>Festivos</span>
          </Link>
        </div>
      )}
    </div>
  );
}
