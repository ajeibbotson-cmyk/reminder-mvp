'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Building2 } from 'lucide-react';

interface ProfessionalLoadingProps {
  /** Loading variant */
  variant?: 'spinner' | 'dots' | 'pulse' | 'branded';
  /** Size of the loading indicator */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Loading message to display */
  message?: string;
  /** Show Reminder branding */
  showBrand?: boolean;
  /** Additional className */
  className?: string;
}

interface LoadingSkeletonProps {
  /** Skeleton variant */
  variant?: 'card' | 'list' | 'table' | 'dashboard';
  /** Number of skeleton items */
  count?: number;
  /** Additional className */
  className?: string;
}

interface LoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading: boolean;
  /** Loading message */
  message?: string;
  /** Children to render when not loading */
  children: React.ReactNode;
  /** Additional className */
  className?: string;
}

// Professional Loading Spinner Component
export const ProfessionalLoading: React.FC<ProfessionalLoadingProps> = ({
  variant = 'spinner',
  size = 'md',
  message,
  showBrand = false,
  className
}) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const containerClasses = {
    sm: 'gap-2 text-sm',
    md: 'gap-3 text-base',
    lg: 'gap-4 text-lg',
    xl: 'gap-6 text-xl'
  };

  // Spinner variant (default)
  if (variant === 'spinner') {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center',
        containerClasses[size],
        className
      )}>
        <Loader2 className={cn(
          'animate-spin text-primary',
          sizeClasses[size]
        )} />
        {message && (
          <p className="text-muted-foreground font-medium animate-pulse">
            {message}
          </p>
        )}
        {showBrand && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
            <Building2 className="h-4 w-4" />
            <span>Reminder</span>
          </div>
        )}
      </div>
    );
  }

  // Dots variant
  if (variant === 'dots') {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center',
        containerClasses[size],
        className
      )}>
        <div className="flex space-x-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                'rounded-full bg-primary animate-pulse',
                size === 'sm' ? 'h-1.5 w-1.5' :
                size === 'md' ? 'h-2 w-2' :
                size === 'lg' ? 'h-3 w-3' : 'h-4 w-4'
              )}
              style={{
                animationDelay: `${i * 0.2}s`,
                animationDuration: '1.4s'
              }}
            />
          ))}
        </div>
        {message && (
          <p className="text-muted-foreground font-medium">
            {message}
          </p>
        )}
      </div>
    );
  }

  // Pulse variant
  if (variant === 'pulse') {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center',
        containerClasses[size],
        className
      )}>
        <div className={cn(
          'rounded-full bg-primary/20 animate-ping',
          sizeClasses[size]
        )}>
          <div className={cn(
            'rounded-full bg-primary animate-pulse',
            sizeClasses[size]
          )} />
        </div>
        {message && (
          <p className="text-muted-foreground font-medium">
            {message}
          </p>
        )}
      </div>
    );
  }

  // Branded variant with Emirates-inspired animation
  if (variant === 'branded') {
    return (
      <div className={cn(
        'flex flex-col items-center justify-center',
        containerClasses[size],
        className
      )}>
        <div className="relative">
          {/* Outer ring */}
          <div className={cn(
            'rounded-full border-4 border-primary/20 animate-spin',
            sizeClasses[size]
          )}
          style={{ animationDuration: '2s' }}
          />
          {/* Inner ring */}
          <div className={cn(
            'absolute inset-1 rounded-full border-4 border-accent/40 animate-spin',
            'border-t-accent border-r-transparent border-b-transparent border-l-transparent'
          )}
          style={{ animationDuration: '1.5s', animationDirection: 'reverse' }}
          />
          {/* Center dot */}
          <div className="absolute inset-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary animate-pulse" />
        </div>
        {message && (
          <p className="text-muted-foreground font-medium">
            {message}
          </p>
        )}
        <div className="flex items-center gap-2 text-muted-foreground text-sm mt-2">
          <Building2 className="h-4 w-4" />
          <span>Reminder</span>
        </div>
      </div>
    );
  }

  return null;
};

// Loading Skeleton Component
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'card',
  count = 1,
  className
}) => {
  const skeletonBase = "animate-pulse bg-muted rounded";

  if (variant === 'card') {
    return (
      <div className={cn('space-y-4', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-6 space-y-4">
            <div className={cn(skeletonBase, 'h-4 w-3/4')} />
            <div className={cn(skeletonBase, 'h-3 w-1/2')} />
            <div className="space-y-2">
              <div className={cn(skeletonBase, 'h-3 w-full')} />
              <div className={cn(skeletonBase, 'h-3 w-5/6')} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center space-x-4">
            <div className={cn(skeletonBase, 'h-10 w-10 rounded-full')} />
            <div className="space-y-2 flex-1">
              <div className={cn(skeletonBase, 'h-4 w-3/4')} />
              <div className={cn(skeletonBase, 'h-3 w-1/2')} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 p-4 border-b">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn(skeletonBase, 'h-4')} />
          ))}
        </div>
        {/* Table rows */}
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="grid grid-cols-4 gap-4 p-4">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className={cn(skeletonBase, 'h-3')} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'dashboard') {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-border rounded-lg p-6 space-y-4">
              <div className={cn(skeletonBase, 'h-4 w-1/2')} />
              <div className={cn(skeletonBase, 'h-8 w-3/4')} />
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div className="border border-border rounded-lg p-6">
          <div className={cn(skeletonBase, 'h-4 w-1/4 mb-4')} />
          <div className={cn(skeletonBase, 'h-64 w-full')} />
        </div>
      </div>
    );
  }

  return null;
};

// Loading Overlay Component
export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  isLoading,
  message = 'Loading...',
  children,
  className
}) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className={cn('relative', className)}>
      {/* Content with overlay */}
      <div className="opacity-50 pointer-events-none">
        {children}
      </div>

      {/* Loading overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <ProfessionalLoading
          variant="branded"
          size="lg"
          message={message}
          showBrand
        />
      </div>
    </div>
  );
};

// Export types for TypeScript users
export type { ProfessionalLoadingProps, LoadingSkeletonProps, LoadingOverlayProps };