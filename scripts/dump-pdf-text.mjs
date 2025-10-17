/**
 * Dump raw extracted text from PDFs to understand format
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function dumpPDFText() {
  console.log('📄 Dumping PDF Text for Analysis\n');
  console.log('='.repeat(70));

  const { PDFInvoiceParser } = await import('../src/lib/services/pdf-invoice-parser.ts');

  const testPdfsDir = path.join(__dirname, '../test-pdfs');

  // Just test first PDF to see the format
  const testFile = 'Above The Clouds AW25 Drop-1.pdf';
  const pdfPath = path.join(testPdfsDir, testFile);
  const pdfBuffer = fs.readFileSync(pdfPath);

  console.log(`\n📄 File: ${testFile}`);
  console.log('-'.repeat(70));

  try {
    const extractedData = await PDFInvoiceParser.parseInvoicePDF(pdfBuffer);

    console.log('\n📋 EXTRACTED DATA:');
    console.log(JSON.stringify(extractedData, null, 2));

    console.log('\n\n📝 RAW TEXT (first 2000 characters):');
    console.log('='.repeat(70));
    console.log(extractedData.rawText.substring(0, 2000));
    console.log('='.repeat(70));

    console.log('\n\n🔍 LOOKING FOR PATTERNS:');
    console.log('-'.repeat(70));

    // Look for invoice-like patterns
    const lines = extractedData.rawText.split('\n').slice(0, 50);
    console.log('\nFirst 50 lines:');
    lines.forEach((line, i) => {
      if (line.trim()) {
        console.log(`${String(i).padStart(3)}: ${line}`);
      }
    });

  } catch (error) {
    console.log('❌ Error:', error.message);
  }
}

dumpPDFText().catch(error => {
  console.error('Failed:', error);
  process.exit(1);
});
