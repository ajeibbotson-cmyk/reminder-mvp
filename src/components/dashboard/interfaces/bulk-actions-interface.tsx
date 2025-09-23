// Sprint 3: Bulk Actions Interface
// Interface for managing multiple consolidation operations

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  X, Send, Calendar, Pause, Play, AlertTriangle,
  Clock, Settings, Check, Loader2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface BulkActionsInterfaceProps {
  selectedItems: string[]
  onAction: (action: string, itemIds: string[], parameters?: any) => Promise<void>
  onClose: () => void
  locale?: string
}

interface ActionConfig {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  variant: 'default' | 'secondary' | 'destructive'
  requiresParameters: boolean
  confirmationRequired: boolean
}

export function BulkActionsInterface({
  selectedItems,
  onAction,
  onClose,
  locale = 'en'
}: BulkActionsInterfaceProps) {
  const t = useTranslations('bulkActions')
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [parameters, setParameters] = useState<any>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [results, setResults] = useState<any>(null)

  const actions: ActionConfig[] = [
    {
      id: 'send',
      label: t('actions.send.label'),
      description: t('actions.send.description'),
      icon: <Send className="h-4 w-4" />,
      variant: 'default',
      requiresParameters: false,
      confirmationRequired: true
    },
    {
      id: 'schedule',
      label: t('actions.schedule.label'),
      description: t('actions.schedule.description'),
      icon: <Calendar className="h-4 w-4" />,
      variant: 'secondary',
      requiresParameters: true,
      confirmationRequired: false
    },
    {
      id: 'reschedule',
      label: t('actions.reschedule.label'),
      description: t('actions.reschedule.description'),
      icon: <Clock className="h-4 w-4" />,
      variant: 'secondary',
      requiresParameters: true,
      confirmationRequired: false
    },
    {
      id: 'update_priority',
      label: t('actions.updatePriority.label'),
      description: t('actions.updatePriority.description'),
      icon: <AlertTriangle className="h-4 w-4" />,
      variant: 'secondary',
      requiresParameters: true,
      confirmationRequired: false
    },
    {
      id: 'cancel',
      label: t('actions.cancel.label'),
      description: t('actions.cancel.description'),
      icon: <Pause className="h-4 w-4" />,
      variant: 'destructive',
      requiresParameters: true,
      confirmationRequired: true
    }
  ]

  const selectedActionConfig = actions.find(a => a.id === selectedAction)

  const handleParameterChange = (key: string, value: any) => {
    setParameters(prev => ({ ...prev, [key]: value }))
  }

  const handleExecute = async () => {
    if (!selectedAction) return

    const actionConfig = actions.find(a => a.id === selectedAction)
    if (actionConfig?.confirmationRequired && !showConfirmation) {
      setShowConfirmation(true)
      return
    }

    setIsProcessing(true)
    try {
      await onAction(selectedAction, selectedItems, parameters)
      setResults({
        action: selectedAction,
        itemCount: selectedItems.length,
        success: true
      })
    } catch (error) {
      setResults({
        action: selectedAction,
        itemCount: selectedItems.length,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsProcessing(false)
      setShowConfirmation(false)
    }
  }

  const renderParametersForm = () => {
    if (!selectedActionConfig?.requiresParameters) return null

    switch (selectedAction) {
      case 'schedule':
      case 'reschedule':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="scheduledFor">{t('parameters.scheduledFor.label')}</Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={parameters.scheduledFor || ''}
                onChange={(e) => handleParameterChange('scheduledFor', e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
              <p className="text-xs text-gray-600 mt-1">
                {t('parameters.scheduledFor.description')}
              </p>
            </div>
          </div>
        )

      case 'update_priority':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="priorityScore">{t('parameters.priority.label')}</Label>
              <Select
                value={parameters.priorityScore?.toString() || ''}
                onValueChange={(value) => handleParameterChange('priorityScore', parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('parameters.priority.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">{t('priority.low')} (20)</SelectItem>
                  <SelectItem value="50">{t('priority.medium')} (50)</SelectItem>
                  <SelectItem value="80">{t('priority.high')} (80)</SelectItem>
                  <SelectItem value="100">{t('priority.urgent')} (100)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="escalationLevel">{t('parameters.escalation.label')}</Label>
              <Select
                value={parameters.escalationLevel || ''}
                onValueChange={(value) => handleParameterChange('escalationLevel', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('parameters.escalation.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POLITE">{t('escalation.polite')}</SelectItem>
                  <SelectItem value="FIRM">{t('escalation.firm')}</SelectItem>
                  <SelectItem value="URGENT">{t('escalation.urgent')}</SelectItem>
                  <SelectItem value="FINAL">{t('escalation.final')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )

      case 'cancel':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">{t('parameters.reason.label')}</Label>
              <Textarea
                id="reason"
                value={parameters.reason || ''}
                onChange={(e) => handleParameterChange('reason', e.target.value)}
                placeholder={t('parameters.reason.placeholder')}
                rows={3}
              />
              <p className="text-xs text-gray-600 mt-1">
                {t('parameters.reason.description')}
              </p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  const isRTL = locale === 'ar'

  if (results) {
    return (
      <Dialog open={true} onOpenChange={onClose}>
        <DialogContent className={cn("max-w-md", isRTL && "text-right")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {results.success ? (
                <Check className="h-5 w-5 text-green-500" />
              ) : (
                <X className="h-5 w-5 text-red-500" />
              )}
              {results.success ? t('results.success.title') : t('results.error.title')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-gray-50">
              <p className="text-sm">
                {results.success
                  ? t('results.success.message', {
                      action: t(`actions.${results.action}.label`),
                      count: results.itemCount
                    })
                  : t('results.error.message', { error: results.error })
                }
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={onClose}>
                {t('close')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (showConfirmation) {
    return (
      <Dialog open={true} onOpenChange={() => setShowConfirmation(false)}>
        <DialogContent className={cn("max-w-md", isRTL && "text-right")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {t('confirmation.title')}
            </DialogTitle>
            <DialogDescription>
              {t('confirmation.message', {
                action: selectedActionConfig?.label,
                count: selectedItems.length
              })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setShowConfirmation(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              variant={selectedActionConfig?.variant}
              onClick={handleExecute}
              disabled={isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('confirm')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={cn("max-w-2xl", isRTL && "text-right")}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>
                {t('description', { count: selectedItems.length })}
              </DialogDescription>
            </div>
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Selected Items Summary */}
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="font-medium">{t('selectedItems')}</span>
              <Badge variant="outline">{selectedItems.length} {t('items')}</Badge>
            </div>
          </div>

          {/* Action Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{t('selectAction')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className={cn(
                    "p-4 border rounded-lg cursor-pointer transition-colors",
                    selectedAction === action.id
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                  onClick={() => setSelectedAction(action.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">{action.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-medium">{action.label}</h4>
                      <p className="text-sm text-gray-600 mt-1">{action.description}</p>
                      {action.requiresParameters && (
                        <Badge variant="outline" className="mt-2 text-xs">
                          {t('requiresParameters')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Parameters Form */}
          {selectedActionConfig?.requiresParameters && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">{t('parameters.title')}</h3>
                {renderParametersForm()}
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              variant={selectedActionConfig?.variant || 'default'}
              onClick={handleExecute}
              disabled={!selectedAction || isProcessing}
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {selectedActionConfig?.label || t('execute')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}