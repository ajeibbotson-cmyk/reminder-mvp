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
        companyId: session.user.companyId
      }
    })

    if (!campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Verify campaign is in paused status
    if (campaign.status !== 'paused') {
      return NextResponse.json(
        { error: `Cannot resume campaign with status: ${campaign.status}` },
        { status: 400 }
      )
    }

    // Update campaign status to sending
    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: 'sending',
        resumedAt: new Date(),
        pausedAt: null
      }
    })

    // Log activity
    await prisma.activity.create({
      data: {
        type: 'CAMPAIGN_RESUMED',
        description: `Campaign "${campaign.name}" resumed`,
        userId: session.user.id,
        companyId: session.user.companyId,
        metadata: {
          campaignId: campaign.id,
          campaignName: campaign.name
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Campaign resumed successfully',
      campaign: updatedCampaign
    })

  } catch (error) {
    console.error('Resume campaign error:', error)
    return NextResponse.json(
      { error: 'Failed to resume campaign' },
      { status: 500 }
    )
  }
}