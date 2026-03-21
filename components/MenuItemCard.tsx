'use client';

import { useState } from 'react';
import { useCartStore } from '@/lib/cart-store';
import type { MenuItem, VariantOption } from '@/lib/types';

export default function MenuItemCard({ item }: { item: MenuItem }) {
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

  // Get the active price based on selected variant
  function getActivePrice(): number {
    if (!hasVariants) return item.price;
    // Find the first variant group with a selected option that has a price
    for (const v of item.variants!) {
      const selectedName = selectedVariants[v.name];
      if (selectedName) {
        const opt = v.options.find(
          (o): o is VariantOption => typeof o === 'object' && o.name === selectedName
        );
        if (opt && opt.price > 0) return opt.price;
      }
    }
    return item.price;
  }

  // Get the price range for display when nothing is selected
  function getPriceDisplay(): string {
    if (!hasVariants) return `$${item.price.toFixed(2)}`;
    // If a variant is selected, show that price
    if (allSelected) return `$${getActivePrice().toFixed(2)}`;
    // Show price range
    const allPrices: number[] = [];
    for (const v of item.variants!) {
      for (const o of v.options) {
        const p = typeof o === 'object' ? o.price : 0;
        if (p > 0) allPrices.push(p);
      }
    }
    if (allPrices.length === 0) return `$${item.price.toFixed(2)}`;
    const min = Math.min(...allPrices);
    const max = Math.max(...allPrices);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  }

  function handleAdd() {
    const price = getActivePrice();
    addItem({
      menu_item_id: item.id,
      name: item.name,
      price,
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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
      {item.image_url ? (
        <div className="h-32 bg-cream flex items-center justify-center overflow-hidden">
          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="h-32 bg-cream flex items-center justify-center">
          <span className="text-4xl">
            {item.category === 'donuts' ? '🍩' : item.category === 'drinks' ? '☕' : '🥞'}
          </span>
        </div>
      )}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-dark">{item.name}</h3>
          <span className="font-bold text-primary whitespace-nowrap ml-2">{getPriceDisplay()}</span>
        </div>
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.description}</p>

        {hasVariants && (
          <div className="space-y-2 mb-3 mt-auto">
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
                  {variant.options.map((opt) => {
                    const optName = typeof opt === 'string' ? opt : opt.name;
                    const optPrice = typeof opt === 'object' && opt.price > 0 ? ` — $${opt.price.toFixed(2)}` : '';
                    return (
                      <option key={optName} value={optName}>
                        {optName}{optPrice}
                      </option>
                    );
                  })}
                </select>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAdd}
          disabled={!item.is_available || !allSelected}
          className={`w-full py-2 rounded-lg font-medium text-sm disabled:bg-gray-200 disabled:text-gray-400 bg-primary text-white hover:bg-primary-dark transition-colors ${!hasVariants ? 'mt-auto' : ''}`}
        >
          {!item.is_available ? 'Unavailable' : !allSelected ? 'Select Options' : `Add to Cart — $${getActivePrice().toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
