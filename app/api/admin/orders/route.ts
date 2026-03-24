import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSquareClient } from '@/lib/square'
import type { FulfillmentState } from 'square'
import { ADMIN_EMAIL } from '@/lib/constants'
import { sendOrderStatusEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import type { OrderStatus } from '@/lib/types'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const status = request.nextUrl.searchParams.get('status')

  let query = service
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (status) {
    query = query.eq('status', status)
  }

  const { data: orders, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with customer info
  const orderList = orders ?? []
  if (orderList.length === 0) {
    return NextResponse.json({ orders: [] })
  }

  const userIds = [...new Set(orderList.map(o => o.user_id))]

  const [profilesResult, usersResult] = await Promise.all([
    service.from('profiles').select('id, full_name, phone').in('id', userIds),
    service.auth.admin.listUsers({ perPage: 1000 }),
  ])

  const profileMap = new Map((profilesResult.data ?? []).map(p => [p.id, p]))
  const emailMap = new Map((usersResult.data?.users ?? []).map(u => [u.id, u.email]))

  const enriched = orderList.map(o => ({
    ...o,
    customer_name: profileMap.get(o.user_id)?.full_name ?? null,
    customer_email: emailMap.get(o.user_id) ?? null,
    customer_phone: profileMap.get(o.user_id)?.phone ?? null,
  }))

  return NextResponse.json({ orders: enriched })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json() as { order_id: string; status?: OrderStatus; scheduled_at?: string }
  const { order_id, status, scheduled_at } = body

  const service = createServiceClient()

  // Handle pickup time update
  if (scheduled_at !== undefined) {
    const updateFields: Record<string, unknown> = {
      scheduled_at: scheduled_at || null,
      estimated_ready_at: scheduled_at || null,
      updated_at: new Date().toISOString(),
    }
    const { data, error } = await service
      .from('orders')
      .update(updateFields)
      .eq('id', order_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  }

  if (!status) {
    return NextResponse.json({ error: 'Missing status or scheduled_at' }, { status: 400 })
  }

  const validStatuses: OrderStatus[] = ['received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled', 'refunded']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // When marking out_for_delivery, calculate estimated delivery time
  const updateFields: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'out_for_delivery') {
    // Get delivery distance to estimate ETA
    const { data: orderData } = await service.from('orders').select('delivery_distance_miles').eq('id', order_id).single()
    const distanceMiles = orderData?.delivery_distance_miles || 3
    // Estimate: 5 min per mile + 5 min buffer, minimum 15 min
    const etaMinutes = Math.max(15, Math.round(distanceMiles * 5) + 5)
    updateFields.estimated_ready_at = new Date(Date.now() + etaMinutes * 60 * 1000).toISOString()
  }

  const { data, error } = await service
    .from('orders')
    .update(updateFields)
    .eq('id', order_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Clean up driver location when delivery completes or is cancelled
  if (['delivered', 'picked_up', 'cancelled', 'refunded'].includes(status)) {
    await service.from('driver_locations').delete().eq('order_id', order_id)
  }

  // Sync fulfillment state to Square POS
  if (data?.square_order_id) {
    const fulfillmentStateMap: Record<string, string> = {
      received: 'PROPOSED',
      preparing: 'RESERVED',
      ready: 'PREPARED',
      out_for_delivery: 'PREPARED',
      delivered: 'COMPLETED',
      picked_up: 'COMPLETED',
      cancelled: 'CANCELED',
    }
    const squareFulfillmentState = fulfillmentStateMap[status]
    if (squareFulfillmentState) {
      try {
        const square = getSquareClient()
        // Fetch the current order to get fulfillment UID and version
        const { order: currentOrder } = await square.orders.get({ orderId: data.square_order_id })
        const fulfillment = currentOrder?.fulfillments?.[0]
        if (fulfillment?.uid && currentOrder?.version) {
          await square.orders.update({
            orderId: data.square_order_id,
            order: {
              locationId: process.env.SQUARE_LOCATION_ID!,
              version: currentOrder.version,
              fulfillments: [{
                uid: fulfillment.uid,
                state: squareFulfillmentState as FulfillmentState,
              }],
            },
            idempotencyKey: `${order_id}-${status}-${Date.now()}`,
          })
        }
      } catch (squareErr) {
        console.error('Square fulfillment sync failed:', squareErr)
        // Don't fail the request — DB update already succeeded
      }
    }
  }

  // Send email notification to customer
  if (data?.user_id && status !== 'received') {
    try {
      const { data: userData } = await service.auth.admin.getUserById(data.user_id)
      const customerEmail = userData?.user?.email
      if (customerEmail) {
        const orderUrl = `https://gotopdonuts.com/orders/${order_id}`
        await sendOrderStatusEmail(customerEmail, { order_number: data.order_number, status }, orderUrl)
      }
    } catch (emailErr) {
      console.error('Status email failed:', emailErr)
    }
  }

  return NextResponse.json(data)
}
