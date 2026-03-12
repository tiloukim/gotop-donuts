'use client'

import { useState, useEffect } from 'react'
import { ShoppingBag, DollarSign, Users, Clock } from 'lucide-react'
import { STATUS_LABELS } from '@/lib/constants'
import Link from 'next/link'

interface Stats {
  todayOrders: number
  todayRevenue: number
  totalCustomers: number
  activeOrders: number
}

interface RecentOrder {
  id: string
  order_number: number
  status: string
  total: number
  order_type: string
  created_at: string
  customer_name: string | null
  customer_email: string | null
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setStats(data.stats)
        setRecentOrders(data.recentOrders ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 lg:p-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-gray-100 rounded-xl h-28 animate-pulse" />
          ))}
        </div>
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={ShoppingBag} label="Today's Orders" value={stats?.todayOrders ?? 0} />
        <StatCard icon={DollarSign} label="Today's Revenue" value={`$${(stats?.todayRevenue ?? 0).toFixed(2)}`} />
        <StatCard icon={Users} label="Total Customers" value={stats?.totalCustomers ?? 0} />
        <StatCard icon={Clock} label="Active Orders" value={stats?.activeOrders ?? 0} />
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-gray-200 rounded-xl">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">No orders yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentOrders.map(order => (
              <div key={order.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    #{order.order_number}
                    <span className="ml-2 font-normal text-gray-500">
                      {order.customer_name || order.customer_email || 'Guest'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {order.order_type === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'}
                    {' · '}
                    {new Date(order.created_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">${Number(order.total).toFixed(2)}</span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ size: number; className?: string }>
  label: string
  value: string | number
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon size={18} className="text-primary" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  )
}
