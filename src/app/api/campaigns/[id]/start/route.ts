import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.companyId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const campaignId = params.id

    // Verify campaign exists and belongs to user's company
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        companyId: session.user.companiesId
      },
      include: {
        invoices: {
          include: {
            customer: true
          }
        }
      }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Verify campaign is in draft status
    if (campaign.status !== 'draft') {
      return NextResponse.json(
        { error: `Cannot start campaign with status: ${campaign.status}` },
        { status: 400 }
      )
    }

    // Verify campaign has invoices
    if (!campaign.invoices || campaign.invoices.length === 0) {
      return NextResponse.json(
        { error: 'Campaign has no invoices to send' },
        { status: 400 }
      )
    }

    // Update campaign status to sending
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'sending',
        startedAt: new Date(),
        progress: {
          upsert: {
            create: {
              sentCount: 0,
              failedCount: 0,
              totalRecipients: campaign.invoices.length,
              percentComplete: 0,
              currentBatch: 1,
              totalBatches: Math.ceil(campaign.invoices.length / (campaign.batchSize || 10)),
              lastUpdated: new Date()
            },
            update: {
              sentCount: 0,
              failedCount: 0,
              totalRecipients: campaign.invoices.length,
              percentComplete: 0,
              currentBatch: 1,
              totalBatches: Math.ceil(campaign.invoices.length / (campaign.batchSize || 10)),
              lastUpdated: new Date()
            }
          }
        }
      }
    })

    // Log activity
    await prisma.activities.create({
      data: {
        type: 'CAMPAIGN_STARTED',
        description: `Campaign "${campaign.name}" started`,
        userId: session.user.id,
        companyId: session.user.companiesId,
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name,
          totalRecipients: campaign.invoices.length
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Campaign started successfully',
      campaign: updatedCampaign
    })

  } catch (error) {
    console.error('Start campaign error:', error)
    return NextResponse.json(
      { error: 'Failed to start campaign' },
      { status: 500 }
    )
  }
}