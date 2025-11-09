#!/bin/bash
# Fix remaining snake_case and mixed-case field names
# Targets patterns like default_vatRate → defaultVatRate

echo "🔧 Starting final field name fix..."

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

  # Fix remaining snake_case and mixed-case patterns
  sed -i '' \
    -e 's/default_vatRate/defaultVatRate/g' \
    -e 's/total_amount/totalAmount/g' \
    -e 's/paid_amount/paidAmount/g' \
    -e 's/remaining_amount/remainingAmount/g' \
    -e 's/subtotal_amount/subtotalAmount/g' \
    -e 's/vat_total/vatTotal/g' \
    -e 's/grand_total/grandTotal/g' \
    -e 's/original_amount/originalAmount/g' \
    -e 's/discount_amount/discountAmount/g' \
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
echo "✅ Final field fix complete!"
