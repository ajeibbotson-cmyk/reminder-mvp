'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export function AuthNav() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-32 bg-gray-300 rounded"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex items-center space-x-4">
        <Link
          href="/en/auth/signin"
          className="text-gray-600 hover:text-gray-900"
        >
          Sign In
        </Link>
        <Link
          href="/en/auth/signup"
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Sign Up
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center space-x-4">
      <div className="text-sm text-gray-600">
        Welcome, {session.user?.name || session.user?.email}
      </div>

      {session.user?.companyId && (
        <div className="text-xs text-gray-500 px-2 py-1 bg-gray-100 rounded">
          Company: {session.user.company?.name || 'Unknown'}
        </div>
      )}

      <button
        onClick={() => signOut({ callbackUrl: '/en/auth/signin' })}
        className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
      >
        Sign Out
      </button>
    </div>
  )
}