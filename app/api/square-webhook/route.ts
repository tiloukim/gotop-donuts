import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = createServiceClient();

    let matchedOrderId: string | null = null;
    let logPayload: Record<string, unknown> = {};

    switch (body.type) {
      case 'payment.completed':
        logPayload = { status: 'COMPLETED', note: 'ignored' };
        break;

      case 'payment.updated': {
        const payment = body.data?.object?.payment;
        const paymentId = payment?.id;
        const status = payment?.status;

        logPayload = { paymentId, status, source: payment?.application_details?.square_product };

        if (paymentId && (status === 'CANCELED' || status === 'CANCELLED' || status === 'VOIDED' || status === 'FAILED')) {
          const { data, error } = await service.from('orders')
            .update({ status: 'cancelled', cancel_reason: 'Cancelled via Square POS', updated_at: new Date().toISOString() })
            .eq('square_payment_id', paymentId)
            .select('id');

          matchedOrderId = data?.[0]?.id || null;
          logPayload.matched = data?.length ?? 0;
          logPayload.dbError = error?.message || null;
        }
        break;
      }

      case 'refund.created':
      case 'refund.updated': {
        const refund = body.data?.object?.refund;
        const refundPaymentId = refund?.payment_id;
        const refundStatus = refund?.status;

        logPayload = { refundPaymentId, refundStatus, refundId: refund?.id };

        if (refundPaymentId && (refundStatus === 'COMPLETED' || refundStatus === 'PENDING')) {
          const { data, error } = await service.from('orders')
            .update({ status: 'refunded', cancel_reason: refund?.reason || 'Refunded via Square POS', updated_at: new Date().toISOString() })
            .eq('square_payment_id', refundPaymentId)
            .select('id');

          matchedOrderId = data?.[0]?.id || null;
          logPayload.matched = data?.length ?? 0;
          logPayload.dbError = error?.message || null;
        }
        break;
      }

      default:
        logPayload = { note: 'unhandled event type' };
        break;
    }

    // Try to save log (table may not exist yet)
    await service.from('webhook_logs').insert({
      event_type: body.type || 'unknown',
      event_id: body.event_id || null,
      matched_order_id: matchedOrderId,
      payload: logPayload,
    });

    return NextResponse.json({ received: true });
  } catch (e) {
    // Always return 200 so Square doesn't keep retrying
    console.error('Webhook handler error:', e);
    return NextResponse.json({ received: true });
  }
}
