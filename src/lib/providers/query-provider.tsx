'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

interface QueryProviderProps {
  children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Conservative default stale time (can be overridden per query)
            staleTime: 5 * 60 * 1000, // 5 minutes
            // Longer garbage collection time for better UX
            gcTime: 15 * 60 * 1000, // 15 minutes
            // Smart retry strategy
            retry: (failureCount, error: any) => {
              // Never retry auth errors
              if (error?.status === 401 || error?.status === 403) return false
              // Never retry client errors (400-499)
              if (error?.status >= 400 && error?.status < 500) return false
              // Retry server errors up to 2 times with exponential backoff
              return failureCount < 2
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Performance optimizations
            refetchOnWindowFocus: false, // Prevent excessive refetches
            refetchOnMount: true, // Always fetch fresh data on component mount
            refetchOnReconnect: 'always', // Refetch when network reconnects
            // No automatic background refetching (use query-specific intervals)
            refetchInterval: false,
            // Network mode for better offline experience
            networkMode: 'online',
          },
          mutations: {
            // No automatic retry for mutations (user should explicitly retry)
            retry: false,
            // Network mode for mutations
            networkMode: 'online',
          },
        },
        // Global error handling
        mutationCache: {
          onError: (error: any, variables, context, mutation) => {
            console.error('Mutation error:', {
              error: error?.message || error,
              mutationKey: mutation.options.mutationKey,
              variables,
            })
          },
        },
        queryCache: {
          onError: (error: any, query) => {
            // Only log non-auth errors to avoid spam
            if (error?.status !== 401 && error?.status !== 403) {
              console.error('Query error:', {
                error: error?.message || error,
                queryKey: query.queryKey,
              })
            }
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools
        initialIsOpen={false}
        position="bottom-right"
      />
    </QueryClientProvider>
  )
}