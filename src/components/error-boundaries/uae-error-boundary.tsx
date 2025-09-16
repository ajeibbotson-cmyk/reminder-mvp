'use client'

import React, { Component, ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, RefreshCw, Phone, Mail } from 'lucide-react'
import { logError } from '@/lib/errors'
import { useLocale, useTranslations } from 'next-intl'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  locale?: string
}

interface State {
  hasError: boolean
  error?: Error
}

// Error messages in both languages
const ERROR_MESSAGES = {
  en: {
    title: 'Something went wrong',
    subtitle: 'We encountered an unexpected error',
    description: 'An unexpected error occurred while processing your request. Our team has been notified and is working to resolve this issue.',
    businessImpact: 'If this affects your business operations, please contact our UAE support team immediately.',
    tryAgain: 'Try Again',
    contactSupport: 'Contact Support',
    supportHours: 'UAE Business Hours: 8:00 AM - 6:00 PM GST',
    supportPhone: '+971-4-XXX-XXXX',
    supportEmail: 'support@reminder.ae',
    errorId: 'Error ID',
    timestamp: 'Time'
  },
  ar: {
    title: 'حدث خطأ ما',
    subtitle: 'واجهنا خطأ غير متوقع',
    description: 'حدث خطأ غير متوقع أثناء معالجة طلبك. تم إشعار فريقنا ونعمل على حل هذه المشكلة.',
    businessImpact: 'إذا كان هذا يؤثر على عمليات شركتك، يرجى الاتصال بفريق الدعم الإماراتي على الفور.',
    tryAgain: 'حاول مرة أخرى',
    contactSupport: 'اتصل بالدعم',
    supportHours: 'ساعات العمل الإماراتية: 8:00 ص - 6:00 م بتوقيت الخليج',
    supportPhone: '+971-4-XXX-XXXX',
    supportEmail: 'support@reminder.ae',
    errorId: 'معرف الخطأ',
    timestamp: 'الوقت'
  }
}

export class UAEErrorBoundary extends Component<Props, State> {
  private errorId: string

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
    this.errorId = this.generateErrorId()
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error with UAE-specific context
    logError('UAE Error Boundary', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: this.constructor.name,
      errorId: this.errorId,
      timestamp: new Date().toISOString(),
      locale: this.props.locale || 'en',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
    })

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  generateErrorId(): string {
    return `UAE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  handleRetry = () => {
    this.errorId = this.generateErrorId()
    this.setState({ hasError: false, error: undefined })
  }

  handleContactSupport = () => {
    const subject = `Reminder Error Report - ${this.errorId}`
    const body = `Error ID: ${this.errorId}\nTimestamp: ${new Date().toISOString()}\nUser Agent: ${typeof window !== 'undefined' ? navigator.userAgent : 'server'}\n\nPlease describe what you were doing when this error occurred:`
    window.open(`mailto:support@reminder.ae?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const locale = this.props.locale || 'en'
      const isRTL = locale === 'ar'
      const messages = ERROR_MESSAGES[locale as keyof typeof ERROR_MESSAGES]

      return (
        <div className={`min-h-screen bg-gray-50 py-8 px-4 ${isRTL ? 'rtl' : 'ltr'}`}>
          <Card className="max-w-2xl mx-auto">
            <CardHeader className={`text-center ${isRTL ? 'text-right' : 'text-left'}`}>
              <CardTitle className="flex items-center gap-3 text-red-600 text-xl justify-center">
                <AlertTriangle className="h-6 w-6" />
                {messages.title}
              </CardTitle>
              <p className="text-gray-500 font-medium">{messages.subtitle}</p>
            </CardHeader>
            <CardContent className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
              {/* Main Error Description */}
              <div className="space-y-3">
                <p className="text-gray-700">{messages.description}</p>
                <p className="text-orange-600 font-medium bg-orange-50 p-3 rounded-lg">
                  {messages.businessImpact}
                </p>
              </div>

              {/* Error Details */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-600">{messages.errorId}:</span>
                  <span className="font-mono text-gray-800">{this.errorId}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-gray-600">{messages.timestamp}:</span>
                  <span className="text-gray-800">{new Date().toLocaleString(locale === 'ar' ? 'ar-AE' : 'en-US')}</span>
                </div>
              </div>

              {/* Support Information */}
              <div className="border-t pt-4 space-y-3">
                <h4 className="font-semibold text-gray-800">{messages.contactSupport}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{messages.supportPhone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{messages.supportEmail}</span>
                  </div>
                  <p className="text-gray-500 text-xs">{messages.supportHours}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={this.handleRetry} className="flex-1">
                  <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {messages.tryAgain}
                </Button>
                <Button onClick={this.handleContactSupport} variant="outline" className="flex-1">
                  <Mail className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                  {messages.contactSupport}
                </Button>
              </div>

              {/* Development Error Details */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-6">
                  <summary className="cursor-pointer text-sm font-medium text-gray-500 hover:text-gray-700 mb-2">
                    Error Details (Development Only)
                  </summary>
                  <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Wrapper component to use with hooks
export default function UAEErrorBoundaryWrapper(props: Omit<Props, 'locale'>) {
  const locale = useLocale()
  
  return <UAEErrorBoundary {...props} locale={locale} />
}