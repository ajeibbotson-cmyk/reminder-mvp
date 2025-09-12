'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Clock, 
  Play, 
  Pause, 
  RefreshCw,
  Zap,
  TrendingUp,
  BarChart
} from 'lucide-react'
import { Progress } from "./progress"
import { Badge } from "./badge"
import { Button } from "./button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card"
import { cn } from '@/lib/utils'

export type ProgressStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled'

export interface ProgressStep {
  id: string
  name: string
  description?: string
  status: ProgressStatus
  progress?: number
  startTime?: Date
  endTime?: Date
  duration?: number
  errors?: string[]
  metadata?: Record<string, any>
}

export interface AdvancedProgressProps {
  steps: ProgressStep[]
  currentStepId?: string
  overallProgress: number
  status: ProgressStatus
  title?: string
  description?: string
  showDetails?: boolean
  showTimings?: boolean
  showErrors?: boolean
  allowControl?: boolean
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onRetry?: (stepId: string) => void
  estimatedTimeRemaining?: number
  processingRate?: number
  locale?: string
  className?: string
}

export function AdvancedProgress({
  steps,
  currentStepId,
  overallProgress,
  status,
  title,
  description,
  showDetails = true,
  showTimings = true,
  showErrors = true,
  allowControl = false,
  onPause,
  onResume,
  onCancel,
  onRetry,
  estimatedTimeRemaining,
  processingRate,
  locale = 'en',
  className
}: AdvancedProgressProps) {
  const t = useTranslations('progress')
  const [elapsedTime, setElapsedTime] = useState(0)

  // Update elapsed time for running processes
  useEffect(() => {
    if (status === 'running') {
      const interval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)
      
      return () => clearInterval(interval)
    }
  }, [status])

  const getStatusIcon = (stepStatus: ProgressStatus) => {
    const iconProps = { className: "h-4 w-4" }
    
    switch (stepStatus) {
      case 'completed':
        return <CheckCircle {...iconProps} className="h-4 w-4 text-green-500" />
      case 'running':
        return <RefreshCw {...iconProps} className="h-4 w-4 text-blue-500 animate-spin" />
      case 'paused':
        return <Pause {...iconProps} className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <XCircle {...iconProps} className="h-4 w-4 text-red-500" />
      case 'cancelled':
        return <XCircle {...iconProps} className="h-4 w-4 text-gray-500" />
      default:
        return <Clock {...iconProps} className="h-4 w-4 text-gray-400" />
    }
  }

  const getStatusColor = (stepStatus: ProgressStatus) => {
    switch (stepStatus) {
      case 'completed': return 'green'
      case 'running': return 'blue'
      case 'paused': return 'yellow'
      case 'error': return 'red'
      case 'cancelled': return 'gray'
      default: return 'gray'
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
  }

  const formatRate = (rate?: number) => {
    if (!rate) return 'N/A'
    if (rate > 1) return `${Math.round(rate)} items/sec`
    return `${Math.round(rate * 60)} items/min`
  }

  const calculateStepProgress = (step: ProgressStep) => {
    if (step.status === 'completed') return 100
    if (step.status === 'error' || step.status === 'cancelled') return 0
    return step.progress || 0
  }

  const completedSteps = steps.filter(step => step.status === 'completed').length
  const errorSteps = steps.filter(step => step.status === 'error').length
  const currentStep = currentStepId ? steps.find(step => step.id === currentStepId) : null

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              {getStatusIcon(status)}
              {title || t('processingTitle')}
            </CardTitle>
            {description && (
              <CardDescription>{description}</CardDescription>
            )}
          </div>
          
          {allowControl && (
            <div className="flex items-center gap-2">
              {status === 'running' && onPause && (
                <Button variant="outline" size="sm" onClick={onPause}>
                  <Pause className="h-4 w-4 mr-2" />
                  {t('pause')}
                </Button>
              )}
              
              {status === 'paused' && onResume && (
                <Button variant="outline" size="sm" onClick={onResume}>
                  <Play className="h-4 w-4 mr-2" />
                  {t('resume')}
                </Button>
              )}
              
              {(status === 'running' || status === 'paused') && onCancel && (
                <Button variant="destructive" size="sm" onClick={onCancel}>
                  <XCircle className="h-4 w-4 mr-2" />
                  {t('cancel')}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{t('overallProgress')}</span>
            <span>{Math.round(overallProgress)}%</span>
          </div>
          <Progress 
            value={overallProgress} 
            className={cn("h-3", {
              "progress-error": status === 'error',
              "progress-success": status === 'completed'
            })} 
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <div className="text-2xl font-bold">{completedSteps}</div>
            <div className="text-xs text-gray-500">{t('completed')}</div>
          </div>
          
          <div className="space-y-1">
            <div className="text-2xl font-bold">{steps.length - completedSteps}</div>
            <div className="text-xs text-gray-500">{t('remaining')}</div>
          </div>
          
          {showTimings && (
            <>
              <div className="space-y-1">
                <div className="text-2xl font-bold">{formatDuration(elapsedTime)}</div>
                <div className="text-xs text-gray-500">{t('elapsed')}</div>
              </div>
              
              <div className="space-y-1">
                <div className="text-2xl font-bold">
                  {estimatedTimeRemaining ? formatDuration(estimatedTimeRemaining) : '--'}
                </div>
                <div className="text-xs text-gray-500">{t('remaining')}</div>
              </div>
            </>
          )}
        </div>

        {/* Processing Rate */}
        {processingRate && (
          <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">{t('processingRate')}</span>
            </div>
            <Badge variant="secondary">
              {formatRate(processingRate)}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <TrendingUp className="h-3 w-3" />
              <span>{t('efficient')}</span>
            </div>
          </div>
        )}

        {/* Current Step */}
        {currentStep && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="font-medium">{t('currentStep')}</span>
            </div>
            <div className="text-sm">
              <div className="font-medium">{currentStep.name}</div>
              {currentStep.description && (
                <div className="text-gray-600 mt-1">{currentStep.description}</div>
              )}
            </div>
            {currentStep.progress !== undefined && (
              <Progress 
                value={currentStep.progress} 
                className="mt-2 h-2" 
              />
            )}
          </div>
        )}

        {/* Step Details */}
        {showDetails && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              {t('stepDetails')}
            </h4>
            
            <div className="space-y-2">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-colors",
                    step.id === currentStepId && "bg-blue-50 border-blue-200",
                    step.status === 'error' && "bg-red-50 border-red-200"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getStatusIcon(step.status)}
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{step.name}</div>
                      {step.description && (
                        <div className="text-sm text-gray-600 truncate">
                          {step.description}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {step.status === 'running' && step.progress !== undefined && (
                      <div className="text-sm text-gray-600">
                        {Math.round(step.progress)}%
                      </div>
                    )}
                    
                    <Badge variant={
                      step.status === 'completed' ? 'default' :
                      step.status === 'error' ? 'destructive' :
                      step.status === 'running' ? 'secondary' :
                      'outline'
                    }>
                      {t(step.status)}
                    </Badge>
                    
                    {showTimings && step.duration && (
                      <div className="text-xs text-gray-500">
                        {formatDuration(step.duration)}
                      </div>
                    )}
                    
                    {step.status === 'error' && onRetry && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRetry(step.id)}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        {t('retry')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Summary */}
        {showErrors && errorSteps > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="font-medium text-red-700">
                {t('errorsFound', { count: errorSteps })}
              </span>
            </div>
            
            <div className="space-y-2">
              {steps
                .filter(step => step.status === 'error' && step.errors)
                .map(step => (
                  <div key={step.id} className="text-sm">
                    <div className="font-medium">{step.name}:</div>
                    <ul className="list-disc list-inside text-red-600 ml-2">
                      {step.errors!.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Utility function for creating progress steps
export function createProgressStep(
  id: string,
  name: string,
  options: Partial<Omit<ProgressStep, 'id' | 'name'>> = {}
): ProgressStep {
  return {
    id,
    name,
    status: 'idle',
    progress: 0,
    ...options
  }
}

// Hook for managing progress state
export function useProgressManager(initialSteps: ProgressStep[]) {
  const [steps, setSteps] = useState<ProgressStep[]>(initialSteps)
  const [currentStepId, setCurrentStepId] = useState<string>()
  const [overallStatus, setOverallStatus] = useState<ProgressStatus>('idle')

  const updateStep = (stepId: string, updates: Partial<ProgressStep>) => {
    setSteps(prev => prev.map(step => 
      step.id === stepId 
        ? { ...step, ...updates }
        : step
    ))
  }

  const startStep = (stepId: string) => {
    updateStep(stepId, { 
      status: 'running', 
      startTime: new Date(),
      progress: 0 
    })
    setCurrentStepId(stepId)
  }

  const completeStep = (stepId: string) => {
    updateStep(stepId, { 
      status: 'completed', 
      endTime: new Date(),
      progress: 100 
    })
    
    // Move to next step or complete overall process
    const currentIndex = steps.findIndex(step => step.id === stepId)
    const nextStep = steps[currentIndex + 1]
    
    if (nextStep) {
      setCurrentStepId(nextStep.id)
    } else {
      setCurrentStepId(undefined)
      setOverallStatus('completed')
    }
  }

  const failStep = (stepId: string, errors: string[]) => {
    updateStep(stepId, { 
      status: 'error', 
      endTime: new Date(),
      errors 
    })
    setOverallStatus('error')
  }

  const getOverallProgress = () => {
    const completedSteps = steps.filter(step => step.status === 'completed').length
    return (completedSteps / steps.length) * 100
  }

  return {
    steps,
    currentStepId,
    overallStatus,
    overallProgress: getOverallProgress(),
    updateStep,
    startStep,
    completeStep,
    failStep,
    setOverallStatus
  }
}