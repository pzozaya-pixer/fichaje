'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarLinkProps {
  href: string;
  children: React.ReactNode;
}

export default function SidebarLink({ href, children }: SidebarLinkProps) {
  const pathname = usePathname();
  // El link está activo si coincide exactamente o si es una subruta (excepto para /dashboard exacto)
  const isActive = href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <Link href={href} className={`sidebar-item ${isActive ? 'active' : ''}`}>
      {children}
    </Link>
  );
}
