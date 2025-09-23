#!/usr/bin/env node

/**
 * Critical Flow Test Runner
 * Runs only the essential tests for the main application flows
 * Bypasses the broken legacy test infrastructure
 */

const { spawn } = require('child_process')
const path = require('path')

console.log('🧪 Running Critical Flow Tests...\n')

// Test configurations
const testConfigs = [
  {
    name: 'PDF Upload Integration Tests',
    command: 'npx',
    args: ['jest', 'tests/critical-flows/pdf-upload-integration.test.ts', '--verbose'],
    description: 'Tests PDF upload and parsing functionality'
  },
  {
    name: 'Prisma Field Validation Tests',
    command: 'npx',
    args: ['jest', 'tests/critical-flows/prisma-field-validation.test.ts', '--verbose'],
    description: 'Tests database field mapping correctness'
  },
  {
    name: 'End-to-End Invoice Upload Tests',
    command: 'npx',
    args: ['playwright', 'test', 'tests/critical-flows/invoice-upload-e2e.spec.ts'],
    description: 'Tests complete user workflow in browser'
  }
]

async function runTest(config) {
  console.log(`📋 ${config.name}`)
  console.log(`   ${config.description}`)
  console.log(`   Command: ${config.command} ${config.args.join(' ')}\n`)

  return new Promise((resolve) => {
    const process = spawn(config.command, config.args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.resolve(__dirname, '..')
    })

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${config.name} - PASSED\n`)
      } else {
        console.log(`❌ ${config.name} - FAILED (exit code: ${code})\n`)
      }
      resolve({ name: config.name, passed: code === 0 })
    })

    process.on('error', (error) => {
      console.log(`💥 ${config.name} - ERROR: ${error.message}\n`)
      resolve({ name: config.name, passed: false, error: error.message })
    })
  })
}

async function runAllTests() {
  const results = []

  for (const config of testConfigs) {
    const result = await runTest(config)
    results.push(result)
  }

  // Summary
  console.log('📊 Test Summary:')
  console.log('================')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  results.forEach(result => {
    const status = result.passed ? '✅' : '❌'
    const error = result.error ? ` (${result.error})` : ''
    console.log(`${status} ${result.name}${error}`)
  })

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

  if (failed > 0) {
    console.log('\n⚠️  Some critical tests failed. Check the output above for details.')
    process.exit(1)
  } else {
    console.log('\n🎉 All critical flow tests passed!')
    process.exit(0)
  }
}

// Handle command line arguments
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Critical Flow Test Runner')
  console.log('========================')
  console.log('')
  console.log('Usage: node scripts/test-critical-flows.js [options]')
  console.log('')
  console.log('Options:')
  console.log('  --help, -h     Show this help message')
  console.log('  --unit         Run only unit/integration tests')
  console.log('  --e2e          Run only end-to-end tests')
  console.log('')
  console.log('Available tests:')
  testConfigs.forEach((config, index) => {
    console.log(`  ${index + 1}. ${config.name}`)
    console.log(`     ${config.description}`)
  })
  process.exit(0)
}

if (args.includes('--unit')) {
  console.log('Running unit/integration tests only...\n')
  runAllTests = async () => {
    const unitConfigs = testConfigs.slice(0, 2) // First two are unit/integration
    const results = []

    for (const config of unitConfigs) {
      const result = await runTest(config)
      results.push(result)
    }

    const passed = results.filter(r => r.passed).length
    const failed = results.filter(r => !r.passed).length

    console.log(`\nUnit/Integration Tests: ${results.length} | Passed: ${passed} | Failed: ${failed}`)

    if (failed > 0) {
      process.exit(1)
    } else {
      console.log('✅ Unit/integration tests passed!')
      process.exit(0)
    }
  }
}

if (args.includes('--e2e')) {
  console.log('Running end-to-end tests only...\n')
  runAllTests = async () => {
    const e2eConfig = testConfigs[2] // Last one is E2E
    const result = await runTest(e2eConfig)

    if (result.passed) {
      console.log('✅ End-to-end tests passed!')
      process.exit(0)
    } else {
      console.log('❌ End-to-end tests failed!')
      process.exit(1)
    }
  }
}

// Run the tests
runAllTests().catch((error) => {
  console.error('💥 Test runner failed:', error)
  process.exit(1)
})