import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [ordersToday, activeOrders, totalCustomers, recentOrders] = await Promise.all([
    service
      .from('orders')
      .select('total')
      .gte('created_at', todayISO),
    service
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('status', ['received', 'preparing', 'ready', 'out_for_delivery']),
    service
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
    service
      .from('orders')
      .select('id, order_number, user_id, status, total, order_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const todayOrdersList = ordersToday.data ?? []
  const todayRevenue = todayOrdersList.reduce((sum, o) => sum + Number(o.total), 0)

  // Get customer info for recent orders
  const recent = recentOrders.data ?? []
  let enrichedRecent = recent.map(o => ({
    ...o,
    customer_name: null as string | null,
    customer_email: null as string | null,
  }))

  if (recent.length > 0) {
    const userIds = [...new Set(recent.map(o => o.user_id))]

    const { data: profiles } = await service
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds)

    // Get emails from auth
    const { data: { users } } = await service.auth.admin.listUsers({ perPage: 1000 })

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
    const emailMap = new Map((users ?? []).map(u => [u.id, u.email]))

    enrichedRecent = recent.map(o => ({
      ...o,
      customer_name: profileMap.get(o.user_id)?.full_name ?? null,
      customer_email: emailMap.get(o.user_id) ?? null,
    }))
  }

  return NextResponse.json({
    stats: {
      todayOrders: todayOrdersList.length,
      todayRevenue,
      totalCustomers: totalCustomers.count ?? 0,
      activeOrders: activeOrders.count ?? 0,
    },
    recentOrders: enrichedRecent,
  })
}
