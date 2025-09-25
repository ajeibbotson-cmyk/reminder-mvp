#!/usr/bin/env node

/**
 * AWS Textract Connection Test Script
 *
 * This script validates your AWS credentials and Textract service configuration
 * Run this before testing PDF extraction to ensure everything is set up correctly
 */

require('dotenv').config({ path: '.env.local' });

async function testTextractConnection() {
  console.log('🧪 Testing AWS Textract Connection');
  console.log('=' .repeat(50));

  // Check environment variables
  console.log('\n📋 Environment Variables Check:');

  const requiredVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION'
  ];

  let missingVars = [];
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`  ✅ ${varName}: ${'*'.repeat(8)}${process.env[varName].slice(-4)}`);
    } else {
      console.log(`  ❌ ${varName}: Not set`);
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.log('\n🚨 Missing required environment variables:');
    missingVars.forEach(varName => {
      console.log(`   - ${varName}`);
    });
    console.log('\n📝 Please add these to your .env.local file and try again');
    process.exit(1);
  }

  // Test AWS SDK import
  console.log('\n📦 Testing AWS SDK Import:');
  try {
    const { TextractClient, AnalyzeExpenseCommand } = await import('@aws-sdk/client-textract');
    console.log('  ✅ AWS Textract SDK imported successfully');

    // Test client creation
    const client = new TextractClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    console.log(`  ✅ Textract client created for region: ${process.env.AWS_REGION}`);

    // Test service availability (dry run)
    console.log('\n🔍 Testing Service Availability:');
    console.log(`  🌍 Region: ${process.env.AWS_REGION}`);
    console.log('  📊 Available operations: AnalyzeExpense, AnalyzeDocument');
    console.log('  💰 Billing: Make sure your AWS account has billing enabled');

    // Create a minimal test document (1x1 pixel PNG as base64)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const testBuffer = Buffer.from(testImageBase64, 'base64');

    console.log('\n🧪 Testing Textract API Call:');
    try {
      const command = new AnalyzeExpenseCommand({
        Document: {
          Bytes: testBuffer,
        },
      });

      // This will likely fail with format error but confirms API access
      await client.send(command);
      console.log('  ✅ API call successful (unexpected - test image should fail)');
    } catch (error) {
      if (error.name === 'UnsupportedDocumentException' ||
          error.message.includes('unsupported document') ||
          error.message.includes('InvalidParameterException')) {
        console.log('  ✅ API access confirmed (expected format error for test image)');
        console.log('  📄 Ready to process real PDF documents');
      } else if (error.name === 'UnrecognizedClientException' ||
                 error.message.includes('security token')) {
        console.log('  ❌ Authentication failed - check your AWS credentials');
        console.log(`     Error: ${error.message}`);
        process.exit(1);
      } else if (error.message.includes('not authorized')) {
        console.log('  ❌ Permission denied - check your IAM policy');
        console.log('     Ensure your user has textract:AnalyzeExpense permission');
        process.exit(1);
      } else {
        console.log(`  ❌ Unexpected error: ${error.message}`);
        process.exit(1);
      }
    }

  } catch (importError) {
    console.log('  ❌ Failed to import AWS SDK');
    console.log('     Run: npm install @aws-sdk/client-textract');
    console.log(`     Error: ${importError.message}`);
    process.exit(1);
  }

  // Test fallback service
  console.log('\n🔄 Testing Fallback Service:');
  try {
    const pdfParse = await import('pdf-parse');
    console.log('  ✅ pdf-parse fallback available');
  } catch (error) {
    console.log('  ⚠️  pdf-parse fallback not available');
    console.log('     Run: npm install pdf-parse');
  }

  // Configuration summary
  console.log('\n📊 Configuration Summary:');
  console.log(`  🌍 AWS Region: ${process.env.AWS_REGION}`);
  console.log(`  💰 Cost Estimate: ~$0.05 per page processed`);
  console.log(`  📄 Supported Formats: PDF, PNG, JPG, TIFF`);
  console.log(`  📏 Max File Size: 10MB`);

  console.log('\n✅ AWS Textract setup validation complete!');
  console.log('\n🎯 Next Steps:');
  console.log('   1. Start your development server: npm run dev');
  console.log('   2. Navigate to the PDF import page');
  console.log('   3. Upload your "Above The Clouds" PDF');
  console.log('   4. Check the console logs for extraction results');
  console.log('   5. Verify extracted fields match expected values');

  console.log('\n📋 Expected Results for Above The Clouds Invoice:');
  console.log('   • Total Amount: 7978');
  console.log('   • Outstanding: 5368.60');
  console.log('   • Paid Amount: 2609.40');
  console.log('   • Invoice Date: 07/15/2025');
  console.log('   • Payment Terms: "within 30 days"');
  console.log('   • Currency: EUR');
}

// Handle script errors
process.on('unhandledRejection', (error) => {
  console.error('\n❌ Unhandled error:', error.message);
  process.exit(1);
});

// Run the test
testTextractConnection().catch(error => {
  console.error('\n❌ Test failed:', error.message);
  process.exit(1);
});