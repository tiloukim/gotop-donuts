'use client';

import { useState } from 'react';
import { useCartStore, getCartKey } from '@/lib/cart-store';
import Link from 'next/link';
import { STORE_HOURS } from '@/lib/constants';
import type { OrderType } from '@/lib/types';

export default function CartPage() {
  const cart = useCartStore();
  const { items, removeItem, updateQuantity, updateInstructions, getSubtotal, getTax, getTotal } = cart;
  const [scheduleMode, setScheduleMode] = useState<'asap' | 'scheduled'>('asap');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  function getAvailableDates(): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }

  function getTimeSlots(dateStr: string): { label: string; value: string }[] {
    const slots: { label: string; value: string }[] = [];
    const openHour = 4, openMin = 30;
    const closeHour = 12, closeMin = 30;
    const now = new Date();
    const isToday = dateStr === now.toISOString().split('T')[0];
    const minTime = isToday ? new Date(now.getTime() + 30 * 60 * 1000) : null;

    for (let h = openHour; h <= closeHour; h++) {
      for (const m of [0, 30]) {
        if (h === openHour && m < openMin) continue;
        if (h === closeHour && m > closeMin) continue;
        if (minTime) {
          const slotDate = new Date(dateStr);
          slotDate.setHours(h, m, 0, 0);
          if (slotDate <= minTime) continue;
        }
        const period = h >= 12 ? 'PM' : 'AM';
        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const label = `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
        const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        slots.push({ label, value });
      }
    }
    return slots;
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">🍩</div>
        <h1 className="text-2xl font-bold mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-6">Add some delicious items from our menu!</p>
        <Link href="/menu" className="bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-dark">
          Browse Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Your Cart</h1>

      <div className="space-y-4 mb-8">
        {items.map((item) => {
          const key = getCartKey(item);
          return (
            <div key={key} className="bg-white border rounded-xl p-4 flex gap-4">
              <div className="w-16 h-16 bg-cream rounded-lg flex items-center justify-center flex-shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <span className="text-2xl">🍩</span>
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold">{item.name}</h3>
                  <button onClick={() => removeItem(key)} className="text-gray-400 hover:text-red-500 text-sm">
                    Remove
                  </button>
                </div>
                {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Object.entries(item.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                  </p>
                )}
                <p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={() => updateQuantity(key, item.quantity - 1)}
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="font-medium">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(key, item.quantity + 1)}
                    className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                  >
                    +
                  </button>
                  <span className="ml-auto font-semibold">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
                <input
                  type="text"
                  placeholder="Special instructions..."
                  value={item.special_instructions}
                  onChange={(e) => updateInstructions(key, e.target.value)}
                  className="mt-2 w-full text-sm px-3 py-2 border rounded-lg focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Type */}
      <div className="mb-6">
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
      </div>

      {/* Pickup / Delivery Time */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">
          {cart.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Time
        </h2>
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => {
              setScheduleMode('asap');
              cart.setScheduledAt(null);
            }}
            className={`flex-1 py-3 rounded-lg font-medium border-2 transition-colors ${
              scheduleMode === 'asap'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            ASAP (~20 min)
          </button>
          <button
            onClick={() => setScheduleMode('scheduled')}
            className={`flex-1 py-3 rounded-lg font-medium border-2 transition-colors ${
              scheduleMode === 'scheduled'
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            Schedule for Later
          </button>
        </div>
        {scheduleMode === 'scheduled' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Date</label>
              <select
                value={scheduleDate}
                onChange={(e) => {
                  setScheduleDate(e.target.value);
                  setScheduleTime('');
                }}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white"
              >
                <option value="">Select date</option>
                {getAvailableDates().map((d) => (
                  <option key={d} value={d}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Time</label>
              <select
                value={scheduleTime}
                onChange={(e) => {
                  setScheduleTime(e.target.value);
                  if (scheduleDate && e.target.value) {
                    const [h, m] = e.target.value.split(':');
                    const dt = new Date(scheduleDate);
                    dt.setHours(Number(h), Number(m), 0, 0);
                    cart.setScheduledAt(dt.toISOString());
                  }
                }}
                disabled={!scheduleDate}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white disabled:opacity-50"
              >
                <option value="">Select time</option>
                {scheduleDate &&
                  getTimeSlots(scheduleDate).map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
              </select>
            </div>
            {scheduleDate && getTimeSlots(scheduleDate).length === 0 && (
              <p className="col-span-2 text-sm text-amber-600">
                No available time slots for this date. Store hours: {STORE_HOURS.open} – {STORE_HOURS.close}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Special Notes */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Special Requests</h2>
        <textarea
          placeholder="Any special requests for your order..."
          defaultValue={typeof window !== 'undefined' ? sessionStorage.getItem('order_notes') || '' : ''}
          onChange={(e) => sessionStorage.setItem('order_notes', e.target.value)}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
          rows={3}
        />
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-6 space-y-3">
        {items.map((item) => (
          <div key={getCartKey(item)} className="flex justify-between text-sm">
            <span>{item.quantity}x {item.name}</span>
            <span>${(item.price * item.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t pt-3 flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>${getSubtotal().toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax (8.25%)</span>
          <span>${getTax().toFixed(2)}</span>
        </div>
        {cart.deliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Delivery Fee</span>
            <span>${cart.deliveryFee.toFixed(2)}</span>
          </div>
        )}
        {cart.discount > 0 && (
          <div className="flex justify-between text-sm text-accent">
            <span>Rewards Discount</span>
            <span>-${cart.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Online Order Fee</span>
          <span>${cart.getServiceFee().toFixed(2)}</span>
        </div>
        <div className="border-t pt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>${getTotal().toFixed(2)}</span>
        </div>

        {/* Schedule summary */}
        {scheduleMode === 'scheduled' && scheduleDate && scheduleTime && (
          <div className="text-sm text-primary font-medium pt-1">
            📅 {cart.orderType === 'pickup' ? 'Pickup' : 'Delivery'}: {new Date(scheduleDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at {getTimeSlots(scheduleDate).find(s => s.value === scheduleTime)?.label}
          </div>
        )}

        <Link
          href="/checkout"
          className="block w-full bg-primary text-white text-center py-3 rounded-lg font-semibold hover:bg-primary-dark mt-4"
        >
          Proceed to Checkout
        </Link>
      </div>
    </div>
  );
}
