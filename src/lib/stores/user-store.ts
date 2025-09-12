import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { User } from '@prisma/client'
import { UserState, UserWithCompany, ApiResponse } from '../types/store'

export const useUserStore = create<UserState>()(
  devtools(
    (set) => ({
      currentUser: null,
      loading: false,
      error: null,

      fetchCurrentUser: async () => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/me')
          
          if (!response.ok) {
            throw new Error(`Failed to fetch user data: ${response.statusText}`)
          }

          const result: ApiResponse<UserWithCompany> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch user data')
          }

          set({ 
            currentUser: result.data || null, 
            loading: false 
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false, currentUser: null })
          throw error
        }
      },

      updateProfile: async (updates) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          })

          if (!response.ok) {
            throw new Error(`Failed to update profile: ${response.statusText}`)
          }

          const result: ApiResponse<User> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to update profile')
          }

          // Update the user in local state
          set(state => ({
            currentUser: state.currentUser ? { 
              ...state.currentUser, 
              ...updates 
            } : null,
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'user-store',
    }
  )
)