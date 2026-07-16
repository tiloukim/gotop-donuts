'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/lib/cart-store';
import { createClient } from '@/lib/supabase/client';
import SquarePaymentForm from '@/components/SquarePaymentForm';
import { REDEEM_POINTS, REDEEM_DISCOUNT } from '@/lib/constants';
import type { OrderType, Profile } from '@/lib/types';

interface StoreHoursDay {
  day_of_week: number
  day_name: string
  open_time: string
  close_time: string
  delivery_start: string | null
  delivery_end: string | null
  is_closed: boolean
}

export default function CheckoutPage() {
  const router = useRouter();
  const cart = useCartStore();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notes, setNotes] = useState(() => {
    if (typeof window !== 'undefined') return sessionStorage.getItem('order_notes') || '';
    return '';
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [fullName, setFullName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);

  // Gift card state
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardBalance, setGiftCardBalance] = useState(0);
  const [giftCardApplied, setGiftCardApplied] = useState(false);
  const [giftCardError, setGiftCardError] = useState('');
  const [checkingGiftCard, setCheckingGiftCard] = useState(false);

  // Delivery address fields
  const [street, setStreet] = useState('');
  const [apt, setApt] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [gateCode, setGateCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [addressError, setAddressError] = useState('');
  const [calculatingFee, setCalculatingFee] = useState(false);

  // Store hours from DB
  const [storeHours, setStoreHours] = useState<StoreHoursDay[]>([]);

  // Scheduling state. Pickup is scheduled-only (no ASAP); delivery keeps ASAP.
  const [scheduleMode, setScheduleMode] = useState<'asap' | 'scheduled'>('scheduled');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

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
      if (data) {
        setProfile(data);
        if (data.phone) setPhone(data.phone);
        if (data.full_name) setFullName(data.full_name);
      }
    });

    // Fetch store hours
    fetch('/api/hours')
      .then(r => r.json())
      .then(d => { if (d.hours) setStoreHours(d.hours); })
      .catch(() => {});
  }, []);

  // Pickup is scheduled-only — never allow ASAP for pickup.
  useEffect(() => {
    if (cart.orderType === 'pickup') setScheduleMode('scheduled');
  }, [cart.orderType]);

  // Auto-default the customer into a valid pickup/delivery date + time.
  // Runs once store hours load (and whenever no date is selected yet) so the
  // pickers land pre-filled with the first open day and its earliest slot.
  useEffect(() => {
    if (scheduleMode !== 'scheduled' || storeHours.length === 0 || scheduleDate) return;
    const firstOpen = getAvailableDates().find((d) => !getHoursForDate(d).is_closed);
    if (!firstOpen) return;
    setScheduleDate(firstOpen);
    const slots = getTimeSlots(firstOpen);
    if (slots.length > 0) setScheduleTime(slots[0].value);
  }, [storeHours, scheduleMode, scheduleDate, cart.orderType]);

  // Format date as YYYY-MM-DD in local timezone
  function toLocalDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Generate available dates (today + next 6 days)
  function getAvailableDates(): string[] {
    const dates: string[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      dates.push(toLocalDateStr(d));
    }
    return dates;
  }

  // Default hours fallback (used while DB hours are loading)
  const defaultHours: StoreHoursDay = {
    day_of_week: 0, day_name: '', open_time: '04:30', close_time: '12:30',
    delivery_start: '07:00', delivery_end: '12:00', is_closed: false,
  };

  // Get hours for a specific date
  function getHoursForDate(dateStr: string): StoreHoursDay {
    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay(); // 0=Sunday
    return storeHours.find(h => h.day_of_week === dayOfWeek) || defaultHours;
  }

  // Generate 30-min time slots within store/delivery hours, filtering past slots for today
  function getTimeSlots(dateStr: string): { label: string; value: string }[] {
    const dayHours = getHoursForDate(dateStr);
    if (dayHours.is_closed) return [];

    // Use delivery hours when delivery is selected, store hours for pickup
    const startTime = cart.orderType === 'delivery' && dayHours.delivery_start
      ? dayHours.delivery_start : dayHours.open_time;
    const endTime = cart.orderType === 'delivery' && dayHours.delivery_end
      ? dayHours.delivery_end : dayHours.close_time;

    const slots: { label: string; value: string }[] = [];
    const [openHour, openMin] = startTime.split(':').map(Number);
    const [closeHour, closeMin] = endTime.split(':').map(Number);

    const now = new Date();
    const isToday = dateStr === toLocalDateStr(now);
    const minTime = isToday ? new Date(now.getTime() + 30 * 60 * 1000) : null;

    for (let h = openHour; h <= closeHour; h++) {
      for (const m of [0, 30]) {
        if (h === openHour && m < openMin) continue;
        if (h === closeHour && m > closeMin) continue;

        if (minTime) {
          const slotDate = new Date(dateStr + 'T00:00:00');
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

  // Build ISO string from date + time selection
  function getScheduledAt(): string | null {
    if (scheduleMode !== 'scheduled' || !scheduleDate || !scheduleTime) return null;
    const [h, m] = scheduleTime.split(':');
    // Parse as local midnight — bare "YYYY-MM-DD" parses as UTC and shifts
    // back a day in negative-offset timezones.
    const dt = new Date(scheduleDate + 'T00:00:00');
    dt.setHours(Number(h), Number(m), 0, 0);
    return dt.toISOString();
  }

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
        setAddressError(`Address is ${result.distance} miles away. We only deliver within 3 miles.`);
        cart.setDeliveryFee(0, null);
      } else {
        cart.setDeliveryAddress({ street, apt, building, floor, gateCode, city, state, zip, lat: result.lat, lng: result.lng });
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

  async function applyGiftCard() {
    if (!giftCardCode.trim()) return;
    setCheckingGiftCard(true);
    setGiftCardError('');
    try {
      const res = await fetch('/api/gift-cards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: giftCardCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGiftCardError(data.error || 'Invalid gift card');
      } else {
        setGiftCardBalance(data.balance);
        setGiftCardApplied(true);
      }
    } catch {
      setGiftCardError('Failed to check gift card');
    }
    setCheckingGiftCard(false);
  }

  function removeGiftCard() {
    setGiftCardApplied(false);
    setGiftCardBalance(0);
    setGiftCardCode('');
    setGiftCardError('');
  }

  async function savePhone() {
    if (!profile || !phone.trim()) return;
    setPhoneSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ phone: phone.trim(), updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (!error) {
      setProfile({ ...profile, phone: phone.trim() });
    }
    setPhoneSaving(false);
  }

  async function saveName() {
    if (!profile || fullName.trim().length < 2) return;
    setNameSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (!error) {
      setProfile({ ...profile, full_name: fullName.trim() });
    }
    setNameSaving(false);
  }

  // A valid contact phone must have at least 10 digits (US number).
  const phoneDigits = (profile?.phone || phone).replace(/\D/g, '');
  const hasPhone = phoneDigits.length >= 10;
  const hasName = (profile?.full_name || fullName).trim().length >= 2;
  const hasNote = !!notes.trim();
  // Scheduled orders need both a date and time. Pickup is always scheduled.
  const scheduleIncomplete = scheduleMode === 'scheduled' && (!scheduleDate || !scheduleTime);

  // Calculate how much the gift card covers
  const orderTotal = cart.getTotal();
  const giftCardDiscount = giftCardApplied ? Math.min(giftCardBalance, orderTotal) : 0;
  const chargeAmount = Math.max(0, orderTotal - giftCardDiscount);

  async function handleTokenize(sourceId: string) {
    const contactName = (profile?.full_name || fullName).trim();
    if (contactName.length < 2) {
      setError('Your full name is required to place your order.');
      return;
    }
    const contactPhone = (profile?.phone || phone).trim();
    if (contactPhone.replace(/\D/g, '').length < 10) {
      setError('A valid phone number (at least 10 digits) is required to place your order.');
      return;
    }
    // Make sure the account carries the name and phone before the order is placed.
    if (profile && !profile.full_name) {
      await saveName();
    }
    if (profile && !profile.phone) {
      await savePhone();
    }
    if (!notes.trim()) {
      setError('A note is required to place your order.');
      return;
    }
    if (scheduleIncomplete) {
      setError(`Please select a ${cart.orderType === 'pickup' ? 'pickup' : 'delivery'} date and time.`);
      return;
    }

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
          tip: cart.tip,
          scheduledAt: getScheduledAt(),
          sourceId,
          fullName: contactName,
          phone: contactPhone,
          notes,
          ...(giftCardApplied && giftCardDiscount > 0 && {
            giftCardCode: giftCardCode.trim(),
            giftCardAmount: giftCardDiscount,
          }),
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

      {/* Full Name (required on account) */}
      {profile && !hasName && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1">Full Name <span className="text-red-500">*</span></h2>
          <p className="text-sm text-gray-500 mb-3">
            Required so we know who the order is for. We’ll save it to your account.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            {fullName.trim().length >= 2 && (
              <button
                onClick={saveName}
                disabled={nameSaving}
                className="bg-primary text-white px-5 py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {nameSaving ? '...' : 'Save'}
              </button>
            )}
          </div>
          <p className="text-red-500 text-sm mt-1">
            Enter your full name to place an order.
          </p>
        </section>
      )}

      {/* Phone Number (required on account) */}
      {profile && !hasPhone && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-1">Phone Number <span className="text-red-500">*</span></h2>
          <p className="text-sm text-gray-500 mb-3">
            Required so we can contact you about your order. We’ll save it to your account.
          </p>
          <div className="flex gap-2">
            <input
              type="tel"
              placeholder="(903) 555-0199"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            {phone.replace(/\D/g, '').length >= 10 && (
              <button
                onClick={savePhone}
                disabled={phoneSaving}
                className="bg-primary text-white px-5 py-3 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {phoneSaving ? '...' : 'Save'}
              </button>
            )}
          </div>
          <p className="text-red-500 text-sm mt-1">
            Enter a valid phone number (at least 10 digits) to place an order.
          </p>
        </section>
      )}

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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Apt #"
                value={apt}
                onChange={(e) => setApt(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
              <input
                type="text"
                placeholder="Building #"
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
              <input
                type="text"
                placeholder="Floor #"
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
              <input
                type="text"
                placeholder="Gate code"
                value={gateCode}
                onChange={(e) => setGateCode(e.target.value)}
                className="px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
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
                Delivery fee: $6.99 ({cart.deliveryDistance} mi away)
              </p>
            )}
          </div>
        </section>
      )}

      {/* Pickup/Delivery Time */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">
          {cart.orderType === 'pickup' ? 'Pickup' : 'Delivery'} Time <span className="text-red-500">*</span>
        </h2>
        <p className="text-sm text-gray-500 mb-3">
          {cart.orderType === 'pickup'
            ? 'Choose the date and time you’ll pick up your order.'
            : 'Choose when you’d like your order.'}
        </p>
        {/* Pickup is scheduled-only — the ASAP toggle is delivery-only. */}
        {cart.orderType === 'delivery' && (
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
        )}
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
                {getAvailableDates().map((d) => {
                  const dayHours = getHoursForDate(d);
                  const closed = dayHours?.is_closed;
                  return (
                    <option key={d} value={d} disabled={closed}>
                      {new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}{closed ? ' (Closed)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Time</label>
              <select
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
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
                {getHoursForDate(scheduleDate)?.is_closed
                  ? 'Store is closed on this day.'
                  : 'No available time slots for this date.'}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Notes (required) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-1">Order Note <span className="text-red-500">*</span></h2>
        <p className="text-sm text-gray-500 mb-3">
          Required — tell us anything we need to prepare your order (e.g. flavors, box preference, allergies).
        </p>
        <textarea
          placeholder="Add a note for your order..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
        />
        {!notes.trim() && (
          <p className="text-red-500 text-sm mt-1">A note is required to place your order.</p>
        )}
      </section>

      {/* Tip */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Add a Tip</h2>
        <div className="flex gap-2">
          {[0, 1, 2, 3, 5].map((amount) => (
            <button
              key={amount}
              onClick={() => cart.setTip(amount)}
              className={`flex-1 py-2.5 rounded-lg font-medium text-sm border-2 transition-colors ${
                cart.tip === amount
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {amount === 0 ? 'No Tip' : `$${amount}`}
            </button>
          ))}
        </div>
        {cart.tip > 0 && (
          <p className="text-accent text-sm font-medium mt-2">Thank you for the tip!</p>
        )}
      </section>

      {/* Rewards */}
      {profile && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Rewards</h2>
          <div className="bg-amber-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">⭐ You have {profile.reward_points} points</p>
                {profile.reward_points >= REDEEM_POINTS ? (
                  <p className="text-sm text-gray-600">
                    Redeem {REDEEM_POINTS} points for ${REDEEM_DISCOUNT} off
                  </p>
                ) : (
                  <p className="text-sm text-gray-600">
                    {REDEEM_POINTS - profile.reward_points} more points to unlock ${REDEEM_DISCOUNT} off
                  </p>
                )}
              </div>
              {profile.reward_points >= REDEEM_POINTS && (
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
              )}
            </div>
            {/* Progress bar */}
            {profile.reward_points < REDEEM_POINTS && (
              <div className="mt-3">
                <div className="w-full bg-amber-100 rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (profile.reward_points / REDEEM_POINTS) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Earn 1 point per $1 spent
                </p>
              </div>
            )}
            {/* Points earned on this order */}
            <div className="mt-2 pt-2 border-t border-amber-200">
              <p className="text-sm text-accent font-medium">
                +{Math.floor(cart.getTotal())} points earned on this order
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Gift Card */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Gift Card</h2>
        {giftCardApplied ? (
          <div className="bg-green-50 p-4 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-medium text-green-800">Gift card applied!</p>
              <p className="text-sm text-green-600">
                Code: {giftCardCode} — Balance: ${giftCardBalance.toFixed(2)}
              </p>
              <p className="text-sm text-green-700 font-semibold">
                -${giftCardDiscount.toFixed(2)} applied to this order
              </p>
            </div>
            <button
              onClick={removeGiftCard}
              className="px-4 py-2 rounded-lg font-medium bg-red-100 text-red-600"
            >
              Remove
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="GTOP-XXXX-XXXX"
                value={giftCardCode}
                onChange={(e) => setGiftCardCode(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono tracking-wider"
                maxLength={14}
              />
              <button
                onClick={applyGiftCard}
                disabled={checkingGiftCard || !giftCardCode.trim()}
                className="bg-gray-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {checkingGiftCard ? '...' : 'Apply'}
              </button>
            </div>
            {giftCardError && <p className="text-red-500 text-sm mt-2">{giftCardError}</p>}
          </div>
        )}
      </section>

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
            {cart.tip > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tip</span>
                <span>${cart.tip.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Online Order Fee</span>
              <span>${cart.getServiceFee().toFixed(2)}</span>
            </div>
            {giftCardDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Gift Card</span>
                <span>-${giftCardDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span>${chargeAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Payment */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Payment</h2>
        {!hasName ? (
          <div className="bg-amber-50 text-amber-700 p-4 rounded-lg text-sm font-medium">
            Please provide your full name above before proceeding to payment.
          </div>
        ) : !hasPhone ? (
          <div className="bg-amber-50 text-amber-700 p-4 rounded-lg text-sm font-medium">
            Please provide your phone number above before proceeding to payment.
          </div>
        ) : scheduleIncomplete ? (
          <div className="bg-amber-50 text-amber-700 p-4 rounded-lg text-sm font-medium">
            Please select a {cart.orderType === 'pickup' ? 'pickup' : 'delivery'} date and time before proceeding to payment.
          </div>
        ) : !hasNote ? (
          <div className="bg-amber-50 text-amber-700 p-4 rounded-lg text-sm font-medium">
            Please add an order note above before proceeding to payment.
          </div>
        ) : cart.orderType === 'delivery' && !cart.deliveryAddress ? (
          <div className="bg-amber-50 text-amber-700 p-4 rounded-lg text-sm font-medium">
            Please enter your delivery address and verify it before proceeding to payment.
          </div>
        ) : (
          <SquarePaymentForm
            onTokenize={handleTokenize}
            onError={(msg) => setError(msg)}
            loading={loading}
            total={cart.getTotal()}
          />
        )}
      </section>
    </div>
  );
}
