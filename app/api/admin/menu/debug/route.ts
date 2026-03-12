import { createClient } from '@/lib/supabase/server'
import { getSquareClient } from '@/lib/square'
import { ADMIN_EMAIL } from '@/lib/constants'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const config = {
    SQUARE_ACCESS_TOKEN: process.env.SQUARE_ACCESS_TOKEN ? `${process.env.SQUARE_ACCESS_TOKEN.slice(0, 8)}...` : 'NOT SET',
    SQUARE_LOCATION_ID: process.env.SQUARE_LOCATION_ID || 'NOT SET',
    SQUARE_ENVIRONMENT: process.env.SQUARE_ENVIRONMENT || 'NOT SET (defaults to sandbox)',
  }

  try {
    const square = getSquareClient()

    // 1. Test: list locations
    let locations: { id: string; name: string; status: string }[] = []
    try {
      const { locations: locs } = await square.locations.list()
      locations = (locs ?? []).map(l => ({
        id: l.id ?? '',
        name: l.name ?? '',
        status: l.status ?? '',
      }))
    } catch (err) {
      return NextResponse.json({
        config,
        error: 'Failed to list locations — check SQUARE_ACCESS_TOKEN',
        details: err instanceof Error ? err.message : String(err),
      })
    }

    // 2. Test: search catalog items with location filter
    let itemCount = 0
    let itemNames: string[] = []
    let searchError: string | null = null
    try {
      const { items } = await square.catalog.searchItems({
        enabledLocationIds: [process.env.SQUARE_LOCATION_ID!],
      })
      itemCount = items?.length ?? 0
      itemNames = (items ?? [])
        .filter(i => i.type === 'ITEM')
        .slice(0, 20)
        .map(i => i.itemData?.name ?? 'unnamed')
    } catch (err) {
      searchError = err instanceof Error ? err.message : String(err)
    }

    // 3. Test: search catalog items WITHOUT location filter
    let allItemCount = 0
    try {
      const { items } = await square.catalog.searchItems({})
      allItemCount = items?.length ?? 0
    } catch {}

    return NextResponse.json({
      config,
      locations,
      locationMatch: locations.some(l => l.id === process.env.SQUARE_LOCATION_ID),
      catalogSearch: {
        withLocationFilter: { count: itemCount, firstItems: itemNames, error: searchError },
        withoutLocationFilter: { count: allItemCount },
      },
      hint: itemCount === 0 && allItemCount > 0
        ? 'Items exist but are not enabled at SQUARE_LOCATION_ID. Check Square Dashboard > Items > enable at your location.'
        : itemCount === 0 && allItemCount === 0
        ? 'No catalog items found at all. Add items in Square Dashboard or POS first.'
        : null,
    })
  } catch (err) {
    return NextResponse.json({
      config,
      error: 'Square client error',
      details: err instanceof Error ? err.message : String(err),
    })
  }
}
