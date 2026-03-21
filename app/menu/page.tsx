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
  const [searchQuery, setSearchQuery] = useState('');
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

  const filtered = items.filter((item) => {
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = !searchQuery && item.category === activeTab;
    return searchQuery ? matchesSearch : matchesTab;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-6">Our Menu</h1>

      {/* Search */}
      <div className="max-w-md mx-auto mb-6 relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search menu..."
          className="w-full pl-10 pr-8 py-2.5 border border-gray-200 rounded-full text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Category Tabs */}
      {!searchQuery && (
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
      )}
      {searchQuery && (
        <p className="text-center text-sm text-gray-500 mb-6">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
        </p>
      )}

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
