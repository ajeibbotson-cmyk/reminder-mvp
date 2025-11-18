#!/bin/bash
# Bulk camelCase fix script for API routes
# Fixes snake_case field names to camelCase

echo "🔧 Starting bulk camelCase fix..."

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

  # Fix common snake_case patterns in orderBy, where, select, include
  # Pattern: orderBy/where/select with snake_case fields

  sed -i '' \
    -e 's/created_at:/createdAt:/g' \
    -e 's/updated_at:/updatedAt:/g' \
    -e 's/company_id:/companyId:/g' \
    -e 's/user_id:/userId:/g' \
    -e 's/customer_id:/customerId:/g' \
    -e 's/invoice_id:/invoiceId:/g' \
    -e 's/payment_id:/paymentId:/g' \
    -e 's/batch_id:/batchId:/g' \
    -e 's/import_batch_id:/importBatchId:/g' \
    -e 's/campaign_id:/campaignId:/g' \
    -e 's/template_id:/templateId:/g' \
    -e 's/sequence_id:/sequenceId:/g' \
    -e 's/step_number:/stepNumber:/g' \
    -e 's/email_address:/emailAddress:/g' \
    -e 's/sent_at:/sentAt:/g' \
    -e 's/delivered_at:/deliveredAt:/g' \
    -e 's/opened_at:/openedAt:/g' \
    -e 's/bounced_at:/bouncedAt:/g' \
    -e 's/email_opened:/emailOpened:/g' \
    -e 's/email_clicked:/emailClicked:/g' \
    -e 's/response_received:/responseReceived:/g' \
    -e 's/delivery_status:/deliveryStatus:/g' \
    -e 's/payment_date:/paymentDate:/g' \
    -e 's/due_date:/dueDate:/g' \
    -e 's/payment_terms:/paymentTerms:/g' \
    -e 's/customer_name:/customerName:/g' \
    -e 's/customer_email:/customerEmail:/g' \
    -e 's/original_filename:/originalFilename:/g' \
    -e 's/reset_token:/resetToken:/g' \
    -e 's/reset_token_expiry:/resetTokenExpiry:/g' \
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
echo "✅ Bulk camelCase fix complete!"
