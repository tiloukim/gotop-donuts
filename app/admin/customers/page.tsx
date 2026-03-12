'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronDown, ChevronUp, Gift, ShoppingBag } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import type { RewardTransaction, OrderWithItems } from '@/lib/types'

interface Customer {
  id: string
  email: string
  name: string | null
  phone: string | null
  reward_points: number
  created_at: string
  total_orders: number
  total_spent: number
}

interface CustomerDetail {
  profile: {
    id: string
    full_name: string | null
    phone: string | null
    reward_points: number
    email: string | null
    created_at: string
  }
  orders: OrderWithItems[]
  rewardTransactions: RewardTransaction[]
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const fetchCustomers = useCallback(async (query: string) => {
    try {
      const params = query ? `?search=${encodeURIComponent(query)}` : ''
      const res = await fetch(`/api/admin/customers${params}`)
      if (res.ok) {
        const data = await res.json()
        setCustomers(data.customers ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    const timeout = setTimeout(() => fetchCustomers(search), 300)
    return () => clearTimeout(timeout)
  }, [search, fetchCustomers])

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }

    setExpandedId(id)
    setDetailLoading(true)
    setDetail(null)

    try {
      const res = await fetch(`/api/admin/customers/${id}`)
      if (res.ok) {
        setDetail(await res.json())
      }
    } catch {
      // ignore
    } finally {
      setDetailLoading(false)
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">Customers</h1>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-100 rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
          {search ? 'No customers found' : 'No customers yet'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-5 py-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <div className="col-span-3">Customer</div>
            <div className="col-span-3">Contact</div>
            <div className="col-span-1 text-center">Points</div>
            <div className="col-span-2 text-center">Orders</div>
            <div className="col-span-2 text-center">Total Spent</div>
            <div className="col-span-1 text-center">Joined</div>
          </div>

          {/* Rows */}
          {customers.map(customer => (
            <div key={customer.id}>
              <div
                onClick={() => toggleExpand(customer.id)}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-5 py-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors items-center"
              >
                <div className="md:col-span-3">
                  <div className="font-medium text-gray-900 text-sm">
                    {customer.name || 'No name'}
                  </div>
                  <div className="text-xs text-gray-400 md:hidden">{customer.email}</div>
                </div>
                <div className="md:col-span-3 hidden md:block">
                  <div className="text-sm text-gray-700">{customer.email}</div>
                  {customer.phone && (
                    <div className="text-xs text-gray-400">{customer.phone}</div>
                  )}
                </div>
                <div className="md:col-span-1 text-center">
                  <span className="text-sm font-medium text-amber-600">{customer.reward_points}</span>
                </div>
                <div className="md:col-span-2 text-center text-sm text-gray-700">
                  {customer.total_orders}
                </div>
                <div className="md:col-span-2 text-center text-sm font-medium text-gray-900">
                  ${customer.total_spent.toFixed(2)}
                </div>
                <div className="md:col-span-1 text-center text-xs text-gray-400">
                  {new Date(customer.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: '2-digit',
                  })}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === customer.id && (
                <div className="px-5 py-5 bg-gray-50 border-b border-gray-200">
                  {detailLoading ? (
                    <div className="text-sm text-gray-400">Loading details...</div>
                  ) : detail ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Profile & Rewards */}
                      <div>
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <Gift size={16} /> Reward Points
                        </h3>
                        <div className="text-2xl font-bold text-amber-600 mb-3">
                          {detail.profile.reward_points} pts
                        </div>
                        {detail.rewardTransactions.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {detail.rewardTransactions.map(tx => (
                              <div key={tx.id} className="flex justify-between items-center text-sm">
                                <span className="text-gray-600">{tx.description}</span>
                                <span className={tx.type === 'earned' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                  {tx.type === 'earned' ? '+' : '-'}{tx.points}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No reward transactions</p>
                        )}
                      </div>

                      {/* Order History */}
                      <div>
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <ShoppingBag size={16} /> Order History
                        </h3>
                        {detail.orders.length > 0 ? (
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {detail.orders.map(order => (
                              <div key={order.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="text-sm font-semibold">#{order.order_number}</span>
                                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                    {STATUS_LABELS[order.status] || order.status}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-400 mb-2">
                                  {new Date(order.created_at).toLocaleString('en-US', {
                                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                                  })}
                                  {' · '}
                                  {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
                                </div>
                                <div className="text-xs text-gray-600">
                                  {order.order_items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                                </div>
                                <div className="text-sm font-semibold mt-1">${Number(order.total).toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">No orders yet</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-500">Failed to load details</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
