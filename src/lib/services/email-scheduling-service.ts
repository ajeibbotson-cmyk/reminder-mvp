import { prisma } from '../prisma'
import { uaeBusinessHours, ScheduleConfig } from './uae-business-hours-service'
import { culturalCompliance, SequenceType, CustomerRelationship } from './cultural-compliance-service'
import { getDefaultEmailService, SendEmailOptions } from '../email-service'

export interface ScheduledEmail {
  id: string
  companyId: string
  invoiceId?: string
  customerId?: string
  templateId?: string
  recipientEmail: string
  recipientName?: string
  subject: string
  content: string
  language: 'ENGLISH' | 'ARABIC'
  scheduledFor: Date
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  sequenceId?: string
  stepNumber?: number
  maxRetries: number
  retryCount: number
  status: 'QUEUED' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED'
  metadata?: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface SchedulingOptions {
  respectBusinessHours: boolean
  avoidHolidays: boolean
  avoidPrayerTimes: boolean
  preferOptimalTiming: boolean
  customScheduleConfig?: Partial<ScheduleConfig>
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  maxRetries: number
  retryDelayMinutes: number
}

export interface QueueMetrics {
  totalQueued: number
  scheduledForToday: number
  failedLastHour: number
  avgDeliveryTime: number
  successRate: number
  queueHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL'
}

export interface RateLimitConfig {
  maxEmailsPerHour: number
  maxEmailsPerDay: number
  burstLimit: number
  cooldownMinutes: number
}

/**
 * Email Scheduling Service with UAE Business Logic
 * Handles intelligent email scheduling, queue management, and rate limiting
 */
export class EmailSchedulingService {
  private readonly DEFAULT_RATE_LIMITS: RateLimitConfig = {
    maxEmailsPerHour: 200, // AWS SES default
    maxEmailsPerDay: 2000,
    burstLimit: 50,
    cooldownMinutes: 5
  }

  private readonly DEFAULT_SCHEDULING_OPTIONS: SchedulingOptions = {
    respectBusinessHours: true,
    avoidHolidays: true,
    avoidPrayerTimes: true,
    preferOptimalTiming: true,
    priority: 'NORMAL',
    maxRetries: 3,
    retryDelayMinutes: 30
  }

  private rateLimits: RateLimitConfig
  private emailService = getDefaultEmailService()

  constructor(customRateLimits?: Partial<RateLimitConfig>) {
    this.rateLimits = { ...this.DEFAULT_RATE_LIMITS, ...customRateLimits }
  }

  /**
   * Schedule an email with UAE business logic and cultural compliance
   */
  async scheduleEmail(
    emailData: Omit<ScheduledEmail, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'>,
    options: Partial<SchedulingOptions> = {}
  ): Promise<string> {
    const schedulingOptions = { ...this.DEFAULT_SCHEDULING_OPTIONS, ...options }
    
    try {
      // Validate scheduling constraints
      await this.validateSchedulingConstraints(emailData.companyId)
      
      // Determine optimal send time
      const optimalSendTime = await this.calculateOptimalSendTime(
        emailData,
        schedulingOptions
      )

      // Validate cultural compliance
      const complianceCheck = culturalCompliance.validateTemplateContent({
        contentEn: emailData.content,
        subjectEn: emailData.subject
      })

      if (!complianceCheck.isValid) {
        throw new Error(`Cultural compliance issues: ${complianceCheck.issues.join(', ')}`)
      }

      // Create email log entry with scheduled status
      const emailLog = await prisma.emailLog.create({
        data: {
          id: crypto.randomUUID(),
          templateId: emailData.templateId,
          companyId: emailData.companyId,
          invoiceId: emailData.invoiceId,
          customerId: emailData.customerId,
          recipientEmail: emailData.recipientEmail,
          recipientName: emailData.recipientName,
          subject: emailData.subject,
          content: emailData.content,
          language: emailData.language,
          deliveryStatus: 'QUEUED',
          uaeSendTime: optimalSendTime,
          maxRetries: schedulingOptions.maxRetries,
          retryCount: 0
        }
      })

      // If scheduled for immediate sending (within 5 minutes), process now
      if (optimalSendTime.getTime() - Date.now() <= 5 * 60 * 1000) {
        await this.processImmediateEmail(emailLog.id)
      }

      return emailLog.id

    } catch (error) {
      throw new Error(`Failed to schedule email: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Calculate optimal send time based on UAE business culture and constraints
   */
  private async calculateOptimalSendTime(
    emailData: Omit<ScheduledEmail, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'retryCount'>,
    options: SchedulingOptions
  ): Promise<Date> {
    let baseTime = emailData.scheduledFor

    // If no specific time provided, use current time
    if (!baseTime) {
      baseTime = new Date()
    }

    // Handle urgent priority - send ASAP within business hours
    if (emailData.priority === 'URGENT') {
      if (uaeBusinessHours.isBusinessHours(baseTime)) {
        return baseTime
      } else {
        return uaeBusinessHours.getNextBusinessHour(baseTime)
      }
    }

    // Get cultural timing preferences
    const sequenceType = this.inferSequenceType(emailData)
    const customerRelationship = await this.inferCustomerRelationship(
      emailData.companyId,
      emailData.customerId
    )
    
    const culturalConfig = culturalCompliance.suggestOptimalTiming(
      sequenceType,
      customerRelationship
    )

    // Merge with custom config
    const finalConfig: ScheduleConfig = {
      ...culturalConfig,
      ...options.customScheduleConfig
    }

    // Apply scheduling preferences
    if (options.preferOptimalTiming) {
      return uaeBusinessHours.getNextAvailableSendTime(baseTime, finalConfig)
    } else if (options.respectBusinessHours) {
      return uaeBusinessHours.getNextBusinessHour(baseTime)
    }

    return baseTime
  }

  /**
   * Infer sequence type from email content/metadata
   */
  private inferSequenceType(emailData: any): SequenceType {
    const subject = emailData.subject?.toLowerCase() || ''
    const content = emailData.content?.toLowerCase() || ''
    
    if (subject.includes('first') || subject.includes('reminder') || emailData.stepNumber === 1) {
      return 'FIRST_REMINDER'
    } else if (subject.includes('second') || subject.includes('follow') || emailData.stepNumber === 2) {
      return 'SECOND_REMINDER'
    } else if (subject.includes('final') || subject.includes('last') || emailData.stepNumber >= 3) {
      return 'FINAL_NOTICE'
    } else if (subject.includes('overdue') || content.includes('overdue')) {
      return 'OVERDUE'
    } else {
      return 'PAYMENT_REQUEST'
    }
  }

  /**
   * Infer customer relationship level
   */
  private async inferCustomerRelationship(
    companyId: string,
    customerId?: string
  ): Promise<CustomerRelationship> {
    if (!customerId) return 'REGULAR'

    try {
      const customer = await prisma.customers.findUnique({
        where: { id: customerId },
        include: {
          invoices: {
            where: { status: 'PAID' }
          }
        }
      })

      if (!customer) return 'REGULAR'

      // Simple heuristics for relationship classification
      const paidInvoices = customer.invoices.length
      const customerAge = Date.now() - customer.createdAt.getTime()
      const monthsActive = customerAge / (1000 * 60 * 60 * 24 * 30)

      if (customer.name.toLowerCase().includes('government') || 
          customer.name.toLowerCase().includes('ministry')) {
        return 'GOVERNMENT'
      } else if (paidInvoices > 50 || monthsActive > 24) {
        return 'VIP'
      } else if (paidInvoices > 10 || monthsActive > 6) {
        return 'CORPORATE'
      } else if (monthsActive < 1) {
        return 'NEW'
      } else {
        return 'REGULAR'
      }
    } catch {
      return 'REGULAR'
    }
  }

  /**
   * Process scheduled emails that are ready to send
   */
  async processScheduledEmails(): Promise<{
    processed: number
    sent: number
    failed: number
    rescheduled: number
  }> {
    const results = {
      processed: 0,
      sent: 0,
      failed: 0,
      rescheduled: 0
    }

    try {
      // Check rate limits
      const canSend = await this.checkRateLimits()
      if (!canSend.allowed) {
        console.log(`Rate limit reached. Next available: ${canSend.nextAvailable}`)
        return results
      }

      // Get emails ready to send
      const readyEmails = await prisma.emailLog.findMany({
        where: {
          deliveryStatus: 'QUEUED',
          uaeSendTime: {
            lte: new Date()
          },
          retryCount: {
            lt: prisma.emailLog.fields.maxRetries
          }
        },
        orderBy: [
          { uaeSendTime: 'asc' }
        ],
        take: Math.min(canSend.availableSlots, 50) // Process in batches
      })

      for (const email of readyEmails) {
        results.processed++

        try {
          // Final business hours check
          if (!uaeBusinessHours.isBusinessHours(new Date())) {
            const nextBusinessHour = uaeBusinessHours.getNextBusinessHour(new Date())
            
            await prisma.emailLog.update({
              where: { id: email.id },
              data: { 
                uaeSendTime: nextBusinessHour,
                updatedAt: new Date()
              }
            })
            
            results.rescheduled++
            continue
          }

          // Send the email
          await this.sendScheduledEmail(email)
          results.sent++

        } catch (error) {
          console.error(`Failed to send email ${email.id}:`, error)
          
          // Handle retry logic
          const shouldRetry = email.retryCount < email.maxRetries
          
          if (shouldRetry) {
            const nextRetry = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
            
            await prisma.emailLog.update({
              where: { id: email.id },
              data: {
                retryCount: email.retryCount + 1,
                uaeSendTime: nextRetry,
                bounceReason: error instanceof Error ? error.message : 'Retry scheduled',
                updatedAt: new Date()
              }
            })
            
            results.rescheduled++
          } else {
            await prisma.emailLog.update({
              where: { id: email.id },
              data: {
                deliveryStatus: 'FAILED',
                bounceReason: error instanceof Error ? error.message : 'Max retries exceeded',
                updatedAt: new Date()
              }
            })
            
            results.failed++
          }
        }
      }

      return results

    } catch (error) {
      console.error('Error processing scheduled emails:', error)
      throw error
    }
  }

  /**
   * Send a scheduled email
   */
  private async sendScheduledEmail(emailLog: any): Promise<void> {
    try {
      // Update status to sending
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'SENT',
          sentAt: new Date()
        }
      })

      // Send via email service
      const sendOptions: SendEmailOptions = {
        companyId: emailLog.companyId,
        invoiceId: emailLog.invoiceId,
        customerId: emailLog.customerId,
        recipientEmail: emailLog.recipientEmail,
        recipientName: emailLog.recipientName,
        subject: emailLog.subject,
        content: emailLog.content,
        language: emailLog.language,
        scheduleForBusinessHours: false // Already scheduled
      }

      await this.emailService.sendEmail(sendOptions)

      // Update final status
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'DELIVERED',
          deliveredAt: new Date()
        }
      })

    } catch (error) {
      // Update status to failed
      await prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          deliveryStatus: 'FAILED',
          bounceReason: error instanceof Error ? error.message : 'Delivery failed'
        }
      })
      
      throw error
    }
  }

  /**
   * Process email that should be sent immediately
   */
  private async processImmediateEmail(emailLogId: string): Promise<void> {
    try {
      const emailLog = await prisma.emailLog.findUnique({
        where: { id: emailLogId }
      })

      if (!emailLog) {
        throw new Error('Email log not found')
      }

      await this.sendScheduledEmail(emailLog)
    } catch (error) {
      console.error(`Failed to process immediate email ${emailLogId}:`, error)
      throw error
    }
  }

  /**
   * Check rate limits and return sending capacity
   */
  private async checkRateLimits(): Promise<{
    allowed: boolean
    availableSlots: number
    nextAvailable?: Date
  }> {
    try {
      const now = new Date()
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

      // Count emails sent in last hour and day
      const [sentLastHour, sentLastDay] = await Promise.all([
        prisma.emailLog.count({
          where: {
            deliveryStatus: { in: ['SENT', 'DELIVERED'] },
            sentAt: { gte: hourAgo }
          }
        }),
        prisma.emailLog.count({
          where: {
            deliveryStatus: { in: ['SENT', 'DELIVERED'] },
            sentAt: { gte: dayAgo }
          }
        })
      ])

      // Check hourly limit
      if (sentLastHour >= this.rateLimits.maxEmailsPerHour) {
        return {
          allowed: false,
          availableSlots: 0,
          nextAvailable: new Date(hourAgo.getTime() + 60 * 60 * 1000)
        }
      }

      // Check daily limit
      if (sentLastDay >= this.rateLimits.maxEmailsPerDay) {
        return {
          allowed: false,
          availableSlots: 0,
          nextAvailable: new Date(dayAgo.getTime() + 24 * 60 * 60 * 1000)
        }
      }

      // Calculate available slots
      const hourlySlots = this.rateLimits.maxEmailsPerHour - sentLastHour
      const dailySlots = this.rateLimits.maxEmailsPerDay - sentLastDay
      const availableSlots = Math.min(hourlySlots, dailySlots, this.rateLimits.burstLimit)

      return {
        allowed: availableSlots > 0,
        availableSlots
      }

    } catch (error) {
      console.error('Error checking rate limits:', error)
      return { allowed: false, availableSlots: 0 }
    }
  }

  /**
   * Validate scheduling constraints for company
   */
  private async validateSchedulingConstraints(companyId: string): Promise<void> {
    try {
      const company = await prisma.company.findUnique({
        where: { id: companyId }
      })

      if (!company) {
        throw new Error('Company not found')
      }

      // Check if company has email settings configured
      const emailSettings = company.emailSettings as any
      if (emailSettings?.disabled) {
        throw new Error('Email sending is disabled for this company')
      }

      // Check for any email suppression rules
      // This could include temporary suspensions, compliance issues, etc.
      
    } catch (error) {
      throw new Error(`Scheduling validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get queue metrics and health status
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    try {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      const [
        totalQueued,
        scheduledForToday,
        failedLastHour,
        recentEmails
      ] = await Promise.all([
        prisma.emailLog.count({
          where: { deliveryStatus: 'QUEUED' }
        }),
        prisma.emailLog.count({
          where: {
            deliveryStatus: 'QUEUED',
            uaeSendTime: {
              gte: todayStart,
              lt: new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)
            }
          }
        }),
        prisma.emailLog.count({
          where: {
            deliveryStatus: 'FAILED',
            updatedAt: { gte: hourAgo }
          }
        }),
        prisma.emailLog.findMany({
          where: {
            deliveryStatus: { in: ['SENT', 'DELIVERED', 'FAILED'] },
            updatedAt: { gte: hourAgo }
          },
          select: {
            deliveryStatus: true,
            sentAt: true,
            deliveredAt: true
          }
        })
      ])

      // Calculate success rate
      const totalRecent = recentEmails.length
      const successfulRecent = recentEmails.filter(email => 
        email.deliveryStatus === 'DELIVERED'
      ).length
      const successRate = totalRecent > 0 ? (successfulRecent / totalRecent) * 100 : 100

      // Calculate average delivery time
      const deliveredEmails = recentEmails.filter(email => 
        email.sentAt && email.deliveredAt
      )
      const avgDeliveryTime = deliveredEmails.length > 0
        ? deliveredEmails.reduce((sum, email) => {
            const deliveryTime = email.deliveredAt!.getTime() - email.sentAt!.getTime()
            return sum + deliveryTime
          }, 0) / deliveredEmails.length / 1000 // Convert to seconds
        : 0

      // Determine queue health
      let queueHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
      if (failedLastHour > 20 || successRate < 80) {
        queueHealth = 'CRITICAL'
      } else if (failedLastHour > 10 || successRate < 90 || totalQueued > 1000) {
        queueHealth = 'WARNING'
      }

      return {
        totalQueued,
        scheduledForToday,
        failedLastHour,
        avgDeliveryTime: Math.round(avgDeliveryTime),
        successRate: Math.round(successRate * 100) / 100,
        queueHealth
      }

    } catch (error) {
      console.error('Error getting queue metrics:', error)
      return {
        totalQueued: 0,
        scheduledForToday: 0,
        failedLastHour: 0,
        avgDeliveryTime: 0,
        successRate: 0,
        queueHealth: 'CRITICAL'
      }
    }
  }

  /**
   * Cancel a scheduled email
   */
  async cancelScheduledEmail(emailLogId: string): Promise<boolean> {
    try {
      const result = await prisma.emailLog.updateMany({
        where: {
          id: emailLogId,
          deliveryStatus: 'QUEUED'
        },
        data: {
          deliveryStatus: 'FAILED',
          bounceReason: 'Cancelled by user',
          updatedAt: new Date()
        }
      })

      return result.count > 0
    } catch (error) {
      console.error(`Error cancelling email ${emailLogId}:`, error)
      return false
    }
  }

  /**
   * Reschedule a failed or queued email
   */
  async rescheduleEmail(
    emailLogId: string,
    newScheduleTime: Date,
    resetRetryCount = false
  ): Promise<boolean> {
    try {
      const updateData: any = {
        uaeSendTime: newScheduleTime,
        deliveryStatus: 'QUEUED',
        bounceReason: null,
        updatedAt: new Date()
      }

      if (resetRetryCount) {
        updateData.retryCount = 0
      }

      const result = await prisma.emailLog.updateMany({
        where: {
          id: emailLogId,
          deliveryStatus: { in: ['QUEUED', 'FAILED'] }
        },
        data: updateData
      })

      return result.count > 0
    } catch (error) {
      console.error(`Error rescheduling email ${emailLogId}:`, error)
      return false
    }
  }
}

// Export singleton instance
export const emailSchedulingService = new EmailSchedulingService()