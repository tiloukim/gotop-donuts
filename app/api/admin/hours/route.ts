import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = createServiceClient()
  const { data, error } = await service
    .from('store_hours')
    .select('*')
    .order('day_of_week')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ hours: data })
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { hours } = await request.json()
  if (!Array.isArray(hours) || hours.length !== 7) {
    return NextResponse.json({ error: 'Must provide all 7 days' }, { status: 400 })
  }

  const service = createServiceClient()

  for (const day of hours) {
    const { error } = await service
      .from('store_hours')
      .update({
        open_time: day.open_time,
        close_time: day.close_time,
        delivery_start: day.delivery_start || null,
        delivery_end: day.delivery_end || null,
        is_closed: day.is_closed,
        updated_at: new Date().toISOString(),
      })
      .eq('day_of_week', day.day_of_week)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // Return updated hours
  const { data } = await service
    .from('store_hours')
    .select('*')
    .order('day_of_week')

  return NextResponse.json({ hours: data })
}
