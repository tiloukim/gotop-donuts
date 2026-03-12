'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/cart-store';
import { createClient } from '@/lib/supabase/client';
import SquarePaymentForm from '@/components/SquarePaymentForm';
import { REDEEM_POINTS, REDEEM_DISCOUNT } from '@/lib/constants';
import type { OrderType, Profile } from '@/lib/types';

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCartStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Delivery address fields
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [addressError, setAddressError] = useState('');
  const [calculatingFee, setCalculatingFee] = useState(false);

  useEffect(() => {
    if (cart.items.length === 0) {
      router.push('/cart');
      return;
    }

    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.push('/login?redirect=/checkout');
        return;
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setProfile(data);
    });
  }, []);

  async function calculateDeliveryFee() {
    if (!street || !city || !zip) {
      setAddressError('Please fill in all address fields');
      return;
    }
    setCalculatingFee(true);
    setAddressError('');

    try {
      const response = await fetch('/api/delivery/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ street, city, state, zip }),
      });

      const result = await response.json();
      if (!response.ok) {
        setAddressError(result.error || 'Could not verify address');
        cart.setDeliveryFee(0, null);
      } else if (!result.available) {
        setAddressError(`Address is ${result.distance} miles away. We deliver up to 8 miles.`);
        cart.setDeliveryFee(0, null);
      } else {
        cart.setDeliveryAddress({ street, city, state, zip, lat: result.lat, lng: result.lng });
        cart.setDeliveryFee(result.fee, result.distance);
      }
    } catch {
      setAddressError('Failed to calculate delivery fee');
    }

    setCalculatingFee(false);
  }

  function handleRedeemToggle() {
    if (cart.redeemPoints > 0) {
      cart.setRedeemPoints(0, 0);
    } else if (profile && profile.reward_points >= REDEEM_POINTS) {
      const redeemCount = Math.floor(profile.reward_points / REDEEM_POINTS);
      cart.setRedeemPoints(redeemCount * REDEEM_POINTS, redeemCount * REDEEM_DISCOUNT);
    }
  }

  async function handleTokenize(sourceId: string) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.items,
          orderType: cart.orderType,
          deliveryAddress: cart.deliveryAddress,
          deliveryFee: cart.deliveryFee,
          deliveryDistance: cart.deliveryDistance,
          redeemPoints: cart.redeemPoints,
          sourceId,
          notes,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        setError(result.error || 'Order failed');
        setLoading(false);
        return;
      }

      cart.clearCart();
      router.push(`/orders/${result.order.id}`);
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  if (cart.items.length === 0) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Checkout</h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-6">{error}</div>
      )}

      {/* Order Type */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Order Type</h2>
        <div className="flex gap-3">
          {(['pickup', 'delivery'] as OrderType[]).map((type) => (
            <button
              key={type}
              onClick={() => cart.setOrderType(type)}
              className={`flex-1 py-3 rounded-lg font-medium border-2 transition-colors ${
                cart.orderType === type
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {type === 'pickup' ? '🏪 Pickup' : '🚗 Delivery'}
            </button>
          ))}
        </div>
      </section>

      {/* Delivery Address */}
      {cart.orderType === 'delivery' && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Delivery Address</h2>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Street address"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
              <input
                type="text"
                placeholder="State"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
              <input
                type="text"
                placeholder="ZIP"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
            <button
              onClick={calculateDeliveryFee}
              disabled={calculatingFee}
              className="bg-gray-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {calculatingFee ? 'Calculating...' : 'Calculate Delivery Fee'}
            </button>
            {addressError && <p className="text-red-500 text-sm">{addressError}</p>}
            {cart.deliveryFee > 0 && (
              <p className="text-accent text-sm font-medium">
                Delivery fee: ${cart.deliveryFee.toFixed(2)} ({cart.deliveryDistance} mi)
              </p>
            )}
          </div>
        </section>
      )}

      {/* Notes */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Order Notes</h2>
        <textarea
          placeholder="Any special requests..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
        />
      </section>

      {/* Rewards */}
      {profile && profile.reward_points >= REDEEM_POINTS && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Rewards</h2>
          <div className="bg-amber-50 p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium">You have {profile.reward_points} points</p>
              <p className="text-sm text-gray-600">
                Redeem {REDEEM_POINTS} points for ${REDEEM_DISCOUNT} off
              </p>
            </div>
            <button
              onClick={handleRedeemToggle}
              className={`px-4 py-2 rounded-lg font-medium ${
                cart.redeemPoints > 0
                  ? 'bg-red-100 text-red-600'
                  : 'bg-accent text-white'
              }`}
            >
              {cart.redeemPoints > 0 ? 'Remove' : 'Redeem'}
            </button>
          </div>
        </section>
      )}

      {/* Order Summary */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Order Summary</h2>
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          {cart.items.map((item) => (
            <div key={item.menu_item_id} className="flex justify-between text-sm">
              <span>{item.quantity}x {item.name}</span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t pt-2 mt-2 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span>${cart.getSubtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax (8.25%)</span>
              <span>${cart.getTax().toFixed(2)}</span>
            </div>
            {cart.deliveryFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Delivery</span>
                <span>${cart.deliveryFee.toFixed(2)}</span>
              </div>
            )}
            {cart.discount > 0 && (
              <div className="flex justify-between text-sm text-accent">
                <span>Rewards Discount</span>
                <span>-${cart.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>${cart.getTotal().toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Payment</h2>
        <SquarePaymentForm
          onTokenize={handleTokenize}
          onError={(msg) => setError(msg)}
          loading={loading}
          total={cart.getTotal()}
        />
      </section>
    </div>
  );
}
