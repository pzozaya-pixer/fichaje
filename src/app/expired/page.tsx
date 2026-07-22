import React from 'react';
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ExpiredClient from './ExpiredClient';
import { stripe, PLANS } from '@/lib/stripe';

export default async function ExpiredPage() {
  const user = await getCurrentUser();

  // Si no está autenticado, volver al login
  if (!user) {
    redirect('/');
  }

  // Si su suscripción está bien, redirigir al sitio correspondiente
  if (!user.isSubscriptionExpired) {
    if (user.role === 'ADMIN' || user.role === 'CONSULTANT') {
      redirect('/dashboard');
    } else {
      redirect('/movil');
    }
  }

  // Función auxiliar para recuperar precios de Stripe con fallback
  async function getProductPriceLabel(
    productId: string,
    period: 'monthly' | 'annual',
    fallback: string
  ): Promise<string> {
    if (
      !productId ||
      productId === 'prod_pro_monthly' ||
      productId === 'prod_pro_annual' ||
      productId === 'prod_business_monthly' ||
      productId === 'prod_business_annual'
    ) {
      return fallback;
    }
    try {
      const pricesList = await stripe.prices.list({
        product: productId,
        active: true,
        type: 'recurring',
      });
      const targetInterval = period === 'annual' ? 'year' : 'month';
      const priceObj = pricesList.data.find((p) => p.recurring?.interval === targetInterval);
      if (priceObj) {
        const amount = (priceObj.unit_amount || 0) / 100;
        const currency = priceObj.currency === 'eur' ? '€' : priceObj.currency.toUpperCase();
        return `${amount}${currency}`;
      } else if (period === 'annual') {
        const monthlyObj = pricesList.data.find((p) => p.recurring?.interval === 'month');
        if (monthlyObj) {
          const monthlyAmount = (monthlyObj.unit_amount || 0) / 100;
          const calculatedAnnual = monthlyAmount * 10;
          const currency = monthlyObj.currency === 'eur' ? '€' : monthlyObj.currency.toUpperCase();
          return `${calculatedAnnual}${currency}`;
        }
      }
    } catch (err) {
      console.warn(`No se pudo obtener precio para producto ${productId}:`, err);
    }
    return fallback;
  }

  // Cargar todos los precios en paralelo con sus respectivos fallbacks
  const [
    basicMonthlyPrice,
    basicAnnualPrice,
    proMonthlyPrice,
    proAnnualPrice,
    businessMonthlyPrice,
    businessAnnualPrice
  ] = await Promise.all([
    getProductPriceLabel(PLANS.BASIC.monthlyProductId, 'monthly', '29€'),
    getProductPriceLabel(PLANS.BASIC.annualProductId, 'annual', '290€'),
    getProductPriceLabel(PLANS.PRO.monthlyProductId, 'monthly', '2.50€'),
    getProductPriceLabel(PLANS.PRO.annualProductId, 'annual', '25€'),
    getProductPriceLabel(PLANS.BUSINESS.monthlyProductId, 'monthly', '5.00€'),
    getProductPriceLabel(PLANS.BUSINESS.annualProductId, 'annual', '50€')
  ]);

  const pricesMap = {
    basic_monthly: basicMonthlyPrice,
    basic_annual: basicAnnualPrice,
    pro_monthly: proMonthlyPrice,
    pro_annual: proAnnualPrice,
    business_monthly: businessMonthlyPrice,
    business_annual: businessAnnualPrice
  };

  // Contar empleados activos
  const activeEmployeesCount = await prisma.user.count({
    where: { companyId: user.companyId, isActive: true, role: 'EMPLOYEE' },
  });

  return (
    <main className="login-container">
      <ExpiredClient
        company={{
          id: user.companyId,
          name: user.company.name,
          email: user.email,
          trialEndsAt: user.company.trialEndsAt.toISOString(),
        }}
        isAdmin={user.role === 'ADMIN'}
        activeEmployeesCount={activeEmployeesCount}
        prices={pricesMap}
      />
    </main>
  );
}
