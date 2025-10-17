/**
 * Test PDF Upload via Actual API Endpoint
 * This tests the real flow as it would work in the browser
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testAPIUpload() {
  console.log('🧪 Testing PDF Upload via API Endpoint\n');
  console.log('='.repeat(70));

  const testPdfsDir = path.join(__dirname, '../test-pdfs');
  const pdfFiles = fs.readdirSync(testPdfsDir).filter(f => f.endsWith('.pdf'));

  console.log(`\n📂 Testing ${pdfFiles.length} PDF files via API\n`);

  const results = [];

  // Test just the first 3 files for speed
  for (const pdfFile of pdfFiles.slice(0, 3)) {
    const pdfPath = path.join(testPdfsDir, pdfFile);

    console.log(`\n📄 Testing: ${pdfFile}`);
    console.log('-'.repeat(70));

    try {
      // Create form data
      const form = new FormData();
      form.append('file', fs.createReadStream(pdfPath), {
        filename: pdfFile,
        contentType: 'application/pdf'
      });

      // Make API request
      const response = await fetch('http://localhost:3000/api/invoices/upload-pdf', {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        const { extractedData, validation } = result.data;

        console.log('✅ API Upload successful!');
        console.log(`   📊 Confidence: ${extractedData.confidence}%`);
        console.log(`   📋 Invoice Number: ${extractedData.invoiceNumber || '❌ NOT FOUND'}`);
        console.log(`   👤 Customer Name: ${extractedData.customerName || '❌ NOT FOUND'}`);
        console.log(`   📧 Customer Email: ${extractedData.customerEmail || '❌ NOT FOUND'}`);
        console.log(`   💰 Total Amount: ${extractedData.totalAmount || extractedData.amount || '❌ NOT FOUND'}`);
        console.log(`   💵 Currency: ${extractedData.currency || 'AED'}`);
        console.log(`   📅 Due Date: ${extractedData.dueDate || '❌ NOT FOUND'}`);

        console.log(`\n   🔍 Validation:`);
        console.log(`      - Valid: ${validation.isValid ? '✅ YES' : '❌ NO'}`);
        console.log(`      - Missing: ${validation.missingFields?.join(', ') || 'None'}`);

        results.push({
          file: pdfFile,
          success: true,
          confidence: extractedData.confidence,
          hasInvoiceNumber: !!extractedData.invoiceNumber,
          hasCustomer: !!(extractedData.customerName || extractedData.customerEmail),
          hasAmount: !!(extractedData.amount || extractedData.totalAmount),
          isValid: validation.isValid,
          extractedData,
        });
      } else {
        console.log('❌ API Upload failed!');
        console.log(`   Status: ${response.status}`);
        console.log(`   Error: ${result.error || result.details || 'Unknown error'}`);

        results.push({
          file: pdfFile,
          success: false,
          error: result.error || result.details,
        });
      }
    } catch (error) {
      console.log('❌ Request failed!');
      console.log(`   Error: ${error.message}`);

      results.push({
        file: pdfFile,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log('\n\n' + '='.repeat(70));
  console.log('📊 API TEST SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);

  if (successful.length > 0) {
    const avgConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;

    console.log(`\n📈 Statistics:`);
    console.log(`   Average Confidence: ${avgConfidence.toFixed(1)}%`);

    console.log(`\n📋 Detailed Results:`);
    successful.forEach(r => {
      console.log(`\n   ${r.file}:`);
      console.log(`   - Invoice #: ${r.extractedData.invoiceNumber || 'N/A'}`);
      console.log(`   - Customer: ${r.extractedData.customerName || 'N/A'}`);
      console.log(`   - Email: ${r.extractedData.customerEmail || 'N/A'}`);
      console.log(`   - Amount: ${r.extractedData.totalAmount || r.extractedData.amount || 'N/A'}`);
      console.log(`   - Due: ${r.extractedData.dueDate || 'N/A'}`);
    });
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed Files:`);
    failed.forEach(r => {
      console.log(`   - ${r.file}: ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(70));

  if (successful.length === results.length) {
    console.log('✅ ALL API TESTS PASSED!\n');
  } else {
    console.log(`⚠️  ${successful.length}/${results.length} API tests passed\n`);
  }
}

testAPIUpload().catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
