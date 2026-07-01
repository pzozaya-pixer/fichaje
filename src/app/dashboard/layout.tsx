import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { logoutAction } from '@/app/actions/auth';
import Link from 'next/link';
import SidebarLink from './SidebarLink';
import ConfigMenu from './ConfigMenu';
import {
  Clock,
  Home,
  Users,
  Calendar,
  BarChart2,
  Settings,
  LogOut,
  User as UserIcon,
  ShieldAlert,
  Receipt
} from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  // Redirigir si no está autenticado
  if (!user) {
    redirect('/');
  }

  // Redirigir si es un empleado (los empleados solo acceden a la PWA)
  if (user.role === 'EMPLOYEE') {
    redirect('/pwa');
  }

  // Redirigir si el periodo de prueba o suscripción ha expirado
  if (user.isSubscriptionExpired) {
    redirect('/expired');
  }

  return (
    <div className="admin-layout">
      {/* SIDEBAR LATERAL (PREMIUM) */}
      <aside className="admin-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo text-gradient">
            <Clock size={24} />
            <span>Fichaje.click</span>
          </div>
          {/* Botón de cerrar sesión rápido para móviles */}
          <form action={logoutAction} className="mobile-logout-form">
            <button type="submit" className="mobile-logout-btn" title="Cerrar sesión">
              <LogOut size={18} />
            </button>
          </form>
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

      {/* CONTENIDO PRINCIPAL */}
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
