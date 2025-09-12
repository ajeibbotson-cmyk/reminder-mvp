'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Wifi } from 'lucide-react'

interface QueryErrorBoundaryProps {
  error: Error
  retry?: () => void
  children?: React.ReactNode
}

export function QueryErrorBoundary({ error, retry, children }: QueryErrorBoundaryProps) {
  const isNetworkError = error.message.toLowerCase().includes('network') || 
                         error.message.toLowerCase().includes('fetch')

  const getErrorMessage = () => {
    if (isNetworkError) {
      return 'Unable to connect to the server. Please check your internet connection.'
    }

    if (error.message.includes('404')) {
      return 'The requested resource could not be found.'
    }

    if (error.message.includes('403') || error.message.includes('401')) {
      return 'You do not have permission to access this resource.'
    }

    if (error.message.includes('500')) {
      return 'Server error occurred. Please try again later.'
    }

    return 'An unexpected error occurred while loading data.'
  }

  const getErrorIcon = () => {
    if (isNetworkError) {
      return <Wifi className="h-5 w-5" />
    }
    return <AlertTriangle className="h-5 w-5" />
  }

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600">
          {getErrorIcon()}
          Error Loading Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-gray-600 text-sm">
          {getErrorMessage()}
        </p>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-700">
              Technical Details
            </summary>
            <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
              {error.message}
            </pre>
          </details>
        )}
        
        {retry && (
          <Button onClick={retry} variant="outline" size="sm" className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}

        {children}
      </CardContent>
    </Card>
  )
}