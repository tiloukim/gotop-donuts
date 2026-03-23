'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { STORE_ADDRESS, STORE_PHONE, STORE_HOURS } from '@/lib/constants';

export default function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;

  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-4 py-10 flex flex-col items-center text-center gap-4">
        <h4 className="font-semibold">Hours & Location</h4>
        <p className="text-gray-400 text-sm">{STORE_HOURS.days} &middot; {STORE_HOURS.open} – {STORE_HOURS.close}</p>
        <p className="text-gray-400 text-sm">{STORE_ADDRESS}</p>
        <a href={`tel:${STORE_PHONE.replace(/[^0-9]/g, '')}`} className="text-gray-400 hover:text-white text-sm">
          {STORE_PHONE}
        </a>
        <div className="flex gap-6 mt-2">
          <Link href="/menu" className="text-gray-400 hover:text-white text-sm">Menu</Link>
          <Link href="/rewards" className="text-gray-400 hover:text-white text-sm">Rewards</Link>
          <Link href="/orders" className="text-gray-400 hover:text-white text-sm">Orders</Link>
        </div>
      </div>
      {/* Partner Section */}
      <div className="border-t border-gray-800 py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center gap-2">
          <p className="text-gray-500 text-xs">Partner with</p>
          <a href="https://donutdash.app" target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity">
            <img src="/donutdash-logo.png" alt="DonutDash" className="h-30 object-contain" />
          </a>
        </div>
      </div>

      <div className="border-t border-gray-800 py-3 text-center text-gray-500 text-xs px-4">
        &copy; {new Date().getFullYear()} Top Donuts. All rights reserved.
      </div>
    </footer>
  );
}
