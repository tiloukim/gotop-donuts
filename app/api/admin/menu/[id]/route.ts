import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

async function verifyAdmin(request: NextRequest) {
  // Create client directly from request cookies to avoid stale cookie issues
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll() {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email === ADMIN_EMAIL) return user
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const user = await verifyAdmin(request)
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { name, description, price, category, is_available, is_taxable, image_url, variants } = body

    // All edits from web admin go to Supabase only — never update Square POS
    const service = createServiceClient()
    const upsertData: Record<string, unknown> = {
      square_item_id: id,
      updated_at: new Date().toISOString(),
    }
    if (name !== undefined) upsertData.name = name.trim()
    if (description !== undefined) upsertData.description = description.trim()
    if (price !== undefined) upsertData.price = price
    if (category !== undefined) upsertData.category = category
    if (is_taxable !== undefined) upsertData.is_taxable = is_taxable
    if (image_url !== undefined) upsertData.image_url = image_url || null
    if (variants !== undefined) upsertData.variants = variants
    if (is_available !== undefined) upsertData.hidden_on_web = !is_available

    // Try upsert with all fields
    let { error: upsertErr } = await service
      .from('menu_image_overrides')
      .upsert(upsertData, { onConflict: 'square_item_id' })

    if (upsertErr) {
      console.error('Upsert failed, trying without newer columns:', upsertErr.message)
      // Remove columns that might not exist yet
      delete upsertData.hidden_on_web
      delete upsertData.is_taxable
      delete upsertData.category
      delete upsertData.name
      delete upsertData.description
      delete upsertData.price

      const { error: retryErr } = await service
        .from('menu_image_overrides')
        .upsert(upsertData, { onConflict: 'square_item_id' })

      if (retryErr) {
        console.error('Retry upsert also failed:', retryErr.message)
        return NextResponse.json({ error: retryErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin menu update error:', err)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const user = await verifyAdmin(request)
  if (!user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const service = createServiceClient()

    // Try to set hidden_on_web first (soft delete)
    const { error: hideErr } = await service
      .from('menu_image_overrides')
      .update({ hidden_on_web: true, updated_at: new Date().toISOString() })
      .eq('square_item_id', id)

    if (hideErr) {
      // If hidden_on_web column doesn't exist, delete the row entirely
      console.error('Hide failed, trying hard delete:', hideErr.message)
      const { error: deleteErr } = await service
        .from('menu_image_overrides')
        .delete()
        .eq('square_item_id', id)

      if (deleteErr) {
        return NextResponse.json({ error: deleteErr.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin menu delete error:', err)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
