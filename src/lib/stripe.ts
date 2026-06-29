import Stripe from 'stripe';
import { prisma } from './db';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const stripe = new Stripe(stripeSecretKey);

// Crear una sesión de pago en Stripe con 15 días de prueba
export async function createCheckoutSession(
  companyId: string,
  email: string,
  plan: 'monthly' | 'annual' = 'monthly'
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new Error('Empresa no encontrada');
  }

  // Determinar el ID de producto de Stripe
  const productId = plan === 'annual' ? 'prod_Un91TCtSLN7pzx' : 'prod_Un8zZdgvmqcuay';

  // Obtener el precio activo del producto en Stripe para usar el precio configurado en tu dashboard
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 1,
  });

  if (!prices.data || prices.data.length === 0) {
    throw new Error(`No se encontró un precio activo en Stripe para el producto ${productId}`);
  }

  const priceId = prices.data[0].id;

  // Determinar si aplica el trial de 15 días
  const now = new Date();
  const trialEndTimestamp = Math.floor(company.trialEndsAt.getTime() / 1000);
  const isTrialActive = company.trialEndsAt > now;

  // Crear o usar el cliente de Stripe
  let stripeCustomerId = company.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email,
      name: company.name,
      metadata: { companyId },
    });
    stripeCustomerId = customer.id;
    await prisma.company.update({
      where: { id: companyId },
      data: { stripeCustomerId },
    });
  }

  // Crear la sesión de suscripción
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    subscription_data: isTrialActive
      ? {
          trial_end: trialEndTimestamp,
        }
      : undefined,
    success_url: `${appUrl}/dashboard/config?status=success`,
    cancel_url: `${appUrl}/dashboard/config?status=cancel`,
    metadata: { companyId },
  });

  if (!session.url) {
    throw new Error('No se pudo generar la URL de Stripe Checkout.');
  }

  return session.url;
}

// Crear una sesión del portal de facturación de Stripe
export async function createPortalSession(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company || !company.stripeCustomerId) {
    throw new Error('La empresa no tiene una suscripción activa o cliente de Stripe.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: company.stripeCustomerId,
    return_url: `${appUrl}/dashboard/config`,
  });

  return session.url;
}

// Procesar los webhooks de Stripe
export async function handleStripeWebhook(signature: string, rawBody: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`Error de firma de webhook: ${err.message}`);
    throw new Error(`Webhook Error: ${err.message}`);
  }

  // Manejar el evento
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;
      const status = subscription.status; // active, trialing, past_due, canceled
      const trialEndsAt = subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : new Date();

      // Buscar empresa por stripeCustomerId
      const company = await prisma.company.findFirst({
        where: { stripeCustomerId },
      });

      if (company) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: status,
            trialEndsAt: subscription.trial_end ? trialEndsAt : company.trialEndsAt,
          },
        });
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = subscription.customer as string;

      const company = await prisma.company.findFirst({
        where: { stripeCustomerId },
      });

      if (company) {
        await prisma.company.update({
          where: { id: company.id },
          data: {
            subscriptionStatus: 'canceled',
          },
        });
      }
      break;
    }
    default:
      console.log(`Evento de webhook no manejado: ${event.type}`);
  }
}
