import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const search = request.nextUrl.searchParams.get('search')?.toLowerCase() || ''

  // Get all auth users (for emails)
  const { data: { users } } = await service.auth.admin.listUsers({ perPage: 1000 })
  const authUsers = users ?? []

  // Get all profiles
  const { data: profiles } = await service
    .from('profiles')
    .select('id, full_name, phone, reward_points, created_at')

  // Get order aggregates per user
  const { data: orderAggs } = await service
    .from('orders')
    .select('user_id, total')

  // Build aggregate maps
  const orderStats = new Map<string, { count: number; spent: number }>()
  for (const o of orderAggs ?? []) {
    const existing = orderStats.get(o.user_id) ?? { count: 0, spent: 0 }
    existing.count++
    existing.spent += Number(o.total)
    orderStats.set(o.user_id, existing)
  }

  const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))
  const emailMap = new Map(authUsers.map(u => [u.id, u.email ?? '']))

  // Build customer list
  let customers = authUsers.map(u => {
    const profile = profileMap.get(u.id)
    const stats = orderStats.get(u.id) ?? { count: 0, spent: 0 }
    return {
      id: u.id,
      email: u.email ?? '',
      name: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      reward_points: profile?.reward_points ?? 0,
      created_at: profile?.created_at ?? u.created_at,
      total_orders: stats.count,
      total_spent: stats.spent,
    }
  })

  // Filter by search
  if (search) {
    customers = customers.filter(c =>
      (c.name?.toLowerCase().includes(search)) ||
      (c.email.toLowerCase().includes(search)) ||
      (c.phone?.includes(search))
    )
  }

  // Sort by most recent first
  customers.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return NextResponse.json({ customers })
}
