import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSquareClient } from '@/lib/square'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

interface ImportItem {
  name: string
  description: string
  price: number
  category: string
  is_taxable: boolean
  image_url: string | null
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { items } = await request.json() as { items: ImportItem[] }

    if (!items?.length) {
      return NextResponse.json({ error: 'No items to import' }, { status: 400 })
    }

    const square = getSquareClient()
    const service = createServiceClient()
    const results: { name: string; success: boolean; id?: string; error?: string }[] = []

    for (const item of items) {
      try {
        if (!item.name?.trim() || item.price == null || item.price < 0) {
          results.push({ name: item.name || 'Unknown', success: false, error: 'Invalid name or price' })
          continue
        }

        const priceCents = BigInt(Math.round(item.price * 100))
        const tempId = `#import-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const variationTempId = `#var-${Date.now()}-${Math.random().toString(36).slice(2)}`

        const { catalogObject } = await square.catalog.object.upsert({
          idempotencyKey: crypto.randomUUID(),
          object: {
            type: 'ITEM',
            id: tempId,
            presentAtAllLocations: true,
            itemData: {
              name: item.name.trim(),
              description: item.description?.trim() || '',
              isTaxable: item.is_taxable !== false,
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

        // Save image override if provided
        if (item.image_url && catalogObject?.id) {
          await service
            .from('menu_image_overrides')
            .upsert({
              square_item_id: catalogObject.id,
              image_url: item.image_url,
              updated_at: new Date().toISOString(),
            })
        }

        results.push({ name: item.name, success: true, id: catalogObject?.id })
      } catch (err) {
        results.push({
          name: item.name || 'Unknown',
          success: false,
          error: err instanceof Error ? err.message : 'Failed to create',
        })
      }
    }

    const succeeded = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({ results, succeeded, failed })
  } catch (err) {
    console.error('Bulk import error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}
