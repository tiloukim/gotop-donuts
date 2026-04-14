'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS } from '@/lib/constants'
import type { OrderWithItems, OrderStatus } from '@/lib/types'
import { RefreshCw, Volume2, VolumeX, Bell, BellOff, ChevronDown, ChevronRight, Navigation, Pencil, Check, X, Camera } from 'lucide-react'
import { useDriverTracking } from '@/hooks/useDriverTracking'

interface EnrichedOrder extends OrderWithItems {
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<EnrichedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [refundModal, setRefundModal] = useState<{ orderId: string; orderNumber: number; total?: number; partial?: boolean; items?: { name: string; total_price: number; selected_variants?: Record<string, string> }[] } | null>(null)
  const [refundReason, setRefundReason] = useState('Out of stock items')
  const [customReason, setCustomReason] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundSelectedItems, setRefundSelectedItems] = useState<Set<number>>(new Set())
  const [showCancelled, setShowCancelled] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)
  const [editingPickup, setEditingPickup] = useState<string | null>(null)
  const [editPickupDate, setEditPickupDate] = useState('')
  const [editPickupTime, setEditPickupTime] = useState('')

  // Delivery photo state
  const [deliveryPhotoModal, setDeliveryPhotoModal] = useState<string | null>(null) // order_id
  const [deliveryPhotoFile, setDeliveryPhotoFile] = useState<File | null>(null)
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState<string | null>(null)
  const [deliveryPhotoUploading, setDeliveryPhotoUploading] = useState(false)
  const deliveryPhotoInputRef = useRef<HTMLInputElement>(null)

  // Sound state — default ON so staff don't miss orders
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [newOrderFlash, setNewOrderFlash] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Driver tracking
  const { trackingOrderId, isTracking, error: trackingError, startTracking, stopTracking } = useDriverTracking()

  // Push state
  const [pushStatus, setPushStatus] = useState<'loading' | 'unsupported' | 'denied' | 'enabled' | 'available'>('loading')

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio('/sounds/new-order.wav')
    audioRef.current.volume = 0.8
  }, [])

  // Register service worker + check push status
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setPushStatus('unsupported')
      return
    }

    navigator.serviceWorker.register('/sw.js').then(async () => {
      const permission = Notification.permission
      if (permission === 'denied') {
        setPushStatus('denied')
      } else if (permission === 'granted') {
        // Check if we have an active subscription
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        setPushStatus(sub ? 'enabled' : 'available')
      } else {
        setPushStatus('available')
      }
    }).catch(() => {
      setPushStatus('unsupported')
    })
  }, [])

  async function enablePush() {
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setPushStatus('denied')
        return
      }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      const res = await fetch('/api/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })

      if (res.ok) {
        setPushStatus('enabled')
      }
    } catch (err) {
      console.error('Push subscription failed:', err)
    }
  }

  async function disablePush() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push-subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushStatus('available')
    } catch (err) {
      console.error('Push unsubscribe failed:', err)
    }
  }

  const playSound = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      // Play sound 3 times so staff don't miss it
      let count = 0
      const play = () => {
        if (count >= 3 || !audioRef.current) return
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => {})
        count++
        if (count < 3) {
          setTimeout(play, 1500)
        }
      }
      play()
    }
  }, [soundEnabled])

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // Realtime: split INSERT (sound + reload) vs UPDATE (reload only)
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        () => {
          playSound()
          setNewOrderFlash(true)
          setTimeout(() => setNewOrderFlash(false), 5000)
          loadOrders()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        () => loadOrders()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadOrders, playSound])

  async function updateStatus(orderId: string, status: OrderStatus) {
    // Auto-stop tracking if moving away from out_for_delivery
    if (trackingOrderId === orderId && status !== 'out_for_delivery') {
      await stopTracking()
    }
    setUpdating(orderId)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, status }),
      })
      if (res.ok) {
        setOrders(prev =>
          prev.map(o => (o.id === orderId ? { ...o, status } : o))
        )
      }
    } catch (e) {
      console.error('Failed to update status:', e)
    }
    setUpdating(null)
  }

  function handleDeliveredClick(orderId: string, orderType: string) {
    if (orderType === 'delivery') {
      setDeliveryPhotoModal(orderId)
      setDeliveryPhotoFile(null)
      setDeliveryPhotoPreview(null)
    } else {
      updateStatus(orderId, 'delivered')
    }
  }

  async function submitDeliveryPhoto() {
    if (!deliveryPhotoModal) return
    setDeliveryPhotoUploading(true)
    try {
      // Upload photo if provided
      if (deliveryPhotoFile) {
        const formData = new FormData()
        formData.append('file', deliveryPhotoFile)
        formData.append('order_id', deliveryPhotoModal)
        const uploadRes = await fetch('/api/admin/orders/delivery-photo', {
          method: 'POST',
          body: formData,
        })
        if (!uploadRes.ok) {
          console.error('Photo upload failed')
        }
      }
      // Mark as delivered
      await updateStatus(deliveryPhotoModal, 'delivered')
    } catch (e) {
      console.error('Delivery photo submission failed:', e)
    }
    setDeliveryPhotoUploading(false)
    setDeliveryPhotoModal(null)
    setDeliveryPhotoFile(null)
    setDeliveryPhotoPreview(null)
  }

  function onDeliveryPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setDeliveryPhotoFile(file)
    const url = URL.createObjectURL(file)
    setDeliveryPhotoPreview(url)
  }

  async function cancelAndRefund() {
    if (!refundModal) return

    setUpdating(refundModal.orderId)
    setRefundModal(null)
    try {
      const res = await fetch('/api/admin/orders/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: refundModal.orderId,
          reason: refundReason === 'Other' ? (customReason || 'Other') : refundReason,
          ...(refundAmount && { amount: parseFloat(refundAmount) }),
        }),
      })
      const result = await res.json()
      if (res.ok) {
        loadOrders()
      } else {
        alert(result.error || 'Refund failed')
      }
    } catch {
      alert('Refund request failed')
    }
    setUpdating(null)
    setRefundReason('Out of stock items')
    setRefundAmount('')
    setRefundSelectedItems(new Set())
  }

  function startEditPickup(order: EnrichedOrder) {
    const scheduled = order.scheduled_at ? new Date(order.scheduled_at) : new Date()
    setEditPickupDate(scheduled.toISOString().split('T')[0])
    setEditPickupTime(scheduled.toTimeString().slice(0, 5))
    setEditingPickup(order.id)
  }

  async function savePickupTime(orderId: string) {
    if (!editPickupDate || !editPickupTime) return
    setUpdating(orderId)
    try {
      const scheduled_at = new Date(`${editPickupDate}T${editPickupTime}`).toISOString()
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, scheduled_at }),
      })
      if (res.ok) {
        setOrders(prev =>
          prev.map(o => (o.id === orderId ? { ...o, scheduled_at: scheduled_at, estimated_ready_at: scheduled_at } : o))
        )
      }
    } catch (e) {
      console.error('Failed to update pickup time:', e)
    }
    setUpdating(null)
    setEditingPickup(null)
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    )
  }

  const activeOrders = orders.filter(o => !['delivered', 'picked_up', 'cancelled', 'refunded'].includes(o.status))
  const completedOrders = orders.filter(o => ['delivered', 'picked_up'].includes(o.status))
  const cancelledOrders = orders.filter(o => ['cancelled', 'refunded'].includes(o.status))

  function getStatusBadge(status: string) {
    if (status === 'cancelled' || status === 'refunded') {
      return 'bg-red-100 text-red-700'
    }
    if (status === 'delivered' || status === 'picked_up') {
      return 'bg-green-100 text-green-700'
    }
    return 'bg-amber-100 text-amber-700'
  }

  function getFlowStatuses(orderType: string): OrderStatus[] {
    if (orderType === 'pickup') {
      return ['received', 'preparing', 'ready', 'picked_up']
    }
    return ['received', 'preparing', 'ready', 'out_for_delivery', 'delivered']
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Order Management</h1>
        <div className="flex items-center gap-2">
          {/* Push notification toggle */}
          {pushStatus === 'enabled' ? (
            <button
              onClick={disablePush}
              className="p-2 text-green-600 hover:text-green-700 rounded-lg hover:bg-green-50"
              title="Push notifications ON — click to disable"
            >
              <Bell size={18} />
            </button>
          ) : pushStatus === 'available' ? (
            <button
              onClick={enablePush}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              title="Enable push notifications"
            >
              <BellOff size={18} />
            </button>
          ) : pushStatus === 'denied' ? (
            <button
              disabled
              className="p-2 text-red-300 rounded-lg cursor-not-allowed"
              title="Push notifications blocked — enable in browser settings"
            >
              <BellOff size={18} />
            </button>
          ) : pushStatus === 'unsupported' ? (
            <button
              disabled
              className="p-2 text-gray-300 rounded-lg cursor-not-allowed"
              title="Push notifications not supported — use HTTPS or deploy to production"
            >
              <BellOff size={18} />
            </button>
          ) : null}

          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg hover:bg-gray-100 ${
              soundEnabled ? 'text-green-600 hover:text-green-700' : 'text-gray-400 hover:text-gray-600'
            }`}
            title={soundEnabled ? 'Sound ON — click to mute' : 'Sound OFF — click to enable'}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Refresh */}
          <button
            onClick={() => { setLoading(true); loadOrders() }}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* New order flash alert */}
      {newOrderFlash && (
        <div className="mb-4 p-4 bg-green-50 border-2 border-green-400 rounded-xl flex items-center gap-3 animate-pulse">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="font-bold text-green-800">New Online Order!</p>
            <p className="text-sm text-green-600">A new order just came in — check below</p>
          </div>
          <button
            onClick={() => setNewOrderFlash(false)}
            className="ml-auto text-green-400 hover:text-green-600 text-lg font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Active Orders */}
      <h2 className="text-lg font-semibold mb-4">
        Active Orders ({activeOrders.length})
      </h2>
      {activeOrders.length === 0 ? (
        <p className="text-gray-500 mb-8">No active orders</p>
      ) : (
        <div className="space-y-4 mb-10">
          {activeOrders.map(order => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg">Order #{order.order_number}</h3>
                  <p className="text-sm text-gray-500">
                    {order.customer_name || order.customer_email || 'Guest'}
                    {order.customer_phone && <a href={`tel:${order.customer_phone}`} className="ml-2 text-blue-500 hover:underline">{order.customer_phone}</a>}
                  </p>
                  <p className="text-sm text-gray-400">
                    {order.order_type === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'} &middot;{' '}
                    {order.scheduled_at
                      ? new Date(order.scheduled_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                        })
                      : new Date(order.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric', minute: '2-digit',
                        })
                    }
                  </p>
                  {editingPickup === order.id ? (
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="date"
                        value={editPickupDate}
                        onChange={e => setEditPickupDate(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      />
                      <input
                        type="time"
                        value={editPickupTime}
                        onChange={e => setEditPickupTime(e.target.value)}
                        className="text-xs border rounded px-2 py-1"
                      />
                      <button
                        onClick={() => savePickupTime(order.id)}
                        disabled={updating === order.id}
                        className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        title="Save"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => setEditingPickup(null)}
                        className="text-gray-400 hover:text-gray-600"
                        title="Cancel"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditPickup(order)}
                      className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 mt-0.5"
                    >
                      <Pencil size={12} />
                      Edit pickup time
                    </button>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">${Number(order.total).toFixed(2)}</span>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(order.status)}`}>
                      {order.status === 'picked_up' && order.order_type === 'delivery'
                        ? 'Delivered'
                        : STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                {order.order_items.map(item => (
                  <div key={item.id} className="text-sm">
                    <span className="font-medium">{item.quantity}x</span> {item.name}
                    {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                      <span className="text-purple-600 text-xs ml-1">
                        ({Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(', ')})
                      </span>
                    )}
                    {item.special_instructions && (
                      <span className="text-gray-400"> — {item.special_instructions}</span>
                    )}
                  </div>
                ))}
                {order.notes && (
                  <p className="text-sm text-amber-600 mt-2 font-medium">Note: {order.notes}</p>
                )}
              </div>

              {order.delivery_address && (
                <div className="mb-3">
                  <p className="text-sm text-gray-600 mb-2">
                    📍 {order.delivery_address.street}, {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.zip}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                        `${order.delivery_address.street}, ${order.delivery_address.city}, ${order.delivery_address.state} ${order.delivery_address.zip}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 flex items-center gap-1"
                    >
                      🧭 Navigate
                    </a>
                    {order.status === 'out_for_delivery' && (
                      trackingOrderId === order.id ? (
                        <button
                          onClick={stopTracking}
                          className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 flex items-center gap-1.5"
                        >
                          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                          Stop Tracking
                        </button>
                      ) : (
                        <button
                          onClick={() => startTracking(order.id)}
                          disabled={isTracking}
                          className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-green-700 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Navigation size={12} />
                          {isTracking ? 'Tracking another order' : 'Start Live Tracking'}
                        </button>
                      )
                    )}
                  </div>
                  {trackingOrderId === order.id && trackingError && (
                    <p className="text-xs text-red-500 mt-1">{trackingError}</p>
                  )}
                </div>
              )}

              <div className="flex gap-2 flex-wrap items-center">
                {getFlowStatuses(order.order_type).map(s => (
                  <button
                    key={s}
                    onClick={() => s === 'delivered' ? handleDeliveredClick(order.id, order.order_type) : updateStatus(order.id, s)}
                    disabled={updating === order.id || order.status === s}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                      order.status === s
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-50`}
                  >
                    {s === 'delivered' && order.order_type === 'delivery' ? (
                      <span className="flex items-center gap-1"><Camera size={12} /> Delivered</span>
                    ) : s === 'ready' && order.order_type === 'delivery' ? 'Ready for Delivery' : STATUS_LABELS[s]}
                  </button>
                ))}

                <span className="mx-1 text-gray-300">|</span>

                {order.square_payment_id && (
                  <a
                    href={`https://squareup.com/receipt/preview/${order.square_payment_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    🧾 Receipt
                  </a>
                )}

                <button
                  onClick={() => setRefundModal({ orderId: order.id, orderNumber: order.order_number })}
                  disabled={updating === order.id}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {updating === order.id ? 'Processing...' : 'Cancel & Refund'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancelled / Refunded */}
      {cancelledOrders.length > 0 && (
        <div className="mb-10">
          <button
            onClick={() => setShowCancelled(!showCancelled)}
            className="flex items-center gap-2 text-lg font-semibold mb-4 hover:text-gray-600 transition-colors"
          >
            {showCancelled ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            Cancelled / Refunded ({cancelledOrders.length})
          </button>
          {showCancelled && (
            <div className="space-y-2">
              {cancelledOrders.map(order => (
                <div key={order.id} className="bg-red-50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="w-full p-3 flex justify-between items-center hover:bg-red-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedOrder === order.id ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      <span className="font-medium">#{order.order_number}</span>
                      <span className="text-sm text-gray-500">
                        {order.customer_name || order.customer_email || 'Guest'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">${Number(order.total).toFixed(2)}</span>
                      <span className={`text-xs ml-2 ${order.status === 'refunded' ? 'text-red-600' : 'text-red-500'}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                  </button>
                  {expandedOrder === order.id && (
                    <div className="px-4 pb-4 pt-1 border-t border-red-100">
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div><span className="text-gray-500">Customer:</span> {order.customer_name || 'Guest'}</div>
                        <div><span className="text-gray-500">Email:</span> {order.customer_email || '—'}</div>
                        <div><span className="text-gray-500">Phone:</span> {order.customer_phone ? <a href={`tel:${order.customer_phone}`} className="text-blue-500 hover:underline">{order.customer_phone}</a> : '—'}</div>
                        <div><span className="text-gray-500">Type:</span> {order.order_type === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'}</div>
                        <div><span className="text-gray-500">Date:</span> {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                        {order.cancel_reason && <div><span className="text-gray-500">Reason:</span> {order.cancel_reason}</div>}
                      </div>
                      {order.delivery_address && (
                        <p className="text-sm text-gray-600 mb-2">📍 {order.delivery_address.street}, {order.delivery_address.city}</p>
                      )}
                      <div className="bg-white/60 rounded-lg p-3">
                        {order.order_items.map(item => (
                          <div key={item.id} className="text-sm flex justify-between">
                            <span>
                              <span className="font-medium">{item.quantity}x</span> {item.name}
                              {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                                <span className="text-purple-600 text-xs ml-1">
                                  ({Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                </span>
                              )}
                            </span>
                            <span className="text-gray-500">${Number(item.total_price).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold text-sm">
                          <span>Total</span>
                          <span>${Number(order.total).toFixed(2)}</span>
                        </div>
                      </div>
                      {order.notes && <p className="text-sm text-amber-600 mt-2 font-medium">Note: {order.notes}</p>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed Orders */}
      <div>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="flex items-center gap-2 text-lg font-semibold mb-4 hover:text-gray-600 transition-colors"
        >
          {showCompleted ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          Completed ({completedOrders.length})
        </button>
        {showCompleted && (
          completedOrders.length === 0 ? (
            <p className="text-gray-400 text-sm">No completed orders</p>
          ) : (
            <div className="space-y-2">
              {completedOrders.map(order => (
                <div key={order.id} className="bg-gray-50 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                    className="w-full p-3 flex justify-between items-center hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedOrder === order.id ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      <span className="font-medium">#{order.order_number}</span>
                      <span className="text-sm text-gray-500">
                        {order.customer_name || order.customer_email || 'Guest'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">${Number(order.total).toFixed(2)}</span>
                      <span className="text-xs text-green-600 ml-2">{STATUS_LABELS[order.status]}</span>
                    </div>
                  </button>
                  {expandedOrder === order.id && (
                    <div className="px-4 pb-4 pt-1 border-t border-gray-200">
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div><span className="text-gray-500">Customer:</span> {order.customer_name || 'Guest'}</div>
                        <div><span className="text-gray-500">Email:</span> {order.customer_email || '—'}</div>
                        <div><span className="text-gray-500">Phone:</span> {order.customer_phone ? <a href={`tel:${order.customer_phone}`} className="text-blue-500 hover:underline">{order.customer_phone}</a> : '—'}</div>
                        <div><span className="text-gray-500">Type:</span> {order.order_type === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'}</div>
                        <div><span className="text-gray-500">Date:</span> {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                        {order.estimated_ready_at && <div><span className="text-gray-500">Scheduled:</span> {new Date(order.estimated_ready_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>}
                      </div>
                      {order.delivery_address && (
                        <p className="text-sm text-gray-600 mb-2">📍 {order.delivery_address.street}, {order.delivery_address.city}</p>
                      )}
                      <div className="bg-white rounded-lg p-3">
                        {order.order_items.map(item => (
                          <div key={item.id} className="text-sm flex justify-between">
                            <div>
                              <span className="font-medium">{item.quantity}x</span> {item.name}
                              {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                                <span className="text-purple-600 text-xs ml-1">
                                  ({Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(', ')})
                                </span>
                              )}
                              {item.special_instructions && <span className="text-gray-400 text-xs ml-1">— {item.special_instructions}</span>}
                            </div>
                            <span className="text-gray-500">${Number(item.total_price).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-semibold text-sm">
                          <span>Total</span>
                          <span>${Number(order.total).toFixed(2)}</span>
                        </div>
                      </div>
                      {order.notes && <p className="text-sm text-amber-600 mt-2 font-medium">Note: {order.notes}</p>}
                      {order.cancel_reason && <p className="text-sm text-orange-600 mt-1">{order.cancel_reason}</p>}
                      <div className="flex gap-2 mt-3">
                        {order.square_payment_id && (
                          <a
                            href={`https://squareup.com/receipt/preview/${order.square_payment_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
                          >
                            🧾 Receipt
                          </a>
                        )}
                        {order.square_payment_id && (
                          <button
                            onClick={() => setRefundModal({
                              orderId: order.id,
                              orderNumber: order.order_number,
                              total: Number(order.total),
                              partial: true,
                              items: order.order_items.map(i => ({ name: i.name, total_price: Number(i.total_price), ...(i.selected_variants && { selected_variants: i.selected_variants }) })),
                            })}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-100 text-red-600 hover:bg-red-200"
                          >
                            Partial Refund
                          </button>
                        )}
                        {order.square_payment_id && (
                          <button
                            onClick={() => setRefundModal({ orderId: order.id, orderNumber: order.order_number })}
                            className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700"
                          >
                            Full Refund
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
      {/* Delivery Photo Modal */}
      {deliveryPhotoModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-1">Proof of Delivery</h3>
            <p className="text-sm text-gray-500 mb-4">Take a photo of the delivered order at the door.</p>

            <input
              ref={deliveryPhotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onDeliveryPhotoSelect}
              className="hidden"
            />

            {deliveryPhotoPreview ? (
              <div className="mb-4">
                <img
                  src={deliveryPhotoPreview}
                  alt="Delivery preview"
                  className="w-full rounded-lg object-cover max-h-64"
                />
                <button
                  onClick={() => { setDeliveryPhotoFile(null); setDeliveryPhotoPreview(null) }}
                  className="text-xs text-red-500 mt-2 hover:underline"
                >
                  Remove photo
                </button>
              </div>
            ) : (
              <button
                onClick={() => deliveryPhotoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-primary hover:text-primary transition-colors mb-4"
              >
                <Camera size={32} />
                <span className="text-sm font-medium">Tap to take photo</span>
              </button>
            )}

            <div className="flex gap-3">
              <button
                onClick={submitDeliveryPhoto}
                disabled={deliveryPhotoUploading}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {deliveryPhotoUploading ? 'Uploading...' : deliveryPhotoFile ? 'Upload & Mark Delivered' : 'Skip & Mark Delivered'}
              </button>
              <button
                onClick={() => { setDeliveryPhotoModal(null); setDeliveryPhotoFile(null); setDeliveryPhotoPreview(null) }}
                className="px-4 py-2.5 rounded-lg font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-1">
              {refundModal.partial ? 'Partial Refund' : 'Cancel & Refund'} Order #{refundModal.orderNumber}
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {refundModal.partial
                ? `Order total: $${refundModal.total?.toFixed(2)}. Enter the amount to refund.`
                : 'The customer will be fully refunded to their original payment method.'}
            </p>

            {refundModal.partial && refundModal.items && (
              <div className="mb-3">
                <label className="block text-sm font-medium mb-2">Select missing items to refund:</label>
                <div className="border rounded-lg divide-y">
                  {refundModal.items.map((item, idx) => (
                    <label key={idx} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={refundSelectedItems.has(idx)}
                        onChange={(e) => {
                          const next = new Set(refundSelectedItems)
                          if (e.target.checked) next.add(idx); else next.delete(idx)
                          setRefundSelectedItems(next)
                          const itemTotal = refundModal.items!
                            .filter((_, i) => next.has(i))
                            .reduce((sum, it) => sum + it.total_price, 0)
                          setRefundAmount(itemTotal > 0 ? itemTotal.toFixed(2) : '')
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex-1">
                        <span className="text-sm">{item.name}</span>
                        {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                          <span className="text-xs text-purple-600 ml-1">
                            ({Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(', ')})
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">${item.total_price.toFixed(2)}</span>
                    </label>
                  ))}
                </div>
                {refundAmount && (
                  <p className="text-sm font-medium text-red-600 mt-2">
                    Refund amount: ${refundAmount}
                  </p>
                )}
                <div className="mt-2">
                  <label className="text-xs text-gray-500">Or enter custom amount:</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={refundModal.total}
                    placeholder="0.00"
                    value={refundAmount}
                    onChange={(e) => { setRefundAmount(e.target.value); setRefundSelectedItems(new Set()) }}
                    className="w-full px-3 py-2 border rounded-lg text-sm mt-1"
                  />
                </div>
              </div>
            )}

            <label className="block text-sm font-medium mb-1">Reason</label>
            <select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-2 text-sm"
            >
              <option>Out of stock items</option>
              <option>Customer requested cancellation</option>
              <option>Duplicate order</option>
              <option>Store closed</option>
              <option>Other</option>
            </select>
            {refundReason === 'Other' && (
              <input
                type="text"
                placeholder="Enter reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-2 text-sm"
                autoFocus
              />
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setRefundModal(null); setRefundReason('Out of stock items'); setCustomReason(''); setRefundAmount(''); setRefundSelectedItems(new Set()) }}
                className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50"
              >
                Go Back
              </button>
              <button
                onClick={cancelAndRefund}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
