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
      }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Verify campaign is in sending status
    if (campaign.status !== 'sending') {
      return NextResponse.json(
        { error: `Cannot pause campaign with status: ${campaign.status}` },
        { status: 400 }
      )
    }

    // Update campaign status to paused
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'paused',
        pausedAt: new Date()
      }
    })

    // Log activity
    await prisma.activities.create({
      data: {
        type: 'CAMPAIGN_PAUSED',
        description: `Campaign "${campaign.name}" paused`,
        userId: session.user.id,
        companyId: session.user.companiesId,
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Campaign paused successfully',
      campaign: updatedCampaign
    })

  } catch (error) {
    console.error('Pause campaign error:', error)
    return NextResponse.json(
      { error: 'Failed to pause campaign' },
      { status: 500 }
    )
  }
}