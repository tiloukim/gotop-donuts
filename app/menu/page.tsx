'use client';

import { useState, useEffect } from 'react';
import MenuItemCard from '@/components/MenuItemCard';
import type { MenuItem, MenuCategory } from '@/lib/types';

const TABS: { label: string; value: MenuCategory }[] = [
  { label: 'Breakfast', value: 'breakfast' },
  { label: 'Donuts', value: 'donuts' },
  { label: 'Drinks', value: 'drinks' },
];

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeTab, setActiveTab] = useState<MenuCategory>('donuts');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/menu')
      .then((r) => r.json())
      .then((data) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = items.filter((item) => item.category === activeTab);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Our Menu</h1>

      {/* Category Tabs */}
      <div className="flex justify-center gap-2 mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-6 py-2 rounded-full font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-56 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-gray-500 py-12">No items available in this category yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <MenuItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
