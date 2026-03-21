import { getSquareClient } from '@/lib/square'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

// Map Square category names to our app categories
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

export async function GET() {
  try {
    const square = getSquareClient()

    // Fetch all catalog items from Square
    const { items: catalogItems } = await square.catalog.searchItems({
      enabledLocationIds: [process.env.SQUARE_LOCATION_ID!],
    })

    if (!catalogItems?.length) {
      return NextResponse.json([])
    }

    // Collect all category and image IDs we need to look up
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
        for (const id of data.imageIds) {
          imageIds.add(id)
        }
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
      .select('square_item_id, image_url, variants, category')

    let overrideMap = new Map<string, { image_url: string | null; variants: unknown; category: string | null }>()
    if (overrideErr) {
      // Fallback: fetch without variants/category columns if they don't exist yet
      const { data: fallback } = await service
        .from('menu_image_overrides')
        .select('square_item_id, image_url')

      overrideMap = new Map(
        (fallback ?? []).map(o => [o.square_item_id, { image_url: o.image_url, variants: null, category: null }])
      )
    } else {
      overrideMap = new Map(
        (overrides ?? []).map(o => [o.square_item_id, { image_url: o.image_url, variants: o.variants, category: o.category ?? null }])
      )
    }

    // Transform Square items to our MenuItem format
    const itemsOnly = catalogItems.filter((item): item is Extract<typeof item, { type: 'ITEM' }> =>
      item.type === 'ITEM' && !!item.itemData
    )
    const menuItems = itemsOnly
      .map((item, index) => {
        const data = item.itemData!
        const variation = data.variations?.[0]
        const priceMoney = variation?.type === 'ITEM_VARIATION'
          ? variation.itemVariationData?.priceMoney
          : undefined

        // Get category
        const categoryId = data.categories?.[0]?.id || data.reportingCategory?.id
        const categoryName = categoryId ? categoryMap.get(categoryId) : null
        const overrideData = overrideMap.get(item.id)
        const category = overrideData?.category || (categoryName ? mapCategory(categoryName) : 'donuts')

        // Get image URL and variants (override takes priority)
        const imageId = data.imageIds?.[0]
        const squareImageUrl = imageId ? imageMap.get(imageId) : null
        const imageUrl = overrideData?.image_url || squareImageUrl

        // Get price (Square stores in cents)
        const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0
        const price = priceCents / 100

        return {
          id: item.id,
          category,
          name: data.name || 'Unknown',
          description: data.description || '',
          price,
          image_url: imageUrl || null,
          is_available: !data.isArchived,
          sort_order: index,
          created_at: new Date().toISOString(),
          variants: overrideData?.variants || null,
        }
      })
      .filter(item => item.is_available && item.price > 0)
      .sort((a, b) => a.sort_order - b.sort_order)

    return NextResponse.json(menuItems, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (err) {
    console.error('Failed to fetch Square catalog:', err)
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 })
  }
}
