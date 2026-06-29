import React from 'react';
export const dynamic = 'force-dynamic';
import { getWorkCenters, getDepartments } from '@/app/actions/admin';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ConfigClient from './ConfigClient';

export default async function ConfigPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/');

  const workCenters = await getWorkCenters();
  const departments = await getDepartments();

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
    />
  );
}
