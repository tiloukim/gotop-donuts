import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
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

  const { order_id, status } = await request.json() as { order_id: string; status: OrderStatus }

  const validStatuses: OrderStatus[] = ['received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up', 'cancelled', 'refunded']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', order_id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
