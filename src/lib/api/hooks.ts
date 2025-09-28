import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient, handleApiError } from './client'
import {
  CampaignsQueryParams,
  CreateCampaignRequest,
  SendCampaignRequest,
  Campaign,
  CampaignsListResponse,
  Invoice
} from './types'

// Enhanced Query Key Factories for Optimized Caching
export const queryKeys = {
  campaigns: {
    all: ['campaigns'] as const,
    lists: () => [...queryKeys.campaigns.all, 'list'] as const,
    list: (params?: CampaignsQueryParams) => [...queryKeys.campaigns.lists(), { ...params }] as const,
    details: () => [...queryKeys.campaigns.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.campaigns.details(), id] as const,
    progress: (id: string) => [...queryKeys.campaigns.detail(id), 'progress'] as const,
  },
  invoices: {
    all: ['invoices'] as const,
    lists: () => [...queryKeys.invoices.all, 'list'] as const,
    list: (params?: any) => [...queryKeys.invoices.lists(), { ...params }] as const,
    details: () => [...queryKeys.invoices.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.invoices.details(), id] as const,
  },
} as const

// Cache Configuration Constants
export const CACHE_TIMES = {
  // Campaign data - moderate change frequency
  CAMPAIGNS_LIST: 10 * 60 * 1000, // 10 minutes
  CAMPAIGN_DETAIL: 5 * 60 * 1000,  // 5 minutes

  // Invoice data - low change frequency
  INVOICES_LIST: 15 * 60 * 1000,   // 15 minutes
  INVOICE_DETAIL: 20 * 60 * 1000,  // 20 minutes

  // Progress data - high change frequency but still cacheable
  PROGRESS_DATA: 30 * 1000,        // 30 seconds
} as const

// Enhanced Campaign Hooks with Optimized Caching
export function useCampaigns(params?: CampaignsQueryParams) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.campaigns.list(params),
    queryFn: () => apiClient.getCampaigns(params),
    staleTime: CACHE_TIMES.CAMPAIGNS_LIST,
    gcTime: CACHE_TIMES.CAMPAIGNS_LIST * 2, // Keep in cache longer
    enabled: !!session,
    retry: (failureCount, error: any) => {
      // Don't retry auth errors
      if (error?.status === 401 || error?.status === 403) return false
      return failureCount < 2
    },
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    refetchOnMount: 'always', // Always refetch on mount for fresh data
  })
}

export function useCampaign(id: string, options?: { enabled?: boolean }) {
  const { data: session } = useSession()
  const { enabled = true } = options || {}

  return useQuery({
    queryKey: queryKeys.campaigns.detail(id),
    queryFn: () => apiClient.getCampaign(id),
    enabled: !!id && !!session && enabled,
    staleTime: CACHE_TIMES.CAMPAIGN_DETAIL,
    gcTime: CACHE_TIMES.CAMPAIGN_DETAIL * 2,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false
      if (error?.status === 404) return false // Don't retry missing campaigns
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
  })
}

export function useCreateCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) => apiClient.createCampaign(data),
    onSuccess: (result) => {
      // Optimistic update: add new campaign to cache
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() })

      // Pre-populate campaign detail cache with new campaign data
      if (result.campaignId) {
        queryClient.setQueryData(
          queryKeys.campaigns.detail(result.campaignId),
          { campaign: result }
        )
      }
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

// Enhanced Invoice Hooks
export function useInvoices(params?: {
  search?: string
  status?: string
  page?: number
  limit?: number
}) {
  const { data: session } = useSession()

  // Memoize query key to prevent unnecessary re-renders
  const queryKey = useMemo(() => queryKeys.invoices.list(params), [params])

  return useQuery({
    queryKey,
    queryFn: () => apiClient.getInvoices(params),
    staleTime: CACHE_TIMES.INVOICES_LIST,
    gcTime: CACHE_TIMES.INVOICES_LIST * 2,
    enabled: !!session,
    retry: (failureCount, error: any) => {
      if (error?.status === 401 || error?.status === 403) return false
      return failureCount < 2
    },
    refetchOnWindowFocus: false,
    keepPreviousData: true, // Keep showing previous data while loading new page
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

// Campaign Control Hooks with Optimistic Updates
export function useStartCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.startCampaign(id),
    onMutate: async (id: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.campaigns.detail(id) })

      // Snapshot previous value
      const previousCampaign = queryClient.getQueryData(queryKeys.campaigns.detail(id))

      // Optimistically update to sending status
      queryClient.setQueryData(queryKeys.campaigns.detail(id), (old: any) => {
        if (!old) return old
        return {
          ...old,
          campaign: {
            ...old.campaign,
            status: 'sending'
          }
        }
      })

      return { previousCampaign }
    },
    onError: (err, id, context) => {
      // Rollback on error
      if (context?.previousCampaign) {
        queryClient.setQueryData(queryKeys.campaigns.detail(id), context.previousCampaign)
      }
    },
    onSettled: (data, error, id) => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() })
    },
  })
}

export function usePauseCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.pauseCampaign(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.campaigns.detail(id) })
      const previousCampaign = queryClient.getQueryData(queryKeys.campaigns.detail(id))

      queryClient.setQueryData(queryKeys.campaigns.detail(id), (old: any) => {
        if (!old) return old
        return {
          ...old,
          campaign: {
            ...old.campaign,
            status: 'paused'
          }
        }
      })

      return { previousCampaign }
    },
    onError: (err, id, context) => {
      if (context?.previousCampaign) {
        queryClient.setQueryData(queryKeys.campaigns.detail(id), context.previousCampaign)
      }
    },
    onSettled: (data, error, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() })
    },
  })
}

export function useResumeCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => apiClient.resumeCampaign(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.campaigns.detail(id) })
      const previousCampaign = queryClient.getQueryData(queryKeys.campaigns.detail(id))

      queryClient.setQueryData(queryKeys.campaigns.detail(id), (old: any) => {
        if (!old) return old
        return {
          ...old,
          campaign: {
            ...old.campaign,
            status: 'sending'
          }
        }
      })

      return { previousCampaign }
    },
    onError: (err, id, context) => {
      if (context?.previousCampaign) {
        queryClient.setQueryData(queryKeys.campaigns.detail(id), context.previousCampaign)
      }
    },
    onSettled: (data, error, id) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.lists() })
    },
  })
}