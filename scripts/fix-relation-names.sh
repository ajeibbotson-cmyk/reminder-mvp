#!/bin/bash
# Fix relation names in include/select blocks for Prisma queries
# Targets incorrect plural/snake_case relation names

echo "🔧 Starting relation name fix..."

# Find all TypeScript files in src/app/api
FILES=$(find src/app/api -name "*.ts" -type f)

# Counter for changes
TOTAL_FILES=0
CHANGED_FILES=0

for file in $FILES; do
  TOTAL_FILES=$((TOTAL_FILES + 1))
  CHANGED=0

  # Create backup
  cp "$file" "$file.backup"

  # Fix relation names in include/select blocks
  # Pattern: Replace incorrect relation names with correct ones

  sed -i '' \
    -e 's/customers:/customer:/g' \
    -e 's/companies:/company:/g' \
    -e 's/invoice_items:/invoiceItems:/g' \
    -e 's/follow_up_logs:/followUpLogs:/g' \
    -e 's/import_batches:/importBatch:/g' \
    -e 's/email_logs:/emailLogs:/g' \
    -e 's/campaign_email_sends:/campaignEmailSends:/g' \
    -e 's/payment_methods:/paymentMethods:/g' \
    -e 's/follow_up_sequences:/followUpSequences:/g' \
    -e 's/bucket_configs:/bucketConfigs:/g' \
    -e 's/import_batch:/importBatch:/g' \
    "$file"

  # Check if file changed
  if ! diff -q "$file" "$file.backup" > /dev/null 2>&1; then
    CHANGED=1
    CHANGED_FILES=$((CHANGED_FILES + 1))
    echo "✅ Fixed: $file"
  fi

  # Remove backup
  rm "$file.backup"
done

echo ""
echo "📊 Summary:"
echo "   Total files scanned: $TOTAL_FILES"
echo "   Files changed: $CHANGED_FILES"
echo ""
echo "✅ Relation name fix complete!"
