import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/lib/stripe';

// Desactivar el parseo automático del body para obtener el raw body requerido por Stripe
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new NextResponse('Falta la firma de Stripe', { status: 400 });
  }

  try {
    const rawBody = await req.text();
    await handleStripeWebhook(signature, rawBody);
    return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error('Error procesando webhook de Stripe:', err.message);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }
}
