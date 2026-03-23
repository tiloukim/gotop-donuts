'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import OrderTimeline from '@/components/OrderTimeline';
import { STATUS_LABELS } from '@/lib/constants';
import type { OrderWithItems, OrderStatus } from '@/lib/types';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setOrder(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Realtime subscription for order status updates
  useEffect(() => {
    if (!order) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setOrder((prev) =>
            prev ? { ...prev, ...payload.new, order_items: prev.order_items } : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, order?.id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Order not found</h1>
      </div>
    );
  }

  const isActive = !['delivered', 'picked_up', 'cancelled', 'refunded'].includes(order.status);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">Order #{order.order_number}</h1>
          <p className="text-gray-500 text-sm">
            {new Date(order.created_at).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          order.status === 'cancelled' || order.status === 'refunded'
            ? 'bg-red-100 text-red-700'
            : !isActive ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      {/* Cancelled / Refunded Notice */}
      {(order.status === 'cancelled' || order.status === 'refunded') && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-red-700 mb-1">
            {order.status === 'refunded' ? 'Order Refunded' : 'Order Cancelled'}
          </h2>
          <p className="text-sm text-red-600">
            {order.status === 'refunded'
              ? 'A refund has been issued to your original payment method. It may take 3-5 business days to appear.'
              : 'This order has been cancelled.'}
          </p>
          {order.cancel_reason && (
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-medium">Reason:</span> {order.cancel_reason}
            </p>
          )}
        </div>
      )}

      {/* Timeline */}
      {isActive && (
        <div className="bg-white border rounded-xl p-6 mb-6">
          <h2 className="font-semibold mb-4">Order Status</h2>
          <OrderTimeline status={order.status as OrderStatus} orderType={order.order_type} />
          {order.scheduled_at && (
            <p className="text-sm text-primary font-medium mt-4 text-center">
              Scheduled for: {new Date(order.scheduled_at).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })} at {new Date(order.scheduled_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}
          {!order.scheduled_at && order.estimated_ready_at && (
            <p className="text-sm text-gray-500 mt-4 text-center">
              Estimated ready: {new Date(order.estimated_ready_at).toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}

      {/* Order Details */}
      <div className="bg-white border rounded-xl p-6 mb-6">
        <h2 className="font-semibold mb-3">Items</h2>
        <div className="space-y-2">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <div>
                <span className="font-medium">{item.quantity}x</span> {item.name}
                {item.special_instructions && (
                  <p className="text-xs text-gray-400">{item.special_instructions}</p>
                )}
              </div>
              <span>${item.total_price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>${order.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax</span>
          <span>${order.tax.toFixed(2)}</span>
        </div>
        {order.delivery_fee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Delivery</span>
            <span>${order.delivery_fee.toFixed(2)}</span>
          </div>
        )}
        {order.discount > 0 && (
          <div className="flex justify-between text-sm text-accent">
            <span>Discount</span>
            <span>-${order.discount.toFixed(2)}</span>
          </div>
        )}
        {order.tip > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Tip</span>
            <span>${order.tip.toFixed(2)}</span>
          </div>
        )}
        {order.service_fee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Service Fee</span>
            <span>${order.service_fee.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-bold">
          <span>Total</span>
          <span>${order.total.toFixed(2)}</span>
        </div>
        {order.points_earned > 0 && (
          <div className="mt-3 bg-accent/10 border border-accent/20 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-accent">+{order.points_earned} reward points earned!</p>
              <p className="text-xs text-gray-500">Earn 100 points, get $5 off your next order</p>
            </div>
            <span className="text-2xl">⭐</span>
          </div>
        )}
        {order.points_redeemed > 0 && (
          <div className="mt-2 text-sm text-primary font-medium">
            {order.points_redeemed} points redeemed for ${order.discount.toFixed(2)} off
          </div>
        )}
      </div>

      {/* Delivery info */}
      {order.delivery_address && (
        <div className="bg-white border rounded-xl p-6 mt-6">
          <h2 className="font-semibold mb-2">Delivery Address</h2>
          <p className="text-gray-600 text-sm">
            {order.delivery_address.street}, {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.zip}
          </p>
        </div>
      )}
    </div>
  );
}
