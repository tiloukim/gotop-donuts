import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSquareClient } from '@/lib/square'
import { ADMIN_EMAIL } from '@/lib/constants'

export const dynamic = 'force-dynamic'

const CATEGORY_MAP: Record<string, string> = {
  breakfast: 'breakfast',
  donuts: 'donuts',
  donut: 'donuts',
  drinks: 'drinks',
  drink: 'drinks',
  beverages: 'drinks',
  beverage: 'drinks',
  coffee: 'drinks',
  tea: 'drinks',
  juice: 'drinks',
}

function mapCategory(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value
  }
  return 'donuts'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { category } = await request.json() as { category?: string }
    const filterCategory = category || 'drinks'

    const square = getSquareClient()
    const service = createServiceClient()

    // Fetch all catalog items from Square
    const { items: catalogItems } = await square.catalog.searchItems({
      enabledLocationIds: [process.env.SQUARE_LOCATION_ID!],
    })

    if (!catalogItems?.length) {
      return NextResponse.json({ error: 'No items found in Square catalog' }, { status: 404 })
    }

    // Fetch categories and images
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
      if (data?.reportingCategory?.id) categoryIds.add(data.reportingCategory.id)
      if (data?.imageIds) {
        for (const id of data.imageIds) imageIds.add(id)
      }
    }

    const objectIds = [...categoryIds, ...imageIds]
    const categoryMap = new Map<string, string>()
    const imageMap = new Map<string, string>()

    if (objectIds.length > 0) {
      const { objects } = await square.catalog.batchGet({ objectIds, includeRelatedObjects: false })
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

    // Get existing items in Supabase to avoid duplicates
    const { data: existing } = await service
      .from('menu_image_overrides')
      .select('square_item_id')

    const existingIds = new Set((existing || []).map(e => e.square_item_id))

    // Filter and import items
    const imported: string[] = []
    const skipped: string[] = []

    for (const item of catalogItems) {
      if (item.type !== 'ITEM' || !item.itemData || !item.id) continue
      if (item.itemData.isArchived) continue

      // Determine category
      const catId = item.itemData.categories?.[0]?.id || item.itemData.reportingCategory?.id
      const catName = catId ? categoryMap.get(catId) : null
      const itemCategory = catName ? mapCategory(catName) : 'donuts'

      // Only import the requested category
      if (itemCategory !== filterCategory) continue

      // Skip if already in Supabase
      if (existingIds.has(item.id)) {
        skipped.push(item.itemData.name || 'Unknown')
        continue
      }

      // Get price
      const variation = item.itemData.variations?.[0]
      const priceMoney = variation?.type === 'ITEM_VARIATION'
        ? variation.itemVariationData?.priceMoney
        : undefined
      const priceCents = priceMoney?.amount ? Number(priceMoney.amount) : 0
      const price = priceCents / 100

      // Get image
      const imageId = item.itemData.imageIds?.[0]
      const imageUrl = imageId ? imageMap.get(imageId) : null

      // Insert into Supabase
      const { error: insertErr } = await service
        .from('menu_image_overrides')
        .insert({
          square_item_id: item.id,
          name: item.itemData.name || 'Unknown',
          description: item.itemData.description || '',
          price,
          category: itemCategory,
          is_taxable: item.itemData.isTaxable !== false,
          image_url: imageUrl || '',
          hidden_on_web: false,
          is_web_only: false,
          updated_at: new Date().toISOString(),
        })

      if (insertErr) {
        console.error(`Failed to import ${item.itemData.name}:`, insertErr.message)
        skipped.push(`${item.itemData.name} (error: ${insertErr.message})`)
      } else {
        imported.push(item.itemData.name || 'Unknown')
      }
    }

    return NextResponse.json({
      imported: imported.length,
      skipped: skipped.length,
      importedItems: imported,
      skippedItems: skipped,
    })
  } catch (err) {
    console.error('Import from Square error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
