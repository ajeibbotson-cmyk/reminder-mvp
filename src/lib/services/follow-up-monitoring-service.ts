import { prisma } from '../prisma'
import { getDefaultEmailService } from '../email-service'

interface HealthCheckResult {
  component: string
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
  message: string
  metrics?: Record<string, any>
  lastChecked: Date
}

interface SystemHealth {
  overall: 'HEALTHY' | 'WARNING' | 'CRITICAL'
  components: HealthCheckResult[]
  summary: {
    totalFollowUps: number
    activeSequences: number
    processingBacklog: number
    errorRate: number
    lastProcessingRun: Date | null
  }
  recommendations: string[]
}

interface PerformanceMetrics {
  timeframe: string
  metrics: {
    followUpsTriggered: number
    emailsSent: number
    deliverySuccessRate: number
    averageProcessingTime: number
    escalationsTriggered: number
    sequenceCompletionRate: number
    errorCount: number
    warningCount: number
  }
  trends: {
    volumeTrend: 'INCREASING' | 'STABLE' | 'DECREASING'
    errorTrend: 'IMPROVING' | 'STABLE' | 'WORSENING'
    performanceTrend: 'IMPROVING' | 'STABLE' | 'DEGRADING'
  }
}

interface AlertRule {
  id: string
  name: string
  condition: string
  threshold: number
  timeframe: number // minutes
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  notificationChannels: string[]
  active: boolean
}

/**
 * Follow-up Monitoring Service
 * Provides comprehensive monitoring, alerting, and performance tracking
 * for the follow-up automation system
 */
export class FollowUpMonitoringService {
  private static readonly DEFAULT_ALERT_RULES: AlertRule[] = [
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: 'error_rate > threshold',
      threshold: 5, // 5% error rate
      timeframe: 60, // 1 hour
      severity: 'HIGH',
      notificationChannels: ['email', 'system'],
      active: true
    },
    {
      id: 'processing-backlog',
      name: 'Processing Backlog',
      condition: 'queued_emails > threshold',
      threshold: 500,
      timeframe: 30,
      severity: 'MEDIUM',
      notificationChannels: ['email'],
      active: true
    },
    {
      id: 'system-failure',
      name: 'System Processing Failure',
      condition: 'last_processing_run > threshold',
      threshold: 120, // 2 hours
      timeframe: 0,
      severity: 'CRITICAL',
      notificationChannels: ['email', 'sms'],
      active: true
    },
    {
      id: 'low-delivery-rate',
      name: 'Low Email Delivery Rate',
      condition: 'delivery_rate < threshold',
      threshold: 90, // 90% delivery rate
      timeframe: 240, // 4 hours
      severity: 'MEDIUM',
      notificationChannels: ['email'],
      active: true
    },
    {
      id: 'uae-compliance-violations',
      name: 'UAE Compliance Violations',
      condition: 'compliance_violations > threshold',
      threshold: 10,
      timeframe: 60,
      severity: 'HIGH',
      notificationChannels: ['email', 'system'],
      active: true
    }
  ]

  private alertRules: AlertRule[]

  constructor(customAlertRules: AlertRule[] = []) {
    this.alertRules = [
      ...FollowUpMonitoringService.DEFAULT_ALERT_RULES,
      ...customAlertRules
    ]
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    console.log('🏥 Performing follow-up system health check...')

    const healthChecks = await Promise.all([
      this.checkDatabaseHealth(),
      this.checkQueueHealth(),
      this.checkEmailServiceHealth(),
      this.checkProcessingHealth(),
      this.checkUAEComplianceHealth(),
      this.checkEscalationHealth()
    ])

    // Determine overall system health
    const criticalIssues = healthChecks.filter(check => check.status === 'CRITICAL')
    const warnings = healthChecks.filter(check => check.status === 'WARNING')

    let overallStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
    if (criticalIssues.length > 0) {
      overallStatus = 'CRITICAL'
    } else if (warnings.length > 0) {
      overallStatus = 'WARNING'
    }

    // Get summary metrics
    const summary = await this.getSummaryMetrics()

    // Generate recommendations
    const recommendations = this.generateRecommendations(healthChecks, summary)

    const systemHealth: SystemHealth = {
      overall: overallStatus,
      components: healthChecks,
      summary,
      recommendations
    }

    // Check for alerts
    await this.checkAndTriggerAlerts(systemHealth)

    return systemHealth
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now()

      // Test basic connectivity
      await prisma.$queryRaw`SELECT 1`

      // Check recent activity
      const recentActivities = await prisma.activity.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      })

      const responseTime = Date.now() - startTime

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
      let message = 'Database is responsive'

      if (responseTime > 5000) {
        status = 'CRITICAL'
        message = `Database response time is very slow (${responseTime}ms)`
      } else if (responseTime > 2000) {
        status = 'WARNING'
        message = `Database response time is slow (${responseTime}ms)`
      }

      return {
        component: 'Database',
        status,
        message,
        metrics: {
          responseTime,
          recentActivities,
          connectionStatus: 'connected'
        },
        lastChecked: new Date()
      }

    } catch (error) {
      return {
        component: 'Database',
        status: 'CRITICAL',
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Check email queue health
   */
  private async checkQueueHealth(): Promise<HealthCheckResult> {
    try {
      const [queuedEmails, failedEmails, oldQueuedEmails] = await Promise.all([
        prisma.followUpLog.count({
          where: { deliveryStatus: 'QUEUED' }
        }),
        prisma.followUpLog.count({
          where: {
            deliveryStatus: 'FAILED',
            sentAt: {
              gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
            }
          }
        }),
        prisma.followUpLog.count({
          where: {
            deliveryStatus: 'QUEUED',
            sentAt: {
              lt: new Date(Date.now() - 4 * 60 * 60 * 1000) // Older than 4 hours
            }
          }
        })
      ])

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
      let message = 'Email queue is healthy'

      if (queuedEmails > 1000 || oldQueuedEmails > 50) {
        status = 'CRITICAL'
        message = `Large email backlog detected (${queuedEmails} queued, ${oldQueuedEmails} overdue)`
      } else if (queuedEmails > 500 || failedEmails > 20) {
        status = 'WARNING'
        message = `Email queue showing stress (${queuedEmails} queued, ${failedEmails} failed in last hour)`
      }

      return {
        component: 'Email Queue',
        status,
        message,
        metrics: {
          queuedEmails,
          failedEmails,
          oldQueuedEmails,
          failureRate: queuedEmails > 0 ? (failedEmails / queuedEmails) * 100 : 0
        },
        lastChecked: new Date()
      }

    } catch (error) {
      return {
        component: 'Email Queue',
        status: 'CRITICAL',
        message: `Queue health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Check email service connectivity
   */
  private async checkEmailServiceHealth(): Promise<HealthCheckResult> {
    try {
      // This would typically test email service connectivity
      // For now, we'll check recent email logs
      const recentDeliveries = await prisma.emailLog.count({
        where: {
          deliveryStatus: 'DELIVERED',
          deliveredAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      })

      const recentFailures = await prisma.emailLog.count({
        where: {
          deliveryStatus: 'FAILED',
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      })

      const totalRecent = recentDeliveries + recentFailures
      const deliveryRate = totalRecent > 0 ? (recentDeliveries / totalRecent) * 100 : 100

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
      let message = 'Email service is functioning normally'

      if (deliveryRate < 80) {
        status = 'CRITICAL'
        message = `Low email delivery rate (${deliveryRate.toFixed(1)}%)`
      } else if (deliveryRate < 95) {
        status = 'WARNING'
        message = `Reduced email delivery rate (${deliveryRate.toFixed(1)}%)`
      }

      return {
        component: 'Email Service',
        status,
        message,
        metrics: {
          deliveryRate,
          recentDeliveries,
          recentFailures,
          serviceStatus: 'operational'
        },
        lastChecked: new Date()
      }

    } catch (error) {
      return {
        component: 'Email Service',
        status: 'CRITICAL',
        message: `Email service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Check cron processing health
   */
  private async checkProcessingHealth(): Promise<HealthCheckResult> {
    try {
      const lastProcessingRun = await prisma.activity.findFirst({
        where: {
          type: 'FOLLOW_UP_PROCESSING'
        },
        orderBy: { createdAt: 'desc' }
      })

      const now = new Date()
      const lastRunTime = lastProcessingRun?.createdAt
      const timeSinceLastRun = lastRunTime
        ? (now.getTime() - lastRunTime.getTime()) / (1000 * 60) // minutes
        : null

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
      let message = 'Processing is running on schedule'

      if (!lastRunTime || timeSinceLastRun! > 120) { // 2 hours
        status = 'CRITICAL'
        message = `Processing hasn't run for ${timeSinceLastRun ? Math.round(timeSinceLastRun) : 'unknown'} minutes`
      } else if (timeSinceLastRun! > 75) { // 75 minutes
        status = 'WARNING'
        message = `Processing is overdue (${Math.round(timeSinceLastRun!)} minutes since last run)`
      }

      return {
        component: 'Processing Engine',
        status,
        message,
        metrics: {
          lastRunTime,
          timeSinceLastRun,
          expectedInterval: 60, // minutes
          runningOnSchedule: timeSinceLastRun ? timeSinceLastRun < 75 : false
        },
        lastChecked: new Date()
      }

    } catch (error) {
      return {
        component: 'Processing Engine',
        status: 'CRITICAL',
        message: `Processing health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Check UAE business compliance
   */
  private async checkUAEComplianceHealth(): Promise<HealthCheckResult> {
    try {
      // Check for emails sent outside business hours in the last 24 hours
      const complianceViolations = await prisma.activity.count({
        where: {
          type: 'COMPLIANCE_VIOLATION',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })

      // Check for emails rescheduled due to cultural compliance
      const rescheduledEmails = await prisma.activity.count({
        where: {
          type: 'EMAIL_RESCHEDULED',
          description: { contains: 'UAE compliance' },
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
      let message = 'UAE business compliance is maintained'

      if (complianceViolations > 10) {
        status = 'CRITICAL'
        message = `Multiple compliance violations detected (${complianceViolations} in last 24 hours)`
      } else if (complianceViolations > 5 || rescheduledEmails > 50) {
        status = 'WARNING'
        message = `Some compliance issues detected (${complianceViolations} violations, ${rescheduledEmails} rescheduled)`
      }

      return {
        component: 'UAE Compliance',
        status,
        message,
        metrics: {
          complianceViolations,
          rescheduledEmails,
          complianceRate: 100 - (complianceViolations * 2), // Simplified calculation
          culturalSensitivityEnabled: true
        },
        lastChecked: new Date()
      }

    } catch (error) {
      return {
        component: 'UAE Compliance',
        status: 'WARNING',
        message: `Compliance check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Check escalation system health
   */
  private async checkEscalationHealth(): Promise<HealthCheckResult> {
    try {
      const recentEscalations = await prisma.activity.count({
        where: {
          type: 'FOLLOW_UP_ESCALATED',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      })

      const stuckFollowUps = await prisma.followUpLog.count({
        where: {
          deliveryStatus: 'SENT',
          sentAt: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Older than 7 days
          }
        }
      })

      let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY'
      let message = 'Escalation system is functioning normally'

      if (stuckFollowUps > 20) {
        status = 'CRITICAL'
        message = `Many stuck follow-ups detected (${stuckFollowUps} over 7 days old)`
      } else if (stuckFollowUps > 10 || recentEscalations > 50) {
        status = 'WARNING'
        message = `Some escalation issues (${stuckFollowUps} stuck, ${recentEscalations} escalated recently)`
      }

      return {
        component: 'Escalation System',
        status,
        message,
        metrics: {
          recentEscalations,
          stuckFollowUps,
          escalationRate: recentEscalations / Math.max(1, recentEscalations + stuckFollowUps) * 100,
          rulesActive: this.alertRules.filter(rule => rule.active).length
        },
        lastChecked: new Date()
      }

    } catch (error) {
      return {
        component: 'Escalation System',
        status: 'WARNING',
        message: `Escalation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date()
      }
    }
  }

  /**
   * Get summary metrics
   */
  private async getSummaryMetrics() {
    const [
      totalFollowUps,
      activeSequences,
      processingBacklog,
      lastProcessingRun
    ] = await Promise.all([
      prisma.followUpLog.count(),
      prisma.followUpSequence.count({ where: { active: true } }),
      prisma.followUpLog.count({ where: { deliveryStatus: 'QUEUED' } }),
      prisma.activity.findFirst({
        where: { type: 'FOLLOW_UP_PROCESSING' },
        orderBy: { createdAt: 'desc' }
      })
    ])

    // Calculate error rate from recent activities
    const recentErrors = await prisma.activity.count({
      where: {
        type: { contains: 'ERROR' },
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    })

    const recentTotal = await prisma.activity.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    })

    const errorRate = recentTotal > 0 ? (recentErrors / recentTotal) * 100 : 0

    return {
      totalFollowUps,
      activeSequences,
      processingBacklog,
      errorRate,
      lastProcessingRun: lastProcessingRun?.createdAt || null
    }
  }

  /**
   * Generate recommendations based on health checks
   */
  private generateRecommendations(
    healthChecks: HealthCheckResult[],
    summary: any
  ): string[] {
    const recommendations: string[] = []

    // Database recommendations
    const dbCheck = healthChecks.find(check => check.component === 'Database')
    if (dbCheck?.metrics?.responseTime > 2000) {
      recommendations.push('Consider optimizing database queries or scaling database resources')
    }

    // Queue recommendations
    const queueCheck = healthChecks.find(check => check.component === 'Email Queue')
    if (queueCheck?.metrics?.queuedEmails > 500) {
      recommendations.push('Increase email processing frequency or add more workers')
    }

    // Email service recommendations
    const emailCheck = healthChecks.find(check => check.component === 'Email Service')
    if (emailCheck?.metrics?.deliveryRate < 95) {
      recommendations.push('Review email content and sender reputation to improve delivery rates')
    }

    // Processing recommendations
    const processingCheck = healthChecks.find(check => check.component === 'Processing Engine')
    if (!processingCheck?.metrics?.runningOnSchedule) {
      recommendations.push('Check cron job configuration and server resources')
    }

    // Compliance recommendations
    const complianceCheck = healthChecks.find(check => check.component === 'UAE Compliance')
    if (complianceCheck?.metrics?.complianceViolations > 5) {
      recommendations.push('Review UAE business hours configuration and cultural compliance rules')
    }

    // General recommendations
    if (summary.errorRate > 5) {
      recommendations.push('Investigate and address recurring errors to improve system stability')
    }

    if (summary.processingBacklog > 200) {
      recommendations.push('Scale processing capacity to handle current workload')
    }

    if (recommendations.length === 0) {
      recommendations.push('System is operating within normal parameters')
    }

    return recommendations
  }

  /**
   * Check and trigger alerts based on current system state
   */
  private async checkAndTriggerAlerts(systemHealth: SystemHealth): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.active) continue

      try {
        const shouldAlert = await this.evaluateAlertRule(rule, systemHealth)
        if (shouldAlert) {
          await this.triggerAlert(rule, systemHealth)
        }
      } catch (error) {
        console.error(`Failed to evaluate alert rule ${rule.id}:`, error)
      }
    }
  }

  /**
   * Evaluate if an alert rule should trigger
   */
  private async evaluateAlertRule(
    rule: AlertRule,
    systemHealth: SystemHealth
  ): Promise<boolean> {
    const now = new Date()
    const timeframeStart = new Date(now.getTime() - rule.timeframe * 60 * 1000)

    switch (rule.condition) {
      case 'error_rate > threshold':
        return systemHealth.summary.errorRate > rule.threshold

      case 'queued_emails > threshold':
        return systemHealth.summary.processingBacklog > rule.threshold

      case 'last_processing_run > threshold':
        if (!systemHealth.summary.lastProcessingRun) return true
        const minutesSinceLastRun = (now.getTime() - systemHealth.summary.lastProcessingRun.getTime()) / (1000 * 60)
        return minutesSinceLastRun > rule.threshold

      case 'delivery_rate < threshold':
        const emailComponent = systemHealth.components.find(c => c.component === 'Email Service')
        const deliveryRate = emailComponent?.metrics?.deliveryRate || 100
        return deliveryRate < rule.threshold

      case 'compliance_violations > threshold':
        const complianceComponent = systemHealth.components.find(c => c.component === 'UAE Compliance')
        const violations = complianceComponent?.metrics?.complianceViolations || 0
        return violations > rule.threshold

      default:
        return false
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, systemHealth: SystemHealth): Promise<void> {
    try {
      console.log(`🚨 Triggering alert: ${rule.name} (${rule.severity})`)

      // Check if we've already sent this alert recently (avoid spam)
      const recentAlert = await prisma.activity.findFirst({
        where: {
          type: 'SYSTEM_ALERT',
          metadata: {
            path: ['ruleId'],
            equals: rule.id
          },
          createdAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        }
      })

      if (recentAlert) {
        console.log(`Alert ${rule.name} recently sent, skipping`)
        return
      }

      // Log the alert
      await prisma.activity.create({
        data: {
          id: crypto.randomUUID(),
          companyId: 'system',
          userId: 'monitoring-service',
          type: 'SYSTEM_ALERT',
          description: `System alert triggered: ${rule.name}`,
          metadata: {
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            condition: rule.condition,
            threshold: rule.threshold,
            systemHealth: {
              overall: systemHealth.overall,
              summary: systemHealth.summary
            }
          }
        }
      })

      // Send notifications based on configured channels
      if (rule.notificationChannels.includes('email')) {
        await this.sendEmailAlert(rule, systemHealth)
      }

      if (rule.notificationChannels.includes('system')) {
        await this.sendSystemAlert(rule, systemHealth)
      }

    } catch (error) {
      console.error(`Failed to trigger alert ${rule.name}:`, error)
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(rule: AlertRule, systemHealth: SystemHealth): Promise<void> {
    try {
      const emailService = getDefaultEmailService()

      // Find system administrators
      const admins = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          email: { not: null }
        },
        take: 5 // Limit to prevent spam
      })

      if (admins.length === 0) {
        console.log('No administrators found for email alerts')
        return
      }

      const alertSubject = `[${rule.severity}] Follow-up System Alert: ${rule.name}`
      const alertContent = `
        <h2>System Alert Notification</h2>
        <p><strong>Alert:</strong> ${rule.name}</p>
        <p><strong>Severity:</strong> ${rule.severity}</p>
        <p><strong>Condition:</strong> ${rule.condition}</p>
        <p><strong>Threshold:</strong> ${rule.threshold}</p>

        <h3>Current System Status</h3>
        <p><strong>Overall Health:</strong> ${systemHealth.overall}</p>
        <ul>
          <li>Processing Backlog: ${systemHealth.summary.processingBacklog}</li>
          <li>Error Rate: ${systemHealth.summary.errorRate.toFixed(2)}%</li>
          <li>Active Sequences: ${systemHealth.summary.activeSequences}</li>
        </ul>

        <h3>Component Status</h3>
        <ul>
          ${systemHealth.components.map(component =>
            `<li><strong>${component.component}:</strong> ${component.status} - ${component.message}</li>`
          ).join('')}
        </ul>

        <h3>Recommendations</h3>
        <ul>
          ${systemHealth.recommendations.map(rec => `<li>${rec}</li>`).join('')}
        </ul>

        <p><em>Alert triggered at: ${new Date().toISOString()}</em></p>
      `

      // Send to first admin
      const admin = admins[0]
      await emailService.sendEmail({
        companyId: 'system',
        recipientEmail: admin.email!,
        recipientName: admin.name,
        subject: alertSubject,
        content: alertContent
      })

    } catch (error) {
      console.error('Failed to send email alert:', error)
    }
  }

  /**
   * Send system alert (internal logging)
   */
  private async sendSystemAlert(rule: AlertRule, systemHealth: SystemHealth): Promise<void> {
    // This could integrate with external monitoring systems like Datadog, New Relic, etc.
    console.log(`📊 System alert logged: ${rule.name} (${rule.severity})`)

    // For now, just ensure it's logged in our activity table
    // In production, this would send to external monitoring services
  }

  /**
   * Get performance metrics for a given timeframe
   */
  async getPerformanceMetrics(
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<PerformanceMetrics> {
    const timeframeMs = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    }

    const start = new Date(Date.now() - timeframeMs[timeframe])
    const end = new Date()

    const [
      followUpsTriggered,
      emailsSent,
      emailsDelivered,
      emailsFailed,
      escalationsTriggered,
      sequencesCompleted,
      errorActivities,
      warningActivities,
      processingTimes
    ] = await Promise.all([
      prisma.activity.count({
        where: {
          type: 'FOLLOW_UP_TRIGGERED',
          createdAt: { gte: start, lte: end }
        }
      }),
      prisma.followUpLog.count({
        where: {
          deliveryStatus: { in: ['SENT', 'DELIVERED'] },
          sentAt: { gte: start, lte: end }
        }
      }),
      prisma.followUpLog.count({
        where: {
          deliveryStatus: 'DELIVERED',
          sentAt: { gte: start, lte: end }
        }
      }),
      prisma.followUpLog.count({
        where: {
          deliveryStatus: 'FAILED',
          sentAt: { gte: start, lte: end }
        }
      }),
      prisma.activity.count({
        where: {
          type: 'FOLLOW_UP_ESCALATED',
          createdAt: { gte: start, lte: end }
        }
      }),
      prisma.activity.count({
        where: {
          type: 'SEQUENCE_COMPLETED',
          createdAt: { gte: start, lte: end }
        }
      }),
      prisma.activity.count({
        where: {
          type: { contains: 'ERROR' },
          createdAt: { gte: start, lte: end }
        }
      }),
      prisma.activity.count({
        where: {
          type: { contains: 'WARNING' },
          createdAt: { gte: start, lte: end }
        }
      }),
      prisma.activity.findMany({
        where: {
          type: 'FOLLOW_UP_PROCESSING',
          createdAt: { gte: start, lte: end }
        },
        select: {
          metadata: true
        }
      })
    ])

    const deliverySuccessRate = emailsSent > 0 ? (emailsDelivered / emailsSent) * 100 : 100
    const sequenceCompletionRate = followUpsTriggered > 0 ? (sequencesCompleted / followUpsTriggered) * 100 : 0

    // Calculate average processing time
    const avgProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((sum, activity) => {
          const duration = activity.metadata?.duration || 0
          return sum + duration
        }, 0) / processingTimes.length
      : 0

    return {
      timeframe,
      metrics: {
        followUpsTriggered,
        emailsSent,
        deliverySuccessRate,
        averageProcessingTime: avgProcessingTime,
        escalationsTriggered,
        sequenceCompletionRate,
        errorCount: errorActivities,
        warningCount: warningActivities
      },
      trends: {
        volumeTrend: 'STABLE', // Would need historical comparison
        errorTrend: 'STABLE',   // Would need historical comparison
        performanceTrend: 'STABLE' // Would need historical comparison
      }
    }
  }
}

// Singleton instance for global use
export const followUpMonitoringService = new FollowUpMonitoringService()