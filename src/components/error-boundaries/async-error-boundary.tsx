'use client'

import React, { useState, useEffect } from 'react'
import { ErrorBoundary } from './error-boundary'
import { QueryErrorBoundary } from './query-error-boundary'

interface AsyncErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error) => void
}

export function AsyncErrorBoundary({ children, fallback, onError }: AsyncErrorBoundaryProps) {
  const [asyncError, setAsyncError] = useState<Error | null>(null)

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))
      setAsyncError(error)
      onError?.(error)
      event.preventDefault() // Prevent the error from being logged to console
    }

    const handleError = (event: ErrorEvent) => {
      const error = event.error instanceof Error ? event.error : new Error(event.message)
      setAsyncError(error)
      onError?.(error)
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    window.addEventListener('error', handleError)

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
      window.removeEventListener('error', handleError)
    }
  }, [onError])

  const handleRetry = () => {
    setAsyncError(null)
  }

  if (asyncError) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <QueryErrorBoundary 
        error={asyncError} 
        retry={handleRetry}
      />
    )
  }

  return (
    <ErrorBoundary 
      fallback={fallback}
      onError={onError}
    >
      {children}
    </ErrorBoundary>
  )
}