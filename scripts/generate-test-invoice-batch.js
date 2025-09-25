#!/usr/bin/env node

/**
 * Generate Test Invoice Batch for Stress Testing
 * Creates realistic test data for bulk import scenarios
 *
 * Usage:
 * node scripts/generate-test-invoice-batch.js --invoices 50 --companies 10
 */

const fs = require('fs');
const path = require('path');

// Test company data (UAE-focused)
const TEST_COMPANIES = [
  {
    name: "Above The Clouds",
    email: "finance@aboveclouds.ae",
    phone: "+971-4-555-0101",
    trn: "100123456789012",
    currency: "EUR"
  },
  {
    name: "Dubai Tech Solutions",
    email: "accounts@dubaitech.com",
    phone: "+971-4-555-0102",
    trn: "100234567890123",
    currency: "AED"
  },
  {
    name: "Emirates Marketing Group",
    email: "billing@emiratesmarketing.ae",
    phone: "+971-4-555-0103",
    trn: "100345678901234",
    currency: "AED"
  },
  {
    name: "Al Rashid Trading LLC",
    email: "finance@alrashidtrading.ae",
    phone: "+971-4-555-0104",
    trn: "100456789012345",
    currency: "AED"
  },
  {
    name: "Gulf Consultants",
    email: "accounts@gulfconsultants.com",
    phone: "+971-4-555-0105",
    trn: "100567890123456",
    currency: "USD"
  },
  {
    name: "Sharjah Industrial Corp",
    email: "finance@sharjahindustrial.ae",
    phone: "+971-6-555-0106",
    trn: "100678901234567",
    currency: "AED"
  },
  {
    name: "Abu Dhabi Services",
    email: "billing@abudhabiservices.ae",
    phone: "+971-2-555-0107",
    trn: "100789012345678",
    currency: "AED"
  },
  {
    name: "Middle East Logistics",
    email: "accounts@melogistics.com",
    phone: "+971-4-555-0108",
    trn: "100890123456789",
    currency: "USD"
  },
  {
    name: "Dubai Innovation Hub",
    email: "finance@dubaihub.ae",
    phone: "+971-4-555-0109",
    trn: "100901234567890",
    currency: "AED"
  },
  {
    name: "UAE Digital Partners",
    email: "billing@uaedigital.com",
    phone: "+971-4-555-0110",
    trn: "101012345678901",
    currency: "AED"
  }
];

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    invoices: 50,
    companies: 10,
    output: 'test-invoices-batch.json'
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key in options) {
      options[key] = key === 'output' ? value : parseInt(value);
    }
  }

  return options;
}

// Generate realistic invoice amounts
function generateInvoiceAmount(currency) {
  const baseCurrency = currency === 'AED' ? 3.67 : currency === 'EUR' ? 0.85 : 1; // USD base
  const amounts = [1500, 2300, 3200, 4100, 5500, 7800, 8900, 12000, 15000, 25000];
  const baseAmount = amounts[Math.floor(Math.random() * amounts.length)];
  return Math.round(baseAmount * baseCurrency * 100) / 100;
}

// Generate invoice number
function generateInvoiceNumber(companyIndex, invoiceIndex) {
  const prefixes = ['INV', 'V', 'REF', 'BIL', 'DOC'];
  const prefix = prefixes[companyIndex % prefixes.length];
  const year = new Date().getFullYear().toString().substr(-2);
  const sequence = String(invoiceIndex + 1).padStart(4, '0');
  return `${prefix}${year}${sequence}`;
}

// Generate realistic dates
function generateInvoiceDate(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Generate payment terms
function generatePaymentTerms() {
  const terms = [
    "Net 30 days",
    "within 30 days",
    "Due on receipt",
    "Net 45 days",
    "Payment terms: 30 days",
    "Due within 21 days"
  ];
  return terms[Math.floor(Math.random() * terms.length)];
}

// Generate invoice status based on age
function generateInvoiceStatus(daysOld) {
  if (daysOld < 30) return 'SENT';
  if (daysOld < 60) return 'OVERDUE';
  if (daysOld < 90) return 'OVERDUE';
  return Math.random() > 0.7 ? 'PAID' : 'OVERDUE'; // Some old ones might be paid
}

// Generate test invoice batch
function generateTestBatch(options) {
  const { invoices, companies } = options;
  const testData = [];

  console.log(`🧪 Generating ${invoices} test invoices from ${companies} companies`);

  // Ensure we don't exceed available companies
  const numCompanies = Math.min(companies, TEST_COMPANIES.length);
  const invoicesPerCompany = Math.floor(invoices / numCompanies);
  let invoiceIndex = 0;

  for (let companyIndex = 0; companyIndex < numCompanies; companyIndex++) {
    const company = TEST_COMPANIES[companyIndex];
    const companyInvoices = companyIndex === numCompanies - 1
      ? invoices - invoiceIndex  // Last company gets remaining invoices
      : invoicesPerCompany;

    console.log(`  📋 ${company.name}: generating ${companyInvoices} invoices`);

    for (let i = 0; i < companyInvoices; i++) {
      const daysAgo = Math.floor(Math.random() * 120); // 0-120 days ago
      const amount = generateInvoiceAmount(company.currency);

      // Calculate outstanding amounts (some invoices partially paid)
      const paidPercentage = Math.random();
      const paidAmount = paidPercentage < 0.3 ? 0 : // 30% unpaid
                        paidPercentage < 0.7 ? amount : // 40% fully paid
                        Math.round(amount * Math.random() * 100) / 100; // 30% partially paid

      const outstandingAmount = Math.round((amount - paidAmount) * 100) / 100;

      const invoice = {
        // Extracted data simulation
        extractedData: {
          customerName: {
            value: company.name,
            confidence: 95 + Math.floor(Math.random() * 5),
            source: "textract-pattern-match"
          },
          email: {
            value: company.email,
            confidence: 98,
            source: "email-pattern"
          },
          phone: {
            value: company.phone,
            confidence: 90 + Math.floor(Math.random() * 8),
            source: "phone-pattern"
          },
          trn: {
            value: company.trn,
            confidence: 100,
            source: "trn-pattern"
          },
          invoiceNumber: {
            value: generateInvoiceNumber(companyIndex, invoiceIndex),
            confidence: 99,
            source: "invoice-number-pattern"
          },
          amount: {
            value: amount.toString(),
            confidence: 92 + Math.floor(Math.random() * 6),
            source: "amount-extraction"
          },
          currency: {
            value: company.currency,
            confidence: 95,
            source: "currency-symbol"
          },
          invoiceDate: {
            value: generateInvoiceDate(daysAgo),
            confidence: 88 + Math.floor(Math.random() * 10),
            source: "date-pattern"
          },
          paymentTerms: {
            value: generatePaymentTerms(),
            confidence: 85 + Math.floor(Math.random() * 10),
            source: "terms-pattern"
          },
          outstandingAmount: outstandingAmount > 0 ? {
            value: outstandingAmount.toString(),
            confidence: 90 + Math.floor(Math.random() * 8),
            source: "outstanding-calculation"
          } : null,
          paidAmount: paidAmount > 0 ? {
            value: paidAmount.toString(),
            confidence: 93 + Math.floor(Math.random() * 5),
            source: "paid-amount-extraction"
          } : null
        },

        // Metadata
        metadata: {
          companyIndex,
          invoiceIndex: invoiceIndex,
          daysOld: daysAgo,
          generatedStatus: generateInvoiceStatus(daysOld),
          testScenario: daysOld > 90 ? 'CRITICAL_OVERDUE' :
                       daysOld > 60 ? 'HIGH_PRIORITY' :
                       daysOld > 30 ? 'OVERDUE' : 'CURRENT'
        }
      };

      testData.push(invoice);
      invoiceIndex++;
    }
  }

  return testData;
}

// Generate test scenarios
function generateTestScenarios(testData) {
  const scenarios = {
    totalInvoices: testData.length,
    totalCompanies: new Set(testData.map(inv => inv.extractedData.customerName.value)).size,

    // Age distribution
    ageDistribution: {
      current: testData.filter(inv => inv.metadata.daysOld <= 30).length,
      overdue: testData.filter(inv => inv.metadata.daysOld > 30 && inv.metadata.daysOld <= 60).length,
      highPriority: testData.filter(inv => inv.metadata.daysOld > 60 && inv.metadata.daysOld <= 90).length,
      critical: testData.filter(inv => inv.metadata.daysOld > 90).length
    },

    // Currency distribution
    currencyDistribution: testData.reduce((acc, inv) => {
      const currency = inv.extractedData.currency.value;
      acc[currency] = (acc[currency] || 0) + 1;
      return acc;
    }, {}),

    // Amount ranges
    amountRanges: {
      small: testData.filter(inv => parseFloat(inv.extractedData.amount.value) < 5000).length,
      medium: testData.filter(inv => {
        const amt = parseFloat(inv.extractedData.amount.value);
        return amt >= 5000 && amt < 15000;
      }).length,
      large: testData.filter(inv => parseFloat(inv.extractedData.amount.value) >= 15000).length
    },

    // Payment status
    paymentStatus: {
      unpaid: testData.filter(inv => !inv.extractedData.paidAmount).length,
      partiallyPaid: testData.filter(inv =>
        inv.extractedData.paidAmount && inv.extractedData.outstandingAmount
      ).length,
      fullyPaid: testData.filter(inv =>
        inv.extractedData.paidAmount && !inv.extractedData.outstandingAmount
      ).length
    }
  };

  return scenarios;
}

// Main execution
function main() {
  const options = parseArgs();
  console.log('⚙️ Test Generation Options:', options);
  console.log('=' .repeat(50));

  try {
    // Generate test data
    const testData = generateTestBatch(options);
    const scenarios = generateTestScenarios(testData);

    // Create output structure
    const output = {
      metadata: {
        generatedAt: new Date().toISOString(),
        options,
        scenarios
      },
      testData
    };

    // Write to file
    const outputPath = path.join(__dirname, '..', 'test-data', options.output);

    // Ensure directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

    console.log('\n✅ Test data generation complete!');
    console.log('📊 Test Scenarios Generated:');
    console.log(`   Total Invoices: ${scenarios.totalInvoices}`);
    console.log(`   Total Companies: ${scenarios.totalCompanies}`);
    console.log('   Age Distribution:');
    console.log(`     Current (≤30 days): ${scenarios.ageDistribution.current}`);
    console.log(`     Overdue (31-60 days): ${scenarios.ageDistribution.overdue}`);
    console.log(`     High Priority (61-90 days): ${scenarios.ageDistribution.highPriority}`);
    console.log(`     Critical (>90 days): ${scenarios.ageDistribution.critical}`);
    console.log('   Currency Distribution:', scenarios.currencyDistribution);
    console.log('   Payment Status:');
    console.log(`     Unpaid: ${scenarios.paymentStatus.unpaid}`);
    console.log(`     Partially Paid: ${scenarios.paymentStatus.partiallyPaid}`);
    console.log(`     Fully Paid: ${scenarios.paymentStatus.fullyPaid}`);
    console.log(`\n📁 Output: ${outputPath}`);

    console.log('\n🧪 Ready for stress testing with:');
    console.log(`   node scripts/load-test-data.js --file ${options.output}`);
    console.log('   npm run test:bulk-import');

  } catch (error) {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main();
}

module.exports = { generateTestBatch, generateTestScenarios };