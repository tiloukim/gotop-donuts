'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export function useDriverTracking() {
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const latestPositionRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null)

  const sendLocation = useCallback(async (orderId: string, lat: number, lng: number, heading: number | null) => {
    try {
      await fetch('/api/admin/orders/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, lat, lng, heading }),
      })
    } catch {
      // Silently fail — next update will retry
    }
  }, [])

  const startTracking = useCallback((orderId: string) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }

    setError(null)
    setTrackingOrderId(orderId)

    // Watch position with high accuracy for GPS
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        latestPositionRef.current = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          heading: position.coords.heading,
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setError('Location permission denied. Please enable location in your browser settings.')
        } else {
          setError('Unable to get location. Please check GPS settings.')
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    )

    // Send location every 5 seconds
    intervalRef.current = setInterval(() => {
      const pos = latestPositionRef.current
      if (pos) {
        sendLocation(orderId, pos.lat, pos.lng, pos.heading)
      }
    }, 5000)

    // Send initial position immediately
    navigator.geolocation.getCurrentPosition(
      (position) => {
        sendLocation(orderId, position.coords.latitude, position.coords.longitude, position.coords.heading)
      },
      () => {},
      { enableHighAccuracy: true }
    )
  }, [sendLocation])

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    // Delete location from server
    if (trackingOrderId) {
      try {
        await fetch('/api/admin/orders/location', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: trackingOrderId }),
        })
      } catch {
        // ignore
      }
    }

    latestPositionRef.current = null
    setTrackingOrderId(null)
    setError(null)
  }, [trackingOrderId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  return {
    trackingOrderId,
    isTracking: trackingOrderId !== null,
    error,
    startTracking,
    stopTracking,
  }
}
