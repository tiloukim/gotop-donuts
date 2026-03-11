import Link from 'next/link';
import { STORE_ADDRESS, STORE_PHONE, STORE_HOURS } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="bg-dark text-white">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 md:gap-8">
        <div className="text-center sm:text-left">
          <h3 className="text-lg font-bold mb-2">
            🍩 GoTop <span className="text-primary">Donuts</span>
          </h3>
          <p className="text-gray-400 text-sm">
            Fresh donuts & breakfast made daily in Tyler, TX.
          </p>
        </div>
        <div className="text-center sm:text-left">
          <h4 className="font-semibold mb-2">Hours & Location</h4>
          <p className="text-gray-400 text-sm">{STORE_HOURS.days}</p>
          <p className="text-gray-400 text-sm">{STORE_HOURS.open} – {STORE_HOURS.close}</p>
          <p className="text-gray-400 text-sm mt-2">{STORE_ADDRESS}</p>
          <a href={`tel:${STORE_PHONE.replace(/[^0-9]/g, '')}`} className="text-gray-400 hover:text-white text-sm">
            {STORE_PHONE}
          </a>
        </div>
        <div className="text-center sm:text-left">
          <h4 className="font-semibold mb-2">Quick Links</h4>
          <div className="flex justify-center sm:justify-start gap-4 sm:flex-col sm:gap-2">
            <Link href="/menu" className="text-gray-400 hover:text-white text-sm">Menu</Link>
            <Link href="/rewards" className="text-gray-400 hover:text-white text-sm">Rewards</Link>
            <Link href="/orders" className="text-gray-400 hover:text-white text-sm">Orders</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800 py-3 text-center text-gray-500 text-xs px-4">
        &copy; {new Date().getFullYear()} GoTop Donuts. All rights reserved.
      </div>
    </footer>
  );
}
