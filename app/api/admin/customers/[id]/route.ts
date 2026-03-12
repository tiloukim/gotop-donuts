import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()

  // Get auth user email
  const { data: { user: authUser } } = await service.auth.admin.getUserById(id)

  // Get profile, orders, and reward transactions in parallel
  const [profileResult, ordersResult, rewardsResult] = await Promise.all([
    service
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single(),
    service
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
    service
      .from('reward_transactions')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!profileResult.data) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  return NextResponse.json({
    profile: {
      ...profileResult.data,
      email: authUser?.email ?? null,
    },
    orders: ordersResult.data ?? [],
    rewardTransactions: rewardsResult.data ?? [],
  })
}
