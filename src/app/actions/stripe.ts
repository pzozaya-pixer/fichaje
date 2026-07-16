'use server';

import { createCheckoutSession, createPortalSession, stripe } from '@/lib/stripe';
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
  try {
    const checkoutUrl = await createCheckoutSession(companyId, email, tier, period, quantity);
    return { success: true, url: checkoutUrl };
  } catch (error: any) {
    console.error('Error creando sesión de Stripe:', error);
    return { success: false, error: error.message || 'No se pudo crear la sesión de pago de Stripe.' };
  }
}

export async function openBillingPortalAction(companyId: string) {
  try {
    const portalUrl = await createPortalSession(companyId);
    return { success: true, url: portalUrl };
  } catch (error: any) {
    console.error('Error creando portal de facturación:', error);
    return { success: false, error: error.message || 'No se pudo iniciar el portal de facturación.' };
  }
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
