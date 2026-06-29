'use server';

import { createCheckoutSession, createPortalSession } from '@/lib/stripe';
import { redirect } from 'next/navigation';

export async function subscribeAction(companyId: string, email: string, plan: 'monthly' | 'annual') {
  let checkoutUrl: string;
  try {
    checkoutUrl = await createCheckoutSession(companyId, email, plan);
  } catch (error) {
    console.error('Error creando sesión de Stripe:', error);
    throw new Error('No se pudo crear la sesión de pago de Stripe.');
  }

  redirect(checkoutUrl);
}

export async function openBillingPortalAction(companyId: string) {
  let portalUrl: string;
  try {
    portalUrl = await createPortalSession(companyId);
  } catch (error) {
    console.error('Error creando portal de facturación:', error);
    throw new Error('No se pudo iniciar el portal de facturación.');
  }

  redirect(portalUrl);
}
