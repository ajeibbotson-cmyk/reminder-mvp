import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Activity } from '@prisma/client'
import { ActivityState, ApiResponse } from '../types/store'

export const useActivityStore = create<ActivityState>()(
  devtools(
    (set) => ({
      activities: [],
      loading: false,
      error: null,

      fetchActivities: async (companyId: string, limit = 50) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/activities?companyId=${companyId}&limit=${limit}`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch activities: ${response.statusText}`)
          }

          const result: ApiResponse<Activity[]> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch activities')
          }

          set({ 
            activities: result.data || [], 
            loading: false 
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      logActivity: async (activityData) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/activities', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(activityData),
          })

          if (!response.ok) {
            throw new Error(`Failed to log activity: ${response.statusText}`)
          }

          const result: ApiResponse<Activity> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to log activity')
          }

          const newActivity = result.data!
          
          // Add the new activity to the top of the list
          set(state => ({
            activities: [newActivity, ...state.activities],
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
      name: 'activity-store',
    }
  )
)