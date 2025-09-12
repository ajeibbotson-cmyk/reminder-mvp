'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { LanguageToggle } from '@/components/navigation/language-toggle'
import UAEErrorBoundaryWrapper from '@/components/error-boundaries/uae-error-boundary'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Building2
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const t = useTranslations()
  const locale = useLocale()
  const { data: session } = useSession()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  
  const isRTL = locale === 'ar'

  const navigation = [
    {
      name: t('navigation.dashboard'),
      href: '/dashboard',
      icon: LayoutDashboard,
      current: pathname === '/dashboard'
    },
    {
      name: t('navigation.invoices'),
      href: '/dashboard/invoices',
      icon: FileText,
      current: pathname.startsWith('/dashboard/invoices')
    },
    {
      name: t('navigation.customers'),
      href: '/dashboard/customers',
      icon: Users,
      current: pathname.startsWith('/dashboard/customers')
    },
    {
      name: t('navigation.followUps'),
      href: '/dashboard/follow-ups',
      icon: MessageSquare,
      current: pathname.startsWith('/dashboard/follow-ups')
    },
    {
      name: t('navigation.reports'),
      href: '/dashboard/reports',
      icon: BarChart3,
      current: pathname.startsWith('/dashboard/reports')
    },
    {
      name: t('navigation.settings'),
      href: '/dashboard/settings',
      icon: Settings,
      current: pathname.startsWith('/dashboard/settings')
    }
  ]

  const handleSignOut = () => {
    signOut({ callbackUrl: '/' })
  }

  return (
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 lg:hidden',
          sidebarOpen ? 'block' : 'hidden'
        )}
      >
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
        <div
          className={cn(
            'fixed top-0 flex h-full w-64 flex-col bg-white shadow-xl',
            isRTL ? 'right-0' : 'left-0'
          )}
        >
          <div className={`flex items-center justify-between px-4 py-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="flex items-center gap-2">
              <Building2 className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold">UAEPay</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex-1 space-y-1 px-2 pb-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                  item.current
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  isRTL ? 'flex-row-reverse' : ''
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0',
                    item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
                    isRTL ? 'ml-3' : 'mr-3'
                  )}
                />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={cn('hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col', isRTL ? 'lg:right-0' : 'lg:left-0')}>
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200 pt-5 pb-4 overflow-y-auto">
          <div className="flex items-center flex-shrink-0 px-4">
            <Building2 className="h-8 w-8 text-blue-600" />
            <span className={`text-xl font-bold ${isRTL ? 'mr-2' : 'ml-2'}`}>UAEPay</span>
          </div>
          <div className="mt-5 flex-grow flex flex-col">
            <nav className="flex-1 px-2 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md',
                    item.current
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    isRTL ? 'flex-row-reverse' : ''
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 flex-shrink-0',
                      item.current ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500',
                      isRTL ? 'ml-3' : 'mr-3'
                    )}
                  />
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={cn('flex flex-col flex-1', isRTL ? 'lg:mr-64' : 'lg:ml-64')}>
        {/* Top navigation */}
        <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
          <div className={`flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              <div className={`lg:hidden ${isRTL ? 'mr-4' : 'ml-4'}`}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-6 w-6 text-blue-600" />
                  <span className="font-bold">UAEPay</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <LanguageToggle />
              
              {/* User menu */}
              <div className="flex items-center gap-3">
                <div className={`text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
                  <p className="font-medium text-gray-700">
                    {session?.user?.name}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {session?.user?.email}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <UAEErrorBoundaryWrapper>
            {children}
          </UAEErrorBoundaryWrapper>
        </main>
      </div>
    </div>
  )
}