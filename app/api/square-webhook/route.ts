import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  console.log('Square webhook received:', body.type);

  const service = createServiceClient();

  switch (body.type) {
    case 'payment.completed':
      // Payment completed — order already created in POST /api/orders
      break;

    case 'payment.updated': {
      // Handle refunds — Square updates payment status
      const payment = body.data?.object?.payment;
      if (!payment?.id) break;

      const status = payment.status;
      if (status === 'CANCELED' || status === 'FAILED') {
        // Find order by square_payment_id and mark as cancelled
        await service.from('orders')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('square_payment_id', payment.id);
      }
      break;
    }

    case 'refund.created':
    case 'refund.updated': {
      const refund = body.data?.object?.refund;
      if (!refund?.paymentId) break;

      if (refund.status === 'COMPLETED' || refund.status === 'PENDING') {
        // Mark order as refunded
        await service.from('orders')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('square_payment_id', refund.paymentId);
      }
      break;
    }

    case 'payment.failed':
      console.error('Payment failed:', body.data?.object?.payment?.id);
      break;

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
