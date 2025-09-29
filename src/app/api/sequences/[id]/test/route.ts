import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from "@/lib/auth"
import { prisma } from '@/lib/prisma'
import { culturalCompliance } from '@/lib/services/cultural-compliance-service'
import { uaeBusinessHours } from '@/lib/services/uae-business-hours-service'
import { emailSchedulingService } from '@/lib/services/email-scheduling-service'

interface TestSequenceRequest {
  testMode: 'VALIDATE_ONLY' | 'SEND_SAMPLE' | 'FULL_SIMULATION'
  sampleInvoiceId?: string
  testEmail?: string
  testCustomerName?: string
  stepToTest?: number // Test specific step only
}

interface TestResult {
  success: boolean
  overallScore: number
  issues: string[]
  warnings: string[]
  stepResults: StepTestResult[]
  culturalCompliance: {
    score: number
    issues: string[]
    suggestions: string[]
  }
  timingAnalysis: {
    estimatedDuration: number // Total sequence duration in days
    businessHoursCompliant: boolean
    culturallyOptimal: boolean
    suggestions: string[]
  }
  simulationResults?: {
    emailLogIds: string[]
    scheduledTimes: Date[]
    estimatedDelivery: Date[]
  }
}

interface StepTestResult {
  stepNumber: number
  valid: boolean
  culturalScore: number
  issues: string[]
  warnings: string[]
  processedContent: {
    subject: string
    content: string
    variables: Record<string, string>
  }
  timing: {
    scheduledFor: Date
    businessHoursCompliant: boolean
    culturallyOptimal: boolean
  }
}

/**
 * POST /api/sequences/[id]/test
 * Test sequence with sample data and validation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { company: true }
    })

    if (!user?.company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const sequence = await prisma.follow_up_sequences.findFirst({
      where: {
        id: params.id,
        companyId: user.company.id
      }
    })

    if (!sequence) {
      return NextResponse.json({ error: 'Sequence not found' }, { status: 404 })
    }

    const body: TestSequenceRequest = await request.json()
    
    if (!['VALIDATE_ONLY', 'SEND_SAMPLE', 'FULL_SIMULATION'].includes(body.testMode)) {
      return NextResponse.json(
        { error: 'Invalid test mode' },
        { status: 400 }
      )
    }

    // Parse sequence steps
    let steps = []
    try {
      steps = typeof sequence.steps === 'string' 
        ? JSON.parse(sequence.steps) 
        : sequence.steps || []
    } catch {
      return NextResponse.json(
        { error: 'Invalid sequence steps format' },
        { status: 400 }
      )
    }

    if (steps.length === 0) {
      return NextResponse.json(
        { error: 'Sequence has no steps to test' },
        { status: 400 }
      )
    }

    // Get sample invoice data
    let sampleInvoice = null
    
    if (body.sampleInvoiceId) {
      sampleInvoice = await prisma.invoices.findFirst({
        where: {
          id: body.sampleInvoiceId,
          companyId: user.company.id
        },
        include: {
          customer: true,
          company: true,
          payments: true
        }
      })
    }

    // Use sample invoice or create mock data
    const testInvoice = sampleInvoice || {
      id: 'test-invoice-id',
      number: 'INV-2024-001',
      customerName: body.testCustomerName || 'Ahmed Al-Rashid',
      customerEmail: body.testEmail || 'ahmed@example.ae',
      amount: 5000,
      totalAmount: 5250,
      currency: 'AED',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: 'SENT',
      company: user.company,
      customer: {
        name: body.testCustomerName || 'Ahmed Al-Rashid',
        email: body.testEmail || 'ahmed@example.ae',
        phone: '+971-50-123-4567'
      },
      payments: []
    }

    // Filter steps to test
    const stepsToTest = body.stepToTest 
      ? steps.filter((step: any) => step.stepNumber === body.stepToTest)
      : steps

    if (stepsToTest.length === 0) {
      return NextResponse.json(
        { error: 'No steps found matching the test criteria' },
        { status: 400 }
      )
    }

    // Test each step
    const stepResults: StepTestResult[] = []
    const allIssues: string[] = []
    const allWarnings: string[] = []
    let totalCulturalScore = 0
    let simulationResults: any = undefined

    for (const step of stepsToTest) {
      const stepResult = await testSequenceStep(step, testInvoice, user.company)
      stepResults.push(stepResult)
      
      allIssues.push(...stepResult.issues)
      allWarnings.push(...stepResult.warnings)
      totalCulturalScore += stepResult.culturalScore
    }

    // Overall cultural compliance analysis
    const overallCompliance = culturalCompliance.validateSequenceTone(
      { steps: stepsToTest },
      'REGULAR'
    )

    // Timing analysis
    const timingAnalysis = analyzeSequenceTiming(stepsToTest)

    // Handle different test modes
    if (body.testMode === 'SEND_SAMPLE' || body.testMode === 'FULL_SIMULATION') {
      simulationResults = await simulateSequenceExecution(
        stepsToTest,
        testInvoice,
        user.company.id,
        body.testMode === 'SEND_SAMPLE'
      )
    }

    const testResult: TestResult = {
      success: allIssues.length === 0,
      overallScore: Math.round(totalCulturalScore / stepsToTest.length),
      issues: allIssues,
      warnings: allWarnings,
      stepResults,
      culturalCompliance: {
        score: overallCompliance.culturalScore,
        issues: overallCompliance.issues,
        suggestions: overallCompliance.suggestions
      },
      timingAnalysis,
      simulationResults
    }

    // Log test activity
    await prisma.activities.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.company.id,
        userId: user.id,
        type: 'SEQUENCE_TESTED',
        description: `Tested sequence: ${sequence.name} (${body.testMode})`,
        metadata: {
          sequenceId: params.id,
          testMode: body.testMode,
          stepsCount: stepsToTest.length,
          overallScore: testResult.overallScore,
          success: testResult.success
        }
      }
    })

    return NextResponse.json(testResult)

  } catch (error) {
    console.error('Error testing sequence:', error)
    return NextResponse.json(
      { error: 'Failed to test sequence' },
      { status: 500 }
    )
  }
}

/**
 * Test individual sequence step
 */
async function testSequenceStep(
  step: any,
  testInvoice: any,
  company: any
): Promise<StepTestResult> {
  const issues: string[] = []
  const warnings: string[] = []

  // Process template variables
  const processedContent = processStepTemplate(step, testInvoice)

  // Cultural compliance check
  const complianceCheck = culturalCompliance.validateTemplateContent({
    contentEn: processedContent.content,
    subjectEn: processedContent.subject
  })

  if (!complianceCheck.isValid) {
    issues.push(...complianceCheck.issues)
  }

  if (complianceCheck.culturalCompliance < 80) {
    warnings.push(...complianceCheck.improvements)
  }

  // Calculate timing
  const baseTime = new Date()
  const stepDelay = step.delayDays || 0
  const scheduledTime = new Date(baseTime.getTime() + stepDelay * 24 * 60 * 60 * 1000)
  
  const timingValidation = uaeBusinessHours.validateScheduledTime(scheduledTime)
  const isBusinessHours = timingValidation.isValid
  const isCulturallyOptimal = isBusinessHours && 
    scheduledTime.getDay() >= 2 && scheduledTime.getDay() <= 4 && // Tue-Thu
    scheduledTime.getHours() >= 10 && scheduledTime.getHours() <= 11 // 10-11 AM

  if (!isBusinessHours) {
    warnings.push(...timingValidation.suggestions)
  }

  return {
    stepNumber: step.stepNumber || 1,
    valid: issues.length === 0,
    culturalScore: complianceCheck.culturalCompliance,
    issues,
    warnings,
    processedContent,
    timing: {
      scheduledFor: scheduledTime,
      businessHoursCompliant: isBusinessHours,
      culturallyOptimal: isCulturallyOptimal
    }
  }
}

/**
 * Process step template with test data
 */
function processStepTemplate(step: any, testInvoice: any): {
  subject: string
  content: string
  variables: Record<string, string>
} {
  const variables = {
    invoiceNumber: testInvoice.number,
    customerName: testInvoice.customerName,
    invoiceAmount: `AED ${testInvoice.totalAmount || testInvoice.amount}`,
    currency: testInvoice.currency,
    dueDate: testInvoice.dueDate.toLocaleDateString('en-AE'),
    companyName: testInvoice.company?.name || 'Your Company',
    daysPastDue: Math.max(0, Math.ceil((Date.now() - testInvoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))),
    currentDate: new Date().toLocaleDateString('en-AE'),
    supportEmail: 'support@yourdomain.ae',
    supportPhone: '+971-4-XXX-XXXX'
  }

  let subject = step.subject || ''
  let content = step.content || ''

  // Replace variables
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    subject = subject.replace(new RegExp(placeholder, 'g'), value)
    content = content.replace(new RegExp(placeholder, 'g'), value)
  })

  return { subject, content, variables }
}

/**
 * Analyze sequence timing
 */
function analyzeSequenceTiming(steps: any[]): {
  estimatedDuration: number
  businessHoursCompliant: boolean
  culturallyOptimal: boolean
  suggestions: string[]
} {
  const suggestions: string[] = []
  let totalDays = 0
  const businessHoursCompliant = true
  let culturallyOptimal = true

  for (const step of steps) {
    totalDays += step.delayDays || 0
    
    // Check if delays are reasonable
    if (step.delayDays < 3) {
      suggestions.push(`Step ${step.stepNumber}: Consider longer delay (3+ days) for UAE culture`)
      culturallyOptimal = false
    }
    
    if (step.delayDays > 30) {
      suggestions.push(`Step ${step.stepNumber}: Very long delay may reduce effectiveness`)
    }
  }

  // Check overall sequence length
  if (totalDays < 14) {
    suggestions.push('Sequence may be too aggressive for UAE business culture')
    culturallyOptimal = false
  }

  if (totalDays > 90) {
    suggestions.push('Very long sequence - consider reducing steps or delays')
  }

  return {
    estimatedDuration: totalDays,
    businessHoursCompliant,
    culturallyOptimal,
    suggestions
  }
}

/**
 * Simulate sequence execution
 */
async function simulateSequenceExecution(
  steps: any[],
  testInvoice: any,
  companyId: string,
  sendActualEmails: boolean
): Promise<{
  emailLogIds: string[]
  scheduledTimes: Date[]
  estimatedDelivery: Date[]
}> {
  const emailLogIds: string[] = []
  const scheduledTimes: Date[] = []
  const estimatedDelivery: Date[] = []

  let currentTime = new Date()

  for (const step of steps) {
    // Calculate when this step would be sent
    const stepTime = new Date(currentTime.getTime() + (step.delayDays || 0) * 24 * 60 * 60 * 1000)
    const optimalTime = uaeBusinessHours.getNextAvailableSendTime(stepTime)
    
    scheduledTimes.push(optimalTime)
    estimatedDelivery.push(new Date(optimalTime.getTime() + 5 * 60 * 1000)) // +5 minutes for delivery

    if (sendActualEmails) {
      try {
        // Process content
        const processedContent = processStepTemplate(step, testInvoice)
        
        // Schedule test email
        const emailLogId = await emailSchedulingService.scheduleEmail({
          companyId,
          recipientEmail: testInvoice.customerEmail,
          recipientName: testInvoice.customerName,
          subject: `[TEST] ${processedContent.subject}`,
          content: `[TEST EMAIL - SEQUENCE SIMULATION]\n\n${processedContent.content}`,
          language: step.language || 'ENGLISH',
          scheduledFor: optimalTime,
          priority: 'LOW',
          sequenceId: undefined,
          stepNumber: step.stepNumber,
          maxRetries: 1,
          retryCount: 0,
          metadata: {
            isTest: true,
            originalSubject: step.subject
          }
        })

        emailLogIds.push(emailLogId)
      } catch (error) {
        console.error('Error scheduling test email:', error)
      }
    }

    currentTime = optimalTime
  }

  return {
    emailLogIds,
    scheduledTimes,
    estimatedDelivery
  }
}