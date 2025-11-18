#!/usr/bin/env node

/**
 * Comprehensive Test Runner for Follow-up Automation
 * Runs all test suites and generates detailed coverage reports
 */

const { spawn, exec } = require('child_process')
const fs = require('fs')
const path = require('path')

// Test configuration
const TEST_CONFIG = {
  timeout: 300000, // 5 minutes per test suite
  maxConcurrency: 4,
  coverageThreshold: {
    statements: 90,
    branches: 85,
    functions: 90,
    lines: 90
  }
}

// Test suites to run
const TEST_SUITES = [
  {
    name: 'Unit Tests - UAE Business Hours',
    command: 'npx jest src/lib/services/__tests__/uae-business-hours-service.test.ts',
    category: 'unit',
    priority: 1
  },
  {
    name: 'Unit Tests - Cultural Compliance',
    command: 'npx jest src/lib/services/__tests__/cultural-compliance-enhanced.test.ts',
    category: 'unit',
    priority: 1
  },
  {
    name: 'Unit Tests - Sequence Execution',
    command: 'npx jest src/lib/services/__tests__/sequence-execution-service.test.ts',
    category: 'unit',
    priority: 1
  },
  {
    name: 'Unit Tests - Islamic Calendar Compliance',
    command: 'npx jest src/lib/services/__tests__/uae-islamic-calendar-compliance.test.ts',
    category: 'unit',
    priority: 1
  },
  {
    name: 'Unit Tests - Bilingual Template Validation',
    command: 'npx jest src/lib/services/__tests__/bilingual-template-validation.test.ts',
    category: 'unit',
    priority: 1
  },
  {
    name: 'Integration Tests - Follow-up Automation',
    command: 'npx jest tests/integration/follow-up-automation-integration.test.ts',
    category: 'integration',
    priority: 2
  },
  {
    name: 'Performance Tests - Load Testing',
    command: 'npx jest tests/performance/follow-up-automation-load.test.ts --maxWorkers=1',
    category: 'performance',
    priority: 3
  },
  {
    name: 'E2E Tests - User Journeys',
    command: 'npx playwright test tests/e2e/follow-up-automation-e2e.test.ts',
    category: 'e2e',
    priority: 3
  }
]

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

class TestRunner {
  constructor() {
    this.results = []
    this.startTime = Date.now()
    this.coverageData = {}
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`)
  }

  logSection(title) {
    this.log('\\n' + '='.repeat(60), 'cyan')
    this.log(` ${title}`, 'bright')
    this.log('='.repeat(60), 'cyan')
  }

  async runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', command], {
        stdio: 'pipe',
        ...options
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        resolve({
          code,
          stdout,
          stderr,
          success: code === 0
        })
      })

      child.on('error', reject)

      // Set timeout
      setTimeout(() => {
        child.kill('SIGKILL')
        reject(new Error(`Command timed out: ${command}`))
      }, TEST_CONFIG.timeout)
    })
  }

  async runTestSuite(suite) {
    this.log(`\\n🧪 Running: ${suite.name}`, 'blue')
    this.log(`   Command: ${suite.command}`, 'cyan')

    const startTime = Date.now()

    try {
      const result = await this.runCommand(suite.command)
      const duration = Date.now() - startTime

      const testResult = {
        ...suite,
        success: result.success,
        duration,
        stdout: result.stdout,
        stderr: result.stderr,
        code: result.code
      }

      this.results.push(testResult)

      if (result.success) {
        this.log(`   ✅ PASSED (${duration}ms)`, 'green')
      } else {
        this.log(`   ❌ FAILED (${duration}ms)`, 'red')
        this.log(`   Error: ${result.stderr.substring(0, 200)}...`, 'red')
      }

      return testResult

    } catch (error) {
      const duration = Date.now() - startTime
      const testResult = {
        ...suite,
        success: false,
        duration,
        error: error.message,
        code: -1
      }

      this.results.push(testResult)
      this.log(`   💥 ERROR (${duration}ms): ${error.message}`, 'red')

      return testResult
    }
  }

  async runAllTests() {
    this.logSection('🚀 Starting Follow-up Automation Test Suite')

    // Sort by priority
    const sortedSuites = TEST_SUITES.sort((a, b) => a.priority - b.priority)

    // Run tests by category
    const categories = ['unit', 'integration', 'performance', 'e2e']

    for (const category of categories) {
      const categoryTests = sortedSuites.filter(suite => suite.category === category)
      if (categoryTests.length === 0) continue

      this.logSection(`📋 ${category.toUpperCase()} TESTS`)

      for (const suite of categoryTests) {
        await this.runTestSuite(suite)
      }
    }
  }

  async generateCoverageReport() {
    this.logSection('📊 Generating Coverage Report')

    try {
      // Run Jest with coverage for all unit and integration tests
      const coverageCommand = 'npx jest --coverage --coverageReporters=json-summary --coverageReporters=lcov --coverageReporters=text-summary --testPathPattern=\"(unit|integration)\"'

      this.log('Running coverage analysis...', 'yellow')
      const result = await this.runCommand(coverageCommand)

      if (result.success) {
        this.log('✅ Coverage report generated', 'green')

        // Parse coverage summary
        try {
          const coveragePath = path.join(process.cwd(), 'coverage', 'coverage-summary.json')
          if (fs.existsSync(coveragePath)) {
            const coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'))
            this.coverageData = coverageData.total
            this.displayCoverageResults()
          }
        } catch (error) {
          this.log(`⚠️  Could not parse coverage data: ${error.message}`, 'yellow')
        }
      } else {
        this.log('❌ Coverage generation failed', 'red')
        this.log(result.stderr, 'red')
      }

    } catch (error) {
      this.log(`💥 Coverage error: ${error.message}`, 'red')
    }
  }

  displayCoverageResults() {
    this.log('\\n📈 Coverage Results:', 'bright')

    const coverage = this.coverageData
    const threshold = TEST_CONFIG.coverageThreshold

    const metrics = [
      { name: 'Statements', value: coverage.statements, threshold: threshold.statements },
      { name: 'Branches', value: coverage.branches, threshold: threshold.branches },
      { name: 'Functions', value: coverage.functions, threshold: threshold.functions },
      { name: 'Lines', value: coverage.lines, threshold: threshold.lines }
    ]

    metrics.forEach(metric => {
      const pct = metric.value.pct
      const color = pct >= metric.threshold ? 'green' : 'red'
      const status = pct >= metric.threshold ? '✅' : '❌'

      this.log(`   ${status} ${metric.name}: ${pct}% (threshold: ${metric.threshold}%)`, color)
    })
  }

  async runPerformanceBenchmarks() {
    this.logSection('⚡ Performance Benchmarks')

    const benchmarks = [
      {
        name: 'UAE Business Hours Validation',
        command: 'node -e "const service = require(\'./dist/lib/services/uae-business-hours-service.js\'); const start = Date.now(); for(let i = 0; i < 10000; i++) { service.uaeBusinessHours.isBusinessHours(new Date()); } console.log(\'Time:\', Date.now() - start, \'ms\');"'
      },
      {
        name: 'Cultural Compliance Check',
        command: 'node -e "const service = require(\'./dist/lib/services/cultural-compliance-service.js\'); const start = Date.now(); for(let i = 0; i < 1000; i++) { service.CulturalComplianceService.calculateCulturalScore(\'Test content\'); } console.log(\'Time:\', Date.now() - start, \'ms\');"'
      }
    ]

    for (const benchmark of benchmarks) {
      this.log(`\\n🔬 ${benchmark.name}`, 'yellow')
      try {
        const result = await this.runCommand(benchmark.command)
        if (result.success) {
          this.log(`   ${result.stdout.trim()}`, 'green')
        } else {
          this.log(`   ⚠️  Benchmark skipped (build required)`, 'yellow')
        }
      } catch (error) {
        this.log(`   ⚠️  Benchmark failed: ${error.message}`, 'yellow')
      }
    }
  }

  generateTestReport() {
    this.logSection('📋 Test Results Summary')

    const totalTests = this.results.length
    const passedTests = this.results.filter(r => r.success).length
    const failedTests = totalTests - passedTests
    const totalDuration = Date.now() - this.startTime

    // Summary stats
    this.log('\\n📊 Test Statistics:', 'bright')
    this.log(`   Total Tests: ${totalTests}`)
    this.log(`   Passed: ${passedTests}`, passedTests > 0 ? 'green' : 'reset')
    this.log(`   Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'reset')
    this.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)
    this.log(`   Total Duration: ${(totalDuration / 1000).toFixed(1)}s`)

    // Category breakdown
    this.log('\\n📂 By Category:', 'bright')
    const categories = ['unit', 'integration', 'performance', 'e2e']
    categories.forEach(category => {
      const categoryTests = this.results.filter(r => r.category === category)
      const categoryPassed = categoryTests.filter(r => r.success).length

      if (categoryTests.length > 0) {
        this.log(`   ${category.toUpperCase()}: ${categoryPassed}/${categoryTests.length} passed`)
      }
    })

    // Failed tests details
    if (failedTests > 0) {
      this.log('\\n❌ Failed Tests:', 'red')
      this.results.filter(r => !r.success).forEach(result => {
        this.log(`   • ${result.name}`, 'red')
        if (result.error) {
          this.log(`     Error: ${result.error}`, 'red')
        }
      })
    }

    // Coverage summary
    if (this.coverageData && Object.keys(this.coverageData).length > 0) {
      const overallCoverage = this.coverageData.statements?.pct || 0
      const coverageStatus = overallCoverage >= TEST_CONFIG.coverageThreshold.statements ? '✅' : '❌'
      this.log(`\\n${coverageStatus} Overall Coverage: ${overallCoverage}%`,
        overallCoverage >= TEST_CONFIG.coverageThreshold.statements ? 'green' : 'red')
    }

    return {
      totalTests,
      passedTests,
      failedTests,
      successRate: (passedTests / totalTests) * 100,
      duration: totalDuration,
      coverage: this.coverageData
    }
  }

  async saveReportToFile() {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: this.generateTestReport(),
      results: this.results,
      coverage: this.coverageData,
      environment: {
        node: process.version,
        platform: process.platform,
        arch: process.arch
      }
    }

    const reportPath = path.join(process.cwd(), 'test-reports', `automation-tests-${Date.now()}.json`)
    const reportDir = path.dirname(reportPath)

    // Ensure directory exists
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2))
    this.log(`\\n💾 Report saved to: ${reportPath}`, 'cyan')

    return reportPath
  }
}

// Main execution
async function main() {
  const runner = new TestRunner()

  try {
    // Run all test suites
    await runner.runAllTests()

    // Generate coverage report
    await runner.generateCoverageReport()

    // Run performance benchmarks
    await runner.runPerformanceBenchmarks()

    // Generate final report
    const summary = runner.generateTestReport()

    // Save report to file
    await runner.saveReportToFile()

    // Final status
    runner.logSection('🎯 Test Execution Complete')

    if (summary.failedTests === 0 && summary.coverage?.statements?.pct >= TEST_CONFIG.coverageThreshold.statements) {
      runner.log('🎉 All tests passed with sufficient coverage!', 'green')
      process.exit(0)
    } else if (summary.failedTests === 0) {
      runner.log('⚠️  Tests passed but coverage is below threshold', 'yellow')
      process.exit(1)
    } else {
      runner.log('❌ Some tests failed', 'red')
      process.exit(1)
    }

  } catch (error) {
    runner.log(`💥 Test execution failed: ${error.message}`, 'red')
    process.exit(1)
  }
}

// Handle command line arguments
const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Follow-up Automation Test Runner

Usage: node scripts/run-automation-tests.js [options]

Options:
  --help, -h          Show this help message
  --unit              Run only unit tests
  --integration       Run only integration tests
  --performance       Run only performance tests
  --e2e               Run only e2e tests
  --coverage          Generate coverage report only
  --fast              Skip performance and e2e tests

Examples:
  node scripts/run-automation-tests.js --unit
  node scripts/run-automation-tests.js --coverage
  node scripts/run-automation-tests.js --fast
  `)
  process.exit(0)
}

// Filter tests based on arguments
if (args.includes('--unit')) {
  TEST_SUITES.splice(0, TEST_SUITES.length, ...TEST_SUITES.filter(s => s.category === 'unit'))
} else if (args.includes('--integration')) {
  TEST_SUITES.splice(0, TEST_SUITES.length, ...TEST_SUITES.filter(s => s.category === 'integration'))
} else if (args.includes('--performance')) {
  TEST_SUITES.splice(0, TEST_SUITES.length, ...TEST_SUITES.filter(s => s.category === 'performance'))
} else if (args.includes('--e2e')) {
  TEST_SUITES.splice(0, TEST_SUITES.length, ...TEST_SUITES.filter(s => s.category === 'e2e'))
} else if (args.includes('--fast')) {
  TEST_SUITES.splice(0, TEST_SUITES.length, ...TEST_SUITES.filter(s => ['unit', 'integration'].includes(s.category)))
}

if (args.includes('--coverage')) {
  // Only run coverage
  const runner = new TestRunner()
  runner.generateCoverageReport().then(() => process.exit(0))
} else {
  // Run main test suite
  main()
}