import { createServiceClient } from '@/lib/supabase/service';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const service = createServiceClient();

    // Log ALL incoming webhooks for debugging
    console.log('[WEBHOOK] Received:', body.type, JSON.stringify(body.data?.object || {}).slice(0, 500))

    let matchedOrderId: string | null = null;
    let logPayload: Record<string, unknown> = { raw_type: body.type };

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

      case 'order.fulfillment.updated': {
        const orderId = body.data?.object?.order_fulfillment_updated?.order_id;
        const fulfillmentUpdate = body.data?.object?.order_fulfillment_updated?.fulfillment_update?.[0];
        const newState = fulfillmentUpdate?.new_state;
        const oldState = fulfillmentUpdate?.old_state;

        logPayload = { squareOrderId: orderId, oldState, newState };

        if (orderId && newState) {
          // Map Square fulfillment states to our order statuses
          const stateMap: Record<string, string> = {
            'PROPOSED': 'confirmed',
            'RESERVED': 'preparing',
            'PREPARED': 'ready_for_pickup',
            'COMPLETED': 'picked_up',
            'CANCELED': 'cancelled',
          };

          const newStatus = stateMap[newState];
          if (newStatus) {
            const { data, error } = await service.from('orders')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('square_order_id', orderId)
              .select('id');

            matchedOrderId = data?.[0]?.id || null;
            logPayload.mappedStatus = newStatus;
            logPayload.matched = data?.length ?? 0;
            logPayload.dbError = error?.message || null;
          }
        }
        break;
      }

      case 'order.updated': {
        // Handle direct order state changes from POS
        const order = body.data?.object?.order;
        const sqOrderId = order?.id;
        const sqState = order?.state;
        const fulfillments = order?.fulfillments;
        const fulfillmentState = fulfillments?.[0]?.state;

        logPayload = { squareOrderId: sqOrderId, orderState: sqState, fulfillmentState };

        if (sqOrderId && fulfillmentState) {
          const stateMap: Record<string, string> = {
            'PROPOSED': 'confirmed',
            'RESERVED': 'preparing',
            'PREPARED': 'ready_for_pickup',
            'COMPLETED': 'picked_up',
            'CANCELED': 'cancelled',
          };

          const newStatus = stateMap[fulfillmentState];
          if (newStatus) {
            const { data, error } = await service.from('orders')
              .update({ status: newStatus, updated_at: new Date().toISOString() })
              .eq('square_order_id', sqOrderId)
              .select('id');

            matchedOrderId = data?.[0]?.id || null;
            logPayload.mappedStatus = newStatus;
            logPayload.matched = data?.length ?? 0;
            logPayload.dbError = error?.message || null;
          }
        }
        break;
      }

      default:
        logPayload = { note: 'unhandled event type' };
        break;
    }

    // Save full raw payload for debugging
    logPayload.raw_data = body.data?.object || null

    // Try to save log (table may not exist yet)
    try {
      await service.from('webhook_logs').insert({
        event_type: body.type || 'unknown',
        event_id: body.event_id || null,
        matched_order_id: matchedOrderId,
        payload: logPayload,
      });
    } catch {
      // Table may not exist
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    // Always return 200 so Square doesn't keep retrying
    console.error('Webhook handler error:', e);
    return NextResponse.json({ received: true });
  }
}
