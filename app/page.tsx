import Link from 'next/link';

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="bg-cream">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-32 text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-dark mb-4">
            Fresh Donuts,{' '}
            <span className="text-primary">Made Daily</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            From classic glazed to creative specialties — order online for pickup or delivery in Tyler, TX.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/menu"
              className="bg-primary text-white px-8 py-4 rounded-xl text-lg font-semibold hover:bg-primary-dark transition-colors"
            >
              Order Now
            </Link>
            <Link
              href="/menu"
              className="border-2 border-dark text-dark px-8 py-4 rounded-xl text-lg font-semibold hover:bg-dark hover:text-white transition-colors"
            >
              View Menu
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🛒</div>
            <h3 className="text-xl font-bold mb-2">Order Online</h3>
            <p className="text-gray-600">Browse our full menu and order ahead for quick pickup or delivery.</p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🚗</div>
            <h3 className="text-xl font-bold mb-2">Pickup or Delivery</h3>
            <p className="text-gray-600">Pick up at our store or get your donuts delivered within 8 miles.</p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">⭐</div>
            <h3 className="text-xl font-bold mb-2">Earn Rewards</h3>
            <p className="text-gray-600">Earn 1 point per dollar. Redeem 100 points for $5 off your order.</p>
          </div>
        </div>
      </section>

      {/* Menu Preview */}
      <section className="bg-warm-gray py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-dark mb-2">Our Menu</h2>
          <p className="text-gray-600 mb-10">Something for every craving</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="text-5xl mb-4">🥞</div>
              <h3 className="text-xl font-bold mb-2">Breakfast</h3>
              <p className="text-gray-500 text-sm">Sandwiches, kolaches, and more</p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="text-5xl mb-4">🍩</div>
              <h3 className="text-xl font-bold mb-2">Donuts</h3>
              <p className="text-gray-500 text-sm">Classic, filled, and specialty</p>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-sm">
              <div className="text-5xl mb-4">☕</div>
              <h3 className="text-xl font-bold mb-2">Drinks</h3>
              <p className="text-gray-500 text-sm">Coffee, juice, and more</p>
            </div>
          </div>
          <Link
            href="/menu"
            className="inline-block mt-10 bg-primary text-white px-8 py-3 rounded-xl font-semibold hover:bg-primary-dark transition-colors"
          >
            View Full Menu
          </Link>
        </div>
      </section>

    </>
  );
}
