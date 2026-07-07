import React from 'react';
export const dynamic = 'force-dynamic';
import { getWorkCenters, getDepartments } from '@/app/actions/admin';
import { getHolidays } from '@/app/actions/holidays';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ConfigClient from './ConfigClient';
import { stripe, PLANS } from '@/lib/stripe';

export default async function ConfigPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (user.role === 'CONSULTANT') {
    redirect('/dashboard/reports');
  }

  const workCenters = await getWorkCenters();
  const departments = await getDepartments();
  const holidays = await getHolidays();

  // Función auxiliar para recuperar precios de Stripe con fallback
  async function getProductPriceLabel(productId: string, fallback: string): Promise<string> {
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
        limit: 1,
      });
      if (pricesList.data && pricesList.data.length > 0) {
        const price = pricesList.data[0];
        const amount = (price.unit_amount || 0) / 100;
        const currency = price.currency === 'eur' ? '€' : price.currency.toUpperCase();
        return `${amount}${currency}`;
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
    getProductPriceLabel(PLANS.BASIC.monthlyProductId, '29€'),
    getProductPriceLabel(PLANS.BASIC.annualProductId, '290€'),
    getProductPriceLabel(PLANS.PRO.monthlyProductId, '59€'),
    getProductPriceLabel(PLANS.PRO.annualProductId, '590€'),
    getProductPriceLabel(PLANS.BUSINESS.monthlyProductId, '99€'),
    getProductPriceLabel(PLANS.BUSINESS.annualProductId, '990€')
  ]);

  const pricesMap = {
    basic_monthly: basicMonthlyPrice,
    basic_annual: basicAnnualPrice,
    pro_monthly: proMonthlyPrice,
    pro_annual: proAnnualPrice,
    business_monthly: businessMonthlyPrice,
    business_annual: businessAnnualPrice
  };

  return (
    <ConfigClient
      initialWorkCenters={workCenters.map((w) => ({
        id: w.id,
        name: w.name,
        address: w.address || '',
        latitude: w.latitude,
        longitude: w.longitude,
        radius: w.radius,
      }))}
      initialDepartments={departments}
      initialHolidays={holidays.map((h) => ({
        id: h.id,
        date: h.date.toISOString(),
        name: h.name,
      }))}
      subscription={{
        status: user.company.subscriptionStatus,
        trialEndsAt: user.company.trialEndsAt.toISOString(),
        stripeCustomerId: user.company.stripeCustomerId || '',
        stripeSubscriptionId: user.company.stripeSubscriptionId || '',
        stripeProductId: user.company.stripeProductId || null,
      }}
      company={{
        name: user.company.name,
        cif: user.company.cif,
        address: user.company.address || '',
        city: user.company.city || '',
        province: user.company.province || '',
        postalCode: user.company.postalCode || '',
        backupActive: user.company.backupActive,
        backupFrequency: user.company.backupFrequency,
        backupEmail: user.company.backupEmail || '',
        createdAt: user.company.createdAt.toISOString(),
      }}
      companyId={user.companyId}
      companyEmail={user.email}
      monthlyPrice={pricesMap.basic_monthly}
      annualPrice={pricesMap.basic_annual}
      prices={pricesMap}
    />
  );
}
