#!/bin/bash
# Fix snake_case field names in select statements
# Targets field names that weren't caught by previous scripts

echo "🔧 Starting select field fix..."

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

  # Fix snake_case field names in select/include blocks
  sed -i '' \
    -e 's/name_ar:/nameAr:/g' \
    -e 's/description_ar:/descriptionAr:/g' \
    -e 's/notes_ar:/notesAr:/g' \
    -e 's/address_ar:/addressAr:/g' \
    -e 's/business_name:/businessName:/g' \
    -e 's/business_name_ar:/businessNameAr:/g' \
    -e 's/business_type:/businessType:/g' \
    -e 's/contact_person:/contactPerson:/g' \
    -e 's/contact_person_ar:/contactPersonAr:/g' \
    -e 's/credit_limit:/creditLimit:/g' \
    -e 's/customer_since:/customerSince:/g' \
    -e 's/is_active:/isActive:/g' \
    -e 's/last_interaction:/lastInteraction:/g' \
    -e 's/last_payment_date:/lastPaymentDate:/g' \
    -e 's/lifetime_value:/lifetimeValue:/g' \
    -e 's/outstanding_balance:/outstandingBalance:/g' \
    -e 's/payment_behavior:/paymentBehavior:/g' \
    -e 's/payment_method_pref:/paymentMethodPref:/g' \
    -e 's/preferred_language:/preferredLanguage:/g' \
    -e 's/risk_score:/riskScore:/g' \
    -e 's/consolidation_preference:/consolidationPreference:/g' \
    -e 's/max_consolidation_amount:/maxConsolidationAmount:/g' \
    -e 's/preferred_contact_interval:/preferredContactInterval:/g' \
    -e 's/communication_pref:/communicationPref:/g' \
    -e 's/unit_price:/unitPrice:/g' \
    -e 's/vat_rate:/vatRate:/g' \
    -e 's/vat_amount:/vatAmount:/g' \
    -e 's/total_with_vat:/totalWithVat:/g' \
    -e 's/tax_category:/taxCategory:/g' \
    -e 's/default_vat_rate:/defaultVatRate:/g' \
    -e 's/business_hours:/businessHours:/g' \
    -e 's/email_settings:/emailSettings:/g' \
    -e 's/archived_at:/archivedAt:/g' \
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
echo "✅ Select field fix complete!"
