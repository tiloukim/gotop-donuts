import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();

  console.log('Square webhook received:', body.type, JSON.stringify(body.data?.object));

  const service = createServiceClient();

  switch (body.type) {
    case 'payment.completed':
      break;

    case 'payment.updated': {
      // Webhook sends snake_case JSON
      const payment = body.data?.object?.payment;
      const paymentId = payment?.id;
      const status = payment?.status;

      if (paymentId && (status === 'CANCELED' || status === 'FAILED')) {
        await service.from('orders')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('square_payment_id', paymentId);
      }
      break;
    }

    case 'refund.created':
    case 'refund.updated': {
      // Square webhooks use snake_case: payment_id, not paymentId
      const refund = body.data?.object?.refund;
      const refundPaymentId = refund?.payment_id;
      const refundStatus = refund?.status;

      if (refundPaymentId && (refundStatus === 'COMPLETED' || refundStatus === 'PENDING')) {
        await service.from('orders')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('square_payment_id', refundPaymentId);
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
