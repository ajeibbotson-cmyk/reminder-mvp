#!/usr/bin/env node

/**
 * Integration Test Runner for Phase 4 Sprint 1.5
 * 
 * Runs all integration tests in the correct order:
 * 1. UAE Compliance Validation
 * 2. Invoice Workflow Integration  
 * 3. Error Handling & Edge Cases
 * 4. Performance Validation
 * 5. Sprint 1.5 Acceptance Criteria
 */

const { spawn } = require('child_process');
const path = require('path');

const testSuites = [
  {
    name: 'UAE Compliance Validation',
    file: 'tests/integration/uae-compliance-validation.test.ts',
    description: 'Validates UAE business rules and compliance requirements'
  },
  {
    name: 'Invoice Workflow Integration',
    file: 'tests/integration/invoice-workflow-integration.test.ts',
    description: 'Tests complete invoice lifecycle workflows'
  },
  {
    name: 'Error Handling & Edge Cases',
    file: 'tests/integration/error-handling-edge-cases.test.ts',
    description: 'Validates error scenarios and edge case handling'
  },
  {
    name: 'Performance Validation',
    file: 'tests/integration/performance-validation.test.ts',
    description: 'Tests system performance under realistic loads'
  },
  {
    name: 'Sprint 1.5 Acceptance Criteria',
    file: 'tests/integration/sprint-1.5-acceptance-criteria.test.ts',
    description: 'Validates all Sprint 1.5 acceptance criteria'
  }
];

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runTest(testSuite) {
  return new Promise((resolve, reject) => {
    log(`\n${colors.blue}${colors.bright}🧪 Running: ${testSuite.name}${colors.reset}`);
    log(`${colors.cyan}📝 ${testSuite.description}${colors.reset}`);
    log(`${colors.yellow}📁 ${testSuite.file}${colors.reset}\n`);

    const jest = spawn('npx', ['jest', testSuite.file, '--verbose'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    jest.on('close', (code) => {
      if (code === 0) {
        log(`${colors.green}✅ ${testSuite.name} - PASSED${colors.reset}`);
        resolve({ name: testSuite.name, status: 'PASSED' });
      } else {
        log(`${colors.red}❌ ${testSuite.name} - FAILED${colors.reset}`);
        resolve({ name: testSuite.name, status: 'FAILED', code });
      }
    });

    jest.on('error', (error) => {
      log(`${colors.red}💥 Error running ${testSuite.name}: ${error.message}${colors.reset}`);
      reject(error);
    });
  });
}

async function runAllTests() {
  log(`${colors.magenta}${colors.bright}🚀 Phase 4 Sprint 1.5 Integration Test Suite${colors.reset}`);
  log(`${colors.cyan}📊 Running ${testSuites.length} test suites...${colors.reset}\n`);

  const startTime = Date.now();
  const results = [];

  // Run tests sequentially to avoid database conflicts
  for (const testSuite of testSuites) {
    try {
      const result = await runTest(testSuite);
      results.push(result);
      
      // Small delay between tests to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      results.push({ name: testSuite.name, status: 'ERROR', error: error.message });
    }
  }

  const endTime = Date.now();
  const duration = Math.round((endTime - startTime) / 1000);

  // Print summary
  log(`\n${colors.bright}${colors.magenta}📋 INTEGRATION TEST SUMMARY${colors.reset}`);
  log(`${colors.cyan}⏱️  Total Duration: ${duration} seconds${colors.reset}\n`);

  const passed = results.filter(r => r.status === 'PASSED').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const errored = results.filter(r => r.status === 'ERROR').length;

  results.forEach(result => {
    const statusColor = result.status === 'PASSED' ? colors.green : 
                       result.status === 'FAILED' ? colors.red : colors.yellow;
    log(`${statusColor}${result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⚠️ '} ${result.name}: ${result.status}${colors.reset}`);
  });

  log(`\n${colors.bright}Final Results:${colors.reset}`);
  log(`${colors.green}✅ Passed: ${passed}${colors.reset}`);
  log(`${colors.red}❌ Failed: ${failed}${colors.reset}`);
  log(`${colors.yellow}⚠️  Errors: ${errored}${colors.reset}`);

  if (failed === 0 && errored === 0) {
    log(`\n${colors.green}${colors.bright}🎉 ALL INTEGRATION TESTS PASSED!${colors.reset}`);
    log(`${colors.cyan}✅ Sprint 1.5 Phase 4 Integration Testing: COMPLETE${colors.reset}`);
    log(`${colors.cyan}🚀 System Status: PRODUCTION READY${colors.reset}\n`);
  } else {
    log(`\n${colors.red}${colors.bright}❌ SOME TESTS FAILED${colors.reset}`);
    log(`${colors.yellow}Please review failed tests before proceeding to production.${colors.reset}\n`);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  log(`${colors.cyan}Phase 4 Sprint 1.5 Integration Test Runner${colors.reset}\n`);
  log('Usage: npm run test:integration [options]\n');
  log('Options:');
  log('  --help, -h     Show this help message');
  log('  --list, -l     List available test suites');
  log('  --suite, -s    Run specific test suite by name');
  log('\nExamples:');
  log('  npm run test:integration');
  log('  npm run test:integration -- --list');
  log('  npm run test:integration -- --suite "UAE Compliance"');
  process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
  log(`${colors.cyan}Available Test Suites:${colors.reset}\n`);
  testSuites.forEach((suite, index) => {
    log(`${colors.yellow}${index + 1}. ${suite.name}${colors.reset}`);
    log(`   ${colors.cyan}${suite.description}${colors.reset}`);
    log(`   ${colors.blue}${suite.file}${colors.reset}\n`);
  });
  process.exit(0);
}

const suiteArgIndex = args.findIndex(arg => arg === '--suite' || arg === '-s');
if (suiteArgIndex !== -1 && args[suiteArgIndex + 1]) {
  const suiteName = args[suiteArgIndex + 1];
  const suite = testSuites.find(s => s.name.toLowerCase().includes(suiteName.toLowerCase()));
  
  if (suite) {
    runTest(suite).then(() => {
      log(`\n${colors.green}✅ Single test suite completed.${colors.reset}`);
    }).catch(error => {
      log(`${colors.red}❌ Test suite failed: ${error.message}${colors.reset}`);
      process.exit(1);
    });
  } else {
    log(`${colors.red}❌ Test suite "${suiteName}" not found.${colors.reset}`);
    log(`${colors.cyan}Use --list to see available test suites.${colors.reset}`);
    process.exit(1);
  }
} else {
  // Run all tests
  runAllTests().catch(error => {
    log(`${colors.red}💥 Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}