'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface DebugData {
  config: {
    SQUARE_ACCESS_TOKEN: string
    SQUARE_LOCATION_ID: string
    SQUARE_ENVIRONMENT: string
  }
  locations?: { id: string; name: string; status: string }[]
  locationMatch?: boolean
  catalogSearch?: {
    withLocationFilter: { count: number; firstItems: string[]; error: string | null }
    withoutLocationFilter: { count: number }
  }
  hint?: string | null
  error?: string
  details?: string
}

function Status({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
  if (warn) return <AlertCircle size={18} className="text-yellow-500 flex-shrink-0" />
  return <XCircle size={18} className="text-red-500 flex-shrink-0" />
}

export default function MenuDebugPage() {
  const [data, setData] = useState<DebugData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/menu/debug')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load')
        return res.json()
      })
      .then(setData)
      .catch(() => setError('Failed to load debug info. Make sure you are logged in as admin.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error || 'Unknown error'}
        </div>
      </div>
    )
  }

  const tokenSet = !data.config.SQUARE_ACCESS_TOKEN.includes('NOT SET')
  const locationSet = data.config.SQUARE_LOCATION_ID !== 'NOT SET'
  const envSet = !data.config.SQUARE_ENVIRONMENT.includes('NOT SET')
  const locationMatch = data.locationMatch ?? false
  const itemsFound = (data.catalogSearch?.withLocationFilter.count ?? 0) > 0
  const allItemsFound = (data.catalogSearch?.withoutLocationFilter.count ?? 0) > 0

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/menu" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Square Connection Debug</h1>
      </div>

      {/* Overall status */}
      {data.error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          <p className="font-medium">{data.error}</p>
          {data.details && <p className="mt-1 text-red-500">{data.details}</p>}
        </div>
      )}

      {data.hint && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg p-4 text-sm">
          <p className="font-medium">Hint</p>
          <p className="mt-1">{data.hint}</p>
        </div>
      )}

      {/* Checklist */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Configuration Checklist</h2>
        </div>

        <div className="divide-y divide-gray-100">
          {/* Token */}
          <div className="flex items-start gap-3 px-5 py-4">
            <Status ok={tokenSet} />
            <div>
              <p className="text-sm font-medium text-gray-900">SQUARE_ACCESS_TOKEN</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {tokenSet ? `Set (${data.config.SQUARE_ACCESS_TOKEN})` : 'Not set — add it in Vercel Environment Variables'}
              </p>
            </div>
          </div>

          {/* Location ID */}
          <div className="flex items-start gap-3 px-5 py-4">
            <Status ok={locationSet && locationMatch} warn={locationSet && !locationMatch} />
            <div>
              <p className="text-sm font-medium text-gray-900">SQUARE_LOCATION_ID</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {!locationSet
                  ? 'Not set — add it in Vercel Environment Variables'
                  : locationMatch
                  ? `Set: ${data.config.SQUARE_LOCATION_ID} (matches a location)`
                  : `Set: ${data.config.SQUARE_LOCATION_ID} — but does NOT match any of your Square locations!`}
              </p>
            </div>
          </div>

          {/* Environment */}
          <div className="flex items-start gap-3 px-5 py-4">
            <Status ok={envSet} warn={!envSet} />
            <div>
              <p className="text-sm font-medium text-gray-900">SQUARE_ENVIRONMENT</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {envSet
                  ? `Set: ${data.config.SQUARE_ENVIRONMENT}`
                  : 'Not set — defaults to sandbox. Set to "production" for your real Square account.'}
              </p>
            </div>
          </div>

          {/* Catalog items */}
          <div className="flex items-start gap-3 px-5 py-4">
            <Status ok={itemsFound} warn={!itemsFound && allItemsFound} />
            <div>
              <p className="text-sm font-medium text-gray-900">Catalog Items</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {itemsFound
                  ? `${data.catalogSearch!.withLocationFilter.count} items found at your location`
                  : allItemsFound
                  ? `0 items at your location, but ${data.catalogSearch!.withoutLocationFilter.count} exist in your catalog. Enable them at this location in Square Dashboard → Items.`
                  : 'No items found in your Square catalog. Add items in Square Dashboard or POS first.'}
              </p>
              {data.catalogSearch?.withLocationFilter.error && (
                <p className="text-xs text-red-500 mt-1">{data.catalogSearch.withLocationFilter.error}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Locations list */}
      {data.locations && data.locations.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">Your Square Locations</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {data.locations.map(loc => (
              <div key={loc.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{loc.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    loc.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {loc.status}
                  </span>
                  {loc.id === data.config.SQUARE_LOCATION_ID && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
                      Current
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Items preview */}
      {data.catalogSearch?.withLocationFilter.firstItems && data.catalogSearch.withLocationFilter.firstItems.length > 0 && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-700">
              Items Found (first {data.catalogSearch.withLocationFilter.firstItems.length})
            </h2>
          </div>
          <div className="px-5 py-3">
            <div className="flex flex-wrap gap-2">
              {data.catalogSearch.withLocationFilter.firstItems.map((name, i) => (
                <span key={i} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
