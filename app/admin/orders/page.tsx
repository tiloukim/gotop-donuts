'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { STATUS_LABELS, ADMIN_EMAIL } from '@/lib/constants';
import type { OrderWithItems, OrderStatus } from '@/lib/types';

const ALL_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'picked_up'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        loadOrders();
        subscribeToOrders();
      } else {
        setLoading(false);
      }
    });
  }, []);

  async function loadOrders() {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false })
      .limit(50);

    setOrders((data as OrderWithItems[]) || []);
    setLoading(false);
  }

  function subscribeToOrders() {
    const supabase = createClient();
    supabase
      .channel('admin-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => loadOrders()
      )
      .subscribe();
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    setUpdating(orderId);
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    } catch (e) {
      console.error('Failed to update status:', e);
    }
    setUpdating(null);
  }

  if (!isAdmin && !loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-gray-500 mt-2">Admin access required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  const activeOrders = orders.filter((o) => !['delivered', 'picked_up'].includes(o.status));
  const completedOrders = orders.filter((o) => ['delivered', 'picked_up'].includes(o.status));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Order Management</h1>

      {/* Active Orders */}
      <h2 className="text-xl font-semibold mb-4">
        Active Orders ({activeOrders.length})
      </h2>
      {activeOrders.length === 0 ? (
        <p className="text-gray-500 mb-8">No active orders</p>
      ) : (
        <div className="space-y-4 mb-10">
          {activeOrders.map((order) => (
            <div key={order.id} className="bg-white border rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg">Order #{order.order_number}</h3>
                  <p className="text-sm text-gray-500">
                    {order.order_type === 'delivery' ? '🚗 Delivery' : '🏪 Pickup'} &middot;{' '}
                    {new Date(order.created_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
                  {STATUS_LABELS[order.status]}
                </span>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                {order.order_items.map((item) => (
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
                  .filter((s) => {
                    if (order.order_type === 'pickup') {
                      return ['received', 'preparing', 'ready', 'picked_up'].includes(s);
                    }
                    return s !== 'picked_up';
                  })
                  .map((s) => (
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
      <h2 className="text-xl font-semibold mb-4">
        Completed ({completedOrders.length})
      </h2>
      <div className="space-y-2">
        {completedOrders.slice(0, 20).map((order) => (
          <div key={order.id} className="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
            <div>
              <span className="font-medium">#{order.order_number}</span>
              <span className="text-sm text-gray-500 ml-2">
                {order.order_items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-semibold">${order.total.toFixed(2)}</span>
              <span className="text-xs text-green-600 ml-2">{STATUS_LABELS[order.status]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
