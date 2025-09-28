'use client'

import { useCampaignProgress } from '@/lib/hooks/use-campaign-progress'
import { useState } from 'react'

interface CampaignProgressDashboardProps {
  campaignId: string
  onComplete?: () => void
  className?: string
}

export function CampaignProgressDashboard({
  campaignId,
  onComplete,
  className = ''
}: CampaignProgressDashboardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const {
    progress,
    isConnected,
    isPolling,
    error,
    connectionAttempts,
    lastUpdated,
    forceReconnect
  } = useCampaignProgress(campaignId, {
    enabled: true,
    pollInterval: 3000,
    maxRetries: 5
  })

  // Handle completion callback
  if (progress?.status === 'completed' && onComplete) {
    onComplete()
  }

  const formatDuration = (timeString?: string) => {
    if (!timeString) return 'Calculating...'
    return timeString
  }

  const formatTime = (date: Date | null) => {
    if (!date) return 'Never'
    return new Intl.DateTimeFormat('en-AE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(date)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      case 'sending':
        return 'text-blue-600 bg-blue-100'
      case 'paused':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getConnectionStatus = () => {
    if (error) {
      return { text: 'Connection Error', color: 'text-red-600', icon: '❌' }
    }
    if (isConnected) {
      return { text: 'Live Updates', color: 'text-green-600', icon: '🟢' }
    }
    if (isPolling) {
      return { text: 'Backup Updates', color: 'text-yellow-600', icon: '🟡' }
    }
    return { text: 'Connecting...', color: 'text-gray-600', icon: '⚫' }
  }

  const connectionStatus = getConnectionStatus()

  if (!progress) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-300 rounded w-full mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Campaign Progress
            </h3>
            <p className="text-sm text-gray-600">
              Campaign ID: {campaignId}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            {/* Status Badge */}
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(progress.status)}`}>
              {progress.status.toUpperCase()}
            </span>

            {/* Connection Status */}
            <div className="flex items-center space-x-2">
              <span className={`text-xs ${connectionStatus.color}`}>
                {connectionStatus.icon} {connectionStatus.text}
              </span>
              {error && (
                <button
                  onClick={forceReconnect}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-900">
            {progress.sentCount} of {progress.totalRecipients} emails sent
          </span>
          <span className="text-sm text-gray-600">
            {progress.percentComplete}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              progress.status === 'completed'
                ? 'bg-green-600'
                : progress.status === 'failed'
                ? 'bg-red-600'
                : 'bg-blue-600'
            }`}
            style={{ width: `${Math.min(progress.percentComplete, 100)}%` }}
          />
        </div>

        {progress.status === 'sending' && progress.estimatedTimeRemaining && (
          <div className="mt-2 text-sm text-gray-600">
            Estimated time remaining: {formatDuration(progress.estimatedTimeRemaining)}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="px-6 py-4 bg-gray-50">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {progress.sentCount}
            </div>
            <div className="text-xs text-gray-600">Sent</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">
              {progress.failedCount}
            </div>
            <div className="text-xs text-gray-600">Failed</div>
          </div>

          {progress.currentBatch && progress.totalBatches && (
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {progress.currentBatch}/{progress.totalBatches}
              </div>
              <div className="text-xs text-gray-600">Batches</div>
            </div>
          )}

          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {((progress.sentCount / progress.totalRecipients) * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600">Success Rate</div>
          </div>
        </div>
      </div>

      {/* Expandable Details */}
      <div className="px-6 py-4 border-t border-gray-200">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-sm text-gray-600 hover:text-gray-900"
        >
          <span>Technical Details</span>
          <svg
            className={`w-4 h-4 transform transition-transform ${
              isExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Connection Type:</span>
              <span className="font-medium">
                {isConnected ? 'Server-Sent Events' : isPolling ? 'Polling Fallback' : 'Disconnected'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Connection Attempts:</span>
              <span className="font-medium">{connectionAttempts}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated:</span>
              <span className="font-medium">{formatTime(lastUpdated)}</span>
            </div>

            {progress.lastEmailTo && (
              <div className="flex justify-between">
                <span className="text-gray-600">Last Email To:</span>
                <span className="font-medium text-xs">{progress.lastEmailTo}</span>
              </div>
            )}

            {error && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                <div className="text-red-700 text-xs">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Completion Message */}
      {progress.status === 'completed' && (
        <div className="px-6 py-4 bg-green-50 border-t border-green-200">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-green-700">
              Campaign completed successfully!
            </span>
          </div>
        </div>
      )}

      {/* Failed Message */}
      {progress.status === 'failed' && (
        <div className="px-6 py-4 bg-red-50 border-t border-red-200">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium text-red-700">
              Campaign failed. Check error logs for details.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}