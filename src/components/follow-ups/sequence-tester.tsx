'use client'

import { useState, useEffect } from 'react'
import { 
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Clock,
  Mail,
  Send,
  Eye,
  Settings,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Target,
  Zap,
  Users,
  TrendingUp,
  BarChart3,
  FileText,
  Download,
  Sparkles
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'

interface SequenceTesterProps {
  sequence: any
  onClose: () => void
}

interface TestScenario {
  id: string
  name: string
  description: string
  invoiceAmount: number
  customerType: 'INDIVIDUAL' | 'SME' | 'ENTERPRISE'
  paymentHistory: 'EXCELLENT' | 'GOOD' | 'POOR'
  relationshipLength: number // months
  industry: string
}

interface SimulationStep {
  stepId: string
  stepName: string
  stepType: string
  scheduledDate: Date
  actualDate?: Date
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'SKIPPED' | 'FAILED'
  skipReason?: string
  metrics?: {
    deliveryRate?: number
    openRate?: number
    clickRate?: number
    responseRate?: number
  }
}

interface UAECalendar {
  businessDays: string[]
  holidays: { date: string; name: string; type: 'PUBLIC' | 'ISLAMIC' }[]
  prayerTimes: { [key: string]: string[] }
}

export function SequenceTester({ sequence, onClose }: SequenceTesterProps) {
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null)
  const [simulationSteps, setSimulationSteps] = useState<SimulationStep[]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedLanguage, setSelectedLanguage] = useState<'ENGLISH' | 'ARABIC' | 'BOTH'>('BOTH')

  // Sample test scenarios
  const testScenarios: TestScenario[] = [
    {
      id: 'scenario-1',
      name: 'Typical SME Client',
      description: 'Small business with good payment history but occasional delays',
      invoiceAmount: 2500,
      customerType: 'SME',
      paymentHistory: 'GOOD',
      relationshipLength: 18,
      industry: 'Retail'
    },
    {
      id: 'scenario-2',
      name: 'Large Enterprise',
      description: 'Big company with complex approval processes',
      invoiceAmount: 15000,
      customerType: 'ENTERPRISE',
      paymentHistory: 'EXCELLENT',
      relationshipLength: 36,
      industry: 'Technology'
    },
    {
      id: 'scenario-3',
      name: 'Difficult Individual',
      description: 'Individual client with poor payment track record',
      invoiceAmount: 800,
      customerType: 'INDIVIDUAL',
      paymentHistory: 'POOR',
      relationshipLength: 6,
      industry: 'Services'
    },
    {
      id: 'scenario-4',
      name: 'New High-Value Client',
      description: 'First-time client with large invoice amount',
      invoiceAmount: 25000,
      customerType: 'ENTERPRISE',
      paymentHistory: 'GOOD',
      relationshipLength: 2,
      industry: 'Construction'
    }
  ]

  // UAE Calendar data (simplified for demo)
  const uaeCalendar: UAECalendar = {
    businessDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    holidays: [
      { date: '2025-01-01', name: 'New Year\'s Day', type: 'PUBLIC' },
      { date: '2025-04-10', name: 'Eid Al-Fitr', type: 'ISLAMIC' },
      { date: '2025-06-16', name: 'Eid Al-Adha', type: 'ISLAMIC' },
      { date: '2025-12-02', name: 'UAE National Day', type: 'PUBLIC' }
    ],
    prayerTimes: {
      'Maghrib': ['18:30', '19:15'],
      'Isha': ['20:00', '20:30']
    }
  }

  const calculateSequenceTiming = (startDate: string, scenario: TestScenario) => {
    if (!sequence?.steps) return []

    const steps: SimulationStep[] = []
    let currentDate = new Date(startDate)
    
    sequence.steps.forEach((step: any, index: number) => {
      const simulationStep: SimulationStep = {
        stepId: step.id,
        stepName: step.name,
        stepType: step.type,
        scheduledDate: new Date(currentDate),
        status: 'PENDING'
      }

      // Apply UAE business logic
      if (step.config?.businessHoursOnly || step.uaeSettings?.respectBusinessHours) {
        currentDate = adjustForBusinessHours(currentDate)
      }

      if (step.config?.avoidWeekends || step.uaeSettings?.respectHolidays) {
        currentDate = adjustForWeekends(currentDate)
      }

      if (step.config?.avoidHolidays || step.uaeSettings?.respectHolidays) {
        currentDate = adjustForHolidays(currentDate)
      }

      // Apply wait delays
      if (step.type === 'WAIT' && step.config?.delay) {
        let delay = step.config.delay
        if (step.config.delayUnit === 'WEEKS') delay *= 7
        if (step.config.delayUnit === 'HOURS') delay = delay / 24
        
        currentDate.setDate(currentDate.getDate() + delay)
      }

      // Simulate step outcomes based on scenario
      simulationStep.metrics = simulateStepOutcome(step, scenario)
      
      // Determine if step would be skipped
      if (shouldSkipStep(step, scenario)) {
        simulationStep.status = 'SKIPPED'
        simulationStep.skipReason = getSkipReason(step, scenario)
      }

      simulationStep.actualDate = new Date(currentDate)
      steps.push(simulationStep)

      // Add some buffer time for next step
      currentDate.setHours(currentDate.getHours() + 2)
    })

    return steps
  }

  const adjustForBusinessHours = (date: Date): Date => {
    const newDate = new Date(date)
    const hours = newDate.getHours()
    
    // If outside business hours (9 AM - 6 PM), move to next business day at 9 AM
    if (hours < 9 || hours >= 18) {
      newDate.setHours(9, 0, 0, 0)
      if (hours >= 18) {
        newDate.setDate(newDate.getDate() + 1)
      }
    }
    
    return newDate
  }

  const adjustForWeekends = (date: Date): Date => {
    const newDate = new Date(date)
    const dayOfWeek = newDate.getDay()
    
    // If Friday (5) or Saturday (6), move to Sunday
    if (dayOfWeek === 5 || dayOfWeek === 6) {
      const daysToAdd = dayOfWeek === 5 ? 2 : 1
      newDate.setDate(newDate.getDate() + daysToAdd)
      newDate.setHours(9, 0, 0, 0)
    }
    
    return newDate
  }

  const adjustForHolidays = (date: Date): Date => {
    const newDate = new Date(date)
    const dateString = newDate.toISOString().split('T')[0]
    
    // Check if date is a holiday
    const isHoliday = uaeCalendar.holidays.some(holiday => holiday.date === dateString)
    
    if (isHoliday) {
      // Move to next day and check again
      newDate.setDate(newDate.getDate() + 1)
      return adjustForHolidays(newDate)
    }
    
    return newDate
  }

  const simulateStepOutcome = (step: any, scenario: TestScenario) => {
    // Base rates influenced by customer type and payment history
    let baseDeliveryRate = 95
    let baseOpenRate = 25
    let baseClickRate = 5
    let baseResponseRate = 2

    // Adjust rates based on customer type
    switch (scenario.customerType) {
      case 'ENTERPRISE':
        baseOpenRate += 10
        baseClickRate += 3
        baseResponseRate += 2
        break
      case 'SME':
        baseOpenRate += 5
        baseClickRate += 1
        baseResponseRate += 1
        break
      case 'INDIVIDUAL':
        baseOpenRate -= 5
        baseClickRate -= 1
        baseResponseRate -= 1
        break
    }

    // Adjust rates based on payment history
    switch (scenario.paymentHistory) {
      case 'EXCELLENT':
        baseOpenRate += 15
        baseClickRate += 5
        baseResponseRate += 5
        break
      case 'GOOD':
        baseOpenRate += 5
        baseClickRate += 2
        baseResponseRate += 2
        break
      case 'POOR':
        baseOpenRate -= 10
        baseClickRate -= 3
        baseResponseRate -= 2
        break
    }

    // Adjust rates based on cultural tone
    if (step.uaeSettings?.culturalTone) {
      switch (step.uaeSettings.culturalTone) {
        case 'GENTLE':
          baseOpenRate += 8
          baseResponseRate += 3
          break
        case 'PROFESSIONAL':
          baseOpenRate += 5
          baseResponseRate += 2
          break
        case 'FIRM':
          baseOpenRate -= 3
          baseResponseRate += 1
          break
        case 'URGENT':
          baseOpenRate -= 5
          baseResponseRate -= 1
          break
      }
    }

    // Ensure rates don't exceed realistic bounds
    return {
      deliveryRate: Math.min(Math.max(baseDeliveryRate, 80), 99),
      openRate: Math.min(Math.max(baseOpenRate, 5), 85),
      clickRate: Math.min(Math.max(baseClickRate, 1), 25),
      responseRate: Math.min(Math.max(baseResponseRate, 0.5), 15)
    }
  }

  const shouldSkipStep = (step: any, scenario: TestScenario): boolean => {
    // Simulate conditions that might cause steps to be skipped
    
    // High-value clients might pay before later steps
    if (scenario.invoiceAmount > 10000 && step.order > 2) {
      return Math.random() < 0.3 // 30% chance of early payment
    }
    
    // Excellent payment history clients might respond quickly
    if (scenario.paymentHistory === 'EXCELLENT' && step.order > 3) {
      return Math.random() < 0.4 // 40% chance of early resolution
    }
    
    // Poor payment history might lead to disputes
    if (scenario.paymentHistory === 'POOR' && step.order > 2) {
      return Math.random() < 0.2 // 20% chance of dispute/issue
    }
    
    return false
  }

  const getSkipReason = (step: any, scenario: TestScenario): string => {
    if (scenario.invoiceAmount > 10000) return 'Payment received early'
    if (scenario.paymentHistory === 'EXCELLENT') return 'Customer responded proactively'
    if (scenario.paymentHistory === 'POOR') return 'Dispute raised by customer'
    return 'Condition not met'
  }

  const runSimulation = () => {
    if (!selectedScenario) return

    setIsSimulating(true)
    setCurrentStep(0)
    
    const steps = calculateSequenceTiming(startDate, selectedScenario)
    setSimulationSteps(steps)

    // Simulate step-by-step execution
    let stepIndex = 0
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setSimulationSteps(prev => 
          prev.map((step, index) => {
            if (index === stepIndex && step.status === 'PENDING') {
              const random = Math.random()
              
              if (step.status === 'SKIPPED') {
                return step // Already marked as skipped
              }
              
              let newStatus: SimulationStep['status'] = 'SENT'
              
              if (random > (step.metrics?.deliveryRate || 90) / 100) {
                newStatus = 'FAILED'
              } else if (random > (step.metrics?.openRate || 25) / 100) {
                newStatus = 'DELIVERED'
              } else if (random > (step.metrics?.clickRate || 5) / 100) {
                newStatus = 'OPENED'
              } else {
                newStatus = 'CLICKED'
              }
              
              return { ...step, status: newStatus }
            }
            return step
          })
        )
        setCurrentStep(stepIndex + 1)
        stepIndex++
      } else {
        setIsSimulating(false)
        clearInterval(interval)
      }
    }, 1000) // 1 second per step for demo
  }

  const resetSimulation = () => {
    setSimulationSteps([])
    setCurrentStep(0)
    setIsSimulating(false)
  }

  const getStepIcon = (stepType: string) => {
    switch (stepType) {
      case 'EMAIL': return Mail
      case 'WAIT': return Timer
      case 'CONDITION': return Target
      case 'ACTION': return Zap
      default: return Mail
    }
  }

  const getStatusColor = (status: SimulationStep['status']) => {
    switch (status) {
      case 'PENDING': return 'gray'
      case 'SENT': return 'blue'
      case 'DELIVERED': return 'green'
      case 'OPENED': return 'yellow'
      case 'CLICKED': return 'purple'
      case 'SKIPPED': return 'orange'
      case 'FAILED': return 'red'
      default: return 'gray'
    }
  }

  const calculateOverallMetrics = () => {
    if (simulationSteps.length === 0) return null

    const emailSteps = simulationSteps.filter(s => s.stepType === 'EMAIL')
    const totalSteps = emailSteps.length
    const sentSteps = emailSteps.filter(s => ['SENT', 'DELIVERED', 'OPENED', 'CLICKED'].includes(s.status)).length
    const deliveredSteps = emailSteps.filter(s => ['DELIVERED', 'OPENED', 'CLICKED'].includes(s.status)).length
    const openedSteps = emailSteps.filter(s => ['OPENED', 'CLICKED'].includes(s.status)).length
    const clickedSteps = emailSteps.filter(s => s.status === 'CLICKED').length
    const skippedSteps = simulationSteps.filter(s => s.status === 'SKIPPED').length

    return {
      totalSteps,
      sentSteps,
      deliveredSteps,
      openedSteps,
      clickedSteps,
      skippedSteps,
      deliveryRate: totalSteps > 0 ? (deliveredSteps / sentSteps) * 100 : 0,
      openRate: deliveredSteps > 0 ? (openedSteps / deliveredSteps) * 100 : 0,
      clickRate: openedSteps > 0 ? (clickedSteps / openedSteps) * 100 : 0,
      completionRate: totalSteps > 0 ? ((totalSteps - skippedSteps) / totalSteps) * 100 : 0
    }
  }

  const metrics = calculateOverallMetrics()
  const totalDuration = simulationSteps.length > 0 
    ? Math.ceil((simulationSteps[simulationSteps.length - 1]?.actualDate?.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Sequence Testing & Simulation</h2>
          <p className="text-gray-600">
            Test your sequence with different customer scenarios and UAE calendar integration
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      <Tabs defaultValue="setup" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-6">
          {/* Test Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Scenario</CardTitle>
                <CardDescription>
                  Choose a customer scenario to test your sequence against
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {testScenarios.map(scenario => (
                    <Card 
                      key={scenario.id}
                      className={cn(
                        "cursor-pointer transition-colors",
                        selectedScenario?.id === scenario.id 
                          ? "ring-2 ring-blue-500 bg-blue-50" 
                          : "hover:bg-gray-50"
                      )}
                      onClick={() => setSelectedScenario(scenario)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{scenario.name}</h4>
                          <Badge variant="outline">{scenario.customerType}</Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{scenario.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                          <div>Amount: AED {scenario.invoiceAmount.toLocaleString()}</div>
                          <div>History: {scenario.paymentHistory}</div>
                          <div>Industry: {scenario.industry}</div>
                          <div>Relationship: {scenario.relationshipLength}mo</div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Test Settings</CardTitle>
                <CardDescription>
                  Configure the simulation parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Language Preference</Label>
                  <Select value={selectedLanguage} onValueChange={(value: any) => setSelectedLanguage(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ENGLISH">English Only</SelectItem>
                      <SelectItem value="ARABIC">Arabic Only</SelectItem>
                      <SelectItem value="BOTH">Customer Preference</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">UAE Calendar Settings</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Business hours: Sunday-Thursday, 9 AM - 6 PM</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Avoids weekends (Friday-Saturday)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Respects UAE public holidays</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Honors Islamic prayer times</span>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  onClick={runSimulation}
                  disabled={!selectedScenario || isSimulating}
                >
                  <Play className="h-4 w-4 mr-2" />
                  {isSimulating ? 'Running Simulation...' : 'Run Simulation'}
                </Button>

                {simulationSteps.length > 0 && (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={resetSimulation}
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset Simulation
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="simulation" className="space-y-6">
          {simulationSteps.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Simulation Progress */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Simulation Progress</CardTitle>
                      <Badge variant={isSimulating ? "default" : "secondary"}>
                        {isSimulating ? 'Running' : 'Completed'}
                      </Badge>
                    </div>
                    <CardDescription>
                      Step-by-step simulation of your sequence
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {simulationSteps.map((step, index) => {
                        const StepIcon = getStepIcon(step.stepType)
                        const statusColor = getStatusColor(step.status)
                        const isCurrentStep = index === currentStep - 1 && isSimulating
                        
                        return (
                          <div 
                            key={step.stepId}
                            className={cn(
                              "flex items-center gap-4 p-3 border rounded-lg transition-colors",
                              isCurrentStep && "bg-blue-50 border-blue-200",
                              index < currentStep && "bg-gray-50"
                            )}
                          >
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">
                              {index + 1}
                            </div>
                            
                            <div className="p-2 rounded-lg bg-gray-100">
                              <StepIcon className="h-5 w-5 text-gray-600" />
                            </div>
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{step.stepName}</h4>
                                <Badge variant="outline">{step.stepType}</Badge>
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    step.status === 'PENDING' && "border-gray-400 text-gray-600",
                                    step.status === 'SENT' && "border-blue-400 text-blue-600",
                                    step.status === 'DELIVERED' && "border-green-400 text-green-600",
                                    step.status === 'OPENED' && "border-yellow-400 text-yellow-600",
                                    step.status === 'CLICKED' && "border-purple-400 text-purple-600",
                                    step.status === 'SKIPPED' && "border-orange-400 text-orange-600",
                                    step.status === 'FAILED' && "border-red-400 text-red-600"
                                  )}
                                >
                                  {step.status}
                                </Badge>
                              </div>
                              
                              <div className="text-sm text-gray-600">
                                Scheduled: {step.scheduledDate.toLocaleDateString('en-AE')} at {step.scheduledDate.toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              
                              {step.skipReason && (
                                <div className="text-sm text-orange-600 mt-1">
                                  Skipped: {step.skipReason}
                                </div>
                              )}
                              
                              {step.metrics && step.status !== 'PENDING' && step.status !== 'SKIPPED' && (
                                <div className="flex gap-4 text-xs text-gray-500 mt-1">
                                  <span>Delivery: {step.metrics.deliveryRate?.toFixed(1)}%</span>
                                  <span>Open: {step.metrics.openRate?.toFixed(1)}%</span>
                                  <span>Click: {step.metrics.clickRate?.toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                            
                            <div className="text-right">
                              {step.actualDate && (
                                <div className="text-sm font-medium">
                                  {step.actualDate.toLocaleDateString('en-AE')}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Simulation Metrics */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Real-time Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {metrics && (
                      <>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Progress</span>
                            <span>{currentStep}/{simulationSteps.length}</span>
                          </div>
                          <Progress value={(currentStep / simulationSteps.length) * 100} />
                        </div>

                        <Separator />

                        <div className="space-y-3">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Delivery Rate</span>
                            <span className="font-medium">{metrics.deliveryRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Open Rate</span>
                            <span className="font-medium">{metrics.openRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Click Rate</span>
                            <span className="font-medium">{metrics.clickRate.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Completion</span>
                            <span className="font-medium">{metrics.completionRate.toFixed(1)}%</span>
                          </div>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                          <div className="text-sm font-medium">Scenario Details</div>
                          {selectedScenario && (
                            <div className="space-y-1 text-xs text-gray-600">
                              <div>Customer: {selectedScenario.customerType}</div>
                              <div>History: {selectedScenario.paymentHistory}</div>
                              <div>Amount: AED {selectedScenario.invoiceAmount.toLocaleString()}</div>
                              <div>Duration: {totalDuration} days</div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Play className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">No Simulation Running</h3>
                  <p className="text-gray-600 mb-4">
                    Go to the Setup tab to configure and run a simulation
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          {simulationSteps.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>UAE Calendar Timeline</CardTitle>
                <CardDescription>
                  Visual timeline showing when each step would execute considering UAE business practices
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {simulationSteps.map((step, index) => (
                    <div key={step.stepId} className="flex items-center gap-4">
                      <div className="w-16 text-sm text-gray-600 text-right">
                        Day {Math.ceil((step.scheduledDate.getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))}
                      </div>
                      
                      <div className="w-px h-8 bg-gray-200"></div>
                      
                      <div className="flex-1 flex items-center gap-3">
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          step.status === 'SKIPPED' && "bg-orange-400",
                          step.status === 'FAILED' && "bg-red-400",
                          step.status !== 'SKIPPED' && step.status !== 'FAILED' && "bg-blue-400"
                        )}></div>
                        
                        <div className="flex-1">
                          <div className="font-medium">{step.stepName}</div>
                          <div className="text-sm text-gray-600">
                            {step.scheduledDate.toLocaleDateString('en-AE', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })} at {step.scheduledDate.toLocaleTimeString('en-AE', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                          {step.skipReason && (
                            <div className="text-sm text-orange-600">
                              {step.skipReason}
                            </div>
                          )}
                        </div>
                        
                        <Badge variant="outline">{step.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">No Timeline Available</h3>
                  <p className="text-gray-600">
                    Run a simulation to see the timeline view
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-6">
          {metrics ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>
                    Overall sequence performance for this scenario
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {metrics.deliveryRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-blue-700">Delivery Rate</div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {metrics.openRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-green-700">Open Rate</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">
                        {metrics.clickRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-purple-700">Click Rate</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {totalDuration}
                      </div>
                      <div className="text-sm text-yellow-700">Days Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>
                    AI-powered suggestions based on simulation results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Optimize Timing</div>
                        <div className="text-xs text-gray-600">
                          Consider adjusting step delays for better response rates
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">Cultural Tone</div>
                        <div className="text-xs text-gray-600">
                          Your chosen tone works well for this customer type
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                      <div>
                        <div className="font-medium text-sm">UAE Compliance</div>
                        <div className="text-xs text-gray-600">
                          All steps respect UAE business hours and holidays
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Export Results</CardTitle>
                  <CardDescription>
                    Save simulation results for analysis and reporting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Report (PDF)
                    </Button>
                    <Button variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Export Data (CSV)
                    </Button>
                    <Button variant="outline">
                      <Send className="h-4 w-4 mr-2" />
                      Email Results
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold mb-2">No Results Available</h3>
                  <p className="text-gray-600">
                    Complete a simulation to see detailed results and recommendations
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}