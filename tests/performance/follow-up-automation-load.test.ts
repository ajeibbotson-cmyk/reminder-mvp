/**
 * Follow-up Automation Performance & Load Tests
 * High-volume testing for UAE business automation at scale
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals'
import { PrismaClient } from '@prisma/client'
import { SequenceExecutionService } from '@/lib/services/sequence-execution-service'
import { UAEBusinessHoursService } from '@/lib/services/uae-business-hours-service'
import { faker } from '@faker-js/faker'

// Performance test database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'file:./test-performance.db'
    }
  }
})

// Mock external services for performance testing
const mockEmailService = {
  scheduleEmail: jest.fn(),
  cancelScheduledEmail: jest.fn(),
  getDeliveryStatus: jest.fn(),
  bulkScheduleEmails: jest.fn() // Bulk operation for performance
}

const mockAWSService = {
  sendBulkEmail: jest.fn(),
  checkBulkEmailStatus: jest.fn()
}

jest.mock('@/lib/services/email-scheduling-service', () => ({
  emailSchedulingService: mockEmailService
}))

describe('Follow-up Automation Performance & Load Tests', () => {
  let sequenceService: SequenceExecutionService
  let businessHoursService: UAEBusinessHoursService
  let testCompanies: any[] = []
  let testCustomers: any[] = []
  let testInvoices: any[] = []
  let testSequences: any[] = []

  // Performance benchmarks
  const PERFORMANCE_TARGETS = {
    // Process 1000+ invoices in under 2 minutes
    BULK_PROCESSING_TARGET: 120000, // 2 minutes in ms
    BULK_PROCESSING_VOLUME: 1000,

    // Handle 50+ concurrent sequences
    CONCURRENT_SEQUENCES: 50,
    CONCURRENT_PROCESSING_TARGET: 30000, // 30 seconds

    // Database queries under 100ms average
    DB_QUERY_TARGET: 100,

    // Email delivery rate >98%
    EMAIL_DELIVERY_RATE: 0.98,

    // Memory usage should not exceed 512MB during load testing
    MEMORY_LIMIT: 512 * 1024 * 1024 // 512MB in bytes
  }

  beforeAll(async () => {
    sequenceService = new SequenceExecutionService()
    businessHoursService = new UAEBusinessHoursService()

    // Clean up any existing test data
    await cleanupPerformanceTestData()

    // Set up mock responses for performance testing
    mockEmailService.scheduleEmail.mockImplementation(() =>
      Promise.resolve(`email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    )
    mockEmailService.bulkScheduleEmails.mockImplementation((emails) =>
      Promise.resolve(emails.map(() => `bulk-email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`))
    )
    mockEmailService.cancelScheduledEmail.mockResolvedValue(true)
    mockEmailService.getDeliveryStatus.mockResolvedValue('SENT')
  })

  afterAll(async () => {
    await cleanupPerformanceTestData()
    await prisma.$disconnect()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(async () => {
    // Cleanup test data after each test
    await cleanupCurrentTestData()
  })

  async function cleanupPerformanceTestData() {
    try {
      await prisma.followUpLog.deleteMany({
        where: {
          OR: [
            { id: { contains: 'perf-test-' } },
            { id: { contains: 'load-test-' } },
            { id: { contains: 'stress-test-' } }
          ]
        }
      })

      await prisma.emailLog.deleteMany({
        where: {
          OR: [
            { id: { contains: 'perf-test-' } },
            { id: { contains: 'load-test-' } },
            { id: { contains: 'stress-test-' } }
          ]
        }
      })

      await prisma.followUpSequence.deleteMany({
        where: {
          id: { contains: 'perf-test-' }
        }
      })

      await prisma.invoice.deleteMany({
        where: {
          id: { contains: 'perf-test-' }
        }
      })

      await prisma.customer.deleteMany({
        where: {
          id: { contains: 'perf-test-' }
        }
      })

      await prisma.company.deleteMany({
        where: {
          id: { contains: 'perf-test-' }
        }
      })
    } catch (error) {
      console.warn('Performance cleanup warning:', error)
    }
  }

  async function cleanupCurrentTestData() {
    const idsToClean = [
      ...testCompanies.map(c => c.id),
      ...testCustomers.map(c => c.id),
      ...testInvoices.map(i => i.id),
      ...testSequences.map(s => s.id)
    ]

    if (idsToClean.length > 0) {
      try {
        await prisma.followUpLog.deleteMany({
          where: {
            OR: [
              { invoiceId: { in: testInvoices.map(i => i.id) } },
              { sequenceId: { in: testSequences.map(s => s.id) } }
            ]
          }
        })

        await prisma.followUpSequence.deleteMany({
          where: { id: { in: testSequences.map(s => s.id) } }
        })

        await prisma.invoice.deleteMany({
          where: { id: { in: testInvoices.map(i => i.id) } }
        })

        await prisma.customer.deleteMany({
          where: { id: { in: testCustomers.map(c => c.id) } }
        })

        await prisma.company.deleteMany({
          where: { id: { in: testCompanies.map(c => c.id) } }
        })
      } catch (error) {
        console.warn('Current test cleanup warning:', error)
      }

      // Reset arrays
      testCompanies = []
      testCustomers = []
      testInvoices = []
      testSequences = []
    }
  }

  async function createPerformanceTestData(count: number) {
    const companies: any[] = []
    const customers: any[] = []
    const invoices: any[] = []
    const sequences: any[] = []

    // Create companies
    for (let i = 0; i < Math.min(count / 100, 10); i++) { // Max 10 companies
      const company = await prisma.company.create({
        data: {
          id: `perf-test-company-${i}-${Date.now()}`,
          name: `${faker.company.name()} LLC`,
          email: faker.internet.email(),
          trn: `100${faker.string.numeric(9)}001`,
          address: 'Dubai, UAE',
          phone: '+971-4-123-4567',
          website: faker.internet.url(),
          currency: 'AED',
          timezone: 'Asia/Dubai',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      companies.push(company)
    }

    // Create customers
    for (let i = 0; i < Math.min(count / 10, 100); i++) { // Max 100 customers
      const customer = await prisma.customer.create({
        data: {
          id: `perf-test-customer-${i}-${Date.now()}`,
          companyId: companies[i % companies.length].id,
          name: faker.person.fullName(),
          email: faker.internet.email(),
          phone: `+971-50-${faker.string.numeric(7)}`,
          address: `${faker.location.city()}, UAE`,
          trn: `100${faker.string.numeric(9)}001`,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      customers.push(customer)
    }

    // Create sequences
    for (let i = 0; i < companies.length; i++) {
      const sequence = await prisma.followUpSequence.create({
        data: {
          id: `perf-test-sequence-${i}-${Date.now()}`,
          companyId: companies[i].id,
          name: `Performance Test Sequence ${i}`,
          description: 'High-performance follow-up sequence',
          active: true,
          steps: JSON.stringify([
            {
              stepNumber: 1,
              delayDays: 7,
              subject: 'Invoice Reminder: {{invoiceNumber}}',
              content: 'Dear {{customerName}}, please review invoice {{invoiceNumber}} for {{invoiceAmount}} {{currency}}.',
              language: 'ENGLISH',
              tone: 'BUSINESS',
              stopConditions: []
            }
          ]),
          triggerConditions: JSON.stringify([
            { type: 'DAYS_OVERDUE', value: 0, operator: 'GREATER_THAN' }
          ]),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      sequences.push(sequence)
    }

    // Create invoices
    for (let i = 0; i < count; i++) {
      const customer = customers[i % customers.length]
      const company = companies.find(c => c.id === customer.companyId)

      const invoice = await prisma.invoice.create({
        data: {
          id: `perf-test-invoice-${i}-${Date.now()}`,
          number: `PERF-${i.toString().padStart(6, '0')}`,
          companyId: company.id,
          customerId: customer.id,
          customerName: customer.name,
          customerEmail: customer.email,
          amount: faker.number.int({ min: 1000, max: 50000 }),
          vat: faker.number.int({ min: 50, max: 2500 }),
          totalAmount: faker.number.int({ min: 1050, max: 52500 }),
          currency: 'AED',
          status: 'SENT',
          dueDate: faker.date.future(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      })
      invoices.push(invoice)
    }

    testCompanies.push(...companies)
    testCustomers.push(...customers)
    testInvoices.push(...invoices)
    testSequences.push(...sequences)

    return { companies, customers, invoices, sequences }
  }

  function measureMemoryUsage(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }

  describe('High-Volume Invoice Processing', () => {
    it('should process 1000+ invoices within performance targets', async () => {
      const volume = PERFORMANCE_TARGETS.BULK_PROCESSING_VOLUME
      const { invoices, sequences } = await createPerformanceTestData(volume)

      const startTime = Date.now()
      const initialMemory = measureMemoryUsage()

      const promises: Promise<any>[] = []

      // Process invoices in batches to avoid overwhelming the system
      const batchSize = 50
      for (let i = 0; i < invoices.length; i += batchSize) {
        const batch = invoices.slice(i, i + batchSize)

        const batchPromises = batch.map(invoice => {
          const sequence = sequences.find(s => s.companyId === invoice.companyId)
          return sequenceService.startSequenceExecution(
            sequence.id,
            invoice.id,
            { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
            { startImmediately: true }
          )
        })

        promises.push(...batchPromises)

        // Small delay between batches to prevent overwhelming
        if (i + batchSize < invoices.length) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      const results = await Promise.all(promises)
      const endTime = Date.now()
      const finalMemory = measureMemoryUsage()

      const processingTime = endTime - startTime
      const successRate = results.filter(r => r.success).length / results.length
      const memoryUsed = finalMemory - initialMemory

      // Performance assertions
      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.BULK_PROCESSING_TARGET)
      expect(successRate).toBeGreaterThan(PERFORMANCE_TARGETS.EMAIL_DELIVERY_RATE)
      expect(memoryUsed).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_LIMIT)

      // Verify all emails were scheduled\n      expect(mockEmailService.scheduleEmail).toHaveBeenCalledTimes(volume)

      console.log(`Performance Metrics:`)
      console.log(`  Processed: ${volume} invoices`)
      console.log(`  Time: ${processingTime}ms (target: ${PERFORMANCE_TARGETS.BULK_PROCESSING_TARGET}ms)`)
      console.log(`  Success Rate: ${(successRate * 100).toFixed(2)}% (target: ${PERFORMANCE_TARGETS.EMAIL_DELIVERY_RATE * 100}%)`)
      console.log(`  Memory Used: ${(memoryUsed / (1024 * 1024)).toFixed(2)}MB`)
    }, 180000) // 3 minute timeout

    it('should handle concurrent sequence executions efficiently', async () => {
      const concurrentCount = PERFORMANCE_TARGETS.CONCURRENT_SEQUENCES
      const { invoices, sequences } = await createPerformanceTestData(concurrentCount)

      const startTime = Date.now()

      // Execute all sequences concurrently
      const promises = invoices.map(invoice => {
        const sequence = sequences.find(s => s.companyId === invoice.companyId)
        return sequenceService.startSequenceExecution(
          sequence.id,
          invoice.id,
          { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
          { startImmediately: true }
        )
      })

      const results = await Promise.all(promises)
      const endTime = Date.now()

      const processingTime = endTime - startTime
      const successRate = results.filter(r => r.success).length / results.length

      expect(processingTime).toBeLessThan(PERFORMANCE_TARGETS.CONCURRENT_PROCESSING_TARGET)
      expect(successRate).toBeGreaterThan(PERFORMANCE_TARGETS.EMAIL_DELIVERY_RATE)

      console.log(`Concurrent Processing Metrics:`)
      console.log(`  Concurrent Sequences: ${concurrentCount}`)
      console.log(`  Time: ${processingTime}ms (target: ${PERFORMANCE_TARGETS.CONCURRENT_PROCESSING_TARGET}ms)`)
      console.log(`  Success Rate: ${(successRate * 100).toFixed(2)}%`)
    }, 60000) // 1 minute timeout

    it('should maintain performance with database query optimization', async () => {
      const { invoices, sequences } = await createPerformanceTestData(100)

      const queryTimes: number[] = []

      for (let i = 0; i < 50; i++) {
        const invoice = invoices[i]
        const sequence = sequences.find(s => s.companyId === invoice.companyId)

        const queryStart = Date.now()

        // Test various database operations
        await Promise.all([
          prisma.invoice.findUnique({ where: { id: invoice.id } }),
          prisma.followUpSequence.findUnique({ where: { id: sequence.id } }),
          prisma.customer.findUnique({ where: { id: invoice.customerId } }),
          prisma.company.findUnique({ where: { id: invoice.companyId } })
        ])

        const queryEnd = Date.now()
        queryTimes.push(queryEnd - queryStart)
      }

      const averageQueryTime = queryTimes.reduce((sum, time) => sum + time, 0) / queryTimes.length
      const maxQueryTime = Math.max(...queryTimes)

      expect(averageQueryTime).toBeLessThan(PERFORMANCE_TARGETS.DB_QUERY_TARGET)
      expect(maxQueryTime).toBeLessThan(PERFORMANCE_TARGETS.DB_QUERY_TARGET * 2) // Max should be reasonable

      console.log(`Database Query Performance:`)
      console.log(`  Average Query Time: ${averageQueryTime.toFixed(2)}ms (target: ${PERFORMANCE_TARGETS.DB_QUERY_TARGET}ms)`)
      console.log(`  Max Query Time: ${maxQueryTime}ms`)
      console.log(`  Queries Tested: ${queryTimes.length}`)
    })
  })

  describe('Memory and Resource Management', () => {
    it('should manage memory efficiently during bulk operations', async () => {
      const initialMemory = measureMemoryUsage()

      // Process data in waves to test garbage collection
      for (let wave = 0; wave < 5; wave++) {
        const { invoices, sequences } = await createPerformanceTestData(200)

        const promises = invoices.map(invoice => {
          const sequence = sequences.find(s => s.companyId === invoice.companyId)
          return sequenceService.startSequenceExecution(
            sequence.id,
            invoice.id,
            { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
            { startImmediately: true }
          )
        })

        await Promise.all(promises)

        // Cleanup after each wave
        await cleanupCurrentTestData()

        // Force garbage collection if available
        if (global.gc) {
          global.gc()
        }

        const currentMemory = measureMemoryUsage()
        const memoryIncrease = currentMemory - initialMemory

        // Memory should not continuously grow
        expect(memoryIncrease).toBeLessThan(PERFORMANCE_TARGETS.MEMORY_LIMIT)

        console.log(`Wave ${wave + 1} Memory: ${(currentMemory / (1024 * 1024)).toFixed(2)}MB`)
      }
    }, 120000) // 2 minute timeout

    it('should handle resource cleanup properly', async () => {
      const { invoices, sequences } = await createPerformanceTestData(100)

      // Start sequences
      const startPromises = invoices.map(invoice => {
        const sequence = sequences.find(s => s.companyId === invoice.companyId)
        return sequenceService.startSequenceExecution(
          sequence.id,
          invoice.id,
          { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
          { startImmediately: true }
        )
      })

      const startResults = await Promise.all(startPromises)

      // Stop all sequences (simulating payment received)
      const stopPromises = startResults
        .filter(result => result.success)
        .map(result =>
          sequenceService.stopSequenceExecution(
            result.sequenceExecutionId!.split('-')[0], // Extract sequence ID
            invoices[0].id, // Use first invoice as example
            'Performance test cleanup'
          )
        )

      const stopResults = await Promise.all(stopPromises)

      // All stops should succeed
      expect(stopResults.every(result => result === true)).toBe(true)

      // Verify cancellation calls were made
      expect(mockEmailService.cancelScheduledEmail).toHaveBeenCalled()
    })
  })

  describe('Stress Testing and Edge Cases', () => {
    it('should handle rapid sequence creation and deletion', async () => {
      const cycles = 50
      const sequencesPerCycle = 10

      for (let cycle = 0; cycle < cycles; cycle++) {
        // Create sequences
        const { invoices, sequences } = await createPerformanceTestData(sequencesPerCycle)

        // Start them
        const promises = invoices.map(invoice => {
          const sequence = sequences.find(s => s.companyId === invoice.companyId)
          return sequenceService.startSequenceExecution(
            sequence.id,
            invoice.id,
            { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
            { startImmediately: true }
          )
        })

        const results = await Promise.all(promises)

        // Verify success
        expect(results.every(r => r.success)).toBe(true)

        // Clean up immediately
        await cleanupCurrentTestData()
      }

      console.log(`Stress Test Completed: ${cycles} cycles, ${sequencesPerCycle} sequences each`)
    }, 180000) // 3 minute timeout

    it('should maintain performance under UAE business hours constraints', async () => {
      const { invoices, sequences } = await createPerformanceTestData(500)

      // Mock various business hour scenarios
      let businessHoursCalls = 0
      jest.spyOn(businessHoursService, 'getNextAvailableSendTime').mockImplementation((date) => {
        businessHoursCalls++
        // Simulate some processing time
        const nextTime = new Date(date.getTime() + 60 * 60 * 1000) // 1 hour later
        return nextTime
      })

      const startTime = Date.now()

      const promises = invoices.map(invoice => {
        const sequence = sequences.find(s => s.companyId === invoice.companyId)
        return sequenceService.startSequenceExecution(
          sequence.id,
          invoice.id,
          { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
          { startImmediately: false } // Force business hours calculation
        )
      })

      const results = await Promise.all(promises)
      const endTime = Date.now()

      const processingTime = endTime - startTime
      const successRate = results.filter(r => r.success).length / results.length

      // Should still meet performance targets even with business hours constraints
      expect(processingTime).toBeLessThan(60000) // 1 minute
      expect(successRate).toBeGreaterThan(0.95)
      expect(businessHoursCalls).toBeGreaterThan(0)

      console.log(`Business Hours Constraint Performance:`)
      console.log(`  Processing Time: ${processingTime}ms`)
      console.log(`  Business Hours Calls: ${businessHoursCalls}`)
      console.log(`  Success Rate: ${(successRate * 100).toFixed(2)}%`)
    }, 120000) // 2 minute timeout
  })

  describe('Scalability Testing', () => {
    it('should scale linearly with invoice volume', async () => {
      const volumes = [100, 250, 500]
      const timings: number[] = []

      for (const volume of volumes) {
        const { invoices, sequences } = await createPerformanceTestData(volume)

        const startTime = Date.now()

        const promises = invoices.map(invoice => {
          const sequence = sequences.find(s => s.companyId === invoice.companyId)
          return sequenceService.startSequenceExecution(
            sequence.id,
            invoice.id,
            { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
            { startImmediately: true }
          )
        })

        await Promise.all(promises)
        const endTime = Date.now()

        const processingTime = endTime - startTime
        timings.push(processingTime)

        await cleanupCurrentTestData()

        console.log(`Volume ${volume}: ${processingTime}ms`)
      }

      // Check that scaling is roughly linear (not exponential)
      const timePerInvoice100 = timings[0] / volumes[0]
      const timePerInvoice250 = timings[1] / volumes[1]
      const timePerInvoice500 = timings[2] / volumes[2]

      // Time per invoice should not increase dramatically
      expect(timePerInvoice250).toBeLessThan(timePerInvoice100 * 2)
      expect(timePerInvoice500).toBeLessThan(timePerInvoice100 * 3)

      console.log(`Scalability Metrics:`)
      console.log(`  100 invoices: ${timePerInvoice100.toFixed(2)}ms per invoice`)
      console.log(`  250 invoices: ${timePerInvoice250.toFixed(2)}ms per invoice`)
      console.log(`  500 invoices: ${timePerInvoice500.toFixed(2)}ms per invoice`)
    }, 300000) // 5 minute timeout

    it('should handle analytics calculation for large datasets efficiently', async () => {
      const { sequences } = await createPerformanceTestData(1000)

      // Create analytics data
      const sequence = sequences[0]
      const analyticsData: any[] = []

      for (let i = 0; i < 1000; i++) {
        analyticsData.push(
          prisma.followUpLog.create({
            data: {
              id: `stress-test-log-${i}-${Date.now()}`,
              invoiceId: testInvoices[i % testInvoices.length].id,
              sequenceId: sequence.id,
              stepNumber: (i % 3) + 1,
              emailAddress: `test${i}@example.com`,
              subject: `Test Subject ${i}`,
              content: `Test Content ${i}`,
              sentAt: new Date(Date.now() - i * 60 * 1000), // Spread over time
              awsMessageId: `aws-message-${i}`
            }
          })
        )
      }

      await Promise.all(analyticsData)

      const analyticsStart = Date.now()
      const analytics = await sequenceService.getSequenceAnalytics(sequence.id)
      const analyticsEnd = Date.now()

      const analyticsTime = analyticsEnd - analyticsStart

      expect(analyticsTime).toBeLessThan(5000) // Should complete within 5 seconds
      expect(analytics.totalExecutions).toBe(1000)
      expect(analytics.stepAnalytics).toHaveLength(3)

      console.log(`Analytics Performance: ${analyticsTime}ms for 1000 records`)
    }, 120000) // 2 minute timeout
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle partial failures gracefully in bulk operations', async () => {
      const { invoices, sequences } = await createPerformanceTestData(100)

      // Mock some failures
      let callCount = 0
      mockEmailService.scheduleEmail.mockImplementation(() => {
        callCount++
        if (callCount % 10 === 0) { // Fail every 10th call
          return Promise.reject(new Error('Simulated failure'))
        }
        return Promise.resolve(`email-${callCount}`)
      })

      const promises = invoices.map(invoice => {
        const sequence = sequences.find(s => s.companyId === invoice.companyId)
        return sequenceService.startSequenceExecution(
          sequence.id,
          invoice.id,
          { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
          { startImmediately: true }
        ).catch(error => ({ success: false, error: error.message }))
      })

      const results = await Promise.all(promises)

      const successCount = results.filter(r => r.success).length
      const failureCount = results.filter(r => !r.success).length

      // Should handle failures gracefully
      expect(successCount).toBeGreaterThan(80) // Most should succeed
      expect(failureCount).toBeLessThan(20) // Some failures expected

      console.log(`Resilience Test: ${successCount} succeeded, ${failureCount} failed`)
    })

    it('should recover from database connection issues', async () => {
      const { invoices, sequences } = await createPerformanceTestData(50)

      // Simulate database issues for some operations
      let queryCount = 0
      const originalFindUnique = prisma.invoice.findUnique
      jest.spyOn(prisma.invoice, 'findUnique').mockImplementation((args) => {
        queryCount++
        if (queryCount % 5 === 0) { // Fail every 5th query
          return Promise.reject(new Error('Database connection failed'))
        }
        return originalFindUnique.call(prisma.invoice, args)
      })

      const results = await Promise.allSettled(
        invoices.map(invoice => {
          const sequence = sequences.find(s => s.companyId === invoice.companyId)
          return sequenceService.startSequenceExecution(
            sequence.id,
            invoice.id,
            { type: 'DAYS_OVERDUE', value: 1, operator: 'GREATER_THAN' },
            { startImmediately: true }
          )
        })
      )

      const successCount = results.filter(r => r.status === 'fulfilled').length
      const failureCount = results.filter(r => r.status === 'rejected').length

      // Should handle database failures gracefully
      expect(successCount).toBeGreaterThan(30) // Most should succeed despite DB issues
      expect(failureCount).toBeGreaterThan(0) // Some failures expected

      console.log(`Database Resilience: ${successCount} succeeded, ${failureCount} failed`)

      // Restore original implementation
      jest.restoreAllMocks()
    })
  })
})