import Link from 'next/link';
import { STORE_ADDRESS, STORE_PHONE, STORE_HOURS } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-lg font-bold mb-3">
            🍩 GoTop <span className="text-primary">Donuts</span>
          </h3>
          <p className="text-gray-400 text-sm">
            Fresh donuts & breakfast made daily in Tyler, TX.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Hours & Location</h4>
          <p className="text-gray-400 text-sm">{STORE_HOURS.days}</p>
          <p className="text-gray-400 text-sm">{STORE_HOURS.open} – {STORE_HOURS.close}</p>
          <p className="text-gray-400 text-sm mt-1">Closed {STORE_HOURS.closed}</p>
          <p className="text-gray-400 text-sm mt-3">{STORE_ADDRESS}</p>
          <p className="text-gray-400 text-sm">{STORE_PHONE}</p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Quick Links</h4>
          <div className="space-y-2">
            <Link href="/menu" className="block text-gray-400 hover:text-white text-sm">Menu</Link>
            <Link href="/rewards" className="block text-gray-400 hover:text-white text-sm">Rewards</Link>
            <Link href="/orders" className="block text-gray-400 hover:text-white text-sm">Order History</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800 py-4 text-center text-gray-500 text-sm">
        &copy; {new Date().getFullYear()} GoTop Donuts. All rights reserved.
      </div>
    </footer>
  );
}
