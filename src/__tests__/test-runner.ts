/**
 * Comprehensive Test Suite Runner
 * Orchestrates all invoice management system tests with proper setup and reporting
 */

import { PrismaClient } from '@prisma/client'

// Test configuration
export const testConfig = {
  // Database setup
  database: {
    url: process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/uaepay_test',
    resetBetweenTests: true
  },
  
  // Test timeouts (milliseconds)
  timeouts: {
    integration: 30000,  // 30 seconds for integration tests
    e2e: 60000,         // 60 seconds for E2E tests
    component: 10000,    // 10 seconds for component tests
    unit: 5000          // 5 seconds for unit tests
  },
  
  // Coverage thresholds
  coverage: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90
  },
  
  // Test data cleanup
  cleanup: {
    enabled: true,
    retainOnFailure: true,
    cleanupTimeout: 5000
  },
  
  // Performance thresholds
  performance: {
    maxRenderTime: 2000,        // 2 seconds
    maxApiResponseTime: 1000,   // 1 second
    maxImportTime: 30000,       // 30 seconds for 1000 records
    maxMemoryUsage: 100 * 1024 * 1024  // 100MB
  }
}

// Test suite categories
export const testSuites = {
  unit: [
    'src/__tests__/utils/uae-test-data.test.ts',
    'src/lib/__tests__/**/*.test.ts',
    'src/lib/services/__tests__/**/*.test.ts'
  ],
  
  integration: [
    'src/__tests__/integration/import-functionality.test.ts',
    'src/__tests__/integration/payment-status-workflow.test.ts'
  ],
  
  component: [
    'src/__tests__/components/dashboard-comprehensive.test.tsx',
    'src/components/**/__tests__/**/*.test.tsx'
  ],
  
  e2e: [
    'src/__tests__/e2e/invoice-lifecycle-workflow.test.ts',
    'src/__tests__/e2e/**/*.test.ts'
  ]
}

// Test environment setup
export const setupTestEnvironment = async () => {
  // Environment variables for testing
  process.env.NODE_ENV = 'test'
  process.env.NEXTAUTH_SECRET = 'test-secret-key'
  process.env.NEXTAUTH_URL = 'http://localhost:3000'
  process.env.AWS_REGION = 'me-south-1'
  process.env.AWS_ACCESS_KEY_ID = 'test-key'
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
  
  // Mock external services
  process.env.MOCK_AWS_SES = 'true'
  process.env.MOCK_PAYMENT_GATEWAY = 'true'
  process.env.MOCK_EMAIL_SERVICE = 'true'
  
  // UAE-specific settings
  process.env.DEFAULT_TIMEZONE = 'Asia/Dubai'
  process.env.DEFAULT_CURRENCY = 'AED'
  process.env.VAT_RATE = '0.05'
  process.env.BUSINESS_HOURS_START = '08:00'
  process.env.BUSINESS_HOURS_END = '18:00'
  process.env.WORKING_DAYS = '1,2,3,4,5,6' // Sunday to Friday
  
  console.log('✅ Test environment configured')
}

// Database setup for tests
export const setupTestDatabase = async () => {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: testConfig.database.url
      }
    }
  })
  
  try {
    // Ensure test database exists and is clean
    await prisma.$connect()
    
    // Clear existing test data
    const tableNames = [
      'invoice_line_items',
      'payment_transactions',
      'invoice_status_history',
      'invoices',
      'customers',
      'import_batches',
      'companies'
    ]
    
    for (const tableName of tableNames) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE;`)
    }
    
    console.log('✅ Test database prepared')
    return prisma
  } catch (error) {
    console.error('❌ Test database setup failed:', error)
    throw error
  }
}

// Test reporting utilities
export const TestReporter = {
  startTime: 0,
  suiteResults: new Map<string, any>(),
  
  startSuite(suiteName: string) {
    this.startTime = Date.now()
    console.log(`\n🧪 Starting ${suiteName} tests...`)
  },
  
  endSuite(suiteName: string, results: any) {
    const duration = Date.now() - this.startTime
    this.suiteResults.set(suiteName, { ...results, duration })
    
    const status = results.success ? '✅' : '❌'
    console.log(`${status} ${suiteName} completed in ${duration}ms`)
    
    if (results.coverage) {
      console.log(`   Coverage: ${results.coverage.statements}% statements, ${results.coverage.lines}% lines`)
    }
    
    if (results.performance) {
      console.log(`   Performance: ${results.performance.avgResponseTime}ms avg response time`)
    }
  },
  
  generateReport() {
    console.log('\n📊 Test Suite Summary')
    console.log('='.repeat(50))
    
    let totalTests = 0
    let passedTests = 0
    let failedTests = 0
    let totalDuration = 0
    
    for (const [suiteName, results] of this.suiteResults) {
      totalTests += results.total || 0
      passedTests += results.passed || 0
      failedTests += results.failed || 0
      totalDuration += results.duration || 0
      
      const status = results.success ? '✅' : '❌'
      console.log(`${status} ${suiteName}: ${results.passed}/${results.total} tests passed`)
    }
    
    console.log('='.repeat(50))
    console.log(`📈 Overall: ${passedTests}/${totalTests} tests passed (${((passedTests/totalTests) * 100).toFixed(1)}%)`)
    console.log(`⏱️  Total duration: ${(totalDuration / 1000).toFixed(1)}s`)
    
    // Coverage summary
    const overallCoverage = this.calculateOverallCoverage()
    if (overallCoverage) {
      console.log(`📊 Coverage: ${overallCoverage.statements}% statements, ${overallCoverage.lines}% lines`)
      
      // Check if coverage meets thresholds
      const meetsCoverage = 
        overallCoverage.statements >= testConfig.coverage.statements &&
        overallCoverage.lines >= testConfig.coverage.lines
      
      if (!meetsCoverage) {
        console.log('⚠️  Coverage below thresholds!')
      }
    }
    
    return {
      totalTests,
      passedTests,
      failedTests,
      duration: totalDuration,
      success: failedTests === 0,
      coverage: overallCoverage
    }
  },
  
  calculateOverallCoverage() {
    const coverageData = Array.from(this.suiteResults.values())
      .map(result => result.coverage)
      .filter(Boolean)
    
    if (coverageData.length === 0) return null
    
    return {
      statements: Math.round(coverageData.reduce((sum, c) => sum + c.statements, 0) / coverageData.length),
      lines: Math.round(coverageData.reduce((sum, c) => sum + c.lines, 0) / coverageData.length),
      branches: Math.round(coverageData.reduce((sum, c) => sum + c.branches, 0) / coverageData.length),
      functions: Math.round(coverageData.reduce((sum, c) => sum + c.functions, 0) / coverageData.length)
    }
  }
}

// Performance monitoring
export const PerformanceMonitor = {
  measurements: new Map<string, number[]>(),
  
  measure<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const startTime = performance.now()
    
    return fn().then(
      (result) => {
        const duration = performance.now() - startTime
        this.recordMeasurement(label, duration)
        return result
      },
      (error) => {
        const duration = performance.now() - startTime
        this.recordMeasurement(label, duration)
        throw error
      }
    )
  },
  
  recordMeasurement(label: string, duration: number) {
    if (!this.measurements.has(label)) {
      this.measurements.set(label, [])
    }
    this.measurements.get(label)!.push(duration)
  },
  
  getStats(label: string) {
    const measurements = this.measurements.get(label) || []
    if (measurements.length === 0) return null
    
    const sum = measurements.reduce((a, b) => a + b, 0)
    const avg = sum / measurements.length
    const min = Math.min(...measurements)
    const max = Math.max(...measurements)
    
    return { avg, min, max, count: measurements.length }
  },
  
  checkThresholds() {
    const issues = []
    
    for (const [label, threshold] of Object.entries(testConfig.performance)) {
      const stats = this.getStats(label)
      if (stats && stats.avg > threshold) {
        issues.push(`${label}: ${stats.avg.toFixed(1)}ms (threshold: ${threshold}ms)`)
      }
    }
    
    return issues
  }
}

// Memory monitoring
export const MemoryMonitor = {
  baseline: 0,
  peak: 0,
  
  start() {
    if (global.gc) {
      global.gc()
    }
    this.baseline = process.memoryUsage().heapUsed
    this.peak = this.baseline
  },
  
  record() {
    const current = process.memoryUsage().heapUsed
    if (current > this.peak) {
      this.peak = current
    }
  },
  
  getStats() {
    return {
      baseline: this.baseline,
      peak: this.peak,
      increase: this.peak - this.baseline,
      current: process.memoryUsage().heapUsed
    }
  },
  
  checkThreshold() {
    const stats = this.getStats()
    return stats.increase > testConfig.performance.maxMemoryUsage
  }
}

// Test utilities
export const TestUtils = {
  // Generate test data
  createTestCompany: () => {
    const { generateUAECompany } = require('./utils/uae-test-data')
    return generateUAECompany()
  },
  
  createTestInvoices: (count: number, overrides?: any) => {
    const { generateInvoiceBatch } = require('./utils/uae-test-data')
    return generateInvoiceBatch(count, overrides)
  },
  
  // Wait for async operations
  waitFor: (condition: () => boolean, timeout = 5000) => {
    return new Promise<void>((resolve, reject) => {
      const startTime = Date.now()
      
      const check = () => {
        if (condition()) {
          resolve()
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Condition not met within ${timeout}ms`))
        } else {
          setTimeout(check, 100)
        }
      }
      
      check()
    })
  },
  
  // Mock external services
  mockExternalServices: () => {
    // AWS SES mock
    jest.mock('@aws-sdk/client-ses', () => ({
      SESClient: jest.fn(() => ({
        sendEmail: jest.fn().mockResolvedValue({
          MessageId: 'mock-message-id',
          ResponseMetadata: { HTTPStatusCode: 200 }
        })
      })),
      SendEmailCommand: jest.fn()
    }))
    
    // Payment gateway mock
    jest.mock('@/lib/services/payment-workflow-service', () => ({
      processPayment: jest.fn().mockResolvedValue({
        success: true,
        transactionId: 'mock-tx-id',
        status: 'completed'
      })
    }))
  },
  
  // Cleanup utilities
  cleanup: async (prisma: PrismaClient) => {
    if (!testConfig.cleanup.enabled) return
    
    try {
      // Delete test data in correct order
      await prisma.invoiceLineItem.deleteMany({})
      await prisma.paymentTransaction.deleteMany({})
      await prisma.invoiceStatusHistory.deleteMany({})
      await prisma.invoice.deleteMany({})
      await prisma.customer.deleteMany({})
      await prisma.importBatch.deleteMany({})
      await prisma.company.deleteMany({
        where: {
          name: {
            contains: 'Test'
          }
        }
      })
      
      console.log('🧹 Test data cleaned up')
    } catch (error) {
      console.error('❌ Cleanup failed:', error)
    }
  }
}

export default {
  testConfig,
  testSuites,
  setupTestEnvironment,
  setupTestDatabase,
  TestReporter,
  PerformanceMonitor,
  MemoryMonitor,
  TestUtils
}