'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { STATUS_LABELS } from '@/lib/constants';
import type { OrderWithItems } from '@/lib/types';

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/orders')
      .then((r) => r.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Your Orders</h1>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-gray-500 mb-4">No orders yet</p>
          <Link href="/menu" className="text-primary hover:underline font-medium">
            Browse our menu
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block bg-white border rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">Order #{order.order_number}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(order.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    order.status === 'delivered' || order.status === 'picked_up'
                      ? 'bg-green-100 text-green-700'
                      : order.status === 'cancelled' || order.status === 'refunded'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-700'
                  }`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <p className="text-sm font-semibold mt-1">${order.total.toFixed(2)}</p>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {order.order_items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
