'use client';

import React, { useState, useEffect } from 'react';
import { 
  LogOut, 
  Clock, 
  Menu, 
  X, 
  Home, 
  Users, 
  Calendar, 
  BarChart2, 
  ShieldAlert, 
  Receipt, 
  CalendarDays 
} from 'lucide-react';
import SidebarLink from './SidebarLink';
import ConfigMenu from './ConfigMenu';
import { usePathname } from 'next/navigation';

interface AdminSidebarProps {
  user: {
    role: string;
    name: string;
    email: string;
  };
  logoutAction: () => Promise<void>;
}

export default function AdminSidebar({ user, logoutAction }: AdminSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Cerrar el menú al cambiar de página en móvil
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <>
      {/* HEADER DE MÓVIL (VISIBLE SOLO EN PANTALLAS PEQUEÑAS) */}
      <header className="mobile-header">
        <div className="mobile-logo text-gradient">
          <Clock size={22} />
          <span>Fichaje.click</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="mobile-menu-btn"
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* OVERLAY DEL MENU MÓVIL */}
      {isOpen && (
        <div 
          className="mobile-menu-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* SIDEBAR LATERAL (COMPACTO O DESPLEGADO) */}
      <aside className={`admin-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo text-gradient">
            <Clock size={24} />
            <span>Fichaje.click</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          {user.role === 'ADMIN' && (
            <>
              <SidebarLink href="/dashboard">
                <Home size={18} />
                <span>Inicio</span>
              </SidebarLink>
              
              <SidebarLink href="/dashboard/employees">
                <Users size={18} />
                <span>Empleados</span>
              </SidebarLink>
              
              <SidebarLink href="/dashboard/fichajes">
                <Calendar size={18} />
                <span>Fichajes</span>
              </SidebarLink>
              
              <SidebarLink href="/dashboard/vacations">
                <CalendarDays size={18} />
                <span>Vacaciones</span>
              </SidebarLink>
            </>
          )}
          
          <SidebarLink href="/dashboard/reports">
            <BarChart2 size={18} />
            <span>Informes</span>
          </SidebarLink>
          
          {user.role === 'ADMIN' && (
            <>
              <SidebarLink href="/dashboard/audit">
                <ShieldAlert size={18} />
                <span>Registro de Cambios</span>
              </SidebarLink>

              <SidebarLink href="/dashboard/billing">
                <Receipt size={18} />
                <span>Facturación</span>
              </SidebarLink>
              
              <ConfigMenu />
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          {/* Perfil del Administrador */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px 12px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                color: 'white',
                fontSize: '14px',
              }}
            >
              {user.name.charAt(0)}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'white', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.name}
              </p>
              <p style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.role === 'ADMIN' ? 'Gestor RRHH' : 'Inspector'}
              </p>
            </div>
          </div>

          {/* Formulario de Cierre de Sesión */}
          <form action={logoutAction}>
            <button
              type="submit"
              className="sidebar-item"
              style={{ width: '100%', border: 'none', background: 'none', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', color: '#f87171', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              <LogOut size={18} />
              <span>Cerrar sesión</span>
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
