'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: Array<string | number>
  resetOnPropsChange?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console and call custom error handler
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)

    // In production, you might want to log to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Example: logErrorToService(error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys, resetOnPropsChange } = this.props
    const { hasError } = this.state

    // If we're in an error state and resetKeys have changed, reset the error boundary
    if (hasError && prevProps.resetKeys !== resetKeys) {
      const prevResetKeys = prevProps.resetKeys || []
      const currentResetKeys = resetKeys || []

      if (prevResetKeys.length !== currentResetKeys.length ||
          prevResetKeys.some((key, index) => key !== currentResetKeys[index])) {
        this.resetErrorBoundary()
      }
    }

    // Reset on any prop change if specified
    if (hasError && resetOnPropsChange && prevProps !== this.props) {
      this.resetErrorBoundary()
    }
  }

  resetErrorBoundary = () => {
    // Clear any existing timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }

    // Reset after a brief delay to allow React to finish current operations
    this.resetTimeoutId = window.setTimeout(() => {
      this.setState({ hasError: false, error: null })
    }, 100)
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default fallback UI
      return (
        <div className="min-h-[200px] flex items-center justify-center bg-red-50 border border-red-200 rounded-lg p-8">
          <div className="text-center">
            <div className="text-red-600 mb-4">
              <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-red-900">Something went wrong</h3>
            </div>
            <p className="text-red-700 mb-4 max-w-md">
              An unexpected error occurred. Please try refreshing the page or contact support if the problem persists.
            </p>
            <button
              onClick={this.resetErrorBoundary}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook version for functional components
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null)

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  return { captureError, resetError }
}

// Higher-order component for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Specific error boundaries for different sections
export const CampaignErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    fallback={
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-red-900 font-medium">Campaign Error</h4>
            <p className="text-red-700 text-sm">Unable to load campaign data. Please refresh the page.</p>
          </div>
        </div>
      </div>
    }
    onError={(error, errorInfo) => {
      console.error('Campaign component error:', error, errorInfo)
    }}
  >
    {children}
  </ErrorBoundary>
)

export const ProgressErrorBoundary = ({ children }: { children: ReactNode }) => (
  <ErrorBoundary
    fallback={
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-yellow-900 font-medium">Progress Monitoring Unavailable</h4>
            <p className="text-yellow-700 text-sm">Real-time progress updates are temporarily unavailable.</p>
          </div>
        </div>
      </div>
    }
    onError={(error, errorInfo) => {
      console.error('Progress monitoring error:', error, errorInfo)
    }}
  >
    {children}
  </ErrorBoundary>
)