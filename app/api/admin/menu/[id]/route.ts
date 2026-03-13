import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSquareClient } from '@/lib/square'
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
    const { name, description, price, is_available, is_taxable, image_url, variants } = body

    const square = getSquareClient()

    // Fetch current object for version
    const { object: current } = await square.catalog.object.get({ objectId: id })
    if (!current || current.type !== 'ITEM') {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    const currentData = current.itemData!
    const firstVariation = currentData.variations?.[0]
    const currentVariation = firstVariation?.type === 'ITEM_VARIATION' ? firstVariation : null

    // Build updated item data
    const updatedItemData: Record<string, unknown> = {
      name: name ?? currentData.name,
      description: description ?? currentData.description,
      isArchived: is_available != null ? !is_available : currentData.isArchived,
      isTaxable: is_taxable != null ? is_taxable : currentData.isTaxable,
      variations: currentData.variations,
      categories: currentData.categories,
      reportingCategory: currentData.reportingCategory,
      imageIds: currentData.imageIds,
    }

    // Update price on the variation if provided
    if (price != null && currentVariation) {
      const priceCents = BigInt(Math.round(price * 100))
      updatedItemData.variations = [
        {
          type: 'ITEM_VARIATION' as const,
          id: currentVariation.id,
          version: currentVariation.version,
          itemVariationData: {
            ...currentVariation.itemVariationData,
            priceMoney: {
              amount: priceCents,
              currency: 'USD',
            },
          },
        },
      ]
    }

    await square.catalog.object.upsert({
      idempotencyKey: crypto.randomUUID(),
      object: {
        type: 'ITEM',
        id: current.id,
        version: current.version,
        itemData: updatedItemData,
      },
    })

    // Update image override and/or variants if provided
    if (image_url !== undefined || variants !== undefined) {
      const service = createServiceClient()
      const upsertData: Record<string, unknown> = {
        square_item_id: id,
        updated_at: new Date().toISOString(),
      }
      if (image_url !== undefined) upsertData.image_url = image_url || null
      if (variants !== undefined) upsertData.variants = variants

      const { error: upsertErr } = await service
        .from('menu_image_overrides')
        .upsert(upsertData, { onConflict: 'square_item_id' })

      if (upsertErr) {
        console.error('Failed to upsert menu overrides:', upsertErr)
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

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const square = getSquareClient()

    await square.catalog.object.delete({ objectId: id })

    // Clean up image override + storage file
    const service = createServiceClient()
    const { data: override } = await service
      .from('menu_image_overrides')
      .select('image_url')
      .eq('square_item_id', id)
      .single()

    if (override?.image_url) {
      // Extract filename from URL
      const url = new URL(override.image_url)
      const pathParts = url.pathname.split('/')
      const fileName = pathParts[pathParts.length - 1]
      if (fileName) {
        await service.storage.from('menu-images').remove([fileName])
      }
    }

    await service
      .from('menu_image_overrides')
      .delete()
      .eq('square_item_id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin menu delete error:', err)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
