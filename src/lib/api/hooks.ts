import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient, handleApiError } from './client'
import {
  CampaignsQueryParams,
  CreateCampaignRequest,
  SendCampaignRequest,
  Campaign,
  CampaignsListResponse,
  Invoice
} from './types'

// Query Keys (for caching and invalidation)
export const queryKeys = {
  campaigns: {
    all: ['campaigns'] as const,
    lists: () => [...queryKeys.campaigns.all, 'list'] as const,
    list: (params?: CampaignsQueryParams) => [...queryKeys.campaigns.lists(), params] as const,
    details: () => [...queryKeys.campaigns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.campaigns.details(), id] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    lists: () => [...queryKeys.invoices.all, 'list'] as const,
    list: (params?: any) => [...queryKeys.invoices.lists(), params] as const,
  },
} as const

// Campaign Hooks
export function useCampaigns(params?: CampaignsQueryParams) {
  return useQuery({
    queryKey: queryKeys.campaigns.list(params),
    queryFn: () => apiClient.getCampaigns(params),
    staleTime: 30 * 1000, // 30 seconds for campaign lists
  })
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => apiClient.getCampaign(id),
    enabled: !!id, // Only run query if id exists
    staleTime: 10 * 1000, // 10 seconds for campaign details
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) => apiClient.createCampaign(data),
    onSuccess: () => {
      // Invalidate campaigns list to refetch with new campaign
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() })
    },
    onError: (error) => {
      console.error('Campaign creation failed:', handleApiError(error))
    },
  })
}

export function useSendCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SendCampaignRequest }) =>
      apiClient.sendCampaign(id, data),
    onSuccess: (_, variables) => {
      // Invalidate specific campaign to refetch updated status
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.detail(variables.id)
      })
      // Also invalidate campaigns list
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.lists()
      })
    },
    onError: (error) => {
      console.error('Campaign send failed:', handleApiError(error))
    },
  })
}

// Invoice Hooks
export function useInvoices(params?: {
  search?: string
  status?: string
  page?: number
  limit?: number
}) {
  return useQuery({
    queryKey: queryKeys.invoices.list(params),
    queryFn: () => apiClient.getInvoices(params),
    staleTime: 2 * 60 * 1000, // 2 minutes for invoice lists
  })
}

// Progress Monitoring Hook (Custom hook for Server-Sent Events)
export function useCampaignProgress(campaignId: string, enabled = true) {
  const [progress, setProgress] = useState<any>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !campaignId) {
      return
    }

    let eventSource: EventSource | null = null
    let retryCount = 0
    const maxRetries = 3

    const connect = () => {
      try {
        eventSource = apiClient.createProgressStream(campaignId)

        eventSource.onopen = () => {
          setConnected(true)
          setError(null)
          retryCount = 0
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            setProgress(data)
          } catch (e) {
            console.error('Failed to parse progress data:', e)
          }
        }

        eventSource.onerror = () => {
          setConnected(false)

          if (retryCount < maxRetries) {
            setTimeout(() => {
              retryCount++
              connect()
            }, Math.pow(2, retryCount) * 1000) // Exponential backoff
          } else {
            setError('Failed to connect to progress stream')
          }
        }

        // Handle specific event types
        eventSource.addEventListener('progress', (event) => {
          const data = JSON.parse(event.data)
          setProgress(data)
        })

        eventSource.addEventListener('completion', (event) => {
          const data = JSON.parse(event.data)
          setProgress(data)
          // Close connection on completion
          eventSource?.close()
          setConnected(false)
        })

        eventSource.addEventListener('error', (event) => {
          const data = JSON.parse(event.data)
          setError(data.error)
        })

      } catch (err) {
        setError('Failed to establish connection')
        setConnected(false)
      }
    }

    connect()

    // Cleanup function
    return () => {
      if (eventSource) {
        eventSource.close()
        setConnected(false)
      }
    }
  }, [campaignId, enabled])

  return {
    progress,
    connected,
    error,
  }
}

// Utility hooks for common operations
export function useInvalidateCampaigns() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all })
  }
}

export function useRefreshCampaign(id: string) {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) })
  }
}

// Import useState for the progress hook
import { useState, useEffect } from 'react'