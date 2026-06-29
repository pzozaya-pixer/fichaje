import React from 'react';
export const dynamic = 'force-dynamic';
import { getWorkCenters, getDepartments } from '@/app/actions/admin';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ConfigClient from './ConfigClient';
import { stripe } from '@/lib/stripe';

export default async function ConfigPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');
  if (user.role === 'CONSULTANT') {
    redirect('/dashboard/reports');
  }

  const workCenters = await getWorkCenters();
  const departments = await getDepartments();

  // Valores por defecto
  let monthlyPriceLabel = '29€';
  let annualPriceLabel = '290€';

  try {
    // Obtener precio mensual
    const monthlyPrices = await stripe.prices.list({
      product: 'prod_Un8zZdgvmqcuay',
      active: true,
      limit: 1,
    });
    if (monthlyPrices.data && monthlyPrices.data.length > 0) {
      const price = monthlyPrices.data[0];
      const amount = (price.unit_amount || 0) / 100;
      const currency = price.currency === 'eur' ? '€' : price.currency.toUpperCase();
      monthlyPriceLabel = `${amount}${currency}`;
    }

    // Obtener precio anual
    const annualPrices = await stripe.prices.list({
      product: 'prod_Un91TCtSLN7pzx',
      active: true,
      limit: 1,
    });
    if (annualPrices.data && annualPrices.data.length > 0) {
      const price = annualPrices.data[0];
      const amount = (price.unit_amount || 0) / 100;
      const currency = price.currency === 'eur' ? '€' : price.currency.toUpperCase();
      annualPriceLabel = `${amount}${currency}`;
    }
  } catch (err) {
    console.error('Error al obtener precios de Stripe:', err);
  }

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
      subscription={{
        status: user.company.subscriptionStatus,
        trialEndsAt: user.company.trialEndsAt.toISOString(),
        stripeCustomerId: user.company.stripeCustomerId || '',
      }}
      companyId={user.companyId}
      companyEmail={user.email}
      monthlyPrice={monthlyPriceLabel}
      annualPrice={annualPriceLabel}
    />
  );
}
