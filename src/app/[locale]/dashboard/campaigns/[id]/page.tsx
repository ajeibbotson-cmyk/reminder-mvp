'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useCampaign, useStartCampaign, usePauseCampaign, useResumeCampaign } from '@/lib/api/hooks'
import { ProtectedRoute } from '@/lib/components/protected-route'
import { useAuthGuard } from '@/lib/hooks/use-auth-guard'
import { AuthNav } from '@/lib/components/auth-nav'
import { CampaignProgressDashboard } from '@/lib/components/campaign-progress-dashboard'
import { CampaignErrorBoundary, ProgressErrorBoundary } from '@/lib/components/error-boundary'
import { CampaignDetailsSkeleton } from '@/lib/components/skeleton'

export default function CampaignDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuthGuard()
  const campaignId = params?.id as string

  const {
    data: campaignData,
    isLoading,
    error: fetchError,
    refetch
  } = useCampaign(campaignId, {
    enabled: !!campaignId
  })

  const campaign = campaignData?.campaign

  // Use optimized mutation hooks with optimistic updates
  const startCampaignMutation = useStartCampaign()
  const pauseCampaignMutation = usePauseCampaign()
  const resumeCampaignMutation = useResumeCampaign()

  const handleStartCampaign = () => {
    if (!campaign || campaign.status !== 'draft') return
    startCampaignMutation.mutate(campaignId)
  }

  const handlePauseCampaign = () => {
    if (!campaign || campaign.status !== 'sending') return
    pauseCampaignMutation.mutate(campaignId)
  }

  const handleResumeCampaign = () => {
    if (!campaign || campaign.status !== 'paused') return
    resumeCampaignMutation.mutate(campaignId)
  }

  const handleCampaignComplete = () => {
    // Refetch campaign data when completion is detected
    refetch()
  }

  // Aggregate loading and error states from mutations
  const isStarting = startCampaignMutation.isPending
  const isPausing = pauseCampaignMutation.isPending
  const isResuming = resumeCampaignMutation.isPending
  const mutationError = startCampaignMutation.error || pauseCampaignMutation.error || resumeCampaignMutation.error

  if (fetchError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Failed to load campaign
          </div>
          <p className="text-gray-600 mb-4">
            There was an error loading the campaign details. Please try refreshing the page.
          </p>
          <Link
            href="/dashboard/campaigns"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Back to Campaigns
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading || !campaign) {
    return (
      <ProtectedRoute>
        <CampaignDetailsSkeleton />
      </ProtectedRoute>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'sending':
        return 'bg-blue-100 text-blue-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const canStart = campaign.status === 'draft'
  const canPause = campaign.status === 'sending'
  const canResume = campaign.status === 'paused'
  const isActive = campaign.status === 'sending' || campaign.status === 'paused'

  return (
    <ProtectedRoute>
      <CampaignErrorBoundary>
        <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Navigation */}
        <div className="flex justify-end mb-6">
          <AuthNav />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-4 mb-2">
              <Link
                href="/dashboard/campaigns"
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">
                {campaign.name}
              </h1>
              <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(campaign.status)}`}>
                {campaign.status.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600">
              Campaign created by {campaign.createdBy.name} on {new Date(campaign.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {canStart && (
              <button
                onClick={handleStartCampaign}
                disabled={isStarting}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStarting ? (
                  <>
                    <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Starting...
                  </>
                ) : (
                  'Start Campaign'
                )}
              </button>
            )}

            {canPause && (
              <button
                onClick={handlePauseCampaign}
                disabled={isPausing}
                className="px-6 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPausing ? (
                  <>
                    <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Pausing...
                  </>
                ) : (
                  'Pause Campaign'
                )}
              </button>
            )}

            {canResume && (
              <button
                onClick={handleResumeCampaign}
                disabled={isResuming}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResuming ? (
                  <>
                    <span className="inline-block w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Resuming...
                  </>
                ) : (
                  'Resume Campaign'
                )}
              </button>
            )}
          </div>
        </div>

        {/* Error Display */}
        {mutationError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <svg className="w-5 h-5 text-red-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-red-700">
                <strong>Error:</strong> {mutationError?.message || 'An error occurred'}
              </div>
            </div>
          </div>
        )}

        {/* Real-time Progress Dashboard */}
        {isActive && (
          <div className="mb-8">
            <ProgressErrorBoundary>
              <CampaignProgressDashboard
                campaignId={campaignId}
                onComplete={handleCampaignComplete}
                className="w-full"
              />
            </ProgressErrorBoundary>
          </div>
        )}

        {/* Campaign Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Details */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Recipients</label>
                  <p className="text-2xl font-semibold text-gray-900">{campaign.totalRecipients}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Success Rate</label>
                  <p className="text-2xl font-semibold text-gray-900">{campaign.successRate}%</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Emails Sent</label>
                  <p className="text-2xl font-semibold text-green-600">{campaign.sentCount}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Failed</label>
                  <p className="text-2xl font-semibold text-red-600">{campaign.failedCount}</p>
                </div>
              </div>

              {campaign.scheduledFor && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="text-sm font-medium text-gray-700">Scheduled For</label>
                  <p className="text-gray-900">{new Date(campaign.scheduledFor).toLocaleString()}</p>
                </div>
              )}
            </div>

            {/* Email Template Preview */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Email Template</h3>

              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700">Subject</label>
                <p className="text-gray-900 font-medium">{campaign.emailSubject}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Content</label>
                <div className="mt-2 p-4 bg-gray-50 rounded-md border">
                  <div className="prose prose-sm max-w-none">
                    {campaign.emailContent.split('\n').map((line, index) => (
                      <p key={index} className="mb-2 last:mb-0">
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Campaign Settings</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Language</label>
                  <p className="text-gray-900">{campaign.language === 'en' ? 'English' : 'Arabic'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Batch Size</label>
                  <p className="text-gray-900">{campaign.batchSize} emails per batch</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Delay Between Batches</label>
                  <p className="text-gray-900">{campaign.delayBetweenBatches} seconds</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Business Hours Only</label>
                  <p className="text-gray-900">{campaign.respectBusinessHours ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>

            {/* Invoice Count */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Related Invoices</h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {campaign.invoices?.length || 0}
                </div>
                <div className="text-sm text-gray-600">Invoices included</div>
              </div>

              {campaign.invoices && campaign.invoices.length > 0 && (
                <div className="mt-4">
                  <Link
                    href={`/dashboard/campaigns/${campaignId}/invoices`}
                    className="block w-full text-center px-4 py-2 bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
                  >
                    View Invoices
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </CampaignErrorBoundary>
    </ProtectedRoute>
  )
}