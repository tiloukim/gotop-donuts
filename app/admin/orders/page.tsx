'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { STATUS_LABELS } from '@/lib/constants'
import type { OrderWithItems, OrderStatus } from '@/lib/types'
import { RefreshCw } from 'lucide-react'

interface EnrichedOrder extends OrderWithItems {
  customer_name: string | null
  customer_email: string | null
  customer_phone: string | null
}

const ALL_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up']

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<EnrichedOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

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

  // Realtime subscription for order updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => loadOrders()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [loadOrders])

  async function updateStatus(orderId: string, status: OrderStatus) {
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

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    )
  }

  const activeOrders = orders.filter(o => !['delivered', 'picked_up'].includes(o.status))
  const completedOrders = orders.filter(o => ['delivered', 'picked_up'].includes(o.status))

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Order Management</h1>
        <button
          onClick={() => { setLoading(true); loadOrders() }}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          title="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

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
                    {order.customer_phone && <span className="ml-2 text-gray-400">{order.customer_phone}</span>}
                  </p>
                  <p className="text-sm text-gray-400">
                    {order.order_type === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'} &middot;{' '}
                    {new Date(order.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold">${Number(order.total).toFixed(2)}</span>
                  <div className="mt-1">
                    <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                {order.order_items.map(item => (
                  <div key={item.id} className="text-sm">
                    <span className="font-medium">{item.quantity}x</span> {item.name}
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
                <p className="text-sm text-gray-600 mb-3">
                  📍 {order.delivery_address.street}, {order.delivery_address.city}
                </p>
              )}

              <div className="flex gap-2 flex-wrap">
                {ALL_STATUSES
                  .filter(s => {
                    if (order.order_type === 'pickup') {
                      return ['received', 'preparing', 'ready', 'picked_up'].includes(s)
                    }
                    return s !== 'picked_up'
                  })
                  .map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(order.id, s)}
                      disabled={updating === order.id || order.status === s}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                        order.status === s
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      } disabled:opacity-50`}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed Orders */}
      <h2 className="text-lg font-semibold mb-4">
        Completed ({completedOrders.length})
      </h2>
      {completedOrders.length === 0 ? (
        <p className="text-gray-400 text-sm">No completed orders</p>
      ) : (
        <div className="space-y-2">
          {completedOrders.slice(0, 20).map(order => (
            <div key={order.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
              <div>
                <span className="font-medium">#{order.order_number}</span>
                <span className="text-sm text-gray-500 ml-2">
                  {order.customer_name || order.customer_email || 'Guest'}
                </span>
                <span className="text-xs text-gray-400 ml-2">
                  {order.order_items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold">${Number(order.total).toFixed(2)}</span>
                <span className="text-xs text-green-600 ml-2">{STATUS_LABELS[order.status]}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
