'use server';

import { createCheckoutSession, createPortalSession, stripe } from '@/lib/stripe';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export async function subscribeAction(
  companyId: string,
  email: string,
  tier: 'basic' | 'pro' | 'business',
  period: 'monthly' | 'annual',
  quantity: number = 1
) {
  let checkoutUrl: string;
  try {
    checkoutUrl = await createCheckoutSession(companyId, email, tier, period, quantity);
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

export async function cancelSubscriptionAction() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') {
    return { success: false, message: 'No autorizado.' };
  }

  try {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
    });

    if (!company || !company.stripeSubscriptionId) {
      return { success: false, message: 'No tienes ninguna suscripción activa en Stripe.' };
    }

    // Cancelar la suscripción en Stripe de forma inmediata
    await stripe.subscriptions.cancel(company.stripeSubscriptionId);

    // Actualizar base de datos
    await prisma.company.update({
      where: { id: user.companyId },
      data: {
        subscriptionStatus: 'canceled',
      },
    });

    revalidatePath('/dashboard/config');
    return { success: true, message: 'Suscripción cancelada correctamente.' };
  } catch (error: any) {
    console.error('Error al cancelar la suscripción:', error);
    return { success: false, message: error.message || 'Error al cancelar la suscripción en Stripe.' };
  }
}
