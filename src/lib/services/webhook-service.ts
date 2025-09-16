/**
 * Webhook Service
 * Event-driven notification system for UAE Payment Collection Platform
 * 
 * Features:
 * - Real-time webhook notifications for critical events
 * - Retry mechanism with exponential backoff
 * - Webhook signature verification
 * - Event filtering and routing
 * - Delivery tracking and analytics
 * - UAE business hours aware delivery
 */

import { InvoiceStatus, PaymentMethod, UserRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AuditEventType } from './audit-trail-service'
import * as crypto from 'crypto'

// Webhook event types
export enum WebhookEventType {
  // Invoice events
  INVOICE_CREATED = 'invoice.created',
  INVOICE_STATUS_CHANGED = 'invoice.status_changed',
  INVOICE_OVERDUE = 'invoice.overdue',
  INVOICE_PAID = 'invoice.paid',
  
  // Payment events
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_FAILED = 'payment.failed',
  OVERPAYMENT_DETECTED = 'overpayment.detected',
  
  // System events
  SYSTEM_ERROR = 'system.error',
  COMPLIANCE_VIOLATION = 'compliance.violation'
}

// Webhook delivery status
export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  EXPIRED = 'expired'
}

// Webhook configuration
export interface WebhookConfig {
  id: string
  companyId: string
  url: string
  eventTypes: WebhookEventType[]
  isActive: boolean
  secret: string
  retryPolicy: {
    maxRetries: number
    initialDelayMs: number
    maxDelayMs: number
    backoffMultiplier: number
  }
  headers?: Record<string, string>
  timeout: number
  description?: string
}

// Webhook payload
export interface WebhookPayload {
  id: string
  eventType: WebhookEventType
  timestamp: string
  data: any
  companyId: string
  version: string
}

// Webhook delivery attempt
export interface WebhookDeliveryAttempt {
  id: string
  webhookId: string
  webhookUrl: string
  payload: WebhookPayload
  status: WebhookDeliveryStatus
  httpStatus?: number
  responseBody?: string
  errorMessage?: string
  attemptNumber: number
  deliveredAt?: Date
  nextRetryAt?: Date
  createdAt: Date
}

/**
 * Webhook Service
 * Manages webhook registrations and event delivery
 */
export class WebhookService {
  private readonly defaultRetryPolicy = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 300000, // 5 minutes
    backoffMultiplier: 2
  }

  private readonly defaultTimeout = 30000 // 30 seconds

  /**
   * Register a new webhook
   */
  public async registerWebhook(config: Omit<WebhookConfig, 'id' | 'secret'>): Promise<WebhookConfig> {
    const webhookId = crypto.randomUUID()
    const secret = this.generateWebhookSecret()

    const fullConfig: WebhookConfig = {
      ...config,
      id: webhookId,
      secret,
      retryPolicy: { ...this.defaultRetryPolicy, ...config.retryPolicy },
      timeout: config.timeout || this.defaultTimeout
    }

    // Store webhook configuration in database
    await prisma.webhookConfigs.create({
      data: {
        id: webhookId,
        companyId: config.companyId,
        url: config.url,
        eventTypes: config.eventTypes,
        isActive: config.isActive,
        secret: secret,
        retryPolicy: fullConfig.retryPolicy,
        headers: config.headers || {},
        timeout: fullConfig.timeout,
        description: config.description
      }
    })

    return fullConfig
  }

  /**
   * Update webhook configuration
   */
  public async updateWebhook(webhookId: string, updates: Partial<WebhookConfig>): Promise<void> {
    await prisma.webhookConfigs.update({
      where: { id: webhookId },
      data: {
        url: updates.url,
        eventTypes: updates.eventTypes,
        isActive: updates.isActive,
        retryPolicy: updates.retryPolicy,
        headers: updates.headers,
        timeout: updates.timeout,
        description: updates.description
      }
    })
  }

  /**
   * Delete webhook
   */
  public async deleteWebhook(webhookId: string): Promise<void> {
    await prisma.webhookConfigs.delete({
      where: { id: webhookId }
    })
  }

  /**
   * Trigger webhook for invoice events
   */
  public async triggerInvoiceEvent(
    eventType: WebhookEventType,
    invoice: any,
    companyId: string,
    additionalData: any = {}
  ): Promise<void> {
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      companyId,
      version: '1.0',
      data: {
        invoice: {
          id: invoice.id,
          number: invoice.number,
          customerName: invoice.customerName,
          customerEmail: invoice.customerEmail,
          totalAmount: invoice.totalAmount || invoice.amount,
          currency: invoice.currency,
          status: invoice.status,
          dueDate: invoice.dueDate,
          createdAt: invoice.createdAt
        },
        ...additionalData
      }
    }

    await this.deliverWebhook(payload)
  }

  /**
   * Trigger webhook for payment events
   */
  public async triggerPaymentEvent(
    eventType: WebhookEventType,
    payment: any,
    invoice: any,
    companyId: string,
    additionalData: any = {}
  ): Promise<void> {
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      companyId,
      version: '1.0',
      data: {
        payment: {
          id: payment.id,
          amount: payment.amount,
          method: payment.method,
          paymentDate: payment.paymentDate,
          reference: payment.reference
        },
        invoice: {
          id: invoice.id,
          number: invoice.number,
          customerName: invoice.customerName,
          totalAmount: invoice.totalAmount || invoice.amount,
          currency: invoice.currency,
          status: invoice.status
        },
        ...additionalData
      }
    }

    await this.deliverWebhook(payload)
  }

  /**
   * Trigger system event webhook
   */
  public async triggerSystemEvent(
    eventType: WebhookEventType,
    companyId: string,
    data: any
  ): Promise<void> {
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      eventType,
      timestamp: new Date().toISOString(),
      companyId,
      version: '1.0',
      data
    }

    await this.deliverWebhook(payload)
  }

  /**
   * Get webhook delivery history
   */
  public async getDeliveryHistory(
    companyId: string,
    webhookId?: string,
    limit: number = 50
  ): Promise<WebhookDeliveryAttempt[]> {
    const where: any = { companyId }
    if (webhookId) {
      where.webhookId = webhookId
    }

    const deliveries = await prisma.webhookDeliveries.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit
    })

    return deliveries.map(delivery => ({
      id: delivery.id,
      webhookId: delivery.webhookId,
      webhookUrl: delivery.webhookUrl,
      payload: delivery.payload as WebhookPayload,
      status: delivery.status as WebhookDeliveryStatus,
      httpStatus: delivery.httpStatus,
      responseBody: delivery.responseBody,
      errorMessage: delivery.errorMessage,
      attemptNumber: delivery.attemptNumber,
      deliveredAt: delivery.deliveredAt,
      nextRetryAt: delivery.nextRetryAt,
      createdAt: delivery.createdAt
    }))
  }

  /**
   * Process webhook retries
   */
  public async processRetries(): Promise<void> {
    const now = new Date()
    
    const failedDeliveries = await prisma.webhookDeliveries.findMany({
      where: {
        status: WebhookDeliveryStatus.RETRYING,
        nextRetryAt: { lte: now }
      },
      include: {
        webhookConfigs: true
      }
    })

    for (const delivery of failedDeliveries) {
      if (!delivery.webhookConfigs) continue

      const config = delivery.webhookConfigs
      const retryPolicy = config.retryPolicy as any

      if (delivery.attemptNumber >= retryPolicy.maxRetries) {
        // Mark as expired
        await prisma.webhookDeliveries.update({
          where: { id: delivery.id },
          data: { status: WebhookDeliveryStatus.EXPIRED }
        })
        continue
      }

      // Attempt redelivery
      await this.attemptDelivery({
        id: delivery.id,
        webhookId: delivery.webhookId,
        webhookUrl: delivery.webhookUrl,
        payload: delivery.payload as WebhookPayload,
        status: delivery.status as WebhookDeliveryStatus,
        attemptNumber: delivery.attemptNumber,
        createdAt: delivery.createdAt
      }, config as any)
    }
  }

  // Private methods

  private async deliverWebhook(payload: WebhookPayload): Promise<void> {
    // Find active webhooks for this company and event type
    const webhooks = await prisma.webhookConfigs.findMany({
      where: {
        companyId: payload.companyId,
        isActive: true,
        eventTypes: {
          has: payload.eventType
        }
      }
    })

    // Create delivery attempts for each webhook
    for (const webhook of webhooks) {
      const delivery: WebhookDeliveryAttempt = {
        id: crypto.randomUUID(),
        webhookId: webhook.id,
        webhookUrl: webhook.url,
        payload,
        status: WebhookDeliveryStatus.PENDING,
        attemptNumber: 1,
        createdAt: new Date()
      }

      await this.attemptDelivery(delivery, webhook as any)
    }
  }

  private async attemptDelivery(
    delivery: WebhookDeliveryAttempt,
    config: WebhookConfig
  ): Promise<void> {
    try {
      // Generate signature
      const signature = this.generateSignature(delivery.payload, config.secret)
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event-Type': delivery.payload.eventType,
        'X-Webhook-Delivery-ID': delivery.id,
        'User-Agent': 'Reminder-Webhook/1.0',
        ...config.headers
      }

      // Make HTTP request
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout)

      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(delivery.payload),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      const responseBody = await response.text()

      if (response.ok) {
        // Success
        await this.recordDeliverySuccess(delivery, response.status, responseBody)
      } else {
        // HTTP error
        await this.recordDeliveryFailure(delivery, config, response.status, responseBody)
      }

    } catch (error) {
      // Network or other error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.recordDeliveryFailure(delivery, config, undefined, undefined, errorMessage)
    }
  }

  private async recordDeliverySuccess(
    delivery: WebhookDeliveryAttempt,
    httpStatus: number,
    responseBody: string
  ): Promise<void> {
    await prisma.webhookDeliveries.upsert({
      where: { id: delivery.id },
      create: {
        id: delivery.id,
        webhookId: delivery.webhookId,
        companyId: delivery.payload.companyId,
        webhookUrl: delivery.webhookUrl,
        payload: delivery.payload,
        status: WebhookDeliveryStatus.DELIVERED,
        httpStatus,
        responseBody: responseBody.substring(0, 1000), // Limit response body size
        attemptNumber: delivery.attemptNumber,
        deliveredAt: new Date(),
        createdAt: delivery.createdAt
      },
      update: {
        status: WebhookDeliveryStatus.DELIVERED,
        httpStatus,
        responseBody: responseBody.substring(0, 1000),
        attemptNumber: delivery.attemptNumber,
        deliveredAt: new Date()
      }
    })
  }

  private async recordDeliveryFailure(
    delivery: WebhookDeliveryAttempt,
    config: WebhookConfig,
    httpStatus?: number,
    responseBody?: string,
    errorMessage?: string
  ): Promise<void> {
    const nextAttempt = delivery.attemptNumber + 1
    const retryPolicy = config.retryPolicy

    let status = WebhookDeliveryStatus.FAILED
    let nextRetryAt: Date | undefined

    if (nextAttempt <= retryPolicy.maxRetries) {
      status = WebhookDeliveryStatus.RETRYING
      const delay = Math.min(
        retryPolicy.initialDelayMs * Math.pow(retryPolicy.backoffMultiplier, delivery.attemptNumber - 1),
        retryPolicy.maxDelayMs
      )
      nextRetryAt = new Date(Date.now() + delay)
    }

    await prisma.webhookDeliveries.upsert({
      where: { id: delivery.id },
      create: {
        id: delivery.id,
        webhookId: delivery.webhookId,
        companyId: delivery.payload.companyId,
        webhookUrl: delivery.webhookUrl,
        payload: delivery.payload,
        status,
        httpStatus,
        responseBody: responseBody?.substring(0, 1000),
        errorMessage: errorMessage?.substring(0, 500),
        attemptNumber: nextAttempt,
        nextRetryAt,
        createdAt: delivery.createdAt
      },
      update: {
        status,
        httpStatus,
        responseBody: responseBody?.substring(0, 1000),
        errorMessage: errorMessage?.substring(0, 500),
        attemptNumber: nextAttempt,
        nextRetryAt
      }
    })
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  private generateSignature(payload: WebhookPayload, secret: string): string {
    const data = JSON.stringify(payload)
    return crypto.createHmac('sha256', secret).update(data).digest('hex')
  }

  /**
   * Verify webhook signature
   */
  public verifySignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  }
}

// Export singleton instance
export const webhookService = new WebhookService()