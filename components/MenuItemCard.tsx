'use client';

import { useState } from 'react';
import { useCartStore } from '@/lib/cart-store';
import type { MenuItem } from '@/lib/types';

export default function MenuItemCard({ item, compact }: { item: MenuItem; compact?: boolean }) {
  const addItem = useCartStore((s) => s.addItem);
  const hasVariants = item.variants && item.variants.length > 0;

  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
    if (!hasVariants) return {};
    const initial: Record<string, string> = {};
    for (const v of item.variants!) {
      initial[v.name] = '';
    }
    return initial;
  });

  const allSelected = !hasVariants || Object.values(selectedVariants).every(v => v !== '');

  function handleAdd() {
    addItem({
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      image_url: item.image_url,
      ...(hasVariants && { selectedVariants: { ...selectedVariants } }),
    });
    // Reset selections after adding
    if (hasVariants) {
      const reset: Record<string, string> = {};
      for (const v of item.variants!) reset[v.name] = '';
      setSelectedVariants(reset);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {item.image_url ? (
        <div className={`${compact ? 'h-32' : 'h-48'} bg-cream flex items-center justify-center overflow-hidden`}>
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`${compact ? 'h-32' : 'h-48'} bg-cream flex items-center justify-center`}>
          <span className={compact ? 'text-4xl' : 'text-5xl'}>
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

        {hasVariants && (
          <div className="space-y-2 mb-3">
            {item.variants!.map((variant) => (
              <div key={variant.name}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{variant.name}</label>
                <select
                  value={selectedVariants[variant.name] || ''}
                  onChange={(e) =>
                    setSelectedVariants((prev) => ({ ...prev, [variant.name]: e.target.value }))
                  }
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">Select {variant.name.toLowerCase()}</option>
                  {variant.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={!item.is_available || !allSelected}
          className="w-full py-2 rounded-lg font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400 bg-primary text-white hover:bg-primary-dark transition-colors"
        >
          {!item.is_available ? 'Unavailable' : !allSelected ? 'Select Options' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
