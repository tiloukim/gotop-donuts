'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useCartStore } from '@/lib/cart-store';
import CartDrawer from './CartDrawer';
import type { User } from '@supabase/supabase-js';

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const itemCount = useCartStore((s) => s.getItemCount());

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-24 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo-header.png" alt="GoTop Donuts" width={280} height={96} className="h-20 w-auto" priority />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/menu" className="text-gray-700 hover:text-primary font-medium">
              Menu
            </Link>
            {user && (
              <>
                <Link href="/orders" className="text-gray-700 hover:text-primary font-medium">
                  Orders
                </Link>
                <Link href="/rewards" className="text-gray-700 hover:text-primary font-medium">
                  Rewards
                </Link>
              </>
            )}
            <button
              onClick={() => setCartOpen(true)}
              className="relative text-gray-700 hover:text-primary"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {mounted && itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
            {user ? (
              <Link href="/account" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark font-medium">
                Account
              </Link>
            ) : (
              <Link href="/login" className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark font-medium">
                Sign In
              </Link>
            )}
          </nav>

          {/* Mobile */}
          <div className="flex md:hidden items-center gap-3">
            <button
              onClick={() => setCartOpen(true)}
              className="relative text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {mounted && itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="text-gray-700">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden border-t bg-white px-4 py-3 space-y-2">
            <Link href="/menu" className="block py-2 text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Menu</Link>
            {user && (
              <>
                <Link href="/orders" className="block py-2 text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Orders</Link>
                <Link href="/rewards" className="block py-2 text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Rewards</Link>
                <Link href="/account" className="block py-2 text-gray-700 font-medium" onClick={() => setMenuOpen(false)}>Account</Link>
              </>
            )}
            {!user && (
              <Link href="/login" className="block py-2 text-primary font-medium" onClick={() => setMenuOpen(false)}>Sign In</Link>
            )}
          </nav>
        )}
      </header>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
