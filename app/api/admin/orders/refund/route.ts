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
    return NextResponse.json({ error: 'No payment ID found for this order' }, { status: 400 })
  }

  // Process refund through Square
  try {
    const square = getSquareClient()
    const amountCents = Math.round(Number(order.total) * 100)

    await square.refunds.refundPayment({
      idempotencyKey: randomUUID(),
      paymentId: order.square_payment_id,
      amountMoney: {
        amount: BigInt(amountCents),
        currency: 'USD',
      },
      reason: reason || 'Out of stock items',
    })

    // Update order status
    await service
      .from('orders')
      .update({
        status: 'refunded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Square refund failed:', err)
    const message = err instanceof Error ? err.message : 'Refund failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
