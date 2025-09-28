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
            // Stale time for server state (5 minutes)
            staleTime: 5 * 60 * 1000,
            // Cache time before garbage collection (10 minutes)
            gcTime: 10 * 60 * 1000,
            // Retry failed requests
            retry: (failureCount, error: any) => {
              // Don't retry on 4xx errors (client errors)
              if (error?.status >= 400 && error?.status < 500) {
                return false
              }
              // Retry up to 3 times for 5xx errors
              return failureCount < 3
            },
            // Refetch on window focus for real-time data
            refetchOnWindowFocus: true,
            // Background refetch interval (2 minutes)
            refetchInterval: 2 * 60 * 1000,
          },
          mutations: {
            retry: false, // Don't retry mutations automatically
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