import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase/service'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

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
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (name !== undefined) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description.trim()
    if (price !== undefined) updateData.price = price
    if (category !== undefined) updateData.category = category
    if (is_taxable !== undefined) updateData.is_taxable = is_taxable
    if (image_url !== undefined) updateData.image_url = image_url || ''
    if (variants !== undefined) updateData.variants = variants
    if (is_available !== undefined) updateData.hidden_on_web = !is_available

    // Update existing row (items already exist in the table)
    const { error: updateErr } = await service
      .from('menu_image_overrides')
      .update(updateData)
      .eq('square_item_id', id)

    if (updateErr) {
      console.error('Update failed:', updateErr.message)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Invalidate cached menu so customers see updated prices immediately
    revalidatePath('/api/menu')
    revalidatePath('/menu')

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

    // Delete the row from Supabase
    const { error: deleteErr } = await service
      .from('menu_image_overrides')
      .delete()
      .eq('square_item_id', id)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin menu delete error:', err)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
