import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const BucketConfigSchema = z.object({
  bucket_id: z.string(),
  auto_send_enabled: z.boolean().optional(),
  email_templateId: z.string().nullable().optional(),
  send_time_hour: z.number().min(0).max(23).optional(),
  send_days_of_week: z.array(z.number().min(0).max(6)).optional()
})

/**
 * GET /api/bucket-configs
 * Get all bucket configurations for the current company
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with company
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { company: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get all bucket configs for company
    const configs = await prisma.bucketConfig.findMany({
      where: { companyId: user.company_id },
      orderBy: { bucket_id: 'asc' }
    })

    return NextResponse.json({ configs })

  } catch (error) {
    console.error('Error fetching bucket configs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bucket configurations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/bucket-configs
 * Create or update a bucket configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user with company
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { company: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = BucketConfigSchema.parse(body)

    // Upsert bucket config
    const config = await prisma.bucketConfig.upsert({
      where: {
        company_id_bucket_id: {
          companyId: user.company_id,
          bucket_id: validatedData.bucket_id
        }
      },
      update: {
        auto_send_enabled: validatedData.auto_send_enabled,
        email_templateId: validatedData.email_templateId,
        send_time_hour: validatedData.send_time_hour,
        send_days_of_week: validatedData.send_days_of_week as any
      },
      create: {
        companyId: user.company_id,
        bucket_id: validatedData.bucket_id,
        auto_send_enabled: validatedData.auto_send_enabled ?? false,
        email_templateId: validatedData.email_templateId,
        send_time_hour: validatedData.send_time_hour ?? 9,
        send_days_of_week: validatedData.send_days_of_week ?? [0, 1, 2, 3, 4]
      }
    })

    return NextResponse.json({ config })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error upserting bucket config:', error)
    return NextResponse.json(
      { error: 'Failed to update bucket configuration' },
      { status: 500 }
    )
  }
}
