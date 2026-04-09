import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function db() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// GET /api/report?id=income-2025
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { data } = await db().from('report_data').select('data, updated_at').eq('id', id).single()
  return NextResponse.json({ data: data?.data || null, updated_at: data?.updated_at || null })
}

// POST /api/report — save report data
export async function POST(req: NextRequest) {
  const { id, data } = await req.json()
  if (!id || !data) return NextResponse.json({ error: 'Missing id or data' }, { status: 400 })
  const { error } = await db().from('report_data').upsert({ id, data, updated_at: new Date().toISOString() }, { onConflict: 'id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
