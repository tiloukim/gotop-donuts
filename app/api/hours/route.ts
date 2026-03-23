import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
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
