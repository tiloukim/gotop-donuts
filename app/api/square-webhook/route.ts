import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const service = createServiceClient();

  // Log every webhook for debugging
  const logEntry = {
    event_type: body.type,
    event_id: body.event_id,
    payload: body.data?.object,
  };

  let matchedOrderId: string | null = null;

  switch (body.type) {
    case 'payment.completed':
      break;

    case 'payment.updated': {
      const payment = body.data?.object?.payment;
      const paymentId = payment?.id;
      const status = payment?.status;

      logEntry.payload = { paymentId, status, source: payment?.application_details?.square_product };

      if (paymentId && (status === 'CANCELED' || status === 'CANCELLED' || status === 'VOIDED' || status === 'FAILED')) {
        const { data, error } = await service.from('orders')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('square_payment_id', paymentId)
          .select('id');

        matchedOrderId = data?.[0]?.id || null;
        console.log('Payment cancel update:', { paymentId, status, matched: data?.length, error: error?.message });
      }
      break;
    }

    case 'refund.created':
    case 'refund.updated': {
      const refund = body.data?.object?.refund;
      const refundPaymentId = refund?.payment_id;
      const refundStatus = refund?.status;

      logEntry.payload = { refundPaymentId, refundStatus, refundId: refund?.id };

      if (refundPaymentId && (refundStatus === 'COMPLETED' || refundStatus === 'PENDING')) {
        const { data, error } = await service.from('orders')
          .update({ status: 'refunded', updated_at: new Date().toISOString() })
          .eq('square_payment_id', refundPaymentId)
          .select('id');

        matchedOrderId = data?.[0]?.id || null;
        console.log('Refund update:', { refundPaymentId, refundStatus, matched: data?.length, error: error?.message });
      }
      break;
    }

    default:
      break;
  }

  // Save log to database
  try {
    await service.from('webhook_logs').insert({
      ...logEntry,
      matched_order_id: matchedOrderId,
      payload: logEntry.payload ? JSON.parse(JSON.stringify(logEntry.payload, (_, v) =>
        typeof v === 'bigint' ? v.toString() : v
      )) : null,
    });
  } catch (e) {
    console.error('Failed to log webhook:', e);
  }

  return NextResponse.json({ received: true });
}
