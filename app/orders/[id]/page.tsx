'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import OrderTimeline from '@/components/OrderTimeline';
import { STATUS_LABELS } from '@/lib/constants';
import type { OrderWithItems, OrderStatus } from '@/lib/types';

const DriverTrackingMap = dynamic(() => import('@/components/DriverTrackingMap'), { ssr: false });

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState<{ rating: number; comment: string | null } | null>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setOrder(data);
          // Fetch existing review for completed orders
          if (['delivered', 'picked_up'].includes(data.status)) {
            fetch(`/api/reviews?order_id=${data.id}`)
              .then(r => r.json())
              .then(d => { if (d.review) setReview(d.review); })
              .catch(() => {});
          }
        }
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
          {order.status === 'picked_up' && order.order_type === 'delivery'
            ? 'Delivered'
            : STATUS_LABELS[order.status]}
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

      {/* Delivery On The Way Banner */}
      {order.status === 'out_for_delivery' && order.order_type === 'delivery' && (
        <div className="bg-green-50 border-2 border-green-400 rounded-xl p-5 mb-6 animate-pulse">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🚗</span>
            <div>
              <h2 className="font-bold text-green-800 text-lg">Your order is on the way!</h2>
              {order.estimated_ready_at && (
                <p className="text-sm text-green-700">
                  Estimated delivery by{' '}
                  <span className="font-bold">
                    {new Date(order.estimated_ready_at).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
              )}
            </div>
          </div>
          {order.delivery_address && (
            <p className="text-sm text-green-600 ml-12">
              Delivering to: {order.delivery_address.street}, {order.delivery_address.city}
            </p>
          )}
          {order.delivery_address && (
            <DriverTrackingMap orderId={order.id} deliveryAddress={order.delivery_address} />
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
          {order.status !== 'out_for_delivery' && !order.scheduled_at && order.estimated_ready_at && (
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
                {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                  <p className="text-xs text-purple-600">
                    {Object.entries(item.selected_variants).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
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
            <span className="text-gray-600">Online Order Fee</span>
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

      {/* Delivery Photo — proof of delivery */}
      {order.status === 'delivered' && order.delivery_photo_url && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 mt-6">
          <h2 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
            <span className="text-xl">📸</span> Proof of Delivery
          </h2>
          <img
            src={order.delivery_photo_url}
            alt="Delivery photo"
            className="w-full rounded-lg object-cover max-h-80"
          />
          <p className="text-xs text-green-600 mt-2">
            Photo taken at delivery on{' '}
            {new Date(order.updated_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        </div>
      )}

      {/* Review Section — only for completed orders */}
      {['delivered', 'picked_up'].includes(order.status) && (
        <div className="bg-white border rounded-xl p-6 mt-6">
          {review || reviewSubmitted ? (
            <div className="text-center">
              <div className="text-3xl mb-2">
                {'★'.repeat(review?.rating || reviewRating)}{'☆'.repeat(5 - (review?.rating || reviewRating))}
              </div>
              <p className="font-semibold text-accent">Thank you for your review!</p>
              {(review?.comment || reviewComment) && (
                <p className="text-sm text-gray-500 mt-1 italic">&ldquo;{review?.comment || reviewComment}&rdquo;</p>
              )}
            </div>
          ) : (
            <>
              <h2 className="font-semibold mb-1">How was your order?</h2>
              <p className="text-sm text-gray-500 mb-4">We&apos;d love to hear your feedback!</p>

              {/* Star Rating */}
              <div className="flex justify-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setReviewRating(star)}
                    className={`text-3xl transition-transform hover:scale-110 ${
                      star <= reviewRating ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>

              {reviewRating > 0 && (
                <>
                  <textarea
                    placeholder="Tell us about your experience (optional)..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-sm mb-3"
                  />
                  <button
                    onClick={async () => {
                      setReviewSubmitting(true);
                      try {
                        const res = await fetch('/api/reviews', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ order_id: order.id, rating: reviewRating, comment: reviewComment }),
                        });
                        if (res.ok) {
                          setReviewSubmitted(true);
                        }
                      } catch { /* ignore */ }
                      setReviewSubmitting(false);
                    }}
                    disabled={reviewSubmitting}
                    className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
                  >
                    {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
