'use client'

import { useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useUserStore } from '@/lib/stores'

export function useAuth() {
  const { data: session, status } = useSession()
  const {
    currentUser,
    loading: userLoading,
    error,
    fetchCurrentUser,
    updateProfile,
    clearError
  } = useUserStore()

  const isAuthenticated = status === 'authenticated'
  const isLoading = status === 'loading' || userLoading

  const loadCurrentUser = useCallback(async () => {
    if (isAuthenticated && !currentUser) {
      try {
        await fetchCurrentUser()
      } catch (error) {
        console.error('Failed to load current user:', error)
      }
    }
  }, [isAuthenticated, currentUser, fetchCurrentUser])

  useEffect(() => {
    loadCurrentUser()
  }, [loadCurrentUser])

  return {
    user: currentUser,
    session,
    isAuthenticated,
    isLoading,
    error,
    updateProfile,
    clearError
  }
}