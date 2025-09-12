import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

// Specialized skeleton components for UAE business context
export function InvoiceTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-4 w-24" /> {/* Invoice Number */}
          <Skeleton className="h-4 w-32" /> {/* Customer */}
          <Skeleton className="h-4 w-20" /> {/* Amount */}
          <Skeleton className="h-4 w-24" /> {/* Due Date */}
          <Skeleton className="h-6 w-16 rounded-full" /> {/* Status Badge */}
          <div className="ml-auto flex space-x-2">
            <Skeleton className="h-8 w-16" /> {/* Action Button */}
            <Skeleton className="h-8 w-16" /> {/* Action Button */}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CustomerTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-10 w-10 rounded-full" /> {/* Avatar */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" /> {/* Name */}
            <Skeleton className="h-3 w-48" /> {/* Email */}
          </div>
          <Skeleton className="h-4 w-24" /> {/* TRN */}
          <Skeleton className="h-4 w-20" /> {/* Total Outstanding */}
          <Skeleton className="h-8 w-16" /> {/* Action Button */}
        </div>
      ))}
    </div>
  )
}

export function DashboardCardSkeleton() {
  return (
    <div className="p-6 border rounded-lg space-y-3">
      <Skeleton className="h-4 w-32" /> {/* Title */}
      <Skeleton className="h-8 w-24" /> {/* Amount */}
      <Skeleton className="h-3 w-40" /> {/* Description */}
    </div>
  )
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Input */}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" /> {/* Label */}
        <Skeleton className="h-10 w-full" /> {/* Input */}
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" /> {/* Label */}
        <Skeleton className="h-20 w-full" /> {/* Textarea */}
      </div>
      <div className="flex justify-end space-x-2">
        <Skeleton className="h-10 w-20" /> {/* Cancel Button */}
        <Skeleton className="h-10 w-16" /> {/* Submit Button */}
      </div>
    </div>
  )
}

export { Skeleton }