'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, OrderType, DeliveryAddress } from './types';
import { TX_SALES_TAX } from './constants';

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  deliveryAddress: DeliveryAddress | null;
  deliveryFee: number;
  deliveryDistance: number | null;
  redeemPoints: number;
  discount: number;

  addItem: (item: Omit<CartItem, 'quantity' | 'special_instructions'>) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateInstructions: (menuItemId: string, instructions: string) => void;
  setOrderType: (type: OrderType) => void;
  setDeliveryAddress: (address: DeliveryAddress | null) => void;
  setDeliveryFee: (fee: number, distance: number | null) => void;
  setRedeemPoints: (points: number, discount: number) => void;
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

      addItem: (item) => {
        set((state) => {
          const existing = state.items.find(i => i.menu_item_id === item.menu_item_id);
          if (existing) {
            return {
              items: state.items.map(i =>
                i.menu_item_id === item.menu_item_id
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

      removeItem: (menuItemId) => {
        set((state) => ({
          items: state.items.filter(i => i.menu_item_id !== menuItemId),
        }));
      },

      updateQuantity: (menuItemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        set((state) => ({
          items: state.items.map(i =>
            i.menu_item_id === menuItemId ? { ...i, quantity } : i
          ),
        }));
      },

      updateInstructions: (menuItemId, instructions) => {
        set((state) => ({
          items: state.items.map(i =>
            i.menu_item_id === menuItemId ? { ...i, special_instructions: instructions } : i
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

      clearCart: () => set({
        items: [],
        orderType: 'pickup',
        deliveryAddress: null,
        deliveryFee: 0,
        deliveryDistance: null,
        redeemPoints: 0,
        discount: 0,
      }),

      getSubtotal: () => get().items.reduce((sum, item) => sum + item.price * item.quantity, 0),

      getTax: () => get().getSubtotal() * TX_SALES_TAX,

      getTotal: () => {
        const state = get();
        return state.getSubtotal() + state.getTax() + state.deliveryFee - state.discount;
      },

      getItemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: 'gotop-cart',
      skipHydration: true,
    }
  )
);
