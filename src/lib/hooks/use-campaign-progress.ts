'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { apiClient } from '@/lib/api/client'

interface ProgressData {
  campaignId: string
  sentCount: number
  failedCount: number
  currentBatch?: number
  totalBatches?: number
  percentComplete: number
  lastEmailTo?: string
  estimatedTimeRemaining?: string
  status: string
  totalRecipients: number
}

interface UseCampaignProgressOptions {
  enabled?: boolean
  pollInterval?: number // Fallback polling interval in ms
  maxRetries?: number
  retryDelay?: number
}

interface UseCampaignProgressReturn {
  progress: ProgressData | null
  isConnected: boolean
  isPolling: boolean
  error: string | null
  connectionAttempts: number
  lastUpdated: Date | null
  forceReconnect: () => void
  startPolling: () => void
  stopPolling: () => void
}

export function useCampaignProgress(
  campaignId: string,
  options: UseCampaignProgressOptions = {}
): UseCampaignProgressReturn {
  const {
    enabled = true,
    pollInterval = 3000, // 3 seconds fallback polling
    maxRetries = 5,
    retryDelay = 1000
  } = options

  const { data: session } = useSession()

  // State management
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionAttempts, setConnectionAttempts] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)

  // Clear all timers and connections
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    setIsConnected(false)
    setIsPolling(false)
  }, [])

  // Polling fallback function
  const startPolling = useCallback(async () => {
    if (!session || !campaignId || isPolling) return

    console.log(`[Progress] Starting polling fallback for campaign ${campaignId}`)
    setIsPolling(true)
    setError(null)

    const poll = async () => {
      try {
        const campaignData = await apiClient.getCampaign(campaignId)
        const progressData: ProgressData = {
          campaignId: campaignData.campaign.id,
          sentCount: campaignData.campaign.progress.sentCount,
          failedCount: campaignData.campaign.progress.failedCount,
          currentBatch: campaignData.campaign.progress.currentBatch,
          totalBatches: campaignData.campaign.progress.totalBatches,
          percentComplete: campaignData.campaign.progress.percentComplete,
          estimatedTimeRemaining: campaignData.campaign.progress.estimatedTimeRemaining,
          status: campaignData.campaign.status,
          totalRecipients: campaignData.campaign.progress.totalRecipients,
          lastEmailTo: campaignData.campaign.progress.lastEmailSentAt
        }

        setProgress(progressData)
        setLastUpdated(new Date())
        setError(null)

        // Stop polling if campaign is completed
        if (progressData.status === 'completed' || progressData.status === 'failed') {
          stopPolling()
        }
      } catch (err) {
        console.error('[Progress] Polling error:', err)
        setError('Failed to fetch progress updates')
      }
    }

    // Initial poll
    await poll()

    // Set up interval
    pollingIntervalRef.current = setInterval(poll, pollInterval)
  }, [session, campaignId, isPolling, pollInterval])

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    setIsPolling(false)
    console.log(`[Progress] Stopped polling for campaign ${campaignId}`)
  }, [campaignId])

  // SSE connection function
  const connectSSE = useCallback(() => {
    if (!session || !campaignId || eventSourceRef.current) return

    try {
      console.log(`[Progress] Attempting SSE connection for campaign ${campaignId} (attempt ${reconnectAttemptsRef.current + 1})`)

      const eventSource = apiClient.createProgressStream(campaignId)
      eventSourceRef.current = eventSource
      setConnectionAttempts(prev => prev + 1)
      reconnectAttemptsRef.current += 1

      eventSource.onopen = () => {
        console.log(`[Progress] SSE connected for campaign ${campaignId}`)
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        // Stop polling if we successfully connect to SSE
        stopPolling()
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setProgress(data)
          setLastUpdated(new Date())
        } catch (e) {
          console.error('[Progress] Failed to parse SSE data:', e)
        }
      }

      eventSource.onerror = (event) => {
        console.error('[Progress] SSE error:', event)
        setIsConnected(false)

        // Close the connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close()
          eventSourceRef.current = null
        }

        // Retry logic with exponential backoff
        if (reconnectAttemptsRef.current < maxRetries) {
          const delay = Math.min(retryDelay * Math.pow(2, reconnectAttemptsRef.current), 30000) // Max 30s
          console.log(`[Progress] Retrying SSE connection in ${delay}ms`)

          retryTimeoutRef.current = setTimeout(() => {
            connectSSE()
          }, delay)
        } else {
          console.log(`[Progress] Max SSE retries reached, falling back to polling`)
          setError('Connection failed, using backup updates')
          startPolling()
        }
      }

      // Handle specific event types
      eventSource.addEventListener('progress', (event) => {
        try {
          const data = JSON.parse(event.data)
          setProgress(data)
          setLastUpdated(new Date())
        } catch (e) {
          console.error('[Progress] Failed to parse progress event:', e)
        }
      })

      eventSource.addEventListener('completion', (event) => {
        try {
          const data = JSON.parse(event.data)
          setProgress(data)
          setLastUpdated(new Date())
          // Close connection on completion
          cleanup()
        } catch (e) {
          console.error('[Progress] Failed to parse completion event:', e)
        }
      })

      eventSource.addEventListener('error', (event) => {
        try {
          const data = JSON.parse(event.data)
          setError(data.error)
        } catch (e) {
          setError('An error occurred during progress monitoring')
        }
      })

    } catch (err) {
      console.error('[Progress] Failed to create SSE connection:', err)
      setError('Failed to establish connection')
      // Fall back to polling immediately if SSE fails to initialize
      startPolling()
    }
  }, [session, campaignId, maxRetries, retryDelay, startPolling, stopPolling, cleanup])

  // Force reconnect function
  const forceReconnect = useCallback(() => {
    console.log(`[Progress] Force reconnecting for campaign ${campaignId}`)
    cleanup()
    reconnectAttemptsRef.current = 0
    setError(null)

    // Try SSE first, fall back to polling if it fails
    setTimeout(() => {
      connectSSE()
    }, 1000)
  }, [cleanup, connectSSE, campaignId])

  // Main effect for connection management
  useEffect(() => {
    if (!enabled || !session || !campaignId) {
      cleanup()
      return
    }

    // Start with SSE, fall back to polling if needed
    connectSSE()

    // Cleanup on unmount or dependency change
    return cleanup
  }, [enabled, session, campaignId, connectSSE, cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Handle page visibility changes (reconnect when page becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && enabled && session && campaignId) {
        // Reconnect when page becomes visible
        forceReconnect()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [enabled, session, campaignId, forceReconnect])

  return {
    progress,
    isConnected,
    isPolling,
    error,
    connectionAttempts,
    lastUpdated,
    forceReconnect,
    startPolling,
    stopPolling
  }
}