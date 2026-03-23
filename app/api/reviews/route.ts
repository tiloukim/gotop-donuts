import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { order_id, rating, comment } = await request.json()

  if (!order_id || !rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Valid order_id and rating (1-5) required' }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify order belongs to user and is completed
  const { data: order } = await service
    .from('orders')
    .select('id, status, user_id')
    .eq('id', order_id)
    .eq('user_id', user.id)
    .single()

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  }

  if (!['delivered', 'picked_up'].includes(order.status)) {
    return NextResponse.json({ error: 'Can only review completed orders' }, { status: 400 })
  }

  // Check if already reviewed
  const { data: existing } = await service
    .from('reviews')
    .select('id')
    .eq('order_id', order_id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Already reviewed' }, { status: 400 })
  }

  const { data, error } = await service
    .from('reviews')
    .insert({
      order_id,
      user_id: user.id,
      rating,
      comment: comment?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orderId = request.nextUrl.searchParams.get('order_id')
  if (!orderId) {
    return NextResponse.json({ error: 'order_id required' }, { status: 400 })
  }

  const service = createServiceClient()
  const { data } = await service
    .from('reviews')
    .select('*')
    .eq('order_id', orderId)
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ review: data || null })
}
