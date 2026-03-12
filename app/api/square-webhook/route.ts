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
      const payment = body.data?.object?.payment;
      const paymentId = payment?.id;
      const status = payment?.status;

      if (paymentId && (status === 'CANCELED' || status === 'CANCELLED' || status === 'VOIDED' || status === 'FAILED')) {
        const { data, error } = await service.from('orders')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('square_payment_id', paymentId)
          .select('id');

        console.log('Payment cancel update:', { paymentId, status, matched: data?.length, error: error?.message });
      }
      break;
    }

    case 'refund.created':
    case 'refund.updated': {
      const refund = body.data?.object?.refund;
      const refundPaymentId = refund?.payment_id;
      const refundStatus = refund?.status;

      if (refundPaymentId && (refundStatus === 'COMPLETED' || refundStatus === 'PENDING')) {
        const { data, error } = await service.from('orders')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('square_payment_id', refundPaymentId)
          .select('id');

        console.log('Refund update:', { refundPaymentId, refundStatus, matched: data?.length, error: error?.message });
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
