/**
 * Direct PDF Extraction Backend Test
 * Tests the PDF parser directly without needing authentication or UI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testPDFExtraction() {
  console.log('🧪 Testing PDF Extraction Backend\n');
  console.log('='.repeat(70));

  // Import the parser
  const { PDFInvoiceParser } = await import('../src/lib/services/pdf-invoice-parser.ts');

  const testPdfsDir = path.join(__dirname, '../test-pdfs');
  const pdfFiles = fs.readdirSync(testPdfsDir).filter(f => f.endsWith('.pdf'));

  console.log(`\n📂 Found ${pdfFiles.length} PDF files to test\n`);

  const results = [];

  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(testPdfsDir, pdfFile);
    const pdfBuffer = fs.readFileSync(pdfPath);

    console.log(`\n📄 Testing: ${pdfFile}`);
    console.log('-'.repeat(70));

    try {
      // Parse the PDF
      const extractedData = await PDFInvoiceParser.parseInvoicePDF(pdfBuffer);
      const validation = PDFInvoiceParser.validateExtractedData(extractedData);

      console.log('✅ Extraction completed!');
      console.log(`   📊 Confidence: ${extractedData.confidence}%`);
      console.log(`   📋 Invoice Number: ${extractedData.invoiceNumber || '❌ NOT FOUND'}`);
      console.log(`   👤 Customer Name: ${extractedData.customerName || '❌ NOT FOUND'}`);
      console.log(`   📧 Customer Email: ${extractedData.customerEmail || '❌ NOT FOUND'}`);
      console.log(`   💰 Total Amount: ${extractedData.totalAmount || extractedData.amount || '❌ NOT FOUND'}`);
      console.log(`   💵 Currency: ${extractedData.currency || 'AED (default)'}`);
      console.log(`   📅 Due Date: ${extractedData.dueDate || '❌ NOT FOUND'}`);
      console.log(`   📅 Invoice Date: ${extractedData.invoiceDate || '❌ NOT FOUND'}`);
      console.log(`   📝 VAT Amount: ${extractedData.vatAmount || '0.00'}`);
      console.log(`   🏢 TRN: ${extractedData.trn || 'N/A'}`);
      console.log(`   📄 Description: ${extractedData.description ? extractedData.description.substring(0, 50) + '...' : 'N/A'}`);

      console.log(`\n   🔍 Validation:`);
      console.log(`      - Valid: ${validation.isValid ? '✅ YES' : '❌ NO'}`);
      console.log(`      - Errors: ${validation.errors.length}`);
      console.log(`      - Warnings: ${validation.warnings.length}`);

      if (validation.errors.length > 0) {
        console.log(`      - Error details:`);
        validation.errors.forEach(err => console.log(`        • ${err}`));
      }

      if (validation.warnings.length > 0) {
        console.log(`      - Warning details:`);
        validation.warnings.forEach(warn => console.log(`        • ${warn}`));
      }

      results.push({
        file: pdfFile,
        success: true,
        confidence: extractedData.confidence,
        hasInvoiceNumber: !!extractedData.invoiceNumber,
        hasCustomerName: !!extractedData.customerName,
        hasCustomerEmail: !!extractedData.customerEmail,
        hasAmount: !!(extractedData.amount || extractedData.totalAmount),
        hasDueDate: !!extractedData.dueDate,
        isValid: validation.isValid,
        errors: validation.errors.length,
        warnings: validation.warnings.length,
        extractedData,
      });
    } catch (error) {
      console.log('❌ Extraction failed!');
      console.log(`   Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}`);

      results.push({
        file: pdfFile,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 EXTRACTION SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}/${results.length} (${(successful.length/results.length*100).toFixed(0)}%)`);
  console.log(`❌ Failed: ${failed.length}/${results.length} (${(failed.length/results.length*100).toFixed(0)}%)`);

  if (successful.length > 0) {
    const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
    const withInvoiceNum = successful.filter(r => r.hasInvoiceNumber).length;
    const withCustomerName = successful.filter(r => r.hasCustomerName).length;
    const withCustomerEmail = successful.filter(r => r.hasCustomerEmail).length;
    const withAmount = successful.filter(r => r.hasAmount).length;
    const withDueDate = successful.filter(r => r.hasDueDate).length;
    const valid = successful.filter(r => r.isValid).length;

    console.log(`\n📈 Field Extraction Statistics:`);
    console.log(`   Average Confidence: ${avgConfidence.toFixed(1)}%`);
    console.log(`   Invoice Number: ${withInvoiceNum}/${successful.length} (${(withInvoiceNum/successful.length*100).toFixed(0)}%)`);
    console.log(`   Customer Name: ${withCustomerName}/${successful.length} (${(withCustomerName/successful.length*100).toFixed(0)}%)`);
    console.log(`   Customer Email: ${withCustomerEmail}/${successful.length} (${(withCustomerEmail/successful.length*100).toFixed(0)}%)`);
    console.log(`   Amount: ${withAmount}/${successful.length} (${(withAmount/successful.length*100).toFixed(0)}%)`);
    console.log(`   Due Date: ${withDueDate}/${successful.length} (${(withDueDate/successful.length*100).toFixed(0)}%)`);
    console.log(`   Validation Passed: ${valid}/${successful.length} (${(valid/successful.length*100).toFixed(0)}%)`);
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed Files:`);
    failed.forEach(r => {
      console.log(`   • ${r.file}: ${r.error}`);
    });
  }

  // Detailed results for successful extractions
  if (successful.length > 0 && successful.length <= 3) {
    console.log(`\n📋 Detailed Extraction Results:`);
    successful.forEach(r => {
      console.log(`\n   ${r.file}:`);
      console.log(`   - Invoice #: ${r.extractedData.invoiceNumber || 'N/A'}`);
      console.log(`   - Customer: ${r.extractedData.customerName || 'N/A'}`);
      console.log(`   - Amount: ${r.extractedData.totalAmount || r.extractedData.amount || 'N/A'}`);
      console.log(`   - Due: ${r.extractedData.dueDate || 'N/A'}`);
    });
  }

  console.log('\n' + '='.repeat(70));

  // Overall result
  const passRate = (successful.length / results.length) * 100;
  if (passRate === 100) {
    console.log('✅ ALL TESTS PASSED!\n');
    return 0;
  } else if (passRate >= 70) {
    console.log(`⚠️  PARTIAL SUCCESS (${passRate.toFixed(0)}% pass rate)\n`);
    return 0;
  } else {
    console.log(`❌ MANY TESTS FAILED (${passRate.toFixed(0)}% pass rate)\n`);
    return 1;
  }
}

// Run the test
testPDFExtraction()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });
