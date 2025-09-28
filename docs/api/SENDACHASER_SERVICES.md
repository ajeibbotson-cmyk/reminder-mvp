# 📧 SENDACHASER SERVICES ANALYSIS
## Email Automation Service Architecture for Integration

**Purpose**: Document SendAChaser's service layer for unified platform integration
**Context**: Understanding email automation capabilities for merging with Reminder
**Updated**: September 28, 2025

---

## 🏗️ SERVICE ARCHITECTURE OVERVIEW

### **Core Design Patterns**
- **Singleton Services**: Shared state management across components
- **Provider Abstraction**: Gmail/Outlook API abstraction layer
- **Rate Limiting**: Built-in quota management and batch processing
- **Token Management**: Automatic OAuth token refresh during operations
- **Progress Tracking**: Real-time progress callbacks with ETA calculation
- **Error Recovery**: Comprehensive retry logic with exponential backoff

### **Service Dependencies**
```typescript
// Service Layer Architecture
bulkEmailService
├── gmailApiService
├── outlookApiService
├── supabase (email_providers, campaigns, campaign_sends)
└── localStorage (daily quota tracking)

campaignService
├── supabase (campaigns, campaign_sends, campaign_logs)
└── bulkEmailService (email sending)

contactService
├── supabase (contacts)
├── importService (CSV/Excel import)
└── mergeTagService (personalization)
```

---

## 📬 BULK EMAIL SERVICE (Core Engine)

### **File**: `src/services/bulkEmailService.ts` (325+ lines)

#### **Core Configuration**
```typescript
interface BulkEmailConfig {
  dailyLimit: number;           // Default: 50 emails/day
  batchSize: number;            // Default: 5 emails/batch
  delayBetweenBatches: number;  // Default: 3000ms (3 seconds)
  maxRetries: number;           // Default: 2 retries per email
}
```

#### **Key Features**

##### 1. **Rate Limiting & Quota Management**
```typescript
class BulkEmailService {
  private dailySentCount: number = 0;

  // Persistent quota tracking
  constructor() {
    const today = new Date().toDateString();
    const storedData = localStorage.getItem('emailSendCount');
    if (storedData) {
      const data = JSON.parse(storedData);
      if (data.date === today) {
        this.dailySentCount = data.count || 0;
      }
    }
  }

  // Quota validation before sending
  canSendEmails(count: number): boolean {
    return this.dailySentCount + count <= this.config.dailyLimit;
  }
}
```

##### 2. **Provider Selection & Token Management**
```typescript
// Direct Supabase query to avoid React state dependency
const getProviderForType = async (providerType: 'gmail' | 'outlook') => {
  const { data, error } = await supabase
    .from('email_providers')
    .select('*')
    .eq('provider_type', providerType)
    .eq('is_active', true)
    .limit(1)
    .single();

  return data;
};

// Automatic token refresh during sending
const provider = await getProviderForType('gmail');
if (provider?.token_expires_at && new Date(provider.token_expires_at) <= new Date()) {
  await refreshProviderToken(provider.id);
  // Re-fetch updated provider with new token
}
```

##### 3. **Batch Processing with Progress Tracking**
```typescript
async sendBulkEmail(
  request: BulkEmailRequest,
  onProgress?: (progress: BulkEmailProgress) => void,
  onResult?: (result: SendResult) => void
): Promise<SendResult[]> {
  const totalRecipients = request.recipients.length;
  const batches = createBatches(request.recipients, this.config.batchSize);

  let sent = 0, failed = 0;
  const startTime = Date.now();

  for (const batch of batches) {
    // Process batch concurrently
    const batchPromises = batch.map(recipient =>
      this.sendSingleEmail(recipient, request)
    );

    const batchResults = await Promise.allSettled(batchPromises);

    // Update progress with ETA calculation
    const progress = {
      total: totalRecipients,
      sent,
      failed,
      pending: totalRecipients - sent - failed,
      progress: Math.round(((sent + failed) / totalRecipients) * 100),
      eta: calculateETA(startTime, sent + failed, totalRecipients)
    };

    onProgress?.(progress);

    // Rate limiting delay between batches
    if (batches.indexOf(batch) < batches.length - 1) {
      await delay(this.config.delayBetweenBatches);
    }
  }

  return results;
}
```

##### 4. **Error Recovery & Retry Logic**
```typescript
private async sendSingleEmail(
  recipient: EmailRecipient,
  request: BulkEmailRequest,
  attemptCount: number = 0
): Promise<SendResult> {
  try {
    // Provider selection logic (Gmail preferred, Outlook fallback)
    const provider = await this.selectProvider();

    if (!provider) {
      throw new Error('No active email provider available');
    }

    // Send via appropriate provider
    const result = provider.provider_type === 'gmail'
      ? await sendGmailEmail({
          to: recipient.email,
          subject: recipient.personalizedSubject || request.subject,
          body: recipient.personalizedBody || request.body,
          accessToken: provider.access_token
        })
      : await sendOutlookEmail({
          to: recipient.email,
          subject: recipient.personalizedSubject || request.subject,
          body: recipient.personalizedBody || request.body,
          accessToken: provider.access_token
        });

    if (result.success) {
      this.updateDailyCount(1);
      return {
        recipientId: recipient.id,
        email: recipient.email,
        status: 'sent',
        sentAt: new Date()
      };
    } else {
      throw new Error(result.error || 'Send failed');
    }

  } catch (error) {
    // Retry logic with exponential backoff
    if (attemptCount < this.config.maxRetries) {
      const delay = Math.pow(2, attemptCount) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));

      return this.sendSingleEmail(recipient, request, attemptCount + 1);
    }

    return {
      recipientId: recipient.id,
      email: recipient.email,
      status: 'failed',
      error: error.message
    };
  }
}
```

#### **Integration Points for Reminder**
- 🔗 **Database Integration**: Replace Supabase queries with Prisma
- 🔗 **Storage**: Replace localStorage with database-backed quota tracking
- 🔗 **Authentication**: Integrate with NextAuth session management
- 🔗 **Company Scoping**: Add multi-tenant company_id filtering
- 🔗 **Invoice Context**: Add invoice association to email sending

---

## 🎯 CAMPAIGN SERVICE

### **File**: `src/services/campaignService.ts`

#### **Campaign Lifecycle Management**
```typescript
interface Campaign {
  id: string;
  user_id: string;
  name: string;
  status: 'draft' | 'sending' | 'completed' | 'failed';
  data_source: string;          // 'csv', 'manual', 'api'
  data_source_url?: string;
  template_id?: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: Date;
  updated_at: Date;
}
```

#### **Campaign Operations**
```typescript
class CampaignService {
  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    // Create campaign record
    // Link to contacts/recipients
    // Set initial status as 'draft'
  }

  async startCampaign(campaignId: string): Promise<void> {
    // Validate campaign readiness
    // Update status to 'sending'
    // Trigger bulk email service
    // Track progress and update counts
  }

  async pauseCampaign(campaignId: string): Promise<void> {
    // Pause bulk email processing
    // Update campaign status
  }

  async getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
    // Return real-time campaign statistics
    // Include send rates, errors, completion ETA
  }
}
```

#### **Campaign Analytics**
```typescript
interface CampaignAnalytics {
  totalSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  topPerformingTemplates: Template[];
  engagementTrends: TimeSeriesData[];
}
```

---

## 📱 EMAIL PROVIDER SERVICES

### **Gmail API Service** (`src/services/gmailApiService.ts`)

#### **Core Implementation**
```typescript
interface GmailApiRequest {
  to: string;
  subject: string;
  body: string;
  accessToken: string;
}

interface GmailApiResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendGmailEmail(request: GmailApiRequest): Promise<GmailApiResponse> {
  try {
    // Create RFC 2822 compliant message
    const message = createRFC2822Message(request);

    // Send via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${request.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: btoa(message).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      })
    });

    const result = await response.json();

    if (response.ok) {
      return {
        success: true,
        messageId: result.id
      };
    } else {
      return {
        success: false,
        error: result.error?.message || 'Gmail API error'
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// RFC 2822 message format creation
function createRFC2822Message(request: GmailApiRequest): string {
  return [
    `To: ${request.to}`,
    `Subject: ${request.subject}`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    request.body
  ].join('\r\n');
}
```

#### **Rate Limiting & Error Handling**
- **Gmail Quotas**: 250 quota units per user per second
- **Error Codes**: Handle 401 (token expired), 403 (quota exceeded), 429 (rate limited)
- **Retry Strategy**: Exponential backoff for rate limit errors

### **Outlook API Service** (`src/services/outlookApiService.ts`)

#### **Core Implementation**
```typescript
export async function sendOutlookEmail(request: EmailApiRequest): Promise<EmailApiResponse> {
  try {
    const response = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${request.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: request.subject,
          body: {
            contentType: 'HTML',
            content: request.body
          },
          toRecipients: [{
            emailAddress: {
              address: request.to
            }
          }]
        }
      })
    });

    if (response.ok) {
      return {
        success: true,
        messageId: response.headers.get('x-ms-request-id')
      };
    } else {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Outlook API error'
      };
    }

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

#### **Rate Limiting & Error Handling**
- **Graph API Quotas**: 10,000 requests per 10 minutes per app
- **Error Codes**: Handle 401 (token expired), 403 (insufficient permissions), 429 (throttled)
- **Retry Strategy**: Respect Retry-After headers for throttling

---

## 👥 CONTACT SERVICE

### **File**: `src/services/contactService.ts`

#### **Contact Management Operations**
```typescript
interface Contact {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

class ContactService {
  async createContact(data: CreateContactRequest): Promise<Contact> {
    // Validate email format
    // Check for duplicates
    // Create contact record
  }

  async importContacts(file: File, mapping: FieldMapping): Promise<ImportResult> {
    // Parse CSV/Excel file
    // Apply field mapping
    // Validate each contact
    // Bulk insert with deduplication
  }

  async searchContacts(query: string, filters?: ContactFilters): Promise<Contact[]> {
    // Full-text search across name, email, company
    // Apply filters (tags, custom fields)
    // Return paginated results
  }

  async bulkUpdateContacts(updates: BulkContactUpdate[]): Promise<UpdateResult[]> {
    // Batch update operations
    // Validate each update
    // Return success/failure results
  }
}
```

#### **Custom Fields & Tags**
```typescript
interface CustomFieldSchema {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  required: boolean;
  defaultValue?: any;
}

// Dynamic custom fields support
const contact = {
  email: 'customer@example.com',
  name: 'John Doe',
  custom_fields: {
    invoice_number: 'INV-001',
    amount_owed: 1500.00,
    last_payment_date: '2024-09-15',
    is_priority_customer: true
  },
  tags: ['overdue', 'high-value', 'uae-client']
};
```

---

## 🏷️ MERGE TAG SERVICE

### **File**: `src/services/mergeTagService.ts`

#### **Dynamic Content Personalization**
```typescript
class MergeTagService {
  // Extract merge tags from template content
  extractMergeTags(content: string): string[] {
    const regex = /\{\{([^}]+)\}\}/g;
    const tags = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      tags.push(match[1].trim());
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  // Validate merge tags against contact schema
  validateMergeTags(tags: string[], contactSchema: ContactSchema): ValidationResult {
    const availableFields = [
      'name', 'email', 'company', 'phone',
      ...Object.keys(contactSchema.customFields || {})
    ];

    const invalid = tags.filter(tag => !availableFields.includes(tag));

    return {
      valid: invalid.length === 0,
      invalidTags: invalid,
      suggestions: this.generateSuggestions(invalid, availableFields)
    };
  }

  // Replace merge tags with actual contact data
  replaceMergeTags(template: string, contactData: Contact): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (match, tagName) => {
      const trimmedTag = tagName.trim();

      // Handle standard fields
      if (contactData[trimmedTag]) {
        return String(contactData[trimmedTag]);
      }

      // Handle custom fields
      if (contactData.custom_fields?.[trimmedTag]) {
        return String(contactData.custom_fields[trimmedTag]);
      }

      // Fallback for missing data
      return `{{${trimmedTag}}}`; // Keep original tag if no data
    });
  }

  // Generate personalized content for bulk campaigns
  personalizeForContact(
    subject: string,
    body: string,
    contact: Contact
  ): { personalizedSubject: string; personalizedBody: string } {
    return {
      personalizedSubject: this.replaceMergeTags(subject, contact),
      personalizedBody: this.replaceMergeTags(body, contact)
    };
  }
}
```

#### **Advanced Merge Tag Features**
```typescript
// Conditional merge tags
const template = `
Hi {{name}},

{{#if amount_owed}}
Your outstanding balance is {{amount_owed}} {{currency}}.
{{/if}}

{{#unless last_payment_date}}
We haven't received any payments from you yet.
{{/unless}}

Best regards,
{{company_name}}
`;

// Date formatting
const template = `Due date: {{due_date|format:MM/DD/YYYY}}`;

// Number formatting
const template = `Amount: {{amount|currency:AED}}`;
```

---

## 📥 IMPORT SERVICE

### **File**: `src/services/importService.ts`

#### **File Processing Pipeline**
```typescript
interface ImportResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: ImportError[];
  contacts: Contact[];
}

interface ImportError {
  row: number;
  field: string;
  value: any;
  error: string;
  suggestion?: string;
}

class ImportService {
  async importFromCSV(
    file: File,
    mapping: FieldMapping,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    // 1. Parse CSV with encoding detection
    const csvData = await this.parseCSV(file);

    // 2. Apply field mapping
    const mappedData = this.applyFieldMapping(csvData, mapping);

    // 3. Validate each row
    const validationResult = await this.validateRows(mappedData);

    // 4. Process valid rows
    const contacts = await this.processValidRows(
      validationResult.validRows,
      options
    );

    return {
      totalRows: csvData.length,
      successCount: contacts.length,
      errorCount: validationResult.errors.length,
      errors: validationResult.errors,
      contacts
    };
  }

  private async parseCSV(file: File): Promise<any[]> {
    // Auto-detect encoding (UTF-8, UTF-16, Windows-1252)
    // Handle BOM (Byte Order Mark)
    // Parse with proper delimiter detection
    // Handle quoted fields and escaped characters
  }

  private applyFieldMapping(data: any[], mapping: FieldMapping): any[] {
    return data.map(row => {
      const mappedRow = {};

      Object.entries(mapping).forEach(([csvColumn, contactField]) => {
        if (row[csvColumn] !== undefined) {
          mappedRow[contactField] = this.transformValue(
            row[csvColumn],
            contactField
          );
        }
      });

      return mappedRow;
    });
  }

  private async validateRows(data: any[]): Promise<ValidationResult> {
    const validRows = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowErrors = [];

      // Email validation
      if (!row.email || !this.isValidEmail(row.email)) {
        rowErrors.push({
          row: i + 1,
          field: 'email',
          value: row.email,
          error: 'Invalid email format',
          suggestion: 'Ensure email follows format: user@domain.com'
        });
      }

      // Duplicate detection
      const duplicate = await this.findDuplicateContact(row.email);
      if (duplicate && !options.allowDuplicates) {
        rowErrors.push({
          row: i + 1,
          field: 'email',
          value: row.email,
          error: 'Duplicate email address',
          suggestion: 'Use update mode or remove duplicate'
        });
      }

      // Custom field validation
      if (row.custom_fields) {
        const customFieldErrors = this.validateCustomFields(
          row.custom_fields,
          this.getCustomFieldSchema()
        );
        rowErrors.push(...customFieldErrors.map(err => ({ ...err, row: i + 1 })));
      }

      if (rowErrors.length === 0) {
        validRows.push(row);
      } else {
        errors.push(...rowErrors);
      }
    }

    return { validRows, errors };
  }
}
```

#### **Field Mapping Interface**
```typescript
interface FieldMapping {
  [csvColumn: string]: string; // Maps to contact field
}

// Example mapping
const mapping: FieldMapping = {
  'Full Name': 'name',
  'Email Address': 'email',
  'Company Name': 'company',
  'Phone Number': 'phone',
  'Invoice Number': 'custom_fields.invoice_number',
  'Amount Owed': 'custom_fields.amount_owed',
  'Customer Type': 'tags.0' // First tag
};
```

---

## 🔗 INTEGRATION STRATEGY FOR REMINDER

### **1. Service Layer Migration**

#### **From Supabase to Prisma**
```typescript
// Current SendAChaser pattern
const { data } = await supabase
  .from('contacts')
  .select('*')
  .eq('user_id', userId);

// Migrate to Reminder pattern
const contacts = await prisma.customers.findMany({
  where: {
    company_id: companyId // Multi-tenant scoping
  }
});
```

#### **Authentication Integration**
```typescript
// Current SendAChaser pattern
const user = useUser(); // Supabase auth
const userId = user?.id;

// Migrate to Reminder pattern
const session = await getServerSession(authOptions);
const companyId = session.user.companyId;
const userId = session.user.id;
```

### **2. Database Schema Mapping**

#### **Contacts → Enhanced Customers**
```typescript
// SendAChaser contacts table
interface SendAChaserContact {
  id: string;
  user_id: string;
  email: string;
  name?: string;
  company?: string;
  phone?: string;
  custom_fields?: Record<string, any>;
  tags?: string[];
}

// Reminder enhanced customers table
interface ReminderCustomer {
  id: string;
  company_id: string; // Multi-tenant scoping
  email: string;
  name: string;
  business_name?: string; // Maps to company
  phone?: string;
  custom_fields: Record<string, any>; // Enhanced from SendAChaser
  tags: string[]; // Enhanced from SendAChaser
  // ... existing invoice-focused fields
}
```

#### **Campaigns → Invoice Campaigns**
```typescript
// SendAChaser campaigns
interface SendAChaserCampaign {
  id: string;
  user_id: string;
  name: string;
  data_source: string;
  template_id?: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
}

// Reminder invoice campaigns (new)
interface ReminderInvoiceCampaign {
  id: string;
  company_id: string; // Multi-tenant scoping
  invoice_ids: string[]; // Link to invoices
  name: string;
  campaign_type: 'invoice_reminder' | 'payment_follow_up' | 'overdue_notice';
  template_id?: string;
  email_provider_id: string; // OAuth provider
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  // ... enhanced invoice-specific fields
}
```

### **3. Service Class Integration**

#### **UnifiedEmailService Architecture**
```typescript
class UnifiedEmailService {
  constructor(
    private prisma: PrismaClient,
    private session: SessionData
  ) {}

  // Core method: Create campaign from invoices
  async createCampaignFromInvoices(
    invoiceIds: string[],
    templateId?: string,
    emailProviderId?: string
  ): Promise<InvoiceCampaign> {
    // 1. Validate invoices belong to company
    // 2. Extract customer emails from invoices
    // 3. Create campaign record
    // 4. Generate campaign email sends
    // 5. Return campaign with ready-to-send status
  }

  // Enhanced bulk sending with invoice context
  async sendCampaign(
    campaignId: string,
    onProgress?: (progress: CampaignProgress) => void
  ): Promise<CampaignResult> {
    // 1. Load campaign and associated data
    // 2. Generate personalized emails with invoice data
    // 3. Use adapted BulkEmailService for sending
    // 4. Track progress and update campaign status
    // 5. Link email logs to invoices and campaign
  }

  // OAuth provider management
  async addEmailProvider(
    providerType: 'gmail' | 'outlook',
    oauthData: OAuthTokenData
  ): Promise<EmailProvider> {
    // 1. Validate OAuth tokens
    // 2. Store encrypted tokens in database
    // 3. Test email sending capability
    // 4. Set as active provider
  }
}
```

### **4. API Endpoint Integration**

#### **New Campaign Endpoints**
```typescript
// POST /api/campaigns
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const { invoiceIds, templateId, emailProviderId } = await request.json();

  const unifiedEmailService = new UnifiedEmailService(prisma, session);
  const campaign = await unifiedEmailService.createCampaignFromInvoices(
    invoiceIds,
    templateId,
    emailProviderId
  );

  return NextResponse.json({ success: true, data: campaign });
}

// POST /api/campaigns/[id]/send
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const { id: campaignId } = await params;

  const unifiedEmailService = new UnifiedEmailService(prisma, session);

  // Stream progress back to client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      unifiedEmailService.sendCampaign(campaignId, (progress) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
        );
      }).then(result => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`)
        );
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain',
      'Transfer-Encoding': 'chunked'
    }
  });
}
```

This comprehensive service analysis provides the foundation for integrating SendAChaser's powerful email automation capabilities into Reminder's production-ready platform! 🚀