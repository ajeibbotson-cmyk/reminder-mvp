import { NextRequest, NextResponse } from 'next/server'
import { abTestingService } from '@/lib/services/ab-testing-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'create':
        return await handleCreateTest(data)
      case 'assign':
        return await handleAssignVariant(data)
      case 'track':
        return await handleTrackEvent(data)
      case 'analyze':
        return await handleAnalyzeTest(data)
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('A/B testing API error:', error)
    return NextResponse.json(
      { error: 'Failed to process A/B testing request' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const testId = searchParams.get('testId')
    const companyId = searchParams.get('companyId')
    const action = searchParams.get('action') || 'analyze'

    if (!testId) {
      return NextResponse.json({ error: 'Missing testId' }, { status: 400 })
    }

    if (action === 'analyze') {
      const analysis = await abTestingService.analyzeABTest(testId)
      return NextResponse.json(analysis)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (error) {
    console.error('A/B testing GET API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch A/B test data' },
      { status: 500 }
    )
  }
}

/**
 * Handle creating a new A/B test
 */
async function handleCreateTest(data: any) {
  const {
    name,
    description,
    companyId,
    variants,
    targetAudience,
    successMetrics,
    minimumSampleSize = 1000,
    significanceLevel = 0.05,
    power = 0.80,
    startDate,
    endDate
  } = data

  // Validate required fields
  if (!name || !companyId || !variants || !Array.isArray(variants) || variants.length < 2) {
    return NextResponse.json(
      { error: 'Missing required fields: name, companyId, variants (minimum 2)' },
      { status: 400 }
    )
  }

  // Validate variant weights sum to 1.0
  const totalWeight = variants.reduce((sum: number, v: any) => sum + (v.weight || 0), 0)
  if (Math.abs(totalWeight - 1.0) > 0.001) {
    return NextResponse.json(
      { error: 'Variant weights must sum to 1.0' },
      { status: 400 }
    )
  }

  const testConfig = {
    name,
    description,
    companyId,
    variants,
    targetAudience: targetAudience || {},
    successMetrics: successMetrics || { primary: 'open_rate' },
    minimumSampleSize,
    significanceLevel,
    power,
    status: 'draft' as const,
    startDate: new Date(startDate || Date.now()),
    endDate: endDate ? new Date(endDate) : undefined
  }

  const testId = await abTestingService.createABTest(testConfig)

  return NextResponse.json({
    success: true,
    testId,
    message: 'A/B test created successfully'
  })
}

/**
 * Handle assigning a variant to a recipient
 */
async function handleAssignVariant(data: any) {
  const { testId, recipientEmail, recipientId } = data

  if (!testId || !recipientEmail) {
    return NextResponse.json(
      { error: 'Missing required fields: testId, recipientEmail' },
      { status: 400 }
    )
  }

  const variant = await abTestingService.assignVariant(testId, recipientEmail, recipientId)

  if (!variant) {
    return NextResponse.json(
      { error: 'Failed to assign variant - test may not be active' },
      { status: 400 }
    )
  }

  return NextResponse.json({
    success: true,
    variant: {
      id: variant.id,
      name: variant.name,
      weight: variant.weight
    }
  })
}

/**
 * Handle tracking an event
 */
async function handleTrackEvent(data: any) {
  const { testId, recipientEmail, eventType, eventData } = data

  if (!testId || !recipientEmail || !eventType) {
    return NextResponse.json(
      { error: 'Missing required fields: testId, recipientEmail, eventType' },
      { status: 400 }
    )
  }

  const validEvents = ['sent', 'delivered', 'opened', 'clicked', 'converted']
  if (!validEvents.includes(eventType)) {
    return NextResponse.json(
      { error: `Invalid eventType. Must be one of: ${validEvents.join(', ')}` },
      { status: 400 }
    )
  }

  await abTestingService.trackEvent(testId, recipientEmail, eventType, eventData)

  return NextResponse.json({
    success: true,
    message: `Event '${eventType}' tracked successfully`
  })
}

/**
 * Handle analyzing test results
 */
async function handleAnalyzeTest(data: any) {
  const { testId } = data

  if (!testId) {
    return NextResponse.json(
      { error: 'Missing required field: testId' },
      { status: 400 }
    )
  }

  const analysis = await abTestingService.analyzeABTest(testId)

  return NextResponse.json({
    success: true,
    analysis
  })
}

// Example A/B test creation payload for reference
export const EXAMPLE_AB_TEST = {
  action: 'create',
  name: 'Payment Reminder Subject Line Test',
  description: 'Testing different subject line approaches for payment reminders',
  companyId: 'company-uuid',
  variants: [
    {
      id: 'control',
      name: 'Control - Standard Reminder',
      description: 'Current subject line approach',
      weight: 0.5,
      emailTemplate: {
        subject: 'Payment Reminder - Invoice {{invoiceNumber}}',
        content: 'Standard reminder email...'
      }
    },
    {
      id: 'variant-a',
      name: 'Urgency - Action Required',
      description: 'Subject line emphasizing urgency',
      weight: 0.5,
      emailTemplate: {
        subject: 'Action Required: Payment Due for Invoice {{invoiceNumber}}',
        content: 'Urgent reminder email...'
      }
    }
  ],
  targetAudience: {
    customerSegment: 'regular',
    invoiceStatus: ['OVERDUE']
  },
  successMetrics: {
    primary: 'open_rate',
    secondary: ['click_rate', 'conversion_rate']
  },
  minimumSampleSize: 1000,
  significanceLevel: 0.05,
  power: 0.80,
  startDate: new Date().toISOString()
}