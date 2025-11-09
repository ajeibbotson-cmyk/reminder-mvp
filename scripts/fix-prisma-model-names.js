#!/usr/bin/env node
/**
 * Fix Prisma Model Name References
 *
 * Updates all API routes to use new singular PascalCase Prisma model names
 * after camelCase migration with @map directives.
 *
 * Changes:
 * - prisma.customers → prisma.customer
 * - prisma.invoices → prisma.invoice
 * - prisma.payments → prisma.payment
 * - etc. for all models
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Model name mappings (plural snake_case → singular PascalCase)
const MODEL_MAPPINGS = {
  'customers': 'customer',
  'invoices': 'invoice',
  'payments': 'payment',
  'activities': 'activity',
  'companies': 'company',
  'users': 'user',
  'emailLogs': 'emailLog',
  'followUpLogs': 'followUpLog',
  'followUpSequences': 'followUpSequence',
  'invoiceCampaigns': 'invoiceCampaign',
  'bucketConfigs': 'bucketConfig',
  'importBatches': 'importBatch',
  'importErrors': 'importError',
  'importFieldMappings': 'importFieldMapping',
  'abTestConfigs': 'abTestConfig',
  'abTestAssignments': 'abTestAssignment',
  'abTestEvents': 'abTestEvent',
  'emailTemplates': 'emailTemplate',
  'emailBounceTracking': 'emailBounceTracking',
  'emailEventTracking': 'emailEventTracking',
  'emailSuppressionList': 'emailSuppressionList',
  'campaignEmailSends': 'campaignEmailSend',
  'customerConsolidatedReminders': 'customerConsolidatedReminder',
  'accounts': 'account',
  'sessions': 'session',
  'verificationTokens': 'verificationToken',
  'auditLogs': 'auditLog',
  'bankReconciliations': 'bankReconciliation',
  'invoiceItems': 'invoiceItem',
  'dataRetentionPolicies': 'dataRetentionPolicy',
  'dbPerformanceLogs': 'dbPerformanceLog'
};

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Replace prisma.model and tx.model references
    for (const [oldName, newName] of Object.entries(MODEL_MAPPINGS)) {
      // Pattern 1: prisma.oldName
      const prismaRegex = new RegExp(`prisma\\.${oldName}\\b`, 'g');
      if (prismaRegex.test(content)) {
        content = content.replace(prismaRegex, `prisma.${newName}`);
        modified = true;
      }

      // Pattern 2: tx.oldName (transaction context)
      const txRegex = new RegExp(`tx\\.${oldName}\\b`, 'g');
      if (txRegex.test(content)) {
        content = content.replace(txRegex, `tx.${newName}`);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

function findApiFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          traverse(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

async function main() {
  console.log('🔧 Prisma Model Name Fix Script');
  console.log('================================\n');

  const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');
  console.log(`📂 Scanning directory: ${apiDir}\n`);

  const files = findApiFiles(apiDir);
  console.log(`📄 Found ${files.length} TypeScript files\n`);

  let fixedCount = 0;

  for (const file of files) {
    if (fixFile(file)) {
      fixedCount++;
    }
  }

  console.log(`\n✨ Summary:`);
  console.log(`   Total files scanned: ${files.length}`);
  console.log(`   Files modified: ${fixedCount}`);
  console.log(`   Files unchanged: ${files.length - fixedCount}`);

  if (fixedCount > 0) {
    console.log('\n🔄 Model name updates complete!');
    console.log('⚠️  Next steps:');
    console.log('   1. Review changes with: git diff');
    console.log('   2. Test endpoints manually or with automated tests');
    console.log('   3. Regenerate Prisma client if needed: npx prisma generate');
  } else {
    console.log('\n✅ No changes needed - all files already use correct model names');
  }
}

main().catch(console.error);
