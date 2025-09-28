// Performance monitoring utilities for production observability

interface PerformanceMetric {
  name: string
  value: number
  timestamp: number
  metadata?: Record<string, any>
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private isEnabled: boolean = process.env.NODE_ENV === 'production'

  // Core Web Vitals monitoring
  public initWebVitals() {
    if (!this.isEnabled || typeof window === 'undefined') return

    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          const lastEntry = entries[entries.length - 1]
          this.recordMetric('LCP', lastEntry.startTime, {
            url: window.location.pathname
          })
        })
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          entries.forEach((entry: any) => {
            this.recordMetric('FID', entry.processingStart - entry.startTime, {
              url: window.location.pathname
            })
          })
        })
        fidObserver.observe({ entryTypes: ['first-input'] })

        // Cumulative Layout Shift (CLS)
        let clsValue = 0
        const clsObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value
            }
          })
          this.recordMetric('CLS', clsValue, {
            url: window.location.pathname
          })
        })
        clsObserver.observe({ entryTypes: ['layout-shift'] })

      } catch (error) {
        console.warn('Performance monitoring initialization failed:', error)
      }
    }
  }

  // Navigation timing
  public recordPageLoad() {
    if (!this.isEnabled || typeof window === 'undefined') return

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming

        if (navigation) {
          this.recordMetric('TTFB', navigation.responseStart - navigation.requestStart, {
            url: window.location.pathname
          })

          this.recordMetric('DOMContentLoaded', navigation.domContentLoadedEventStart - navigation.navigationStart, {
            url: window.location.pathname
          })

          this.recordMetric('Load', navigation.loadEventStart - navigation.navigationStart, {
            url: window.location.pathname
          })
        }
      }, 0)
    })
  }

  // Custom metrics for business logic
  public recordMetric(name: string, value: number, metadata?: Record<string, any>) {
    if (!this.isEnabled) return

    const metric: PerformanceMetric = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    }

    this.metrics.push(metric)

    // Log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance Metric: ${name} = ${value}ms`, metadata)
    }

    // In production, you would send to analytics service
    this.sendToAnalytics(metric)
  }

  // React Query performance tracking
  public trackQueryPerformance(queryKey: any[], duration: number, success: boolean) {
    this.recordMetric('Query', duration, {
      queryKey: JSON.stringify(queryKey),
      success,
      type: 'react-query'
    })
  }

  // Component render performance
  public trackComponentRender(componentName: string, duration: number) {
    this.recordMetric('Render', duration, {
      component: componentName,
      type: 'component-render'
    })
  }

  // SSE connection performance
  public trackSSEConnection(campaignId: string, connectionTime: number, success: boolean) {
    this.recordMetric('SSE_Connection', connectionTime, {
      campaignId,
      success,
      type: 'sse-connection'
    })
  }

  // API response times
  public trackAPICall(endpoint: string, duration: number, status: number) {
    this.recordMetric('API_Call', duration, {
      endpoint,
      status,
      success: status >= 200 && status < 300,
      type: 'api-call'
    })
  }

  // Send metrics to analytics service (placeholder)
  private sendToAnalytics(metric: PerformanceMetric) {
    // In production, implement your analytics service integration
    // Examples: Google Analytics, DataDog, New Relic, custom analytics

    // Example implementation:
    // if (window.gtag) {
    //   window.gtag('event', 'performance_metric', {
    //     metric_name: metric.name,
    //     metric_value: metric.value,
    //     custom_parameter_1: metric.metadata?.url
    //   })
    // }
  }

  // Get performance summary for debugging
  public getMetricsSummary(): Record<string, { avg: number, count: number, latest: number }> {
    const summary: Record<string, { values: number[], latest: number }> = {}

    this.metrics.forEach(metric => {
      if (!summary[metric.name]) {
        summary[metric.name] = { values: [], latest: 0 }
      }
      summary[metric.name].values.push(metric.value)
      summary[metric.name].latest = metric.value
    })

    const result: Record<string, { avg: number, count: number, latest: number }> = {}
    Object.entries(summary).forEach(([name, data]) => {
      result[name] = {
        avg: data.values.reduce((sum, val) => sum + val, 0) / data.values.length,
        count: data.values.length,
        latest: data.latest
      }
    })

    return result
  }

  // Clear old metrics (prevent memory leaks)
  public clearOldMetrics(maxAge: number = 5 * 60 * 1000) { // 5 minutes
    const now = Date.now()
    this.metrics = this.metrics.filter(metric => now - metric.timestamp < maxAge)
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor()

// React hook for component performance measurement
export function usePerformanceTracking(componentName: string) {
  const startTime = performance.now()

  return {
    trackRender: () => {
      const duration = performance.now() - startTime
      performanceMonitor.trackComponentRender(componentName, duration)
    }
  }
}

// Higher-order component for automatic performance tracking
export function withPerformanceTracking<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = (props: P) => {
    const { trackRender } = usePerformanceTracking(
      componentName || Component.displayName || Component.name || 'Unknown'
    )

    React.useEffect(() => {
      trackRender()
    })

    return React.createElement(Component, props)
  }

  WrappedComponent.displayName = `withPerformanceTracking(${componentName || Component.displayName || Component.name})`

  return WrappedComponent
}

// Initialize performance monitoring
export function initializePerformanceMonitoring() {
  performanceMonitor.initWebVitals()
  performanceMonitor.recordPageLoad()

  // Clean up old metrics every 5 minutes
  if (typeof window !== 'undefined') {
    setInterval(() => {
      performanceMonitor.clearOldMetrics()
    }, 5 * 60 * 1000)
  }
}

// Export for manual usage
export { PerformanceMonitor }

// React import (needed for withPerformanceTracking)
import React from 'react'