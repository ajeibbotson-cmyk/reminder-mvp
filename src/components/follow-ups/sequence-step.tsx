'use client'

import { useState, useEffect } from 'react'
import { 
  Save, 
  X, 
  Mail, 
  Timer, 
  Target, 
  Zap, 
  Clock, 
  Calendar, 
  Globe, 
  Languages, 
  Shield,
  Eye,
  AlertCircle,
  CheckCircle,
  Settings,
  MessageSquare,
  FileText,
  Send
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from '@/lib/utils'

interface SequenceStepProps {
  step: BuilderStep
  templates: any[]
  onUpdate: (step: BuilderStep) => void
  onClose: () => void
}

interface BuilderStep {
  id: string
  order: number
  type: 'EMAIL' | 'WAIT' | 'CONDITION' | 'ACTION'
  name: string
  description?: string
  config: {
    // Email step config
    templateId?: string
    subject?: string
    customContent?: string
    language?: 'ENGLISH' | 'ARABIC' | 'BOTH'
    
    // Wait step config
    delay?: number
    delayUnit?: 'HOURS' | 'DAYS' | 'WEEKS'
    businessHoursOnly?: boolean
    avoidWeekends?: boolean
    avoidHolidays?: boolean
    avoidPrayerTimes?: boolean
    
    // Condition step config
    conditionType?: string
    conditionValue?: any
    
    // Action step config
    actionType?: string
    actionConfig?: any
  }
  uaeSettings: {
    respectBusinessHours: boolean
    honorPrayerTimes: boolean
    respectHolidays: boolean
    culturalTone: 'GENTLE' | 'PROFESSIONAL' | 'FIRM' | 'URGENT'
  }
  isValid?: boolean
  errors?: string[]
}

export function SequenceStep({ step, templates, onUpdate, onClose }: SequenceStepProps) {
  const [localStep, setLocalStep] = useState<BuilderStep>(step)
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [previewMode, setPreviewMode] = useState<'english' | 'arabic'>('english')

  useEffect(() => {
    setLocalStep(step)
    if (step.config.templateId) {
      const template = templates.find(t => t.id === step.config.templateId)
      setSelectedTemplate(template)
    }
  }, [step, templates])

  const handleSave = () => {
    onUpdate(localStep)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const updateConfig = (updates: any) => {
    setLocalStep(prev => ({
      ...prev,
      config: { ...prev.config, ...updates }
    }))
  }

  const updateUAESettings = (updates: any) => {
    setLocalStep(prev => ({
      ...prev,
      uaeSettings: { ...prev.uaeSettings, ...updates }
    }))
  }

  const delayUnits = [
    { value: 'HOURS', label: 'Hours', description: 'Wait time in hours' },
    { value: 'DAYS', label: 'Days', description: 'Wait time in days (most common)' },
    { value: 'WEEKS', label: 'Weeks', description: 'Wait time in weeks' }
  ]

  const culturalTones = [
    { 
      value: 'GENTLE', 
      label: 'Gentle', 
      description: 'Soft, understanding approach',
      color: 'green',
      icon: '💌'
    },
    { 
      value: 'PROFESSIONAL', 
      label: 'Professional', 
      description: 'Business-like, respectful tone',
      color: 'blue',
      icon: '📋'
    },
    { 
      value: 'FIRM', 
      label: 'Firm', 
      description: 'Direct but still respectful',
      color: 'orange',
      icon: '⚠️'
    },
    { 
      value: 'URGENT', 
      label: 'Urgent', 
      description: 'Immediate action required',
      color: 'red',
      icon: '🔔'
    }
  ]

  const conditionTypes = [
    { value: 'PAYMENT_STATUS', label: 'Payment Status', description: 'Check if payment received' },
    { value: 'INVOICE_AGE', label: 'Invoice Age', description: 'Check days since invoice created' },
    { value: 'CUSTOMER_RESPONSE', label: 'Customer Response', description: 'Check if customer responded' },
    { value: 'AMOUNT_THRESHOLD', label: 'Amount Threshold', description: 'Check invoice amount' },
    { value: 'CUSTOMER_TYPE', label: 'Customer Type', description: 'Check customer category' }
  ]

  const actionTypes = [
    { value: 'NOTIFY_MANAGER', label: 'Notify Manager', description: 'Send notification to account manager' },
    { value: 'CREATE_TASK', label: 'Create Task', description: 'Create follow-up task' },
    { value: 'UPDATE_STATUS', label: 'Update Status', description: 'Change invoice status' },
    { value: 'ESCALATE_LEGAL', label: 'Legal Escalation', description: 'Escalate to legal department' },
    { value: 'MARK_FOR_COLLECTION', label: 'Mark for Collection', description: 'Flag for collection agency' }
  ]

  const renderEmailConfiguration = () => (
    <div className="space-y-6">
      {/* Template Selection */}
      <div>
        <Label className="text-base font-medium mb-4 block">Email Template Configuration</Label>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="templateChoice">Choose Template Method</Label>
            <RadioGroup 
              value={localStep.config.templateId ? 'existing' : 'custom'}
              onValueChange={(value) => {
                if (value === 'existing') {
                  updateConfig({ customContent: undefined })
                } else {
                  updateConfig({ templateId: undefined })
                  setSelectedTemplate(null)
                }
              }}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing">Use Existing Template</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom">Write Custom Email</Label>
              </div>
            </RadioGroup>
          </div>

          {localStep.config.templateId !== undefined ? (
            <div>
              <Label htmlFor="template">Select Email Template</Label>
              <Select 
                value={localStep.config.templateId || ''} 
                onValueChange={(value) => {
                  updateConfig({ templateId: value })
                  const template = templates.find(t => t.id === value)
                  setSelectedTemplate(template)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter(t => t.templateType === 'FOLLOW_UP').map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedTemplate && (
                <Card className="mt-3">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{selectedTemplate.name}</h4>
                      <Badge variant="outline">{selectedTemplate.templateType}</Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{selectedTemplate.description}</p>
                    <div className="text-xs text-gray-500">
                      <strong>Subject (EN):</strong> {selectedTemplate.subjectEn}
                    </div>
                    {selectedTemplate.subjectAr && (
                      <div className="text-xs text-gray-500">
                        <strong>Subject (AR):</strong> {selectedTemplate.subjectAr}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="subject">Email Subject</Label>
                <Input
                  id="subject"
                  value={localStep.config.subject || ''}
                  onChange={(e) => updateConfig({ subject: e.target.value })}
                  placeholder="Payment Reminder - Invoice {{invoiceNumber}}"
                />
              </div>
              
              <div>
                <Label htmlFor="content">Email Content</Label>
                <Textarea
                  id="content"
                  value={localStep.config.customContent || ''}
                  onChange={(e) => updateConfig({ customContent: e.target.value })}
                  placeholder="Dear {{customerName}}, We hope this message finds you well..."
                  rows={6}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Use variables like {{customerName}}, {{invoiceNumber}}, {{amount}}, {{dueDate}}
                </div>
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="language">Language Support</Label>
            <Select 
              value={localStep.config.language || 'BOTH'} 
              onValueChange={(value) => updateConfig({ language: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ENGLISH">English Only</SelectItem>
                <SelectItem value="ARABIC">Arabic Only</SelectItem>
                <SelectItem value="BOTH">Both Languages (Customer Preference)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderWaitConfiguration = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium mb-4 block">Wait Configuration</Label>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="delay">Wait Duration</Label>
            <Input
              id="delay"
              type="number"
              min="1"
              value={localStep.config.delay || 1}
              onChange={(e) => updateConfig({ delay: parseInt(e.target.value) || 1 })}
            />
          </div>
          
          <div>
            <Label htmlFor="delayUnit">Time Unit</Label>
            <Select 
              value={localStep.config.delayUnit || 'DAYS'} 
              onValueChange={(value) => updateConfig({ delayUnit: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {delayUnits.map(unit => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <Clock className="h-8 w-8 mx-auto text-blue-600 mb-2" />
          <div className="font-medium text-blue-800">
            Wait {localStep.config.delay || 1} {(localStep.config.delayUnit || 'DAYS').toLowerCase()}
          </div>
          <div className="text-sm text-blue-600">
            {localStep.config.businessHoursOnly && 'Only during UAE business hours'}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-base font-medium mb-3 block">Timing Restrictions</Label>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Business Hours Only</Label>
              <p className="text-xs text-gray-600">Only proceed during UAE business hours (9 AM - 6 PM)</p>
            </div>
            <Switch
              checked={localStep.config.businessHoursOnly || false}
              onCheckedChange={(checked) => updateConfig({ businessHoursOnly: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Avoid Weekends</Label>
              <p className="text-xs text-gray-600">Skip Friday and Saturday</p>
            </div>
            <Switch
              checked={localStep.config.avoidWeekends || false}
              onCheckedChange={(checked) => updateConfig({ avoidWeekends: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Avoid UAE Holidays</Label>
              <p className="text-xs text-gray-600">Skip public and Islamic holidays</p>
            </div>
            <Switch
              checked={localStep.config.avoidHolidays || false}
              onCheckedChange={(checked) => updateConfig({ avoidHolidays: checked })}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Avoid Prayer Times</Label>
              <p className="text-xs text-gray-600">Skip during Maghrib and Isha prayers</p>
            </div>
            <Switch
              checked={localStep.config.avoidPrayerTimes || false}
              onCheckedChange={(checked) => updateConfig({ avoidPrayerTimes: checked })}
            />
          </div>
        </div>
      </div>
    </div>
  )

  const renderConditionConfiguration = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium mb-4 block">Condition Configuration</Label>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="conditionType">Condition Type</Label>
            <Select 
              value={localStep.config.conditionType || ''} 
              onValueChange={(value) => updateConfig({ conditionType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select condition type..." />
              </SelectTrigger>
              <SelectContent>
                {conditionTypes.map(condition => (
                  <SelectItem key={condition.value} value={condition.value}>
                    <div>
                      <div className="font-medium">{condition.label}</div>
                      <div className="text-xs text-gray-600">{condition.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {localStep.config.conditionType === 'PAYMENT_STATUS' && (
            <div>
              <Label>Payment Status to Check</Label>
              <Select 
                value={localStep.config.conditionValue || ''} 
                onValueChange={(value) => updateConfig({ conditionValue: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAID">Fully Paid</SelectItem>
                  <SelectItem value="PARTIAL">Partially Paid</SelectItem>
                  <SelectItem value="UNPAID">Unpaid</SelectItem>
                  <SelectItem value="DISPUTED">Disputed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {localStep.config.conditionType === 'AMOUNT_THRESHOLD' && (
            <div>
              <Label htmlFor="amount">Amount Threshold (AED)</Label>
              <Input
                id="amount"
                type="number"
                min="0"
                step="0.01"
                value={localStep.config.conditionValue || ''}
                onChange={(e) => updateConfig({ conditionValue: parseFloat(e.target.value) || 0 })}
                placeholder="1000.00"
              />
            </div>
          )}

          {localStep.config.conditionType === 'INVOICE_AGE' && (
            <div>
              <Label htmlFor="days">Days Since Invoice Created</Label>
              <Input
                id="days"
                type="number"
                min="0"
                value={localStep.config.conditionValue || ''}
                onChange={(e) => updateConfig({ conditionValue: parseInt(e.target.value) || 0 })}
                placeholder="30"
              />
            </div>
          )}
        </div>

        <Card className="mt-4">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Condition Logic:</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              This step will only execute if the specified condition is met. 
              If the condition fails, the sequence will skip to the next step.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderActionConfiguration = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-medium mb-4 block">Action Configuration</Label>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="actionType">Action Type</Label>
            <Select 
              value={localStep.config.actionType || ''} 
              onValueChange={(value) => updateConfig({ actionType: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select action type..." />
              </SelectTrigger>
              <SelectContent>
                {actionTypes.map(action => (
                  <SelectItem key={action.value} value={action.value}>
                    <div>
                      <div className="font-medium">{action.label}</div>
                      <div className="text-xs text-gray-600">{action.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {localStep.config.actionType === 'NOTIFY_MANAGER' && (
            <div>
              <Label htmlFor="managerEmail">Manager Email</Label>
              <Input
                id="managerEmail"
                type="email"
                value={localStep.config.actionConfig?.email || ''}
                onChange={(e) => updateConfig({ 
                  actionConfig: { ...localStep.config.actionConfig, email: e.target.value }
                })}
                placeholder="manager@company.com"
              />
            </div>
          )}

          {localStep.config.actionType === 'UPDATE_STATUS' && (
            <div>
              <Label>New Invoice Status</Label>
              <Select 
                value={localStep.config.actionConfig?.status || ''} 
                onValueChange={(value) => updateConfig({ 
                  actionConfig: { ...localStep.config.actionConfig, status: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select new status..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OVERDUE">Mark as Overdue</SelectItem>
                  <SelectItem value="COLLECTION">Send to Collection</SelectItem>
                  <SelectItem value="DISPUTED">Mark as Disputed</SelectItem>
                  <SelectItem value="WRITE_OFF">Write Off</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {localStep.config.actionType === 'CREATE_TASK' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="taskTitle">Task Title</Label>
                <Input
                  id="taskTitle"
                  value={localStep.config.actionConfig?.title || ''}
                  onChange={(e) => updateConfig({ 
                    actionConfig: { ...localStep.config.actionConfig, title: e.target.value }
                  })}
                  placeholder="Follow up on overdue invoice"
                />
              </div>
              <div>
                <Label htmlFor="taskDescription">Task Description</Label>
                <Textarea
                  id="taskDescription"
                  value={localStep.config.actionConfig?.description || ''}
                  onChange={(e) => updateConfig({ 
                    actionConfig: { ...localStep.config.actionConfig, description: e.target.value }
                  })}
                  placeholder="Contact customer regarding overdue payment..."
                  rows={3}
                />
              </div>
            </div>
          )}
        </div>

        <Card className="mt-4">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-sm">
              <Zap className="h-4 w-4 text-green-600" />
              <span className="font-medium">Automated Action:</span>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              This action will be performed automatically when this step is reached in the sequence.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const getStepIcon = () => {
    switch (localStep.type) {
      case 'EMAIL': return Mail
      case 'WAIT': return Timer
      case 'CONDITION': return Target
      case 'ACTION': return Zap
      default: return Mail
    }
  }

  const StepIcon = getStepIcon()

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <StepIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Configure {localStep.type} Step</h2>
            <p className="text-gray-600">Step {localStep.order} in your sequence</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Step
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Settings</TabsTrigger>
          <TabsTrigger value="uae">UAE Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-6">
          {/* Basic Step Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Configuration</CardTitle>
              <CardDescription>
                Configure the basic settings for this step
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="stepName">Step Name</Label>
                <Input
                  id="stepName"
                  value={localStep.name}
                  onChange={(e) => setLocalStep(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Gentle Payment Reminder"
                />
              </div>
              
              <div>
                <Label htmlFor="stepDescription">Description (Optional)</Label>
                <Textarea
                  id="stepDescription"
                  value={localStep.description || ''}
                  onChange={(e) => setLocalStep(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this step does..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Type-specific Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>{localStep.type} Configuration</CardTitle>
              <CardDescription>
                Configure the specific settings for this {localStep.type.toLowerCase()} step
              </CardDescription>
            </CardHeader>
            <CardContent>
              {localStep.type === 'EMAIL' && renderEmailConfiguration()}
              {localStep.type === 'WAIT' && renderWaitConfiguration()}
              {localStep.type === 'CONDITION' && renderConditionConfiguration()}
              {localStep.type === 'ACTION' && renderActionConfiguration()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uae" className="space-y-6">
          {/* UAE Business Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                UAE Business Settings
              </CardTitle>
              <CardDescription>
                Configure settings specific to UAE business culture and practices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-base font-medium mb-3 block">Cultural Tone</Label>
                <div className="grid grid-cols-2 gap-3">
                  {culturalTones.map(tone => (
                    <Card 
                      key={tone.value}
                      className={cn(
                        "cursor-pointer transition-colors",
                        localStep.uaeSettings.culturalTone === tone.value 
                          ? "ring-2 ring-blue-500 bg-blue-50" 
                          : "hover:bg-gray-50"
                      )}
                      onClick={() => updateUAESettings({ culturalTone: tone.value })}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{tone.icon}</span>
                          <span className="font-medium">{tone.label}</span>
                        </div>
                        <p className="text-xs text-gray-600">{tone.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-base font-medium mb-3 block">Business Compliance</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Respect Business Hours</Label>
                      <p className="text-xs text-gray-600">Sunday-Thursday, 9 AM - 6 PM UAE time</p>
                    </div>
                    <Switch
                      checked={localStep.uaeSettings.respectBusinessHours}
                      onCheckedChange={(checked) => updateUAESettings({ respectBusinessHours: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Honor Prayer Times</Label>
                      <p className="text-xs text-gray-600">Avoid sending during Maghrib and Isha</p>
                    </div>
                    <Switch
                      checked={localStep.uaeSettings.honorPrayerTimes}
                      onCheckedChange={(checked) => updateUAESettings({ honorPrayerTimes: checked })}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm font-medium">Respect UAE Holidays</Label>
                      <p className="text-xs text-gray-600">Skip public and Islamic holidays</p>
                    </div>
                    <Switch
                      checked={localStep.uaeSettings.respectHolidays}
                      onCheckedChange={(checked) => updateUAESettings({ respectHolidays: checked })}
                    />
                  </div>
                </div>
              </div>

              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="font-medium">UAE Compliance Status:</span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {localStep.uaeSettings.respectBusinessHours && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Business hours compliant
                      </div>
                    )}
                    {localStep.uaeSettings.honorPrayerTimes && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Prayer times respected
                      </div>
                    )}
                    {localStep.uaeSettings.respectHolidays && (
                      <div className="flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle className="h-3 w-3" />
                        Holiday calendar integrated
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {/* Step Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Step Preview
              </CardTitle>
              <CardDescription>
                Preview how this step will appear and function in your sequence
              </CardDescription>
            </CardHeader>
            <CardContent>
              {localStep.type === 'EMAIL' && (
                <div className="space-y-4">
                  {localStep.config.language === 'BOTH' && (
                    <div className="flex items-center gap-2 mb-4">
                      <Button 
                        variant={previewMode === 'english' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewMode('english')}
                      >
                        English
                      </Button>
                      <Button 
                        variant={previewMode === 'arabic' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setPreviewMode('arabic')}
                      >
                        Arabic
                      </Button>
                    </div>
                  )}
                  
                  <div className="border rounded-lg p-4 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="font-medium">Email Preview</span>
                      </div>
                      <Badge variant="outline">
                        {previewMode === 'arabic' ? 'Arabic' : 'English'}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-gray-500">Subject:</Label>
                        <div className="font-medium">
                          {selectedTemplate 
                            ? (previewMode === 'arabic' ? selectedTemplate.subjectAr : selectedTemplate.subjectEn)
                            : localStep.config.subject || 'No subject set'
                          }
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Content Preview:</Label>
                        <div className="text-sm text-gray-700 border-l-2 border-blue-200 pl-3">
                          {selectedTemplate 
                            ? (previewMode === 'arabic' ? selectedTemplate.contentAr : selectedTemplate.contentEn)
                            : localStep.config.customContent || 'No content set'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {localStep.type === 'WAIT' && (
                <div className="text-center p-6 border rounded-lg">
                  <Timer className="h-12 w-12 mx-auto text-blue-600 mb-3" />
                  <div className="font-medium text-lg">
                    Wait {localStep.config.delay || 1} {(localStep.config.delayUnit || 'DAYS').toLowerCase()}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    {localStep.config.businessHoursOnly && 'Respecting UAE business hours'}
                    {localStep.config.avoidWeekends && ' • Avoiding weekends'}
                    {localStep.config.avoidHolidays && ' • Avoiding holidays'}
                  </div>
                </div>
              )}

              {localStep.type === 'CONDITION' && (
                <div className="text-center p-6 border rounded-lg">
                  <Target className="h-12 w-12 mx-auto text-yellow-600 mb-3" />
                  <div className="font-medium text-lg">Condition Check</div>
                  <div className="text-sm text-gray-600 mt-2">
                    {localStep.config.conditionType 
                      ? `Check: ${conditionTypes.find(c => c.value === localStep.config.conditionType)?.label}`
                      : 'No condition configured'
                    }
                  </div>
                </div>
              )}

              {localStep.type === 'ACTION' && (
                <div className="text-center p-6 border rounded-lg">
                  <Zap className="h-12 w-12 mx-auto text-green-600 mb-3" />
                  <div className="font-medium text-lg">Automated Action</div>
                  <div className="text-sm text-gray-600 mt-2">
                    {localStep.config.actionType 
                      ? actionTypes.find(a => a.value === localStep.config.actionType)?.label
                      : 'No action configured'
                    }
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}