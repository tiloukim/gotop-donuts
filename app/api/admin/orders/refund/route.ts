import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSquareClient } from '@/lib/square'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { order_id, reason } = await request.json() as {
    order_id: string
    reason?: string
  }

  if (!order_id) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Get the order
  const { data: order, error: orderError } = await service
    .from('orders')
    .select('*')
    .eq('id', order_id)
    .single()

  if (orderError || !order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (['cancelled', 'refunded'].includes(order.status)) {
    return NextResponse.json({ error: 'Order already cancelled/refunded' }, { status: 400 })
  }

  if (!order.square_payment_id) {
    // No payment to refund — just cancel the order
    await service
      .from('orders')
      .update({ status: 'cancelled', cancel_reason: reason || 'Cancelled', updated_at: new Date().toISOString() })
      .eq('id', order_id)

    return NextResponse.json({ success: true, note: 'No payment found, order cancelled' })
  }

  // Process refund through Square
  try {
    const square = getSquareClient()

    // Check payment status and refundable amount
    const { payment } = await square.payments.get({ paymentId: order.square_payment_id })
    const refundedAmount = Number(payment?.refundedMoney?.amount ?? 0)
    const totalAmount = Number(payment?.totalMoney?.amount ?? 0)
    const refundableAmount = totalAmount - refundedAmount

    if (refundableAmount <= 0) {
      // Already fully refunded on Square — just update our DB
      await service
        .from('orders')
        .update({ status: 'refunded', cancel_reason: reason || 'Refunded', updated_at: new Date().toISOString() })
        .eq('id', order_id)

      return NextResponse.json({ success: true, note: 'Already refunded on Square, status updated' })
    }

    await square.refunds.refundPayment({
      idempotencyKey: randomUUID(),
      paymentId: order.square_payment_id,
      amountMoney: {
        amount: BigInt(refundableAmount),
        currency: 'USD',
      },
      reason: reason || 'Out of stock items',
    })

    // Update order status
    await service
      .from('orders')
      .update({ status: 'refunded', cancel_reason: reason || 'Refunded', updated_at: new Date().toISOString() })
      .eq('id', order_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Square refund failed:', err)

    let message = 'Refund failed. Please try again.'
    if (err && typeof err === 'object' && 'errors' in err) {
      const sqErr = err as { errors?: { code?: string }[] }
      const codes = sqErr.errors?.map(e => e.code) ?? []
      if (codes.includes('REFUND_AMOUNT_INVALID')) {
        // Already refunded — update status anyway
        await service
          .from('orders')
          .update({ status: 'refunded', cancel_reason: reason || 'Refunded', updated_at: new Date().toISOString() })
          .eq('id', order_id)
        return NextResponse.json({ success: true, note: 'Already refunded on Square' })
      }
      if (codes.includes('PAYMENT_NOT_REFUNDABLE')) {
        message = 'This payment cannot be refunded (it may still be processing).'
      }
    }

    return NextResponse.json({ error: message }, { status: 400 })
  }
}
