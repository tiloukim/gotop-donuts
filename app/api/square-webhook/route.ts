import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Square webhook handler for payment status updates
  // In production, verify the webhook signature
  const body = await request.json();

  console.log('Square webhook received:', body.type);

  // Handle different event types
  switch (body.type) {
    case 'payment.completed':
      // Payment completed — order already created in POST /api/orders
      break;
    case 'payment.failed':
      console.error('Payment failed:', body.data?.object?.payment?.id);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
