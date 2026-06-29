import React from 'react';
export const dynamic = 'force-dynamic';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { Receipt, Download, AlertCircle } from 'lucide-react';

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (user.role !== 'ADMIN') redirect('/dashboard');

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
  });

  let invoicesData: any[] = [];
  let errorMsg = '';

  if (company && company.stripeCustomerId) {
    try {
      const invoices = await stripe.invoices.list({
        customer: company.stripeCustomerId,
        status: 'paid',
        limit: 50,
      });

      invoicesData = invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number || 'Sin número',
        amount: (inv.amount_paid / 100).toFixed(2),
        currency: inv.currency === 'eur' ? '€' : inv.currency.toUpperCase(),
        date: new Date(inv.created * 1000).toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        pdfUrl: inv.invoice_pdf || null,
      }));
    } catch (err) {
      console.error('Error al obtener facturas de Stripe:', err);
      errorMsg = 'No se pudieron recuperar las facturas de Stripe. Inténtalo más tarde.';
    }
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* CABECERA */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturación</h1>
          <p className="page-subtitle">Consulta y descarga tus facturas de Stripe en formato PDF.</p>
        </div>
      </div>

      {errorMsg && (
        <div className="pwa-geo-status out-range" style={{ margin: 0 }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* DETALLES DE FACTURACIÓN */}
      <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <Receipt size={20} style={{ color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '16px', fontFamily: 'var(--font-title)', fontWeight: 600 }}>Historial de Facturas Pagadas</h3>
        </div>

        {invoicesData.length > 0 ? (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Nº de Factura</th>
                  <th>Fecha de Emisión</th>
                  <th>Total Pagado</th>
                  <th style={{ textAlign: 'right' }}>Descarga</th>
                </tr>
              </thead>
              <tbody>
                {invoicesData.map((inv) => (
                  <tr key={inv.id}>
                    <td style={{ fontWeight: 600 }}>{inv.number}</td>
                    <td>{inv.date}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      {inv.amount} {inv.currency}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {inv.pdfUrl ? (
                        <a
                          href={inv.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                        >
                          <Download size={14} />
                          Descargar PDF
                        </a>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No disponible</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '50%', color: 'var(--text-secondary)' }}>
              <Receipt size={32} />
            </div>
            <p style={{ fontWeight: 600, margin: 0 }}>No hay facturas pagadas</p>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '480px', margin: 0 }}>
              Si te has suscrito recientemente o estás en el periodo de prueba gratuito, tu primera factura se generará automáticamente cuando finalice el periodo de prueba y se procese el primer pago.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
