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
    const { data: overrides, error: overrideErr } = await service
      .from('menu_image_overrides')
      .select('square_item_id, image_url, variants')

    let overrideMap = new Map<string, { image_url: string | null; variants: unknown }>()
    if (overrideErr) {
      const { data: fallback } = await service
        .from('menu_image_overrides')
        .select('square_item_id, image_url')

      overrideMap = new Map(
        (fallback ?? []).map(o => [o.square_item_id, { image_url: o.image_url, variants: null }])
      )
    } else {
      overrideMap = new Map(
        (overrides ?? []).map(o => [o.square_item_id, { image_url: o.image_url, variants: o.variants }])
      )
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

      const categoryId = data.categories?.[0]?.id || data.reportingCategory?.id
      const categoryName = categoryId ? categoryMap.get(categoryId) : null
      const category = categoryName ? mapCategory(categoryName) : 'donuts'

      const imageId = data.imageIds?.[0]
      const squareImageUrl = imageId ? imageMap.get(imageId) : null
      const overrideData = overrideMap.get(item.id)
      const overrideImageUrl = overrideData?.image_url

      const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0
      const price = priceCents / 100

      return {
        id: item.id,
        variationId,
        category,
        name: data.name || 'Unknown',
        description: data.description || '',
        price,
        image_url: overrideImageUrl || squareImageUrl || null,
        is_available: !data.isArchived,
        is_taxable: data.isTaxable !== false,
        sort_order: index,
        created_at: item.updatedAt || new Date().toISOString(),
        variants: overrideData?.variants || null,
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

    const square = getSquareClient()
    const priceCents = BigInt(Math.round(price * 100))
    const tempId = `#new-item-${Date.now()}`
    const variationTempId = `#new-variation-${Date.now()}`

    const { catalogObject } = await square.catalog.object.upsert({
      idempotencyKey: crypto.randomUUID(),
      object: {
        type: 'ITEM',
        id: tempId,
        presentAtAllLocations: true,
        itemData: {
          name,
          description: description || '',
          isTaxable: is_taxable !== false,
          variations: [
            {
              type: 'ITEM_VARIATION',
              id: variationTempId,
              itemVariationData: {
                name: 'Regular',
                pricingType: 'FIXED_PRICING',
                priceMoney: {
                  amount: priceCents,
                  currency: 'USD',
                },
              },
            },
          ],
        },
      },
    })

    // Save image override and/or variants if provided
    if ((image_url || variants) && catalogObject?.id) {
      const service = createServiceClient()
      const { error: upsertErr } = await service
        .from('menu_image_overrides')
        .upsert({
          square_item_id: catalogObject.id,
          ...(image_url && { image_url }),
          ...(variants && { variants }),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'square_item_id' })

      if (upsertErr) {
        console.error('Failed to upsert menu overrides:', upsertErr)
      }
    }

    const variationId = catalogObject?.type === 'ITEM'
      ? catalogObject.itemData?.variations?.[0]?.id
      : undefined

    return NextResponse.json({
      id: catalogObject?.id,
      variationId,
    })
  } catch (err) {
    console.error('Admin menu create error:', err)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
