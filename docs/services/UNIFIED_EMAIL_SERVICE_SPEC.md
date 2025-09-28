# 🔄 UNIFIED EMAIL SERVICE SPECIFICATION
## Service Layer Integration for Invoice → Email Workflow

**Purpose**: Comprehensive specification for the UnifiedEmailService class that merges Reminder's invoice management with SendAChaser's email automation
**Context**: Core service layer for the unified platform enabling POP Trading's 2.5hr → 10min workflow transformation
**Updated**: September 28, 2025

---

## 🎯 SERVICE OVERVIEW

### **Core Responsibility**
The `UnifiedEmailService` serves as the primary orchestration layer that connects invoice data with email automation, enabling seamless campaign creation and execution from extracted invoice information.

### **Key Capabilities**
- ✅ **Invoice-to-Campaign Flow**: Convert invoice data into personalized email campaigns
- ✅ **AWS SES Integration**: Leverage existing production email infrastructure for reliable delivery
- ✅ **Bulk Email Processing**: Manage high-volume email sending with rate limiting
- ✅ **Real-time Progress Tracking**: Provide campaign progress updates with ETA calculation
- ✅ **Multi-tenant Security**: Ensure company-scoped data isolation throughout
- ✅ **Comprehensive Audit Trail**: Track all email activities for compliance and analytics

### **Architecture Integration**
```typescript
// Service Layer Architecture (AWS SES MVP)
UnifiedEmailService
├── Database: Prisma ORM (invoice_campaigns, campaign_email_sends)
├── Authentication: NextAuth session management
├── Email Provider: AWS SES (existing production infrastructure)
├── Rate Limiting: AWS SES quota management + database tracking
├── Template Engine: Enhanced email_templates with merge tag support
└── Analytics: Real-time campaign performance tracking
```

---

## 🏗️ CLASS SPECIFICATION

### **Core Class Structure**
```typescript
import { PrismaClient } from '@prisma/client'
import { Session } from 'next-auth'

export class UnifiedEmailService {
  private prisma: PrismaClient
  private session: Session
  private config: UnifiedEmailConfig

  constructor(
    prisma: PrismaClient,
    session: Session,
    config?: Partial<UnifiedEmailConfig>
  ) {
    this.prisma = prisma
    this.session = session
    this.config = {
      dailyQuotaDefault: 500,
      batchSize: 5,
      delayBetweenBatches: 3000,
      maxRetries: 3,
      tokenRefreshBuffer: 300, // 5 minutes
      ...config
    }
  }

  // Core Methods
  async createCampaignFromInvoices(options: CreateCampaignOptions): Promise<InvoiceCampaign>
  async sendCampaign(campaignId: string, options?: SendCampaignOptions): Promise<CampaignResult>
  async pauseCampaign(campaignId: string): Promise<void>
  async resumeCampaign(campaignId: string): Promise<void>
  async getCampaignProgress(campaignId: string): Promise<CampaignProgress>

  // Email Provider Management
  async addEmailProvider(data: AddEmailProviderData): Promise<EmailProvider>
  async removeEmailProvider(providerId: string): Promise<void>
  async refreshProviderTokens(providerId?: string): Promise<TokenRefreshResult>
  async testEmailProvider(providerId: string): Promise<ProviderTestResult>

  // Template & Content Management
  async generateEmailContent(invoiceIds: string[], templateId?: string): Promise<EmailContent[]>
  async previewCampaign(campaignId: string): Promise<CampaignPreview>
  async validateCampaign(campaignId: string): Promise<CampaignValidation>

  // Analytics & Reporting
  async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics>
  async getCompanyEmailMetrics(dateRange?: DateRange): Promise<CompanyEmailMetrics>
  async getCustomerEngagementReport(customerId?: string): Promise<CustomerEngagement>
}
```

### **Configuration Interface**
```typescript
interface UnifiedEmailConfig {
  dailyQuotaDefault: number      // Default daily sending quota per provider
  batchSize: number              // Emails per batch for rate limiting
  delayBetweenBatches: number    // Milliseconds between batches
  maxRetries: number             // Maximum retry attempts for failed emails
  tokenRefreshBuffer: number     // Seconds before token expiry to refresh
  enableUAEBusinessHours: boolean // Respect UAE business hours
  defaultTimezone: string        // Default timezone for scheduling
  enableConsolidation: boolean   // Enable invoice consolidation per customer
  maxInvoicesPerEmail: number    // Maximum invoices to consolidate in single email
}
```

---

## 📧 CORE METHODS IMPLEMENTATION

### **1. CREATE CAMPAIGN FROM INVOICES**

#### **Method Signature**
```typescript
async createCampaignFromInvoices(
  options: CreateCampaignOptions
): Promise<InvoiceCampaign>
```

#### **Input Interface**
```typescript
interface CreateCampaignOptions {
  invoiceIds: string[]                    // Required: Invoice IDs to include
  campaignName?: string                   // Optional: Campaign name (auto-generated if not provided)
  campaignType?: CampaignType            // Default: 'invoice_reminder'
  templateId?: string                     // Optional: Email template (uses default if not provided)
  emailProviderId?: string               // Optional: Specific email provider (auto-selects if not provided)
  scheduledFor?: Date                     // Optional: Schedule for specific time
  sendImmediately?: boolean              // Default: false
  consolidateByCustomer?: boolean        // Default: true (group invoices by customer)
  maxInvoicesPerEmail?: number           // Default: 5 (max invoices to consolidate)
  customSubject?: string                 // Optional: Override template subject
  customContent?: string                 // Optional: Override template content
  mergeTagOverrides?: Record<string, any> // Optional: Custom merge tag values
  skipEmailValidation?: boolean          // Default: false (validate all customer emails)
  dryRun?: boolean                       // Default: false (create campaign without sending)
}
```

#### **Implementation Logic**
```typescript
async createCampaignFromInvoices(
  options: CreateCampaignOptions
): Promise<InvoiceCampaign> {
  // 1. VALIDATION PHASE
  await this.validateInvoiceAccess(options.invoiceIds)
  await this.validateTemplateAccess(options.templateId)
  await this.validateEmailProviderAccess(options.emailProviderId)

  // 2. INVOICE DATA EXTRACTION
  const invoices = await this.getInvoicesWithCustomers(options.invoiceIds)
  const customerGroups = options.consolidateByCustomer
    ? this.groupInvoicesByCustomer(invoices, options.maxInvoicesPerEmail)
    : this.createIndividualInvoiceGroups(invoices)

  // 3. EMAIL CONTENT GENERATION
  const template = await this.getOrCreateDefaultTemplate(options.templateId)
  const emailContents = await this.generateEmailContentsForGroups(
    customerGroups,
    template,
    options
  )

  // 4. CAMPAIGN CREATION
  const campaign = await this.prisma.$transaction(async (tx) => {
    // Create campaign record
    const campaignData = await tx.invoice_campaigns.create({
      data: {
        id: `ic_${randomId()}`,
        company_id: this.session.user.companyId,
        name: options.campaignName || this.generateCampaignName(invoices),
        campaign_type: options.campaignType || 'invoice_reminder',
        invoice_ids: options.invoiceIds,
        invoice_count: options.invoiceIds.length,
        total_amount: this.calculateTotalAmount(invoices),
        currency: invoices[0]?.currency || 'AED',
        template_id: template.id,
        email_provider_id: options.emailProviderId || await this.selectBestProvider(),
        total_recipients: emailContents.length,
        scheduled_for: options.scheduledFor,
        send_immediately: options.sendImmediately || false,
        status: options.dryRun ? 'draft' : 'queued',
        created_by: this.session.user.id
      }
    })

    // Create individual email send records
    const emailSends = await Promise.all(
      emailContents.map(content =>
        tx.campaign_email_sends.create({
          data: {
            id: `ces_${randomId()}`,
            campaign_id: campaignData.id,
            company_id: this.session.user.companyId,
            recipient_email: content.recipientEmail,
            recipient_name: content.recipientName,
            customer_id: content.customerId,
            invoice_id: content.primaryInvoiceId,
            personalized_subject: content.subject,
            personalized_body: content.body,
            merge_data: content.mergeData,
            email_provider_id: campaignData.email_provider_id,
            status: 'queued'
          }
        })
      )
    )

    return { ...campaignData, emailSends }
  })

  // 5. AUDIT LOGGING
  await this.logCampaignActivity('campaign_created', campaign.id, {
    invoiceCount: options.invoiceIds.length,
    recipientCount: emailContents.length,
    campaignType: options.campaignType,
    consolidationUsed: options.consolidateByCustomer
  })

  return campaign
}
```

#### **Helper Methods**
```typescript
private async validateInvoiceAccess(invoiceIds: string[]): Promise<void> {
  const invoices = await this.prisma.invoices.findMany({
    where: {
      id: { in: invoiceIds },
      company_id: this.session.user.companyId
    },
    select: { id: true }
  })

  if (invoices.length !== invoiceIds.length) {
    throw new Error('Some invoices not found or access denied')
  }
}

private groupInvoicesByCustomer(
  invoices: Invoice[],
  maxPerEmail: number
): CustomerInvoiceGroup[] {
  const groups = new Map<string, Invoice[]>()

  invoices.forEach(invoice => {
    const key = invoice.customer_email
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(invoice)
  })

  // Split groups that exceed max invoices per email
  const finalGroups: CustomerInvoiceGroup[] = []
  groups.forEach((customerInvoices, email) => {
    const chunks = this.chunkArray(customerInvoices, maxPerEmail)
    chunks.forEach((chunk, index) => {
      finalGroups.push({
        customerEmail: email,
        customerName: chunk[0].customer_name,
        customerId: chunk[0].customers?.id,
        invoices: chunk,
        groupIndex: index,
        totalGroups: chunks.length
      })
    })
  })

  return finalGroups
}

private async generateEmailContentsForGroups(
  groups: CustomerInvoiceGroup[],
  template: EmailTemplate,
  options: CreateCampaignOptions
): Promise<EmailContent[]> {
  return Promise.all(
    groups.map(group => this.generateEmailContentForGroup(group, template, options))
  )
}

private async generateEmailContentForGroup(
  group: CustomerInvoiceGroup,
  template: EmailTemplate,
  options: CreateCampaignOptions
): Promise<EmailContent> {
  // Prepare merge data for template
  const mergeData = {
    customer_name: group.customerName,
    customer_email: group.customerEmail,
    invoice_count: group.invoices.length,
    total_amount: group.invoices.reduce((sum, inv) => sum + (inv.total_amount || inv.amount), 0),
    currency: group.invoices[0].currency,
    due_date: this.getEarliestDueDate(group.invoices),
    overdue_amount: this.calculateOverdueAmount(group.invoices),
    company_name: this.session.user.company.name,
    invoices: group.invoices.map(inv => ({
      number: inv.number,
      amount: inv.total_amount || inv.amount,
      due_date: inv.due_date,
      days_overdue: this.calculateDaysOverdue(inv.due_date),
      description: inv.description
    })),
    ...options.mergeTagOverrides
  }

  // Generate content using template
  const subject = this.replaceMergeTags(
    options.customSubject || template.subject_en,
    mergeData
  )

  const body = this.replaceMergeTags(
    options.customContent || template.content_en,
    mergeData
  )

  return {
    recipientEmail: group.customerEmail,
    recipientName: group.customerName,
    customerId: group.customerId,
    primaryInvoiceId: group.invoices[0].id,
    subject,
    body,
    mergeData
  }
}
```

### **2. SEND CAMPAIGN**

#### **Method Signature**
```typescript
async sendCampaign(
  campaignId: string,
  options?: SendCampaignOptions
): Promise<CampaignResult>
```

#### **Input Interface**
```typescript
interface SendCampaignOptions {
  onProgress?: (progress: CampaignProgress) => void   // Real-time progress callback
  onEmailSent?: (result: EmailSendResult) => void    // Per-email completion callback
  batchSize?: number                                 // Override default batch size
  delayBetweenBatches?: number                      // Override default delay
  maxConcurrentProviders?: number                   // Max providers to use simultaneously
  resumeFromFailures?: boolean                      // Only retry previously failed emails
  validateTokensFirst?: boolean                     // Pre-validate all OAuth tokens
}
```

#### **Implementation Logic**
```typescript
async sendCampaign(
  campaignId: string,
  options: SendCampaignOptions = {}
): Promise<CampaignResult> {
  // 1. CAMPAIGN VALIDATION & LOADING
  const campaign = await this.validateAndLoadCampaign(campaignId)
  const emailSends = await this.getQueuedEmailSends(campaignId, options.resumeFromFailures)

  if (emailSends.length === 0) {
    throw new Error('No emails to send for this campaign')
  }

  // 2. EMAIL PROVIDER PREPARATION
  const provider = await this.prepareEmailProvider(campaign.email_provider_id)
  await this.validateDailyQuota(provider, emailSends.length)

  // 3. BATCH PROCESSING SETUP
  const batchSize = options.batchSize || this.config.batchSize
  const batches = this.createEmailBatches(emailSends, batchSize)
  const startTime = Date.now()

  // 4. CAMPAIGN STATUS UPDATE
  await this.updateCampaignStatus(campaignId, 'sending', {
    processing_started_at: new Date(),
    total_recipients: emailSends.length
  })

  // 5. BATCH PROCESSING WITH PROGRESS TRACKING
  let totalSent = 0
  let totalFailed = 0
  const results: EmailSendResult[] = []

  try {
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]

      // Process batch concurrently
      const batchPromises = batch.map(emailSend =>
        this.sendSingleEmail(emailSend, provider)
      )

      const batchResults = await Promise.allSettled(batchPromises)

      // Process batch results
      for (let i = 0; i < batchResults.length; i++) {
        const result = batchResults[i]
        const emailSend = batch[i]

        if (result.status === 'fulfilled' && result.value.success) {
          totalSent++
          await this.updateEmailSendStatus(emailSend.id, 'sent', {
            sent_at: new Date(),
            provider_message_id: result.value.messageId
          })

          results.push({
            emailSendId: emailSend.id,
            recipientEmail: emailSend.recipient_email,
            status: 'sent',
            sentAt: new Date()
          })

          options.onEmailSent?.(results[results.length - 1])
        } else {
          totalFailed++
          const error = result.status === 'rejected'
            ? result.reason.message
            : result.value.error

          await this.updateEmailSendStatus(emailSend.id, 'failed', {
            failed_at: new Date(),
            error_message: error,
            attempt_count: emailSend.attempt_count + 1
          })

          results.push({
            emailSendId: emailSend.id,
            recipientEmail: emailSend.recipient_email,
            status: 'failed',
            error
          })

          options.onEmailSent?.(results[results.length - 1])
        }
      }

      // Update campaign progress
      const progress: CampaignProgress = {
        campaignId,
        total: emailSends.length,
        sent: totalSent,
        failed: totalFailed,
        pending: emailSends.length - totalSent - totalFailed,
        progress: Math.round(((totalSent + totalFailed) / emailSends.length) * 100),
        eta: this.calculateETA(startTime, totalSent + totalFailed, emailSends.length),
        currentBatch: batchIndex + 1,
        totalBatches: batches.length
      }

      await this.updateCampaignProgress(campaignId, progress)
      options.onProgress?.(progress)

      // Rate limiting delay between batches
      if (batchIndex < batches.length - 1) {
        await this.delay(options.delayBetweenBatches || this.config.delayBetweenBatches)
      }
    }

    // 6. CAMPAIGN COMPLETION
    const finalStatus = totalFailed === 0 ? 'completed' : totalFailed === emailSends.length ? 'failed' : 'completed_with_errors'

    await this.updateCampaignStatus(campaignId, finalStatus, {
      processing_completed_at: new Date(),
      sent_count: totalSent,
      failed_count: totalFailed
    })

    // 7. ANALYTICS UPDATE
    await this.updateProviderDailyCount(provider.id, totalSent)
    await this.updateCompanyEmailMetrics(totalSent, totalFailed)

    return {
      campaignId,
      status: finalStatus,
      totalSent,
      totalFailed,
      results,
      processingTime: Date.now() - startTime,
      averageEmailsPerSecond: totalSent / ((Date.now() - startTime) / 1000)
    }

  } catch (error) {
    // Handle catastrophic failure
    await this.updateCampaignStatus(campaignId, 'failed', {
      processing_completed_at: new Date(),
      error_message: error.message
    })

    throw error
  }
}
```

#### **Email Sending Core Logic**
```typescript
private async sendSingleEmail(
  emailSend: CampaignEmailSend,
  provider: EmailProvider,
  attemptCount: number = 0
): Promise<EmailSendResult> {
  try {
    // Token validation and refresh if needed
    if (this.isTokenExpiringSoon(provider)) {
      provider = await this.refreshProviderTokens(provider.id)
    }

    // Send via appropriate provider
    const result = await this.sendViaProvider(emailSend, provider)

    if (result.success) {
      return {
        success: true,
        messageId: result.messageId,
        provider: provider.provider_type
      }
    } else {
      throw new Error(result.error)
    }

  } catch (error) {
    // Retry logic with exponential backoff
    if (attemptCount < this.config.maxRetries) {
      const delay = Math.min(Math.pow(2, attemptCount) * 1000, 30000) // Max 30 seconds
      await this.delay(delay)

      return this.sendSingleEmail(emailSend, provider, attemptCount + 1)
    }

    return {
      success: false,
      error: error.message,
      attemptCount: attemptCount + 1
    }
  }
}

private async sendViaProvider(
  emailSend: CampaignEmailSend,
  provider: EmailProvider
): Promise<ProviderSendResult> {
  const emailData = {
    to: emailSend.recipient_email,
    subject: emailSend.personalized_subject,
    body: emailSend.personalized_body,
    accessToken: provider.access_token
  }

  switch (provider.provider_type) {
    case 'gmail':
      return this.sendViaGmail(emailData)
    case 'outlook':
      return this.sendViaOutlook(emailData)
    case 'aws_ses':
      return this.sendViaAWS(emailData)
    default:
      throw new Error(`Unsupported provider type: ${provider.provider_type}`)
  }
}
```

### **3. EMAIL PROVIDER MANAGEMENT**

#### **Add Email Provider**
```typescript
async addEmailProvider(data: AddEmailProviderData): Promise<EmailProvider> {
  const { providerType, oauthData, isDefault } = data

  // 1. Validate OAuth tokens
  const testResult = await this.testOAuthTokens(providerType, oauthData)
  if (!testResult.success) {
    throw new Error(`OAuth validation failed: ${testResult.error}`)
  }

  // 2. Encrypt tokens for storage
  const encryptedTokens = await this.encryptTokenData({
    accessToken: oauthData.accessToken,
    refreshToken: oauthData.refreshToken,
    scope: oauthData.scope
  })

  // 3. Create provider record
  const provider = await this.prisma.$transaction(async (tx) => {
    // Set existing providers as non-primary if this is primary
    if (isDefault) {
      await tx.email_providers.updateMany({
        where: {
          company_id: this.session.user.companyId,
          provider_type: providerType,
          is_primary: true
        },
        data: { is_primary: false }
      })
    }

    return tx.email_providers.create({
      data: {
        id: `ep_${randomId()}`,
        company_id: this.session.user.companyId,
        provider_type: providerType,
        provider_email: oauthData.email,
        provider_name: oauthData.name || oauthData.email,
        access_token: encryptedTokens.accessToken,
        refresh_token: encryptedTokens.refreshToken,
        token_expires_at: oauthData.expiresAt,
        scope: oauthData.scope,
        is_active: true,
        is_primary: isDefault || false,
        daily_quota: this.getProviderDefaultQuota(providerType),
        daily_sent_count: 0,
        quota_reset_date: new Date(),
        last_validated_at: new Date(),
        created_by: this.session.user.id
      }
    })
  })

  // 4. Test email sending capability
  await this.testEmailProvider(provider.id)

  // 5. Audit logging
  await this.logProviderActivity('provider_added', provider.id, {
    providerType,
    providerEmail: oauthData.email
  })

  return provider
}
```

#### **Token Refresh Management**
```typescript
async refreshProviderTokens(providerId?: string): Promise<TokenRefreshResult> {
  const providers = providerId
    ? [await this.getEmailProvider(providerId)]
    : await this.getExpiringProviders()

  const results: ProviderTokenRefresh[] = []

  for (const provider of providers) {
    try {
      const refreshResult = await this.refreshProviderToken(provider)

      if (refreshResult.success) {
        await this.updateProviderTokens(provider.id, {
          access_token: await this.encryptTokenData({ accessToken: refreshResult.accessToken }),
          token_expires_at: refreshResult.expiresAt,
          last_validated_at: new Date(),
          validation_error: null
        })

        results.push({
          providerId: provider.id,
          providerEmail: provider.provider_email,
          status: 'success',
          expiresAt: refreshResult.expiresAt
        })
      } else {
        await this.updateProviderTokens(provider.id, {
          validation_error: refreshResult.error,
          is_active: false
        })

        results.push({
          providerId: provider.id,
          providerEmail: provider.provider_email,
          status: 'failed',
          error: refreshResult.error
        })
      }

    } catch (error) {
      results.push({
        providerId: provider.id,
        providerEmail: provider.provider_email,
        status: 'error',
        error: error.message
      })
    }
  }

  return {
    totalProviders: providers.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status !== 'success').length,
    results
  }
}
```

---

## 📊 ANALYTICS & REPORTING

### **Campaign Analytics**
```typescript
async getCampaignAnalytics(campaignId: string): Promise<CampaignAnalytics> {
  const [campaign, emailSends, events] = await Promise.all([
    this.getCampaign(campaignId),
    this.getCampaignEmailSends(campaignId),
    this.getCampaignEvents(campaignId)
  ])

  const analytics = {
    campaignId,
    campaignName: campaign.name,
    campaignType: campaign.campaign_type,

    // Sending Statistics
    totalRecipients: campaign.total_recipients,
    sentCount: emailSends.filter(e => e.status === 'sent').length,
    deliveredCount: emailSends.filter(e => e.delivered_at).length,
    failedCount: emailSends.filter(e => e.status === 'failed').length,

    // Engagement Statistics
    openCount: emailSends.filter(e => e.opened_at).length,
    clickCount: emailSends.filter(e => e.clicked_at).length,
    bounceCount: emailSends.filter(e => e.bounced_at).length,

    // Performance Rates
    deliveryRate: this.calculateRate(emailSends.filter(e => e.delivered_at).length, campaign.total_recipients),
    openRate: this.calculateRate(emailSends.filter(e => e.opened_at).length, emailSends.filter(e => e.delivered_at).length),
    clickThroughRate: this.calculateRate(emailSends.filter(e => e.clicked_at).length, emailSends.filter(e => e.opened_at).length),
    bounceRate: this.calculateRate(emailSends.filter(e => e.bounced_at).length, campaign.total_recipients),

    // Business Impact (Invoice-specific)
    totalInvoiceValue: campaign.total_amount,
    currency: campaign.currency,
    averageInvoiceValue: campaign.total_amount / campaign.invoice_count,
    overdueInvoicesCount: await this.getOverdueInvoicesCount(campaign.invoice_ids),

    // Timeline Analytics
    campaignDuration: campaign.processing_completed_at
      ? campaign.processing_completed_at.getTime() - campaign.processing_started_at.getTime()
      : null,
    averageEmailsPerMinute: this.calculateEmailsPerMinute(campaign),

    // Geographic Distribution
    topCountries: await this.getTopCountriesByEngagement(campaignId),

    // Device Analytics
    deviceBreakdown: await this.getDeviceBreakdown(campaignId),

    // Email Client Analytics
    emailClientBreakdown: await this.getEmailClientBreakdown(campaignId)
  }

  return analytics
}
```

### **Company Email Metrics**
```typescript
async getCompanyEmailMetrics(dateRange?: DateRange): Promise<CompanyEmailMetrics> {
  const range = dateRange || {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    end: new Date()
  }

  const [campaigns, emailSends, providers] = await Promise.all([
    this.getCompanyCampaigns(range),
    this.getCompanyEmailSends(range),
    this.getCompanyEmailProviders()
  ])

  return {
    dateRange: range,

    // Volume Metrics
    totalCampaigns: campaigns.length,
    totalEmailsSent: emailSends.filter(e => e.sent_at).length,
    totalEmailsDelivered: emailSends.filter(e => e.delivered_at).length,
    totalCustomersContacted: new Set(emailSends.map(e => e.customer_id)).size,
    totalInvoicesFollowedUp: new Set(emailSends.map(e => e.invoice_id)).size,

    // Performance Metrics
    overallDeliveryRate: this.calculateDeliveryRate(emailSends),
    overallOpenRate: this.calculateOpenRate(emailSends),
    overallClickRate: this.calculateClickRate(emailSends),
    overallBounceRate: this.calculateBounceRate(emailSends),

    // Provider Performance
    providerBreakdown: await this.getProviderPerformanceBreakdown(emailSends),

    // Business Impact
    totalInvoiceValueContacted: this.calculateTotalInvoiceValue(campaigns),
    averageResponseTime: await this.calculateAverageResponseTime(emailSends),
    paymentAcceleration: await this.calculatePaymentAcceleration(emailSends),

    // Trends
    dailyVolume: this.calculateDailyVolume(emailSends, range),
    engagementTrends: this.calculateEngagementTrends(emailSends, range),

    // Provider Health
    activeProviders: providers.filter(p => p.is_active).length,
    providersNeedingAttention: providers.filter(p =>
      p.validation_error || p.daily_sent_count >= p.daily_quota * 0.9
    ).length
  }
}
```

---

## 🛡️ SECURITY & COMPLIANCE

### **Data Encryption**
```typescript
private async encryptTokenData(tokenData: TokenData): Promise<EncryptedTokenData> {
  // Use company-specific encryption key
  const encryptionKey = await this.getCompanyEncryptionKey()

  return {
    accessToken: await encrypt(tokenData.accessToken, encryptionKey),
    refreshToken: await encrypt(tokenData.refreshToken, encryptionKey),
    scope: tokenData.scope // Not encrypted
  }
}

private async decryptTokenData(encryptedData: EncryptedTokenData): Promise<TokenData> {
  const encryptionKey = await this.getCompanyEncryptionKey()

  return {
    accessToken: await decrypt(encryptedData.accessToken, encryptionKey),
    refreshToken: await decrypt(encryptedData.refreshToken, encryptionKey),
    scope: encryptedData.scope
  }
}
```

### **Audit Logging**
```typescript
private async logCampaignActivity(
  eventType: string,
  campaignId: string,
  metadata: Record<string, any>
): Promise<void> {
  await this.prisma.email_security_audit.create({
    data: {
      id: `esa_${randomId()}`,
      company_id: this.session.user.companyId,
      event_type: eventType,
      user_id: this.session.user.id,
      entity_type: 'invoice_campaign',
      entity_id: campaignId,
      changes_made: JSON.stringify(metadata),
      risk_level: this.assessRiskLevel(eventType, metadata),
      ip_address: this.session.ipAddress,
      user_agent: this.session.userAgent,
      session_id: this.session.sessionId
    }
  })
}
```

### **Rate Limiting & Quota Management**
```typescript
private async validateDailyQuota(
  provider: EmailProvider,
  emailCount: number
): Promise<void> {
  // Check if quota resets today
  if (provider.quota_reset_date < new Date().toDateString()) {
    await this.resetProviderDailyQuota(provider.id)
    provider.daily_sent_count = 0
  }

  const remainingQuota = provider.daily_quota - provider.daily_sent_count

  if (emailCount > remainingQuota) {
    throw new Error(
      `Insufficient daily quota. Requested: ${emailCount}, Available: ${remainingQuota}`
    )
  }
}

private async updateProviderDailyCount(
  providerId: string,
  sentCount: number
): Promise<void> {
  await this.prisma.email_providers.update({
    where: { id: providerId },
    data: {
      daily_sent_count: { increment: sentCount },
      updated_at: new Date()
    }
  })
}
```

---

## 🎯 ERROR HANDLING & RECOVERY

### **Comprehensive Error Classification**
```typescript
enum EmailServiceErrorType {
  VALIDATION_ERROR = 'validation_error',
  AUTHENTICATION_ERROR = 'authentication_error',
  AUTHORIZATION_ERROR = 'authorization_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
  RATE_LIMITED = 'rate_limited',
  PROVIDER_ERROR = 'provider_error',
  NETWORK_ERROR = 'network_error',
  DATA_ERROR = 'data_error',
  CONFIGURATION_ERROR = 'configuration_error'
}

class EmailServiceError extends Error {
  constructor(
    public type: EmailServiceErrorType,
    message: string,
    public context?: Record<string, any>,
    public retryable: boolean = false
  ) {
    super(message)
    this.name = 'EmailServiceError'
  }
}
```

### **Recovery Strategies**
```typescript
private async handleEmailSendError(
  error: Error,
  emailSend: CampaignEmailSend,
  attemptCount: number
): Promise<EmailSendRecovery> {
  // Classify error type
  const errorType = this.classifyError(error)

  switch (errorType) {
    case EmailServiceErrorType.RATE_LIMITED:
      // Exponential backoff with jitter
      const delay = Math.min(Math.pow(2, attemptCount) * 1000 + Math.random() * 1000, 60000)
      return {
        strategy: 'retry_with_delay',
        delay,
        maxRetries: 5
      }

    case EmailServiceErrorType.QUOTA_EXCEEDED:
      // Switch to fallback provider or schedule for tomorrow
      const fallbackProvider = await this.findFallbackProvider()
      if (fallbackProvider) {
        return {
          strategy: 'switch_provider',
          providerId: fallbackProvider.id
        }
      } else {
        return {
          strategy: 'schedule_tomorrow',
          scheduledFor: this.getNextBusinessDay()
        }
      }

    case EmailServiceErrorType.AUTHENTICATION_ERROR:
      // Refresh tokens and retry
      await this.refreshProviderTokens()
      return {
        strategy: 'retry_after_token_refresh',
        maxRetries: 1
      }

    default:
      // Standard retry with exponential backoff
      return {
        strategy: 'standard_retry',
        delay: Math.pow(2, attemptCount) * 1000,
        maxRetries: 3
      }
  }
}
```

This comprehensive UnifiedEmailService specification provides the foundation for implementing the core service that will enable POP Trading's 2.5-hour → 10-minute workflow transformation! 🚀