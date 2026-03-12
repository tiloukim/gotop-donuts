'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ADMIN_EMAIL } from '@/lib/constants'
import { LayoutDashboard, ShoppingBag, Users, Menu, X } from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag },
  { href: '/admin/customers', label: 'Customers', icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email === ADMIN_EMAIL) {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
        router.replace('/')
      }
    })
  }, [router])

  if (isAdmin === null) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="bg-gray-100 rounded-xl h-64 animate-pulse" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-gray-500 mt-2">Admin access required.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-50 p-3 bg-primary text-white rounded-full shadow-lg"
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/20 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40
          w-60 bg-white border-r border-gray-200 flex flex-col shrink-0
          transform transition-transform lg:transform-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Admin Panel</h2>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== '/admin' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
