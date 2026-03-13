'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, OrderType, DeliveryAddress } from './types';
import { TX_SALES_TAX } from './constants';

export function getCartKey(item: { menu_item_id: string; selectedVariants?: Record<string, string> }): string {
  const base = item.menu_item_id;
  if (!item.selectedVariants || Object.keys(item.selectedVariants).length === 0) return base;
  const sorted = Object.entries(item.selectedVariants).sort(([a], [b]) => a.localeCompare(b));
  return `${base}::${JSON.stringify(sorted)}`;
}

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  deliveryAddress: DeliveryAddress | null;
  deliveryFee: number;
  deliveryDistance: number | null;
  redeemPoints: number;
  discount: number;
  tip: number;
  scheduledAt: string | null;

  addItem: (item: Omit<CartItem, 'quantity' | 'special_instructions'>) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  updateInstructions: (cartKey: string, instructions: string) => void;
  setOrderType: (type: OrderType) => void;
  setDeliveryAddress: (address: DeliveryAddress | null) => void;
  setDeliveryFee: (fee: number, distance: number | null) => void;
  setRedeemPoints: (points: number, discount: number) => void;
  setTip: (tip: number) => void;
  setScheduledAt: (scheduledAt: string | null) => void;
  clearCart: () => void;

  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      orderType: 'pickup',
      deliveryAddress: null,
      deliveryFee: 0,
      deliveryDistance: null,
      redeemPoints: 0,
      discount: 0,
      tip: 0,
      scheduledAt: null,

      addItem: (item) => {
        set((state) => {
          const key = getCartKey(item);
          const existing = state.items.find(i => getCartKey(i) === key);
          if (existing) {
            return {
              items: state.items.map(i =>
                getCartKey(i) === key
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            };
          }
          return {
            items: [...state.items, { ...item, quantity: 1, special_instructions: '' }],
          };
        });
      },

      removeItem: (cartKey) => {
        set((state) => ({
          items: state.items.filter(i => getCartKey(i) !== cartKey),
        }));
      },

      updateQuantity: (cartKey, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartKey);
          return;
        }
        set((state) => ({
          items: state.items.map(i =>
            getCartKey(i) === cartKey ? { ...i, quantity } : i
          ),
        }));
      },

      updateInstructions: (cartKey, instructions) => {
        set((state) => ({
          items: state.items.map(i =>
            getCartKey(i) === cartKey ? { ...i, special_instructions: instructions } : i
          ),
        }));
      },

      setOrderType: (orderType) => {
        set({
          orderType,
          ...(orderType === 'pickup' ? { deliveryAddress: null, deliveryFee: 0, deliveryDistance: null } : {}),
        });
      },

      setDeliveryAddress: (deliveryAddress) => set({ deliveryAddress }),

      setDeliveryFee: (deliveryFee, deliveryDistance) => set({ deliveryFee, deliveryDistance }),

      setRedeemPoints: (redeemPoints, discount) => set({ redeemPoints, discount }),

      setTip: (tip) => set({ tip }),

      setScheduledAt: (scheduledAt) => set({ scheduledAt }),

      clearCart: () => set({
        items: [],
        orderType: 'pickup',
        deliveryAddress: null,
        deliveryFee: 0,
        deliveryDistance: null,
        redeemPoints: 0,
        discount: 0,
        tip: 0,
        scheduledAt: null,
      }),

      getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getTax: () => get().getSubtotal() * TX_SALES_TAX,

      getTotal: () => {
        const state = get();
        return state.getSubtotal() + state.getTax() + state.deliveryFee - state.discount + state.tip;
      },

      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: 'gotop-cart',
      skipHydration: true,
    }
  )
);
