import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
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

    const { error: upsertErr } = await service
      .from('menu_image_overrides')
      .upsert(upsertData, { onConflict: 'square_item_id' })

    if (upsertErr) {
      console.error('Failed to upsert menu overrides:', upsertErr)
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Only hide from website — don't delete from Square POS
    const service = createServiceClient()

    const { error } = await service
      .from('menu_image_overrides')
      .upsert({
        square_item_id: id,
        hidden_on_web: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'square_item_id' })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin menu delete error:', err)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
