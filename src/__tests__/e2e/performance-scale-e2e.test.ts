/**
 * Performance and Scale End-to-End Tests
 * 
 * Validates system performance under realistic UAE business loads,
 * ensuring the automation can handle multiple concurrent sequences
 * while maintaining cultural compliance and UAE business rules.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals'
import { performance } from 'perf_hooks'
import { prisma } from '@/lib/prisma'
import { sequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { emailSchedulingService } from '@/lib/services/email-scheduling-service'
import { culturalCompliance } from '@/lib/services/cultural-compliance-service'
import { UAETestUtils } from '@/lib/uae-test-utils'
import { setupTestDatabase, cleanupTestDatabase } from '@/lib/test-db-setup'

// Performance test configuration
const PERFORMANCE_THRESHOLDS = {
  SINGLE_SEQUENCE_EXECUTION: 2000, // 2 seconds
  BULK_SEQUENCE_PROCESSING: 30000, // 30 seconds for 100 sequences
  CULTURAL_COMPLIANCE_CHECK: 100, // 100ms per check
  EMAIL_SCHEDULING: 500, // 500ms per email
  DATABASE_QUERY: 1000, // 1 second for complex queries
  CONCURRENT_USER_SIMULATION: 15000 // 15 seconds for 50 concurrent operations
}

// Mock external services for controlled testing
jest.mock('@/lib/email-service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  validateEmailConfig: jest.fn().mockResolvedValue(true)
}))

// Performance measurement utilities
class PerformanceProfiler {
  private measurements: Map<string, number[]> = new Map()

  startMeasurement(name: string): () => number {
    const start = performance.now()
    return () => {
      const duration = performance.now() - start
      this.recordMeasurement(name, duration)
      return duration
    }
  }

  recordMeasurement(name: string, duration: number): void {
    if (!this.measurements.has(name)) {
      this.measurements.set(name, [])
    }
    this.measurements.get(name)!.push(duration)
  }

  getStats(name: string) {
    const measurements = this.measurements.get(name) || []
    if (measurements.length === 0) return null

    const sorted = measurements.sort((a, b) => a - b)
    return {
      count: measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      avg: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    }
  }

  getAllStats() {
    const stats: Record<string, any> = {}
    for (const [name] of this.measurements) {
      stats[name] = this.getStats(name)
    }
    return stats
  }

  reset(): void {
    this.measurements.clear()
  }
}

describe('Performance and Scale End-to-End Tests', () => {
  let profiler: PerformanceProfiler
  let testCompanyId: string
  let testUserId: string

  beforeAll(async () => {
    await setupTestDatabase()
    profiler = new PerformanceProfiler()
    
    testCompanyId = UAETestUtils.generateId()
    testUserId = UAETestUtils.generateId()

    await prisma.company.create({
      data: {
        id: testCompanyId,
        name: 'Performance Test LLC',
        trn: '100999888700001',
        address: 'Dubai Performance Center, UAE',
        businessHours: {
          workingDays: [0, 1, 2, 3, 4],
          startHour: 8,
          endHour: 18,
          timezone: 'Asia/Dubai'
        }
      }
    })

    await prisma.user.create({
      data: {
        id: testUserId,
        email: 'performance@test.ae',
        name: 'Performance Test User',
        companyId: testCompanyId,
        role: 'ADMIN'
      }
    })
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    console.log('\n📊 Performance Test Results:')
    console.log(JSON.stringify(profiler.getAllStats(), null, 2))
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Single Sequence Performance', () => {
    it('should execute single sequence within performance threshold', async () => {
      const endMeasurement = profiler.startMeasurement('single_sequence_execution')

      // Create test data
      const { invoiceId, sequenceId } = await createTestSequenceData()

      // Execute sequence
      const result = await sequenceExecutionService.startSequenceExecution(
        sequenceId,
        invoiceId,
        { type: 'INVOICE_STATUS', value: 'OVERDUE', operator: 'EQUALS' },
        { startImmediately: true }
      )

      const duration = endMeasurement()

      expect(result.success).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_SEQUENCE_EXECUTION)

      console.log(`✅ Single sequence execution: ${duration.toFixed(2)}ms`)
    })

    it('should maintain cultural compliance check performance', async () => {
      const testSequence = {
        id: 'perf-test',
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            content: `As-salamu alaykum, respected customer.
            
We hope this message finds you in good health and prosperity.

Your invoice for professional services is due for payment. We kindly request your attention to this matter.

Thank you for your cooperation.

JazakAllahu khair,
Finance Team`,
            subject: 'Respectful Invoice Reminder',
            tone: 'FORMAL'
          }
        ]
      }

      const endMeasurement = profiler.startMeasurement('cultural_compliance_check')
      
      const complianceResult = culturalCompliance.validateSequenceTone(testSequence, 'REGULAR')
      
      const duration = endMeasurement()

      expect(complianceResult.isAppropriate).toBe(true)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CULTURAL_COMPLIANCE_CHECK)

      console.log(`✅ Cultural compliance check: ${duration.toFixed(2)}ms`)
    })

    it('should schedule emails efficiently', async () => {
      const endMeasurement = profiler.startMeasurement('email_scheduling')

      const emailId = await emailSchedulingService.scheduleEmail({
        companyId: testCompanyId,
        recipientEmail: 'performance.test@example.ae',
        recipientName: 'Performance Test Customer',
        subject: 'Performance Test Email',
        content: 'This is a performance test email',
        language: 'ENGLISH',
        scheduledFor: new Date(Date.now() + 60000),
        priority: 'NORMAL',
        maxRetries: 3,
        retryCount: 0
      })

      const duration = endMeasurement()

      expect(emailId).toBeTruthy()
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.EMAIL_SCHEDULING)

      console.log(`✅ Email scheduling: ${duration.toFixed(2)}ms`)
    })
  })

  describe('Bulk Processing Performance', () => {
    it('should handle 100 concurrent sequence executions efficiently', async () => {
      console.log('🚀 Starting bulk sequence processing test (100 sequences)...')

      const endMeasurement = profiler.startMeasurement('bulk_sequence_processing')

      // Create 100 test scenarios
      const testData = await createBulkTestData(100)
      
      // Process all sequences concurrently
      const promises = testData.map(({ invoiceId, sequenceId }) =>
        sequenceExecutionService.startSequenceExecution(
          sequenceId,
          invoiceId,
          { type: 'INVOICE_STATUS', value: 'OVERDUE', operator: 'EQUALS' },
          { startImmediately: true }
        ).catch(error => ({ success: false, error: error.message }))
      )

      const results = await Promise.all(promises)
      const duration = endMeasurement()

      // Analyze results
      const successful = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length
      const successRate = (successful / results.length) * 100

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_SEQUENCE_PROCESSING)
      expect(successRate).toBeGreaterThan(90) // At least 90% success rate
      expect(successful).toBeGreaterThan(90)

      console.log(`✅ Bulk processing: ${duration.toFixed(2)}ms, Success rate: ${successRate.toFixed(1)}%`)
      console.log(`   Successful: ${successful}, Failed: ${failed}`)
    })

    it('should maintain performance with large email queues', async () => {
      console.log('📧 Testing large email queue performance...')

      const endMeasurement = profiler.startMeasurement('large_email_queue')

      // Create 200 scheduled emails
      const emailPromises = []
      for (let i = 0; i < 200; i++) {
        emailPromises.push(
          emailSchedulingService.scheduleEmail({
            companyId: testCompanyId,
            recipientEmail: `bulk.test.${i}@example.ae`,
            recipientName: `Bulk Test Customer ${i}`,
            subject: `Bulk Test Email ${i}`,
            content: `This is bulk test email number ${i}`,
            language: 'ENGLISH',
            scheduledFor: new Date(Date.now() + (i * 1000 * 60)), // Spread over time
            priority: i % 3 === 0 ? 'HIGH' : 'NORMAL',
            maxRetries: 3,
            retryCount: 0
          })
        )
      }

      const emailIds = await Promise.all(emailPromises)
      
      // Check queue metrics performance
      const metricsResult = await emailSchedulingService.getQueueMetrics()
      
      const duration = endMeasurement()

      expect(emailIds.length).toBe(200)
      expect(metricsResult.totalQueued).toBeGreaterThan(150)
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.BULK_SEQUENCE_PROCESSING)

      console.log(`✅ Large email queue: ${duration.toFixed(2)}ms, Queued: ${metricsResult.totalQueued}`)
    })

    it('should handle cultural compliance validation at scale', async () => {
      console.log('🎯 Testing cultural compliance at scale...')

      const endMeasurement = profiler.startMeasurement('bulk_cultural_compliance')

      // Create diverse test content
      const testContents = [
        'As-salamu alaykum, respected customer. Your invoice requires attention. JazakAllahu khair.',
        'Dear valued partner, we kindly request your cooperation regarding the pending payment.',
        'Greetings! This is a friendly reminder about your outstanding invoice.',
        'Your Excellency, we respectfully bring this matter to your attention.',
        'عزيزي العميل المحترم، نتمنى أن تكونوا بخير. فاتورتكم مستحقة الدفع.',
      ]

      const customerTypes = ['GOVERNMENT', 'VIP', 'CORPORATE', 'REGULAR'] as const

      // Test 100 combinations
      const compliancePromises = []
      for (let i = 0; i < 100; i++) {
        const content = testContents[i % testContents.length]
        const customerType = customerTypes[i % customerTypes.length]
        
        compliancePromises.push(
          Promise.resolve(culturalCompliance.calculateCulturalScore(content, {
            customerRelationship: customerType,
            language: content.includes('عزيزي') ? 'ar' : 'en'
          }))
        )
      }

      const results = await Promise.all(compliancePromises)
      const duration = endMeasurement()

      // All should complete successfully
      expect(results.length).toBe(100)
      results.forEach(result => {
        expect(result.score).toBeGreaterThanOrEqual(0)
        expect(result.score).toBeLessThanOrEqual(100)
      })

      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length

      expect(duration).toBeLessThan(10000) // 10 seconds for 100 checks
      expect(avgScore).toBeGreaterThan(60) // Reasonable average score

      console.log(`✅ Bulk cultural compliance: ${duration.toFixed(2)}ms, Avg score: ${avgScore.toFixed(1)}`)
    })
  })

  describe('Database Performance Under Load', () => {
    it('should handle complex analytics queries efficiently', async () => {
      console.log('🗄️ Testing database performance with complex queries...')

      // Create realistic test data
      await createAnalyticsTestData()

      const endMeasurement = profiler.startMeasurement('complex_database_query')

      // Execute complex analytics query
      const analytics = await sequenceExecutionService.getSequenceAnalytics('test-sequence-1')

      const duration = endMeasurement()

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY)
      expect(analytics.totalExecutions).toBeGreaterThanOrEqual(0)

      console.log(`✅ Complex database query: ${duration.toFixed(2)}ms`)
    })

    it('should maintain performance with large result sets', async () => {
      const endMeasurement = profiler.startMeasurement('large_result_set_query')

      // Query for many email logs
      const emailLogs = await prisma.emailLog.findMany({
        where: { companyId: testCompanyId },
        include: {
          emailTemplates: true,
          customers: true,
          invoices: true
        },
        take: 100
      })

      const duration = endMeasurement()

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DATABASE_QUERY)
      expect(emailLogs.length).toBeGreaterThanOrEqual(0)

      console.log(`✅ Large result set query: ${duration.toFixed(2)}ms, Results: ${emailLogs.length}`)
    })
  })

  describe('Concurrent User Simulation', () => {
    it('should handle multiple concurrent operations from different companies', async () => {
      console.log('👥 Simulating concurrent users across multiple companies...')

      const endMeasurement = profiler.startMeasurement('concurrent_user_simulation')

      // Create multiple companies
      const companies = await createMultipleTestCompanies(5)
      
      // Simulate concurrent operations
      const operations = []
      
      for (const company of companies) {
        // Each company performs multiple operations
        for (let i = 0; i < 10; i++) {
          operations.push(
            // Create sequence
            createTestSequenceForCompany(company.id),
            // Schedule emails
            emailSchedulingService.scheduleEmail({
              companyId: company.id,
              recipientEmail: `concurrent.test.${i}@${company.domain}`,
              recipientName: `Concurrent Test ${i}`,
              subject: `Concurrent Test Email ${i}`,
              content: `Test email from ${company.name}`,
              language: 'ENGLISH',
              scheduledFor: new Date(Date.now() + 60000),
              priority: 'NORMAL',
              maxRetries: 3,
              retryCount: 0
            })
          )
        }
      }

      const results = await Promise.allSettled(operations)
      const duration = endMeasurement()

      const successful = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      const successRate = (successful / results.length) * 100

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_USER_SIMULATION)
      expect(successRate).toBeGreaterThan(85) // 85% success rate under load
      
      console.log(`✅ Concurrent operations: ${duration.toFixed(2)}ms`)
      console.log(`   Total: ${results.length}, Success: ${successful}, Failed: ${failed}`)
      console.log(`   Success rate: ${successRate.toFixed(1)}%`)
    })

    it('should maintain cultural compliance under concurrent load', async () => {
      console.log('🎭 Testing cultural compliance under concurrent load...')

      const endMeasurement = profiler.startMeasurement('concurrent_cultural_compliance')

      const complianceChecks = []
      
      // Simulate 50 concurrent cultural compliance checks
      for (let i = 0; i < 50; i++) {
        complianceChecks.push(
          culturalCompliance.validateSequenceTone({
            id: `concurrent-test-${i}`,
            steps: [
              {
                stepNumber: 1,
                delayDays: 7,
                content: `As-salamu alaykum, valued customer ${i}. Your cooperation is appreciated. JazakAllahu khair.`,
                subject: `Respectful reminder ${i}`,
                tone: 'FORMAL'
              }
            ]
          }, i % 4 === 0 ? 'GOVERNMENT' : 'REGULAR')
        )
      }

      const results = await Promise.all(complianceChecks)
      const duration = endMeasurement()

      const validResults = results.filter(r => r.isAppropriate).length
      const validationRate = (validResults / results.length) * 100

      expect(duration).toBeLessThan(5000) // 5 seconds for 50 checks
      expect(validationRate).toBeGreaterThan(90) // 90% should pass validation

      console.log(`✅ Concurrent cultural compliance: ${duration.toFixed(2)}ms`)
      console.log(`   Validation rate: ${validationRate.toFixed(1)}%`)
    })
  })

  describe('Memory and Resource Management', () => {
    it('should not have memory leaks during extended operations', async () => {
      console.log('🧠 Testing memory management during extended operations...')

      const initialMemory = process.memoryUsage()
      
      // Perform 1000 lightweight operations
      for (let i = 0; i < 1000; i++) {
        await culturalCompliance.calculateCulturalScore(
          `Test content ${i} with Islamic greeting As-salamu alaykum`
        )
        
        // Simulate some async work
        await new Promise(resolve => setTimeout(resolve, 1))
      }

      const finalMemory = process.memoryUsage()
      
      // Memory growth should be reasonable
      const heapGrowth = finalMemory.heapUsed - initialMemory.heapUsed
      const heapGrowthMB = heapGrowth / 1024 / 1024

      expect(heapGrowthMB).toBeLessThan(50) // Less than 50MB growth

      console.log(`✅ Memory test: ${heapGrowthMB.toFixed(2)}MB heap growth`)
    })

    it('should handle database connection pooling efficiently', async () => {
      console.log('🔌 Testing database connection efficiency...')

      const endMeasurement = profiler.startMeasurement('db_connection_efficiency')

      // Perform many concurrent database operations
      const dbOperations = []
      for (let i = 0; i < 100; i++) {
        dbOperations.push(
          prisma.company.findFirst({
            where: { id: testCompanyId },
            select: { id: true, name: true }
          })
        )
      }

      const results = await Promise.all(dbOperations)
      const duration = endMeasurement()

      expect(results.length).toBe(100)
      expect(results.every(r => r?.id === testCompanyId)).toBe(true)
      expect(duration).toBeLessThan(5000) // 5 seconds for 100 queries

      console.log(`✅ DB connection efficiency: ${duration.toFixed(2)}ms for 100 queries`)
    })
  })

  // Helper functions
  async function createTestSequenceData() {
    const customerId = UAETestUtils.generateId()
    const invoiceId = UAETestUtils.generateId()
    const sequenceId = UAETestUtils.generateId()

    await prisma.customer.create({
      data: {
        id: customerId,
        companyId: testCompanyId,
        name: 'Performance Test Customer',
        email: `perf.customer.${customerId.slice(-8)}@example.ae`,
        phone: '+971-4-123-4567'
      }
    })

    await prisma.invoice.create({
      data: {
        id: invoiceId,
        companyId: testCompanyId,
        number: `INV-PERF-${invoiceId.slice(-8)}`,
        customerName: 'Performance Test Customer',
        customerEmail: `perf.customer.${customerId.slice(-8)}@example.ae`,
        amount: 1000,
        vatAmount: 50,
        totalAmount: 1050,
        currency: 'AED',
        dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        status: 'OVERDUE',
        trnNumber: '100999888700001'
      }
    })

    await prisma.followUpSequence.create({
      data: {
        id: sequenceId,
        companyId: testCompanyId,
        name: 'Performance Test Sequence',
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Test Reminder',
            content: 'Performance test content',
            tone: 'BUSINESS',
            language: 'ENGLISH'
          }
        ],
        active: true,
        updatedAt: new Date()
      }
    })

    return { customerId, invoiceId, sequenceId }
  }

  async function createBulkTestData(count: number) {
    const testData = []
    
    for (let i = 0; i < count; i++) {
      const data = await createTestSequenceData()
      testData.push(data)
    }
    
    return testData
  }

  async function createAnalyticsTestData() {
    // Create test sequence for analytics
    const sequenceId = 'test-sequence-1'
    
    await prisma.followUpSequence.upsert({
      where: { id: sequenceId },
      create: {
        id: sequenceId,
        companyId: testCompanyId,
        name: 'Analytics Test Sequence',
        steps: [{ stepNumber: 1, delayDays: 7, subject: 'Test', content: 'Test', tone: 'BUSINESS', language: 'ENGLISH' }],
        active: true,
        updatedAt: new Date()
      },
      update: {}
    })

    // Create test data for analytics
    for (let i = 0; i < 20; i++) {
      const customerId = UAETestUtils.generateId()
      const invoiceId = UAETestUtils.generateId()
      const logId = UAETestUtils.generateId()

      await prisma.customer.create({
        data: {
          id: customerId,
          companyId: testCompanyId,
          name: `Analytics Test Customer ${i}`,
          email: `analytics.${i}@example.ae`,
          phone: '+971-4-123-4567'
        }
      })

      await prisma.invoice.create({
        data: {
          id: invoiceId,
          companyId: testCompanyId,
          number: `INV-ANALYTICS-${i}`,
          customerName: `Analytics Test Customer ${i}`,
          customerEmail: `analytics.${i}@example.ae`,
          amount: 1000 * (i + 1),
          vatAmount: 50 * (i + 1),
          totalAmount: 1050 * (i + 1),
          currency: 'AED',
          dueDate: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
          status: 'OVERDUE',
          trnNumber: '100999888700001'
        }
      })

      await prisma.followUpLog.create({
        data: {
          id: logId,
          invoiceId,
          sequenceId,
          stepNumber: 1,
          emailAddress: `analytics.${i}@example.ae`,
          subject: 'Analytics Test',
          content: 'Analytics test content',
          sentAt: new Date(Date.now() - (i * 60 * 60 * 1000))
        }
      })
    }
  }

  async function createMultipleTestCompanies(count: number) {
    const companies = []
    
    for (let i = 0; i < count; i++) {
      const companyId = UAETestUtils.generateId()
      const domain = `company${i}.ae`
      
      const company = await prisma.company.create({
        data: {
          id: companyId,
          name: `Concurrent Test Company ${i}`,
          trn: `10099988870000${i}`,
          address: `Dubai Test Center ${i}, UAE`,
          businessHours: {
            workingDays: [0, 1, 2, 3, 4],
            startHour: 8,
            endHour: 18,
            timezone: 'Asia/Dubai'
          }
        }
      })
      
      companies.push({ ...company, domain })
    }
    
    return companies
  }

  async function createTestSequenceForCompany(companyId: string) {
    const sequenceId = UAETestUtils.generateId()
    
    return await prisma.followUpSequence.create({
      data: {
        id: sequenceId,
        companyId,
        name: `Concurrent Test Sequence ${sequenceId.slice(-8)}`,
        steps: [
          {
            stepNumber: 1,
            delayDays: 7,
            subject: 'Concurrent Test',
            content: 'Concurrent test content',
            tone: 'BUSINESS',
            language: 'ENGLISH'
          }
        ],
        active: true,
        updatedAt: new Date()
      }
    })
  }
})