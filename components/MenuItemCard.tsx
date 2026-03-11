'use client';

import { useCartStore } from '@/lib/cart-store';
import type { MenuItem } from '@/lib/types';

export default function MenuItemCard({ item }: { item: MenuItem }) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {item.image_url ? (
        <div className="h-48 bg-cream flex items-center justify-center overflow-hidden">
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-48 bg-cream flex items-center justify-center">
          <span className="text-5xl">
            {item.category === 'donuts' ? '🍩' : item.category === 'drinks' ? '☕' : '🥞'}
          </span>
        </div>
      )}
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-dark">{item.name}</h3>
          <span className="font-bold text-primary">${item.price.toFixed(2)}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.description}</p>
        <button
          onClick={() => addItem({
            menu_item_id: item.id,
            name: item.name,
            price: item.price,
            image_url: item.image_url,
          })}
          disabled={!item.is_available}
          className="w-full py-2 rounded-lg font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400 bg-primary text-white hover:bg-primary-dark transition-colors"
        >
          {item.is_available ? 'Add to Cart' : 'Unavailable'}
        </button>
      </div>
    </div>
  );
}
