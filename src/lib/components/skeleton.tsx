import { memo } from 'react'
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export const Skeleton = memo(function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-200",
        className
      )}
    />
  )
})

// Specific skeleton components for common UI patterns
export const CardSkeleton = memo(function CardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow p-6", className)}>
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    </div>
  )
})

export const TableSkeleton = memo(function TableSkeleton({
  rows = 5,
  columns = 4,
  className
}: SkeletonProps & { rows?: number; columns?: number }) {
  return (
    <div className={cn("bg-white rounded-lg shadow overflow-hidden", className)}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
      </div>

      {/* Table rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="px-6 py-4">
            <div className="flex items-center justify-between">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="flex-1 mr-4 last:mr-0">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
})

export const ProgressSkeleton = memo(function ProgressSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow", className)}>
      <div className="animate-pulse">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 bg-gray-200 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="h-6 bg-gray-200 rounded w-20"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        </div>

        {/* Progress section */}
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 bg-gray-200 rounded w-48"></div>
            <div className="h-4 bg-gray-200 rounded w-12"></div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-4"></div>
          <div className="h-3 bg-gray-200 rounded w-64"></div>
        </div>

        {/* Stats grid */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="text-center">
                <div className="h-8 bg-gray-200 rounded w-16 mx-auto mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-12 mx-auto"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

export const CampaignDetailsSkeleton = memo(function CampaignDetailsSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("container mx-auto px-4 py-8 max-w-6xl", className)}>
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-4 mb-2">
              <div className="h-5 w-5 bg-gray-200 rounded"></div>
              <div className="h-8 bg-gray-200 rounded w-64"></div>
              <div className="h-6 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-48"></div>
          </div>
          <div className="flex space-x-3">
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
        </div>

        {/* Progress Dashboard */}
        <div className="mb-8">
          <ProgressSkeleton />
        </div>

        {/* Campaign Details Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Main Details */}
          <div className="lg:col-span-2">
            <CardSkeleton className="mb-6" />
            <CardSkeleton />
          </div>

          {/* Settings Sidebar */}
          <div className="lg:col-span-1">
            <CardSkeleton className="mb-6" />
            <CardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
})

export const CampaignListSkeleton = memo(function CampaignListSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("container mx-auto px-4 py-8", className)}>
      <div className="animate-pulse">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-96"></div>
          </div>
          <div className="h-10 bg-gray-200 rounded w-32"></div>
        </div>

        {/* Analytics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <div className="w-6 h-6 bg-gray-200 rounded"></div>
                </div>
                <div className="ml-4 flex-1">
                  <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <TableSkeleton rows={6} columns={6} />
      </div>
    </div>
  )
})