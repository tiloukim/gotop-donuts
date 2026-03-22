import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSquareClient } from '@/lib/square'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Website menu is fully managed in Supabase — independent from Square POS
    const service = createServiceClient()

    const { data: allItems, error } = await service
      .from('menu_image_overrides')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // For items missing name/price, fetch from Square to backfill
    const needsSquareData = (allItems ?? []).filter(
      item => !item.square_item_id.startsWith('web-') && (!item.name || !item.price)
    )
    let squareMap = new Map<string, { name: string; description: string; price: number }>()

    if (needsSquareData.length > 0) {
      try {
        const square = getSquareClient()
        const { objects } = await square.catalog.batchGet({
          objectIds: needsSquareData.map(i => i.square_item_id),
          includeRelatedObjects: false,
        })
        if (objects) {
          for (const obj of objects) {
            if (obj.type === 'ITEM' && obj.itemData && obj.id) {
              const variation = obj.itemData.variations?.[0]
              const priceMoney = variation?.type === 'ITEM_VARIATION'
                ? variation.itemVariationData?.priceMoney
                : undefined
              const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0
              squareMap.set(obj.id, {
                name: obj.itemData.name || 'Unknown',
                description: obj.itemData.description || '',
                price: priceCents / 100,
              })
            }
          }
        }
      } catch {
        // Square fetch failed — show what we have
      }
    }

    const items = (allItems ?? []).map((item, index) => {
      const sq = squareMap.get(item.square_item_id)
      return {
        id: item.square_item_id,
        variationId: '',
        category: item.category || 'donuts',
        name: item.name || sq?.name || 'Unknown',
        description: item.description ?? sq?.description ?? '',
        price: item.price ?? sq?.price ?? 0,
        image_url: item.image_url || null,
        is_available: !(item.hidden_on_web ?? false),
        is_taxable: item.is_taxable ?? true,
        sort_order: item.sort_order ?? index,
        created_at: item.updated_at || new Date().toISOString(),
        variants: item.variants || null,
      }
    })

    return NextResponse.json({ items })
  } catch (err) {
    console.error('Admin menu fetch error:', err)
    return NextResponse.json({ error: 'Failed to fetch menu' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { name, description, price, category, image_url, is_taxable, variants } = await request.json()

    if (!name || price == null || price < 0) {
      return NextResponse.json({ error: 'Name and valid price required' }, { status: 400 })
    }

    // Create web-only item in Supabase — don't touch Square POS
    const service = createServiceClient()
    const webItemId = `web-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`

    const { error: insertErr } = await service
      .from('menu_image_overrides')
      .insert({
        square_item_id: webItemId,
        name: name.trim(),
        description: (description || '').trim(),
        price,
        category: category || 'donuts',
        is_taxable: is_taxable !== false,
        image_url: image_url || null,
        variants: variants || null,
        hidden_on_web: false,
        is_web_only: true,
        updated_at: new Date().toISOString(),
      })

    if (insertErr) {
      console.error('Failed to create web menu item:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      id: webItemId,
      variationId: null,
    })
  } catch (err) {
    console.error('Admin menu create error:', err)
    const message = err instanceof Error ? err.message : 'Failed to create item'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { order } = await request.json() as { order: { id: string; sort_order: number }[] }
    if (!order?.length) {
      return NextResponse.json({ error: 'Order array required' }, { status: 400 })
    }

    const service = createServiceClient()

    // Update sort_order for each item
    for (const item of order) {
      await service
        .from('menu_image_overrides')
        .update({ sort_order: item.sort_order })
        .eq('square_item_id', item.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Admin menu reorder error:', err)
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
  }
}
