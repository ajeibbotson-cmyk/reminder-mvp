'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Save, 
  Plus, 
  Trash2, 
  Edit, 
  Play, 
  Calendar, 
  Clock, 
  Mail, 
  Timer, 
  Settings, 
  Eye,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ArrowDown,
  Grip,
  Copy,
  TestTube,
  Zap,
  Target,
  Globe,
  Languages,
  Shield
} from 'lucide-react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SequenceStep } from './sequence-step'
import { useFollowUpSequenceStore } from '@/lib/stores/follow-up-store'
import { useEmailTemplateStore } from '@/lib/stores/email-template-store'
import { cn } from '@/lib/utils'

interface SequenceBuilderProps {
  sequenceId?: string
  onSave: () => void
  onCancel: () => void
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

interface SequenceData {
  id?: string
  name: string
  description: string
  sequenceType: string
  steps: BuilderStep[]
  active: boolean
  uaeBusinessHoursOnly: boolean
  respectHolidays: boolean
  companyId: string
}

export function SequenceBuilder({ sequenceId, onSave, onCancel }: SequenceBuilderProps) {
  const [sequenceData, setSequenceData] = useState<SequenceData>({
    name: '',
    description: '',
    sequenceType: 'GENTLE_COLLECTION',
    steps: [],
    active: false,
    uaeBusinessHoursOnly: true,
    respectHolidays: true,
    companyId: ''
  })

  const [selectedStep, setSelectedStep] = useState<BuilderStep | null>(null)
  const [showStepEditor, setShowStepEditor] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  const { sequences, addSequence, updateSequence } = useFollowUpSequenceStore()
  const { templates, fetchTemplates } = useEmailTemplateStore()

  // Load existing sequence if editing
  useEffect(() => {
    if (sequenceId && sequences.length > 0) {
      const existingSequence = sequences.find(s => s.id === sequenceId)
      if (existingSequence) {
        setSequenceData({
          id: existingSequence.id,
          name: existingSequence.name,
          description: existingSequence.description || '',
          sequenceType: existingSequence.sequenceType,
          steps: convertSequenceSteps(existingSequence.steps),
          active: existingSequence.active,
          uaeBusinessHoursOnly: existingSequence.uaeBusinessHoursOnly || true,
          respectHolidays: existingSequence.respectHolidays || true,
          companyId: existingSequence.companyId
        })
      }
    }
  }, [sequenceId, sequences])

  // Load templates
  useEffect(() => {
    if (sequenceData.companyId) {
      fetchTemplates(sequenceData.companyId, { templateType: 'FOLLOW_UP' })
    }
  }, [sequenceData.companyId, fetchTemplates])

  const convertSequenceSteps = (steps: any): BuilderStep[] => {
    if (!Array.isArray(steps)) return []
    
    return steps.map((step: any, index: number) => ({
      id: step.id || `step-${index}`,
      order: index + 1,
      type: step.type || 'EMAIL',
      name: step.name || `Step ${index + 1}`,
      description: step.description,
      config: step.config || {},
      uaeSettings: step.uaeSettings || {
        respectBusinessHours: true,
        honorPrayerTimes: true,
        respectHolidays: true,
        culturalTone: 'PROFESSIONAL'
      }
    }))
  }

  const sequenceTypes = [
    { value: 'GENTLE_COLLECTION', label: 'Gentle Collection', icon: '💌', description: 'Soft approach maintaining relationships' },
    { value: 'PROFESSIONAL_STANDARD', label: 'Professional Standard', icon: '📋', description: 'Balanced professional approach' },
    { value: 'FIRM_RECOVERY', label: 'Firm Recovery', icon: '⚠️', description: 'Direct approach for difficult cases' },
    { value: 'RELATIONSHIP_PRESERVING', label: 'Relationship Preserving', icon: '🤝', description: 'Prioritizes long-term relationships' },
    { value: 'QUICK_COLLECTION', label: 'Quick Collection', icon: '⚡', description: 'Fast-paced for urgent collections' },
    { value: 'EXTENDED_COURTESY', label: 'Extended Courtesy', icon: '🕒', description: 'Maximum patience for valued clients' }
  ]

  const stepTypes = [
    { 
      value: 'EMAIL', 
      label: 'Email', 
      icon: Mail, 
      description: 'Send an automated email',
      color: 'blue'
    },
    { 
      value: 'WAIT', 
      label: 'Wait', 
      icon: Timer, 
      description: 'Wait for a specified time period',
      color: 'gray'
    },
    { 
      value: 'CONDITION', 
      label: 'Condition', 
      icon: Target, 
      description: 'Branch based on conditions',
      color: 'yellow'
    },
    { 
      value: 'ACTION', 
      label: 'Action', 
      icon: Zap, 
      description: 'Perform an automated action',
      color: 'green'
    }
  ]

  const addStep = (type: string) => {
    const newStep: BuilderStep = {
      id: `step-${Date.now()}`,
      order: sequenceData.steps.length + 1,
      type: type as any,
      name: `${type.charAt(0).toUpperCase() + type.slice(1).toLowerCase()} Step`,
      config: {
        delay: type === 'WAIT' ? 1 : undefined,
        delayUnit: type === 'WAIT' ? 'DAYS' : undefined,
        businessHoursOnly: true,
        avoidWeekends: true,
        avoidHolidays: true,
        avoidPrayerTimes: true,
        language: 'BOTH'
      },
      uaeSettings: {
        respectBusinessHours: true,
        honorPrayerTimes: true,
        respectHolidays: true,
        culturalTone: 'PROFESSIONAL'
      }
    }

    setSequenceData(prev => ({
      ...prev,
      steps: [...prev.steps, newStep]
    }))

    setSelectedStep(newStep)
    setShowStepEditor(true)
  }

  const editStep = (step: BuilderStep) => {
    setSelectedStep(step)
    setShowStepEditor(true)
  }

  const deleteStep = (stepId: string) => {
    setSequenceData(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId).map((s, index) => ({
        ...s,
        order: index + 1
      }))
    }))
  }

  const duplicateStep = (step: BuilderStep) => {
    const newStep: BuilderStep = {
      ...step,
      id: `step-${Date.now()}`,
      order: step.order + 1,
      name: `${step.name} (Copy)`
    }

    setSequenceData(prev => ({
      ...prev,
      steps: [
        ...prev.steps.slice(0, step.order),
        newStep,
        ...prev.steps.slice(step.order).map(s => ({ ...s, order: s.order + 1 }))
      ]
    }))
  }

  const updateStep = (updatedStep: BuilderStep) => {
    setSequenceData(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === updatedStep.id ? updatedStep : s)
    }))
    setSelectedStep(updatedStep)
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    const items = Array.from(sequenceData.steps)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update order numbers
    const reorderedSteps = items.map((step, index) => ({
      ...step,
      order: index + 1
    }))

    setSequenceData(prev => ({
      ...prev,
      steps: reorderedSteps
    }))
  }

  const validateSequence = (): string[] => {
    const validationErrors: string[] = []

    if (!sequenceData.name.trim()) {
      validationErrors.push('Sequence name is required')
    }

    if (!sequenceData.description.trim()) {
      validationErrors.push('Sequence description is required')
    }

    if (sequenceData.steps.length === 0) {
      validationErrors.push('At least one step is required')
    }

    sequenceData.steps.forEach((step, index) => {
      if (!step.name.trim()) {
        validationErrors.push(`Step ${index + 1} name is required`)
      }

      if (step.type === 'EMAIL' && !step.config.templateId && !step.config.customContent) {
        validationErrors.push(`Step ${index + 1}: Email template or custom content is required`)
      }

      if (step.type === 'WAIT' && (!step.config.delay || step.config.delay <= 0)) {
        validationErrors.push(`Step ${index + 1}: Valid wait delay is required`)
      }
    })

    return validationErrors
  }

  const handleSave = async () => {
    const validationErrors = validateSequence()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    setErrors([])

    try {
      const sequenceToSave = {
        ...sequenceData,
        steps: sequenceData.steps.map(step => ({
          id: step.id,
          order: step.order,
          type: step.type,
          name: step.name,
          description: step.description,
          config: step.config,
          uaeSettings: step.uaeSettings
        }))
      }

      if (sequenceId) {
        await updateSequence(sequenceId, sequenceToSave)
      } else {
        await addSequence(sequenceToSave)
      }

      onSave()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Failed to save sequence'])
    } finally {
      setSaving(false)
    }
  }

  const getStepTypeInfo = (type: string) => {
    return stepTypes.find(t => t.value === type) || stepTypes[0]
  }

  const getTotalDuration = () => {
    return sequenceData.steps
      .filter(s => s.type === 'WAIT' || s.type === 'EMAIL')
      .reduce((total, step) => {
        if (step.type === 'WAIT' && step.config.delay) {
          let delay = step.config.delay
          if (step.config.delayUnit === 'WEEKS') delay *= 7
          if (step.config.delayUnit === 'HOURS') delay = delay / 24
          return total + delay
        }
        return total
      }, 0)
  }

  return (
    <div className="flex h-full gap-6">
      {/* Main Builder Area */}
      <div className="flex-1 space-y-6">
        {/* Sequence Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Sequence Configuration
            </CardTitle>
            <CardDescription>
              Configure the basic settings for your follow-up sequence
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Sequence Name *</Label>
                <Input
                  id="name"
                  value={sequenceData.name}
                  onChange={(e) => setSequenceData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Gentle Collection Sequence"
                />
              </div>
              
              <div>
                <Label htmlFor="type">Sequence Type</Label>
                <Select 
                  value={sequenceData.sequenceType} 
                  onValueChange={(value) => setSequenceData(prev => ({ ...prev, sequenceType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sequenceTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={sequenceData.description}
                onChange={(e) => setSequenceData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this sequence does and when to use it..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="businessHours"
                  checked={sequenceData.uaeBusinessHoursOnly}
                  onCheckedChange={(checked) => setSequenceData(prev => ({ 
                    ...prev, 
                    uaeBusinessHoursOnly: checked 
                  }))}
                />
                <Label htmlFor="businessHours" className="text-sm">UAE Business Hours Only</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="holidays"
                  checked={sequenceData.respectHolidays}
                  onCheckedChange={(checked) => setSequenceData(prev => ({ 
                    ...prev, 
                    respectHolidays: checked 
                  }))}
                />
                <Label htmlFor="holidays" className="text-sm">Respect UAE Holidays</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={sequenceData.active}
                  onCheckedChange={(checked) => setSequenceData(prev => ({ 
                    ...prev, 
                    active: checked 
                  }))}
                />
                <Label htmlFor="active" className="text-sm">Activate After Save</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sequence Timeline */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Sequence Timeline ({sequenceData.steps.length} steps)
                </CardTitle>
                <CardDescription>
                  Drag and drop to reorder steps. Estimated duration: {getTotalDuration().toFixed(1)} days
                </CardDescription>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Sequence
                </Button>
                <Select onValueChange={addStep}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Add Step" />
                  </SelectTrigger>
                  <SelectContent>
                    {stepTypes.map(type => {
                      const IconComponent = type.icon
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {sequenceData.steps.length > 0 ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="steps">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                      {sequenceData.steps.map((step, index) => {
                        const typeInfo = getStepTypeInfo(step.type)
                        const IconComponent = typeInfo.icon
                        
                        return (
                          <Draggable key={step.id} draggableId={step.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "border rounded-lg p-4 bg-white",
                                  snapshot.isDragging && "shadow-lg"
                                )}
                              >
                                <div className="flex items-center gap-4">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="cursor-grab hover:cursor-grabbing"
                                  >
                                    <Grip className="h-5 w-5 text-gray-400" />
                                  </div>
                                  
                                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">
                                    {step.order}
                                  </div>
                                  
                                  <div className={`p-2 rounded-lg bg-${typeInfo.color}-100`}>
                                    <IconComponent className={`h-5 w-5 text-${typeInfo.color}-600`} />
                                  </div>
                                  
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <h4 className="font-medium">{step.name}</h4>
                                      <Badge variant="outline">{step.type}</Badge>
                                      {step.uaeSettings.respectBusinessHours && (
                                        <Badge variant="secondary">
                                          <Shield className="h-3 w-3 mr-1" />
                                          UAE Hours
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    <p className="text-sm text-gray-600">
                                      {step.description || typeInfo.description}
                                    </p>
                                    
                                    {step.type === 'WAIT' && step.config.delay && (
                                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                        <Clock className="h-3 w-3" />
                                        Wait {step.config.delay} {step.config.delayUnit?.toLowerCase()}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="sm" onClick={() => editStep(step)}>
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => duplicateStep(step)}>
                                      <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => deleteStep(step.id)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                
                                {index < sequenceData.steps.length - 1 && (
                                  <div className="flex justify-center mt-3">
                                    <ArrowDown className="h-4 w-4 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        )
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                <Plus className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-700 mb-2">No steps added yet</h3>
                <p className="text-gray-500 mb-4">
                  Start building your sequence by adding your first step
                </p>
                <Select onValueChange={addStep}>
                  <SelectTrigger className="w-[200px] mx-auto">
                    <SelectValue placeholder="Add First Step" />
                  </SelectTrigger>
                  <SelectContent>
                    {stepTypes.map(type => {
                      const IconComponent = type.icon
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-4 w-4" />
                            {type.label}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Validation Errors */}
        {errors.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Validation Errors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {errors.map((error, index) => (
                  <li key={index} className="text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sidebar */}
      <div className="w-80 space-y-4">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : (sequenceId ? 'Update Sequence' : 'Save Sequence')}
            </Button>
            <Button variant="outline" className="w-full" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="outline" className="w-full" disabled={sequenceData.steps.length === 0}>
              <TestTube className="h-4 w-4 mr-2" />
              Test Sequence
            </Button>
          </CardContent>
        </Card>

        {/* UAE Business Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              UAE Business Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Business Hours Only</Label>
              <Switch
                checked={sequenceData.uaeBusinessHoursOnly}
                onCheckedChange={(checked) => setSequenceData(prev => ({ 
                  ...prev, 
                  uaeBusinessHoursOnly: checked 
                }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Respect UAE Holidays</Label>
              <Switch
                checked={sequenceData.respectHolidays}
                onCheckedChange={(checked) => setSequenceData(prev => ({ 
                  ...prev, 
                  respectHolidays: checked 
                }))}
              />
            </div>
            <div className="text-xs text-gray-500">
              <p>• Sunday-Thursday: 9 AM - 6 PM</p>
              <p>• Avoids prayer times automatically</p>
              <p>• Respects Islamic holidays</p>
            </div>
          </CardContent>
        </Card>

        {/* Sequence Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sequence Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Steps:</span>
              <span className="font-medium">{sequenceData.steps.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Email Steps:</span>
              <span className="font-medium">
                {sequenceData.steps.filter(s => s.type === 'EMAIL').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Wait Steps:</span>
              <span className="font-medium">
                {sequenceData.steps.filter(s => s.type === 'WAIT').length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Duration:</span>
              <span className="font-medium">{getTotalDuration().toFixed(1)} days</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Step Editor Dialog */}
      <Dialog open={showStepEditor} onOpenChange={setShowStepEditor}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>
              Edit Step: {selectedStep?.name}
            </DialogTitle>
            <DialogDescription>
              Configure the step settings and UAE business logic
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {selectedStep && (
              <SequenceStep
                step={selectedStep}
                templates={templates}
                onUpdate={updateStep}
                onClose={() => setShowStepEditor(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}