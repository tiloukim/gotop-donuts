'use client';

import { useCartStore } from '@/lib/cart-store';
import Link from 'next/link';

export default function CartPage() {
  const { items, removeItem, updateQuantity, updateInstructions, getSubtotal, getTax, getTotal, deliveryFee, discount, orderType } = useCartStore();

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
        {items.map((item) => (
          <div key={item.menu_item_id} className="bg-white border rounded-xl p-4 flex gap-4">
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
                <button onClick={() => removeItem(item.menu_item_id)} className="text-gray-400 hover:text-red-500 text-sm">
                  Remove
                </button>
              </div>
              <p className="text-sm text-gray-500">${item.price.toFixed(2)} each</p>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                  className="w-8 h-8 rounded-full border flex items-center justify-center hover:bg-gray-100"
                >
                  -
                </button>
                <span className="font-medium">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
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
                onChange={(e) => updateInstructions(item.menu_item_id, e.target.value)}
                className="mt-2 w-full text-sm px-3 py-2 border rounded-lg focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-6 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span>${getSubtotal().toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Tax (8.25%)</span>
          <span>${getTax().toFixed(2)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Delivery Fee</span>
            <span>${deliveryFee.toFixed(2)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm text-accent">
            <span>Rewards Discount</span>
            <span>-${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="border-t pt-3 flex justify-between font-bold text-lg">
          <span>Total</span>
          <span>${getTotal().toFixed(2)}</span>
        </div>
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
