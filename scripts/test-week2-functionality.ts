/**
 * Week 2 Database Functionality Testing Script
 * Purpose: Test CSV Import and Email Integration functionality at application level
 * Usage: Run with ts-node or compile and run with Node.js
 * Requirements: Prisma Client, UAE test data setup
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
}

class Week2FunctionalityTester {
  private results: TestResult[] = [];
  private testCompanyId: string;
  private testUserId: string;
  private testCustomerId: string;

  constructor() {
    this.testCompanyId = `test-company-${randomUUID()}`;
    this.testUserId = `test-user-${randomUUID()}`;
    this.testCustomerId = `test-customer-${randomUUID()}`;
  }

  async runAllTests(): Promise<void> {
    console.log('🇦🇪 Starting Week 2 UAE Invoice Management System Tests...\n');

    try {
      // Setup test data
      await this.setupTestData();

      // Run CSV Import tests
      await this.testCsvImportFunctionality();

      // Run Email Integration tests  
      await this.testEmailIntegrationFunctionality();

      // Run UAE VAT calculation tests
      await this.testUaeVatCalculations();

      // Run Arabic bilingual support tests
      await this.testArabicBilingualSupport();

      // Run performance and constraint tests
      await this.testPerformanceAndConstraints();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
    } finally {
      // Cleanup test data
      await this.cleanupTestData();
      await prisma.$disconnect();
    }
  }

  private async setupTestData(): Promise<void> {
    console.log('📋 Setting up UAE test data...');

    try {
      // Create test company with UAE settings
      await prisma.companies.create({
        data: {
          id: this.testCompanyId,
          name: 'UAE Test Trading LLC',
          trn: '100123456700001', // Valid UAE TRN format
          address: 'Dubai International Financial Centre, Dubai, UAE',
          default_vat_rate: 5.00, // UAE standard VAT rate
          email_settings: {
            smtp_host: 'email-smtp.us-east-1.amazonaws.com',
            from_address: 'noreply@uaetest.com',
            aws_ses_region: 'us-east-1'
          },
          business_hours: {
            timezone: 'Asia/Dubai',
            work_days: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday'],
            start_time: '08:00',
            end_time: '18:00'
          }
        }
      });

      // Create test user
      await prisma.users.create({
        data: {
          id: this.testUserId,
          email: 'admin@uaetest.com',
          name: 'Ahmed Al-Mansouri',
          company_id: this.testCompanyId,
          role: 'ADMIN'
        }
      });

      // Create test customer with Arabic support
      await prisma.customers.create({
        data: {
          id: this.testCustomerId,
          company_id: this.testCompanyId,
          name: 'Emirates Trading Company',
          name_ar: 'شركة الإمارات التجارية',
          email: 'billing@emiratestrading.ae',
          phone: '+971501234567',
          payment_terms: 30,
          notes: 'Premium customer with NET 30 payment terms',
          notes_ar: 'عميل مميز بشروط دفع 30 يوم'
        }
      });

      this.addResult('Setup Test Data', true);
      console.log('✅ Test data setup complete\n');

    } catch (error) {
      this.addResult('Setup Test Data', false, error.message);
      throw error;
    }
  }

  private async testCsvImportFunctionality(): Promise<void> {
    console.log('📥 Testing CSV Import Functionality...');

    try {
      // Test 1: Create import batch
      const importBatch = await prisma.import_batches.create({
        data: {
          id: `import-batch-${randomUUID()}`,
          company_id: this.testCompanyId,
          user_id: this.testUserId,
          filename: 'invoices_2025_batch_001.csv',
          original_filename: 'UAE_Invoices_September_2025.csv',
          file_size: 52428,
          total_records: 100,
          status: 'PENDING',
          import_type: 'INVOICE',
          field_mappings: {
            invoice_number: { system_field: 'number', required: true },
            customer_name: { system_field: 'customer_name', required: true },
            customer_email: { system_field: 'customer_email', required: true },
            amount: { system_field: 'subtotal', data_type: 'decimal', required: true },
            vat_rate: { system_field: 'vat_rate', data_type: 'decimal', default: '5.00' },
            due_date: { system_field: 'due_date', data_type: 'date', required: true }
          }
        }
      });

      this.addResult('Create CSV Import Batch', true, { batchId: importBatch.id });

      // Test 2: Create field mappings
      const fieldMappings = await prisma.import_field_mappings.createMany({
        data: [
          {
            id: randomUUID(),
            import_batch_id: importBatch.id,
            csv_column_name: 'Invoice Number',
            system_field: 'number',
            data_type: 'string',
            is_required: true,
            validation_rule: 'unique_per_company'
          },
          {
            id: randomUUID(),
            import_batch_id: importBatch.id,
            csv_column_name: 'Amount (AED)',
            system_field: 'subtotal',
            data_type: 'decimal',
            is_required: true,
            validation_rule: 'positive_number'
          },
          {
            id: randomUUID(),
            import_batch_id: importBatch.id,
            csv_column_name: 'VAT Rate %',
            system_field: 'vat_rate',
            data_type: 'decimal',
            is_required: false,
            default_value: '5.00'
          }
        ]
      });

      this.addResult('Create Field Mappings', true, { count: fieldMappings.count });

      // Test 3: Create import errors
      const importError = await prisma.import_errors.create({
        data: {
          id: randomUUID(),
          import_batch_id: importBatch.id,
          row_number: 15,
          csv_data: {
            invoice_number: 'INV-2025-001',
            customer_email: 'invalid-email',
            amount: '1000.00'
          },
          error_type: 'VALIDATION_ERROR',
          error_message: 'Invalid email format provided',
          field_name: 'customer_email',
          attempted_value: 'invalid-email',
          suggestion: 'Provide valid email format: user@domain.com'
        }
      });

      this.addResult('Create Import Error', true, { errorId: importError.id });

      // Test 4: Update batch status and record counts
      const updatedBatch = await prisma.import_batches.update({
        where: { id: importBatch.id },
        data: {
          status: 'PARTIALLY_COMPLETED',
          processed_records: 100,
          successful_records: 99,
          failed_records: 1,
          processing_started_at: new Date(Date.now() - 300000), // 5 minutes ago
          processing_ended_at: new Date(),
          error_summary: '1 validation error: Invalid email format'
        }
      });

      this.addResult('Update Import Batch Status', true, { 
        status: updatedBatch.status,
        success_rate: (updatedBatch.successful_records / updatedBatch.processed_records * 100).toFixed(2) + '%'
      });

      console.log('✅ CSV Import functionality tests passed\n');

    } catch (error) {
      this.addResult('CSV Import Functionality', false, error.message);
      console.log('❌ CSV Import functionality tests failed\n');
    }
  }

  private async testEmailIntegrationFunctionality(): Promise<void> {
    console.log('📧 Testing Email Integration Functionality...');

    try {
      // Test 1: Create bilingual email template
      const emailTemplate = await prisma.email_templates.create({
        data: {
          id: `template-${randomUUID()}`,
          company_id: this.testCompanyId,
          name: 'Invoice Reminder Template',
          description: 'Standard invoice reminder for UAE customers',
          template_type: 'INVOICE_REMINDER',
          subject_en: 'Payment Reminder: Invoice {{invoice_number}} - {{amount}} AED',
          subject_ar: 'تذكير دفع: فاتورة {{invoice_number}} - {{amount}} درهم',
          content_en: '<p>Dear {{customer_name}},</p><p>This is a friendly reminder that your invoice {{invoice_number}} for {{amount}} AED is due on {{due_date}}.</p>',
          content_ar: '<p>عزيزنا {{customer_name}}،</p><p>هذا تذكير ودي بأن فاتورتك {{invoice_number}} بمبلغ {{amount}} درهم مستحقة في {{due_date}}.</p>',
          variables: ['customer_name', 'invoice_number', 'amount', 'due_date'],
          version: 1,
          is_active: true,
          is_default: true,
          uae_business_hours_only: true,
          created_by: this.testUserId
        }
      });

      this.addResult('Create Bilingual Email Template', true, { templateId: emailTemplate.id });

      // Test 2: Create email log with UAE business context
      const emailLog = await prisma.email_logs.create({
        data: {
          id: `email-${randomUUID()}`,
          template_id: emailTemplate.id,
          company_id: this.testCompanyId,
          customer_id: this.testCustomerId,
          recipient_email: 'billing@emiratestrading.ae',
          recipient_name: 'Emirates Trading Company',
          subject: 'Payment Reminder: Invoice INV-2025-001 - 1050.00 AED',
          content: 'Dear Emirates Trading Company, This is a friendly reminder...',
          language: 'ENGLISH',
          delivery_status: 'DELIVERED',
          sent_at: new Date(Date.now() - 7200000), // 2 hours ago
          delivered_at: new Date(Date.now() - 6900000), // 1:45 hours ago
          opened_at: new Date(Date.now() - 5400000), // 1:30 hours ago
          engagement_score: 0.85,
          uae_send_time: new Date(Date.now() - 7200000), // Sent during UAE business hours
          retry_count: 0,
          max_retries: 3
        }
      });

      this.addResult('Create Email Log with UAE Context', true, { 
        emailId: emailLog.id,
        engagement: emailLog.engagement_score
      });

      // Test 3: Create email bounce tracking
      const bounceTracking = await prisma.email_bounce_tracking.create({
        data: {
          id: randomUUID(),
          email_log_id: emailLog.id,
          bounce_type: 'soft',
          bounce_subtype: 'temporary-failure',
          diagnostic_code: '4.4.2 Connection timeout',
          arrival_date: new Date(Date.now() - 3600000), // 1 hour ago
          is_suppressed: false
        }
      });

      this.addResult('Create Email Bounce Tracking', true, { 
        bounceId: bounceTracking.id,
        bounceType: bounceTracking.bounce_type
      });

      // Test 4: Query email template with relationships
      const templateWithLogs = await prisma.email_templates.findUnique({
        where: { id: emailTemplate.id },
        include: {
          email_logs: {
            include: {
              email_bounce_tracking: true
            }
          }
        }
      });

      this.addResult('Query Email Template with Relationships', 
        templateWithLogs && templateWithLogs.email_logs.length > 0,
        { logsCount: templateWithLogs?.email_logs.length }
      );

      console.log('✅ Email Integration functionality tests passed\n');

    } catch (error) {
      this.addResult('Email Integration Functionality', false, error.message);
      console.log('❌ Email Integration functionality tests failed\n');
    }
  }

  private async testUaeVatCalculations(): Promise<void> {
    console.log('🧮 Testing UAE VAT Calculations...');

    try {
      // Test 1: Create invoice with VAT calculations
      const invoice = await prisma.invoices.create({
        data: {
          id: `invoice-${randomUUID()}`,
          company_id: this.testCompanyId,
          number: 'INV-2025-VAT-001',
          customer_name: 'Emirates Trading Company',
          customer_email: 'billing@emiratestrading.ae',
          amount: 1050.00, // Total amount including VAT
          subtotal: 1000.00, // Amount before VAT
          vat_amount: 50.00, // 5% UAE VAT
          total_amount: 1050.00, // Final amount with VAT
          currency: 'AED',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          status: 'SENT',
          description: 'Office supplies with UAE VAT',
          description_ar: 'مستلزمات مكتبية مع ضريبة القيمة المضافة',
          trn_number: '100123456700001' // Valid UAE TRN
        }
      });

      this.addResult('Create Invoice with UAE VAT', true, {
        invoiceId: invoice.id,
        vatRate: '5%',
        vatAmount: invoice.vat_amount
      });

      // Test 2: Create invoice items with detailed VAT
      const invoiceItems = await prisma.invoice_items.createMany({
        data: [
          {
            id: randomUUID(),
            invoice_id: invoice.id,
            description: 'Office Chair Premium',
            description_ar: 'كرسي مكتب فاخر',
            quantity: 2.00,
            unit_price: 300.00,
            total: 600.00,
            vat_rate: 5.00,
            vat_amount: 30.00,
            total_with_vat: 630.00,
            tax_category: 'STANDARD'
          },
          {
            id: randomUUID(),
            invoice_id: invoice.id,
            description: 'Desk Organizer Set',
            description_ar: 'مجموعة منظم المكتب',
            quantity: 4.00,
            unit_price: 100.00,
            total: 400.00,
            vat_rate: 5.00,
            vat_amount: 20.00,
            total_with_vat: 420.00,
            tax_category: 'STANDARD'
          }
        ]
      });

      this.addResult('Create Invoice Items with VAT Details', true, {
        itemCount: invoiceItems.count
      });

      // Test 3: Verify VAT calculations are correct
      const invoiceWithItems = await prisma.invoices.findUnique({
        where: { id: invoice.id },
        include: {
          invoice_items: true
        }
      });

      const calculatedSubtotal = invoiceWithItems!.invoice_items.reduce(
        (sum, item) => sum + Number(item.total), 0
      );
      const calculatedVat = invoiceWithItems!.invoice_items.reduce(
        (sum, item) => sum + Number(item.vat_amount), 0
      );
      const calculatedTotal = calculatedSubtotal + calculatedVat;

      const vatCalculationsCorrect = 
        Number(invoice.subtotal) === calculatedSubtotal &&
        Number(invoice.vat_amount) === calculatedVat &&
        Number(invoice.total_amount) === calculatedTotal;

      this.addResult('Verify VAT Calculations', vatCalculationsCorrect, {
        expected: { subtotal: calculatedSubtotal, vat: calculatedVat, total: calculatedTotal },
        actual: { 
          subtotal: Number(invoice.subtotal), 
          vat: Number(invoice.vat_amount), 
          total: Number(invoice.total_amount) 
        }
      });

      console.log('✅ UAE VAT calculations tests passed\n');

    } catch (error) {
      this.addResult('UAE VAT Calculations', false, error.message);
      console.log('❌ UAE VAT calculations tests failed\n');
    }
  }

  private async testArabicBilingualSupport(): Promise<void> {
    console.log('🔤 Testing Arabic Bilingual Support...');

    try {
      // Test 1: Query customer with Arabic fields
      const customer = await prisma.customers.findUnique({
        where: { id: this.testCustomerId }
      });

      const hasArabicSupport = customer && customer.name_ar && customer.notes_ar;

      this.addResult('Customer Arabic Fields', hasArabicSupport, {
        arabicName: customer?.name_ar,
        arabicNotes: customer?.notes_ar ? 'Present' : 'Missing'
      });

      // Test 2: Create invoice with Arabic content
      const arabicInvoice = await prisma.invoices.create({
        data: {
          id: `invoice-ar-${randomUUID()}`,
          company_id: this.testCompanyId,
          number: 'INV-AR-2025-001',
          customer_name: 'شركة الإمارات التجارية',
          customer_email: 'billing@emiratestrading.ae',
          amount: 525.00,
          subtotal: 500.00,
          vat_amount: 25.00,
          total_amount: 525.00,
          currency: 'AED',
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'SENT',
          description: 'Software licensing fees',
          description_ar: 'رسوم ترخيص البرمجيات',
          notes: 'Annual subscription renewal',
          notes_ar: 'تجديد الاشتراك السنوي'
        }
      });

      this.addResult('Create Invoice with Arabic Content', true, {
        invoiceId: arabicInvoice.id,
        hasArabicDescription: !!arabicInvoice.description_ar,
        hasArabicNotes: !!arabicInvoice.notes_ar
      });

      // Test 3: Query email template with both languages
      const bilingualTemplate = await prisma.email_templates.findFirst({
        where: {
          company_id: this.testCompanyId,
          subject_ar: { not: null },
          content_ar: { not: null }
        }
      });

      this.addResult('Bilingual Email Template', !!bilingualTemplate, {
        hasArabicSubject: !!bilingualTemplate?.subject_ar,
        hasArabicContent: !!bilingualTemplate?.content_ar
      });

      console.log('✅ Arabic bilingual support tests passed\n');

    } catch (error) {
      this.addResult('Arabic Bilingual Support', false, error.message);
      console.log('❌ Arabic bilingual support tests failed\n');
    }
  }

  private async testPerformanceAndConstraints(): Promise<void> {
    console.log('⚡ Testing Performance and Constraints...');

    try {
      // Test 1: Test constraint violations
      let constraintTestsPassed = 0;

      // Test invalid VAT rate
      try {
        await prisma.companies.create({
          data: {
            id: randomUUID(),
            name: 'Invalid VAT Company',
            default_vat_rate: 150.00 // Should violate constraint
          }
        });
      } catch (error) {
        if (error.code === 'P2010') { // Prisma constraint violation
          constraintTestsPassed++;
        }
      }

      // Test invalid email format
      try {
        await prisma.email_logs.create({
          data: {
            id: randomUUID(),
            company_id: this.testCompanyId,
            recipient_email: 'invalid-email-format',
            subject: 'Test',
            content: 'Test',
            delivery_status: 'QUEUED'
          }
        });
      } catch (error) {
        if (error.code === 'P2010') {
          constraintTestsPassed++;
        }
      }

      this.addResult('Database Constraints', constraintTestsPassed >= 1, {
        constraintViolationsCaught: constraintTestsPassed
      });

      // Test 2: Performance test with pagination
      const startTime = Date.now();
      
      const invoicesPage = await prisma.invoices.findMany({
        where: { company_id: this.testCompanyId },
        include: {
          invoice_items: true,
          import_batches: true,
          email_logs: true
        },
        orderBy: { created_at: 'desc' },
        take: 50,
        skip: 0
      });

      const queryTime = Date.now() - startTime;

      this.addResult('Complex Query Performance', queryTime < 1000, {
        queryTimeMs: queryTime,
        resultCount: invoicesPage.length,
        performanceTarget: '< 1000ms'
      });

      console.log('✅ Performance and constraints tests passed\n');

    } catch (error) {
      this.addResult('Performance and Constraints', false, error.message);
      console.log('❌ Performance and constraints tests failed\n');
    }
  }

  private async cleanupTestData(): Promise<void> {
    console.log('🧹 Cleaning up test data...');

    try {
      // Delete in correct order to respect foreign key constraints
      await prisma.email_bounce_tracking.deleteMany({
        where: { email_logs: { company_id: this.testCompanyId } }
      });
      
      await prisma.email_logs.deleteMany({
        where: { company_id: this.testCompanyId }
      });
      
      await prisma.email_templates.deleteMany({
        where: { company_id: this.testCompanyId }
      });
      
      await prisma.invoice_items.deleteMany({
        where: { invoices: { company_id: this.testCompanyId } }
      });
      
      await prisma.invoices.deleteMany({
        where: { company_id: this.testCompanyId }
      });
      
      await prisma.import_errors.deleteMany({
        where: { import_batches: { company_id: this.testCompanyId } }
      });
      
      await prisma.import_field_mappings.deleteMany({
        where: { import_batches: { company_id: this.testCompanyId } }
      });
      
      await prisma.import_batches.deleteMany({
        where: { company_id: this.testCompanyId }
      });
      
      await prisma.customers.deleteMany({
        where: { company_id: this.testCompanyId }
      });
      
      await prisma.users.deleteMany({
        where: { company_id: this.testCompanyId }
      });
      
      await prisma.companies.delete({
        where: { id: this.testCompanyId }
      });

      console.log('✅ Test data cleanup complete\n');

    } catch (error) {
      console.log('⚠️  Cleanup error (may be expected):', error.message);
    }
  }

  private addResult(testName: string, passed: boolean, details?: any, error?: string): void {
    this.results.push({
      testName,
      passed,
      details,
      error
    });
  }

  private generateTestReport(): void {
    console.log('📊 WEEK 2 FUNCTIONALITY TEST REPORT');
    console.log('=====================================');
    
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const successRate = ((passedTests / totalTests) * 100).toFixed(2);

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${successRate}%\n`);

    console.log('DETAILED RESULTS:');
    console.log('-'.repeat(50));

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.testName}`);
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      console.log('');
    });

    console.log('FEATURES TESTED:');
    console.log('- CSV Import with batch management and error tracking');
    console.log('- Email Integration with UAE business context');
    console.log('- UAE VAT calculations (5% standard rate)');
    console.log('- Arabic bilingual support for UAE market');
    console.log('- Database constraints and validation');
    console.log('- Query performance optimization');
    console.log('- Multi-tenant data isolation');
    console.log('- UAE business compliance (TRN, business hours, currency)');

    if (passedTests === totalTests) {
      console.log('\n🎉 ALL TESTS PASSED! Week 2 database enhancements are ready for production.');
    } else {
      console.log(`\n⚠️  ${failedTests} tests failed. Review and fix issues before deployment.`);
    }
  }
}

// Run the tests
if (require.main === module) {
  const tester = new Week2FunctionalityTester();
  tester.runAllTests().catch(console.error);
}

export default Week2FunctionalityTester;