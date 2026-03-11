'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/lib/cart-store';

export default function CartHydration() {
  useEffect(() => {
    useCartStore.persist.rehydrate();
  }, []);
  return null;
}
