import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSquareClient } from '@/lib/square'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

const CATEGORY_MAP: Record<string, string> = {
  breakfast: 'breakfast',
  donuts: 'donuts',
  donut: 'donuts',
  drinks: 'drinks',
  drink: 'drinks',
  beverages: 'drinks',
  beverage: 'drinks',
  coffee: 'drinks',
}

function mapCategory(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value
  }
  return 'donuts'
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const square = getSquareClient()

    const { items: catalogItems } = await square.catalog.searchItems({
      enabledLocationIds: [process.env.SQUARE_LOCATION_ID!],
    })

    if (!catalogItems?.length) {
      return NextResponse.json({ items: [] })
    }

    // Collect category and image IDs
    const categoryIds = new Set<string>()
    const imageIds = new Set<string>()

    for (const item of catalogItems) {
      if (item.type !== 'ITEM') continue
      const data = item.itemData
      if (data?.categories) {
        for (const cat of data.categories) {
          if (cat.id) categoryIds.add(cat.id)
        }
      }
      if (data?.reportingCategory?.id) {
        categoryIds.add(data.reportingCategory.id)
      }
      if (data?.imageIds) {
        for (const id of data.imageIds) imageIds.add(id)
      }
    }

    // Batch fetch categories and images
    const objectIds = [...categoryIds, ...imageIds]
    const categoryMap = new Map<string, string>()
    const imageMap = new Map<string, string>()

    if (objectIds.length > 0) {
      const { objects } = await square.catalog.batchGet({
        objectIds,
        includeRelatedObjects: false,
      })
      if (objects) {
        for (const obj of objects) {
          if (obj.type === 'CATEGORY' && obj.categoryData?.name && obj.id) {
            categoryMap.set(obj.id, obj.categoryData.name)
          }
          if (obj.type === 'IMAGE' && obj.imageData?.url && obj.id) {
            imageMap.set(obj.id, obj.imageData.url)
          }
        }
      }
    }

    // Fetch image overrides and variants from Supabase
    const service = createServiceClient()
    let overrideMap = new Map<string, { image_url: string | null; variants: unknown; category: string | null; hidden_on_web: boolean }>()

    const { data: overrides, error: overrideErr } = await service
      .from('menu_image_overrides')
      .select('square_item_id, image_url, variants, category, hidden_on_web')

    if (!overrideErr && overrides) {
      overrideMap = new Map(
        overrides.map(o => [o.square_item_id, { image_url: o.image_url, variants: o.variants, category: o.category ?? null, hidden_on_web: o.hidden_on_web ?? false }])
      )
    } else {
      const { data: fallback2 } = await service
        .from('menu_image_overrides')
        .select('square_item_id, image_url, variants')

      if (fallback2) {
        overrideMap = new Map(
          fallback2.map(o => [o.square_item_id, { image_url: o.image_url, variants: o.variants, category: null, hidden_on_web: false }])
        )
      } else {
        const { data: fallback3 } = await service
          .from('menu_image_overrides')
          .select('square_item_id, image_url')

        overrideMap = new Map(
          (fallback3 ?? []).map(o => [o.square_item_id, { image_url: o.image_url, variants: null, category: null, hidden_on_web: false }])
        )
      }
    }

    // Transform to admin items (include all, even unavailable)
    const itemsOnly = catalogItems.filter((item): item is Extract<typeof item, { type: 'ITEM' }> =>
      item.type === 'ITEM' && !!item.itemData
    )
    const items = itemsOnly.map((item, index) => {
      const data = item.itemData!
      const variation = data.variations?.[0]
      const variationId = variation?.id ?? ''
      const priceMoney = variation?.type === 'ITEM_VARIATION'
        ? variation.itemVariationData?.priceMoney
        : undefined

      const overrideData = overrideMap.get(item.id)

      const categoryId = data.categories?.[0]?.id || data.reportingCategory?.id
      const categoryName = categoryId ? categoryMap.get(categoryId) : null
      const category = overrideData?.category || (categoryName ? mapCategory(categoryName) : 'donuts')

      const imageId = data.imageIds?.[0]
      const squareImageUrl = imageId ? imageMap.get(imageId) : null
      const overrideImageUrl = overrideData?.image_url

      const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0
      const squarePrice = priceCents / 100

      return {
        id: item.id,
        variationId,
        category,
        name: (overrideData as Record<string, unknown>)?.name as string || data.name || 'Unknown',
        description: (overrideData as Record<string, unknown>)?.description as string ?? data.description ?? '',
        price: (overrideData as Record<string, unknown>)?.price as number ?? squarePrice,
        image_url: overrideImageUrl || squareImageUrl || null,
        is_available: !(overrideData?.hidden_on_web ?? false),
        is_taxable: (overrideData as Record<string, unknown>)?.is_taxable as boolean ?? (data.isTaxable !== false),
        sort_order: index,
        created_at: item.updatedAt || new Date().toISOString(),
        variants: overrideData?.variants || null,
      }
    })

    // Add web-only items (not in Square catalog)
    const { data: webOnlyItems } = await service
      .from('menu_image_overrides')
      .select('*')
      .eq('is_web_only', true)

    if (webOnlyItems) {
      for (const webItem of webOnlyItems) {
        items.push({
          id: webItem.square_item_id,
          variationId: '',
          category: webItem.category || 'donuts',
          name: webItem.name || 'Unknown',
          description: webItem.description || '',
          price: webItem.price || 0,
          image_url: webItem.image_url || null,
          is_available: !(webItem.hidden_on_web ?? false),
          is_taxable: webItem.is_taxable ?? true,
          sort_order: items.length,
          created_at: webItem.updated_at || new Date().toISOString(),
          variants: webItem.variants || null,
        })
      }
    }

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
