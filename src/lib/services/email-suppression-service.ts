import { prisma } from '../prisma'

export interface EmailSuppressionRecord {
  id: string
  emailAddress: string
  companyId: string
  suppressionType: 'hard_bounce' | 'soft_bounce' | 'complaint' | 'unsubscribe' | 'manual'
  reason: string
  suppressedAt: Date
  suppressedBy?: string // User ID who manually suppressed
  isActive: boolean
  notes?: string
  createdAt: Date
  updatedAt: Date
}

export interface SuppressionStats {
  totalSuppressed: number
  hardBounces: number
  softBounces: number
  complaints: number
  unsubscribes: number
  manual: number
  suppressionRate: number
}

/**
 * Email Suppression Service for managing email blacklists and bounce handling
 * Ensures compliance with UAE email regulations and protects sender reputation
 */
export class EmailSuppressionService {
  
  /**
   * Add an email address to the suppression list
   */
  async suppressEmail(
    emailAddress: string,
    companyId: string,
    suppressionType: EmailSuppressionRecord['suppressionType'],
    reason: string,
    suppressedBy?: string
  ): Promise<string> {
    try {
      // Check if already suppressed
      const existing = await this.checkSuppression(emailAddress, companyId)
      if (existing.isSuppressed) {
        console.log(`Email ${emailAddress} is already suppressed`)
        return existing.suppressionId!
      }

      // Create suppression record
      const suppressionRecord = await prisma.emailSuppressionList.create({
        data: {
          id: crypto.randomUUID(),
          emailAddress: emailAddress.toLowerCase(),
          companyId,
          suppressionType,
          reason,
          suppressedAt: new Date(),
          suppressedBy,
          isActive: true
        }
      })

      // Update customer record with suppression note
      await this.updateCustomerSuppressionStatus(emailAddress, companyId, suppressionType, reason)

      // Cancel any pending emails to this address
      await this.cancelPendingEmails(emailAddress, companyId)

      console.log(`Successfully suppressed email ${emailAddress} for company ${companyId}`)
      return suppressionRecord.id

    } catch (error) {
      console.error(`Failed to suppress email ${emailAddress}:`, error)
      throw new Error(`Email suppression failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if an email address is suppressed
   */
  async checkSuppression(
    emailAddress: string, 
    companyId: string
  ): Promise<{
    isSuppressed: boolean
    suppressionType?: EmailSuppressionRecord['suppressionType']
    suppressedAt?: Date
    reason?: string
    suppressionId?: string
  }> {
    try {
      const suppression = await prisma.emailSuppressionList.findFirst({
        where: {
          emailAddress: emailAddress.toLowerCase(),
          companyId,
          isActive: true
        },
        orderBy: { suppressedAt: 'desc' }
      })

      if (suppression) {
        return {
          isSuppressed: true,
          suppressionType: suppression.suppressionType as EmailSuppressionRecord['suppressionType'],
          suppressedAt: suppression.suppressedAt,
          reason: suppression.reason,
          suppressionId: suppression.id
        }
      }

      return { isSuppressed: false }

    } catch (error) {
      console.error(`Failed to check suppression for ${emailAddress}:`, error)
      return { isSuppressed: false }
    }
  }

  /**
   * Remove an email address from the suppression list
   */
  async unsuppressEmail(
    emailAddress: string,
    companyId: string,
    unsuppressedBy?: string
  ): Promise<boolean> {
    try {
      const result = await prisma.emailSuppressionList.updateMany({
        where: {
          emailAddress: emailAddress.toLowerCase(),
          companyId,
          isActive: true
        },
        data: {
          isActive: false,
          updatedAt: new Date(),
          notes: `Unsuppressed by ${unsuppressedBy || 'system'} on ${new Date().toISOString()}`
        }
      })

      if (result.count > 0) {
        console.log(`Successfully unsuppressed email ${emailAddress}`)
        return true
      }

      return false

    } catch (error) {
      console.error(`Failed to unsuppress email ${emailAddress}:`, error)
      return false
    }
  }

  /**
   * Get suppression statistics for a company
   */
  async getSuppressionStats(
    companyId: string,
    dateRange?: { start: Date; end: Date }
  ): Promise<SuppressionStats> {
    try {
      const whereClause: any = { 
        companyId,
        isActive: true
      }

      if (dateRange) {
        whereClause.suppressedAt = {
          gte: dateRange.start,
          lte: dateRange.end
        }
      }

      // Get suppression counts by type
      const suppressions = await prisma.emailSuppressionList.groupBy({
        by: ['suppressionType'],
        where: whereClause,
        _count: { id: true }
      })

      const stats: SuppressionStats = {
        totalSuppressed: 0,
        hardBounces: 0,
        softBounces: 0,
        complaints: 0,
        unsubscribes: 0,
        manual: 0,
        suppressionRate: 0
      }

      suppressions.forEach(suppression => {
        const count = suppression._count.id
        stats.totalSuppressed += count

        switch (suppression.suppressionType) {
          case 'hard_bounce':
            stats.hardBounces = count
            break
          case 'soft_bounce':
            stats.softBounces = count
            break
          case 'complaint':
            stats.complaints = count
            break
          case 'unsubscribe':
            stats.unsubscribes = count
            break
          case 'manual':
            stats.manual = count
            break
        }
      })

      // Calculate suppression rate (percentage of total emails sent)
      const totalEmailsSent = await prisma.emailLog.count({
        where: {
          companyId,
          deliveryStatus: { in: ['SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED'] },
          ...(dateRange && {
            sentAt: {
              gte: dateRange.start,
              lte: dateRange.end
            }
          })
        }
      })

      stats.suppressionRate = totalEmailsSent > 0 
        ? Math.round((stats.totalSuppressed / totalEmailsSent) * 10000) / 100 
        : 0

      return stats

    } catch (error) {
      console.error(`Failed to get suppression stats for company ${companyId}:`, error)
      throw error
    }
  }

  /**
   * Get list of suppressed emails for a company
   */
  async getSuppressedEmails(
    companyId: string,
    options: {
      limit?: number
      offset?: number
      suppressionType?: EmailSuppressionRecord['suppressionType']
      search?: string
    } = {}
  ): Promise<{
    suppressions: EmailSuppressionRecord[]
    total: number
    hasMore: boolean
  }> {
    try {
      const { limit = 50, offset = 0, suppressionType, search } = options

      const whereClause: any = {
        companyId,
        isActive: true
      }

      if (suppressionType) {
        whereClause.suppressionType = suppressionType
      }

      if (search) {
        whereClause.emailAddress = {
          contains: search,
          mode: 'insensitive'
        }
      }

      const [suppressions, total] = await Promise.all([
        prisma.emailSuppressionList.findMany({
          where: whereClause,
          orderBy: { suppressedAt: 'desc' },
          take: limit,
          skip: offset
        }),
        prisma.emailSuppressionList.count({ where: whereClause })
      ])

      return {
        suppressions: suppressions.map(s => ({
          ...s,
          suppressionType: s.suppressionType as EmailSuppressionRecord['suppressionType']
        })),
        total,
        hasMore: offset + suppressions.length < total
      }

    } catch (error) {
      console.error(`Failed to get suppressed emails for company ${companyId}:`, error)
      throw error
    }
  }

  /**
   * Bulk check suppression status for multiple emails
   */
  async checkBulkSuppression(
    emailAddresses: string[],
    companyId: string
  ): Promise<Map<string, boolean>> {
    try {
      const suppressedEmails = await prisma.emailSuppressionList.findMany({
        where: {
          emailAddress: { in: emailAddresses.map(email => email.toLowerCase()) },
          companyId,
          isActive: true
        },
        select: { emailAddress: true }
      })

      const suppressionMap = new Map<string, boolean>()
      const suppressedSet = new Set(suppressedEmails.map(s => s.emailAddress))

      emailAddresses.forEach(email => {
        suppressionMap.set(email, suppressedSet.has(email.toLowerCase()))
      })

      return suppressionMap

    } catch (error) {
      console.error('Failed to check bulk suppression:', error)
      return new Map()
    }
  }

  /**
   * Clean up old suppression records (for data retention compliance)
   */
  async cleanupOldSuppressions(
    retentionDays: number = 365
  ): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

      const result = await prisma.emailSuppressionList.deleteMany({
        where: {
          suppressedAt: { lt: cutoffDate },
          suppressionType: { in: ['soft_bounce'] }, // Only delete soft bounces, keep hard bounces and complaints
          isActive: false
        }
      })

      console.log(`Cleaned up ${result.count} old suppression records`)
      return { deletedCount: result.count }

    } catch (error) {
      console.error('Failed to clean up old suppressions:', error)
      throw error
    }
  }

  /**
   * Update customer record with suppression status
   */
  private async updateCustomerSuppressionStatus(
    emailAddress: string,
    companyId: string,
    suppressionType: EmailSuppressionRecord['suppressionType'],
    reason: string
  ): Promise<void> {
    try {
      const customer = await prisma.customer.findFirst({
        where: {
          email: emailAddress,
          companyId
        }
      })

      if (customer) {
        const suppressionNote = `[${suppressionType.toUpperCase()}] Email suppressed on ${new Date().toLocaleDateString('en-AE')}: ${reason}`
        const existingNotes = customer.notes || ''
        const newNotes = existingNotes ? `${existingNotes}\n${suppressionNote}` : suppressionNote

        await prisma.customer.update({
          where: { id: customer.id },
          data: { notes: newNotes }
        })
      }

    } catch (error) {
      console.error('Failed to update customer suppression status:', error)
      // Don't throw - this is supplementary functionality
    }
  }

  /**
   * Cancel pending emails to suppressed address
   */
  private async cancelPendingEmails(
    emailAddress: string,
    companyId: string
  ): Promise<void> {
    try {
      await prisma.emailLog.updateMany({
        where: {
          recipientEmail: emailAddress,
          companyId,
          deliveryStatus: 'QUEUED'
        },
        data: {
          deliveryStatus: 'FAILED',
          bounceReason: 'Email address suppressed'
        }
      })

    } catch (error) {
      console.error('Failed to cancel pending emails:', error)
      // Don't throw - this is supplementary functionality
    }
  }
}

// Export singleton instance
export const emailSuppressionService = new EmailSuppressionService()