'use client'

import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { createClient } from '@/lib/supabase/client'
import { STORE_LAT, STORE_LNG } from '@/lib/constants'
import type { DeliveryAddress } from '@/lib/types'
import 'leaflet/dist/leaflet.css'

// Custom marker icons
const storeIcon = L.divIcon({
  html: '<div style="font-size:24px;text-align:center">🏪</div>',
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

const customerIcon = L.divIcon({
  html: '<div style="font-size:24px;text-align:center">📍</div>',
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function createDriverIcon(heading: number | null) {
  // Default heading 0 = north. CSS rotate: 0deg = up.
  // The car emoji 🚗 faces left by default, so we offset by +90 to make it face up at 0deg heading
  const rotation = heading != null ? heading + 90 : 90;
  return L.divIcon({
    html: `<div style="font-size:28px;text-align:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));transform:rotate(${rotation}deg);transition:transform 0.5s ease">🚗</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}

// Component to fit map bounds
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => [lat, lng]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [map, points])
  return null
}

// Component to smoothly animate driver marker with heading rotation
function AnimatedMarker({ position, heading }: { position: [number, number]; heading: number | null }) {
  const markerRef = useRef<L.Marker>(null)
  const [currentPos, setCurrentPos] = useState(position)
  const icon = createDriverIcon(heading)

  useEffect(() => {
    setCurrentPos(position)
  }, [position])

  return (
    <Marker position={currentPos} icon={icon} ref={markerRef}>
      <Popup>Driver is here</Popup>
    </Marker>
  )
}

interface DriverTrackingMapProps {
  orderId: string
  deliveryAddress: DeliveryAddress
}

export default function DriverTrackingMap({ orderId, deliveryAddress }: DriverTrackingMapProps) {
  const [driverLocation, setDriverLocation] = useState<{ lat: number; lng: number; heading: number | null } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Fetch initial driver location
    supabase
      .from('driver_locations')
      .select('lat, lng, heading')
      .eq('order_id', orderId)
      .single()
      .then(({ data }) => {
        if (data) setDriverLocation({ lat: data.lat, lng: data.lng, heading: data.heading })
        setLoading(false)
      })

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`driver-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setDriverLocation(null)
          } else {
            const row = payload.new as { lat: number; lng: number; heading: number | null }
            setDriverLocation({ lat: row.lat, lng: row.lng, heading: row.heading })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  const customerLat = deliveryAddress.lat
  const customerLng = deliveryAddress.lng

  // Build points for bounds fitting
  const points: [number, number][] = [
    [STORE_LAT, STORE_LNG],
  ]
  if (customerLat && customerLng) {
    points.push([customerLat, customerLng])
  }
  if (driverLocation) {
    points.push([driverLocation.lat, driverLocation.lng])
  }

  if (loading) {
    return (
      <div className="mt-3 bg-gray-100 rounded-lg h-48 flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    )
  }

  if (!driverLocation) {
    return (
      <div className="mt-3 bg-blue-50 rounded-lg p-4 flex items-center gap-2">
        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
        <p className="text-sm text-blue-700">Waiting for driver location...</p>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-lg overflow-hidden border border-gray-200" style={{ height: 280 }}>
      <MapContainer
        center={[driverLocation.lat, driverLocation.lng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />

        {/* Store marker */}
        <Marker position={[STORE_LAT, STORE_LNG]} icon={storeIcon}>
          <Popup>Top Donuts</Popup>
        </Marker>

        {/* Customer marker */}
        {customerLat && customerLng && (
          <Marker position={[customerLat, customerLng]} icon={customerIcon}>
            <Popup>Delivery Address</Popup>
          </Marker>
        )}

        {/* Driver marker */}
        <AnimatedMarker position={[driverLocation.lat, driverLocation.lng]} heading={driverLocation.heading} />
      </MapContainer>
    </div>
  )
}
