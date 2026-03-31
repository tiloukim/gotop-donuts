import { getSquareClient } from '@/lib/square'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const service = createServiceClient()

    // Fetch all menu overrides from Supabase — this is the source of truth for the website
    const { data: overrides, error: overrideErr } = await service
      .from('menu_image_overrides')
      .select('*')
      .eq('hidden_on_web', false)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })

    if (overrideErr) {
      console.error('Failed to fetch menu overrides:', overrideErr)
      return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 })
    }

    if (!overrides?.length) {
      return NextResponse.json([])
    }

    // Separate web-only items from Square-linked items
    const webOnlyItems = overrides.filter(o => o.is_web_only)
    const squareLinkedItems = overrides.filter(o => !o.is_web_only)

    // For Square-linked items, fetch Square data for images (if no override image)
    const squareIds = squareLinkedItems.map(o => o.square_item_id).filter(Boolean)
    let squareDataMap = new Map<string, { name: string; description: string; price: number; imageUrl: string | null }>()

    if (squareIds.length > 0) {
      try {
        const square = getSquareClient()
        const { objects } = await square.catalog.batchGet({
          objectIds: squareIds,
          includeRelatedObjects: true,
        })

        if (objects) {
          // Collect image URLs
          const imageMap = new Map<string, string>()
          for (const obj of objects) {
            if (obj.type === 'IMAGE' && obj.imageData?.url && obj.id) {
              imageMap.set(obj.id, obj.imageData.url)
            }
          }

          for (const obj of objects) {
            if (obj.type === 'ITEM' && obj.itemData && obj.id) {
              const variation = obj.itemData.variations?.[0]
              const priceMoney = variation?.type === 'ITEM_VARIATION'
                ? variation.itemVariationData?.priceMoney
                : undefined
              const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0

              const imageId = obj.itemData.imageIds?.[0]
              const imageUrl = imageId ? imageMap.get(imageId) ?? null : null

              squareDataMap.set(obj.id, {
                name: obj.itemData.name || 'Unknown',
                description: obj.itemData.description || '',
                price: priceCents / 100,
                imageUrl,
              })
            }
          }
        }
      } catch {
        // Square fetch failed — use Supabase data only
      }
    }

    // Build menu items — Supabase overrides always take priority
    const menuItems: Array<{
      id: string
      category: string
      name: string
      description: string
      price: number
      image_url: string | null
      is_available: boolean
      sort_order: number
      created_at: string
      variants: unknown
    }> = []

    let sortIndex = 0

    // Add Square-linked items (only those managed in web admin)
    for (const override of squareLinkedItems) {
      const squareData = squareDataMap.get(override.square_item_id)

      const name = override.name || squareData?.name || 'Unknown'
      const description = override.description ?? squareData?.description ?? ''
      const price = override.price ?? squareData?.price ?? 0
      const imageUrl = override.image_url || squareData?.imageUrl || null

      if (price > 0) {
        menuItems.push({
          id: override.square_item_id,
          category: override.category || 'donuts',
          name,
          description,
          price,
          image_url: imageUrl,
          is_available: true,
          sort_order: sortIndex++,
          created_at: override.updated_at || new Date().toISOString(),
          variants: override.variants || null,
        })
      }
    }

    // Add web-only items
    for (const webItem of webOnlyItems) {
      if (webItem.price > 0) {
        menuItems.push({
          id: webItem.square_item_id,
          category: webItem.category || 'donuts',
          name: webItem.name || 'Unknown',
          description: webItem.description || '',
          price: webItem.price,
          image_url: webItem.image_url || null,
          is_available: true,
          sort_order: sortIndex++,
          created_at: webItem.updated_at || new Date().toISOString(),
          variants: webItem.variants || null,
        })
      }
    }

    return NextResponse.json(menuItems, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    })
  } catch (err) {
    console.error('Failed to fetch menu:', err)
    return NextResponse.json({ error: 'Failed to load menu' }, { status: 500 })
  }
}
