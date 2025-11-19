#!/usr/bin/env node

/**
 * Fix snake_case Prisma model names to camelCase
 *
 * Maps database table names to Prisma model names:
 * - email_logs → emailLog
 * - follow_up_sequences → followUpSequence
 * - follow_up_logs → followUpLog
 * - bucket_configs → bucketConfig
 * etc.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Mapping of snake_case table names to camelCase Prisma model names
const modelMapping = {
  'email_logs': 'emailLog',
  'follow_up_sequences': 'followUpSequence',
  'follow_up_logs': 'followUpLog',
  'bucket_configs': 'bucketConfig',
  'email_templates': 'emailTemplate',
  'ab_test_assignments': 'abTestAssignment',
  'ab_test_config': 'abTestConfig',
  'ab_test_events': 'abTestEvent',
  'audit_logs': 'auditLog',
  'bank_reconciliations': 'bankReconciliation',
  'campaign_email_sends': 'campaignEmailSend',
  'customer_consolidated_reminders': 'customerConsolidatedReminder',
  'data_retention_policies': 'dataRetentionPolicy',
  'db_performance_logs': 'dbPerformanceLog',
  'email_bounce_tracking': 'emailBounceTracking',
  'email_suppression_list': 'emailSuppressionList',
  'import_batches': 'importBatch',
  'import_errors': 'importError',
  'import_field_mappings': 'importFieldMapping',
  'invoice_campaigns': 'invoiceCampaign',
  'invoice_items': 'invoiceItem',
};

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [snakeCase, camelCase] of Object.entries(modelMapping)) {
    const pattern = new RegExp(`prisma\\.${snakeCase}`, 'g');
    if (pattern.test(content)) {
      console.log(`  ${filePath}: ${snakeCase} → ${camelCase}`);
      content = content.replace(pattern, `prisma.${camelCase}`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

// Find all TypeScript files in src/app/api
const files = glob.sync('src/app/api/**/*.ts', {
  cwd: path.resolve(__dirname, '..'),
  absolute: true
});

console.log(`Scanning ${files.length} API route files...\n`);

let filesModified = 0;
for (const file of files) {
  if (fixFile(file)) {
    filesModified++;
  }
}

console.log(`\n✅ Fixed ${filesModified} files`);
