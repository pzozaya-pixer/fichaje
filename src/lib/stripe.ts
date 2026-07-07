import Stripe from 'stripe';
import { prisma } from './db';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const stripe = new Stripe(stripeSecretKey);

// Definición de planes y límites
export const PLANS = {
  BASIC: {
    name: 'Básica',
    limit: 10,
    monthlyProductId: 'prod_Un8zZdgvmqcuay',
    annualProductId: 'prod_Un91TCtSLN7pzx',
  },
  PRO: {
    name: 'Pro',
    limit: 50,
    monthlyProductId: process.env.STRIPE_PRO_MONTHLY_PRODUCT_ID || 'prod_pro_monthly',
    annualProductId: process.env.STRIPE_PRO_ANNUAL_PRODUCT_ID || 'prod_pro_annual',
  },
  BUSINESS: {
    name: 'Business',
    limit: Infinity,
    monthlyProductId: process.env.STRIPE_BUSINESS_MONTHLY_PRODUCT_ID || 'prod_business_monthly',
    annualProductId: process.env.STRIPE_BUSINESS_ANNUAL_PRODUCT_ID || 'prod_business_annual',
  }
};

// Helper para obtener el límite de empleados de un producto
export function getPlanLimit(productId: string | null): number {
  if (!productId) return PLANS.BASIC.limit;
  if (productId === PLANS.PRO.monthlyProductId || productId === PLANS.PRO.annualProductId) {
    return PLANS.PRO.limit;
  }
  if (productId === PLANS.BUSINESS.monthlyProductId || productId === PLANS.BUSINESS.annualProductId) {
    return PLANS.BUSINESS.limit;
  }
  if (productId === PLANS.BASIC.monthlyProductId || productId === PLANS.BASIC.annualProductId) {
    return PLANS.BASIC.limit;
  }
  return PLANS.BASIC.limit; // Por defecto
}

// Helper para obtener el nombre legible del plan
export function getPlanName(productId: string | null): string {
  if (!productId) return 'Básica (Por defecto)';
  if (productId === PLANS.PRO.monthlyProductId || productId === PLANS.PRO.annualProductId) {
    return PLANS.PRO.name;
  }
  if (productId === PLANS.BUSINESS.monthlyProductId || productId === PLANS.BUSINESS.annualProductId) {
    return PLANS.BUSINESS.name;
  }
  if (productId === PLANS.BASIC.monthlyProductId || productId === PLANS.BASIC.annualProductId) {
    return PLANS.BASIC.name;
  }
  return PLANS.BASIC.name;
}

// Crear una sesión de pago en Stripe con 15 días de prueba
export async function createCheckoutSession(
  companyId: string,
  email: string,
  tier: 'basic' | 'pro' | 'business',
  period: 'monthly' | 'annual' = 'monthly'
) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!company) {
    throw new Error('Empresa no encontrada');
  }

  // Determinar el ID de producto de Stripe
  let productId = PLANS.BASIC.monthlyProductId;
  if (tier === 'basic') {
    productId = period === 'annual' ? PLANS.BASIC.annualProductId : PLANS.BASIC.monthlyProductId;
  } else if (tier === 'pro') {
    productId = period === 'annual' ? PLANS.PRO.annualProductId : PLANS.PRO.monthlyProductId;
  } else if (tier === 'business') {
    productId = period === 'annual' ? PLANS.BUSINESS.annualProductId : PLANS.BUSINESS.monthlyProductId;
  }

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

      const priceProduct = subscription.items.data[0]?.price.product;
      const stripeProductId = typeof priceProduct === 'string'
        ? priceProduct
        : (priceProduct && 'id' in priceProduct ? priceProduct.id : null);

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
            stripeProductId: stripeProductId || company.stripeProductId,
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
            stripeSubscriptionId: null,
            stripeProductId: null,
          },
        });
      }
      break;
    }
    default:
      console.log(`Evento de webhook no manejado: ${event.type}`);
  }
}
