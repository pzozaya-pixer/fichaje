import React from 'react';
export const dynamic = 'force-dynamic';
import { getReportsData, getEmployees } from '@/app/actions/admin';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/');
  }
  if (user.role === 'CONSULTANT') {
    redirect('/dashboard/reports');
  }

  const reportsData = await getReportsData();
  const employees = await getEmployees();

  return (
    <DashboardClient
      initialData={reportsData}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
      }))}
      subscription={{
        status: user.company.subscriptionStatus,
        trialEndsAt: user.company.trialEndsAt.toISOString(),
        stripeSubscriptionId: user.company.stripeSubscriptionId || '',
      }}
      companyCreatedAt={user.company.createdAt.toISOString()}
    />
  );
}
