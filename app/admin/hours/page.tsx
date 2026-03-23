'use client'

import { useState, useEffect } from 'react'
import { Clock, Save, Loader2 } from 'lucide-react'

interface StoreHours {
  id: number
  day_of_week: number
  day_name: string
  open_time: string
  close_time: string
  delivery_start: string | null
  delivery_end: string | null
  is_closed: boolean
}

export default function AdminHoursPage() {
  const [hours, setHours] = useState<StoreHours[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchHours()
  }, [])

  async function fetchHours() {
    try {
      const res = await fetch('/api/admin/hours')
      const data = await res.json()
      if (res.ok) {
        setHours(data.hours)
      } else {
        setError(data.error || 'Failed to load hours')
      }
    } catch {
      setError('Failed to load hours')
    }
    setLoading(false)
  }

  function updateDay(dayOfWeek: number, field: keyof StoreHours, value: string | boolean) {
    setHours(prev =>
      prev.map(h =>
        h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
      )
    )
    setMessage('')
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const res = await fetch('/api/admin/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      })
      const data = await res.json()
      if (res.ok) {
        setHours(data.hours)
        setMessage('Hours saved successfully!')
      } else {
        setError(data.error || 'Failed to save hours')
      }
    } catch {
      setError('Failed to save hours')
    }
    setSaving(false)
  }

  // Convert HH:MM (24h) to display format
  function formatTime(time: string | null): string {
    if (!time) return ''
    const [h, m] = time.split(':').map(Number)
    const period = h >= 12 ? 'PM' : 'AM'
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${displayH}:${m.toString().padStart(2, '0')} ${period}`
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock size={24} className="text-gray-700" />
          <h1 className="text-2xl font-bold">Store Hours</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {message && (
        <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4">{message}</div>
      )}
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">{error}</div>
      )}

      {/* Store Hours */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Open & Close Hours</h2>
          <p className="text-sm text-gray-500 mt-0.5">Set when the store opens and closes each day</p>
        </div>
        <div className="divide-y divide-gray-100">
          {hours.map((day) => (
            <div key={day.day_of_week} className="px-5 py-4 flex items-center gap-4">
              <div className="w-28 shrink-0">
                <span className="font-medium text-gray-900">{day.day_name}</span>
              </div>

              <label className="flex items-center gap-2 shrink-0">
                <input
                  type="checkbox"
                  checked={day.is_closed}
                  onChange={(e) => updateDay(day.day_of_week, 'is_closed', e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-gray-600">Closed</span>
              </label>

              {!day.is_closed && (
                <div className="flex items-center gap-2 flex-1">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Open</label>
                    <input
                      type="time"
                      value={day.open_time}
                      onChange={(e) => updateDay(day.day_of_week, 'open_time', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">—</span>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Close</label>
                    <input
                      type="time"
                      value={day.close_time}
                      onChange={(e) => updateDay(day.day_of_week, 'close_time', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <span className="text-xs text-gray-400 mt-5 ml-1">
                    {formatTime(day.open_time)} – {formatTime(day.close_time)}
                  </span>
                </div>
              )}

              {day.is_closed && (
                <span className="text-sm text-red-500 font-medium">Closed</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delivery Hours */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Delivery Hours</h2>
          <p className="text-sm text-gray-500 mt-0.5">Set when delivery is available each day (leave blank to disable delivery)</p>
        </div>
        <div className="divide-y divide-gray-100">
          {hours.map((day) => (
            <div key={day.day_of_week} className="px-5 py-4 flex items-center gap-4">
              <div className="w-28 shrink-0">
                <span className="font-medium text-gray-900">{day.day_name}</span>
              </div>

              {day.is_closed ? (
                <span className="text-sm text-gray-400">Store is closed</span>
              ) : (
                <div className="flex items-center gap-2 flex-1">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Start</label>
                    <input
                      type="time"
                      value={day.delivery_start || ''}
                      onChange={(e) => updateDay(day.day_of_week, 'delivery_start', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  <span className="text-gray-400 mt-5">—</span>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">End</label>
                    <input
                      type="time"
                      value={day.delivery_end || ''}
                      onChange={(e) => updateDay(day.day_of_week, 'delivery_end', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>
                  {day.delivery_start && day.delivery_end && (
                    <span className="text-xs text-gray-400 mt-5 ml-1">
                      {formatTime(day.delivery_start)} – {formatTime(day.delivery_end)}
                    </span>
                  )}
                  {!day.delivery_start && !day.delivery_end && (
                    <span className="text-xs text-gray-400 mt-5 ml-1">No delivery</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
