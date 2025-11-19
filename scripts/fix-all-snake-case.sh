#!/bin/bash

# Fix all snake_case to camelCase in API routes
# This includes both Prisma model names and field names

echo "Fixing snake_case field references in API routes..."

# Common field name mappings
declare -A field_mappings=(
  # Dates
  ["created_at"]="createdAt"
  ["updated_at"]="updatedAt"
  ["due_date"]="dueDate"
  ["paid_date"]="paidDate"
  ["sent_at"]="sentAt"
  ["opened_at"]="openedAt"
  ["payment_date"]="paymentDate"
  ["start_date"]="startDate"
  ["end_date"]="endDate"

  # Customer fields
  ["customer_email"]="customerEmail"
  ["customer_name"]="customerName"
  ["name_ar"]="nameAr"
  ["payment_terms"]="paymentTerms"

  # Invoice fields
  ["invoice_number"]="number"
  ["total_amount"]="totalAmount"
  ["trn_number"]="trnNumber"
  ["vat_amount"]="vatAmount"
  ["subtotal_amount"]="subtotalAmount"
  ["discount_amount"]="discountAmount"
  ["description_ar"]="descriptionAr"
  ["notes_ar"]="notesAr"

  # Email fields
  ["email_address"]="emailAddress"
  ["email_opened"]="emailOpened"
  ["delivery_status"]="deliveryStatus"
  ["template_type"]="templateType"
  ["subject_en"]="subjectEn"
  ["subject_ar"]="subjectAr"
  ["content_en"]="contentEn"
  ["content_ar"]="contentAr"

  # Follow-up fields
  ["step_number"]="stepNumber"
  ["response_received"]="responseReceived"

  # Company fields
  ["default_vat_rate"]="defaultVatRate"
  ["company_id"]="companyId"

  # Other common fields
  ["is_active"]="isActive"
  ["is_default"]="isDefault"
  ["user_id"]="userId"
)

# Fix field names in where clauses and object access
for snake in "${!field_mappings[@]}"; do
  camel="${field_mappings[$snake]}"
  echo "  $snake → $camel"

  # Fix in where clauses: where.field_name =
  find src/app/api -name "*.ts" -type f -exec sed -i '' "s/where\\.${snake}/where.${camel}/g" {} +

  # Fix in object access: obj.field_name
  find src/app/api -name "*.ts" -type f -exec sed -i '' "s/\\.${snake}/.${camel}/g" {} +

  # Fix in object keys: { field_name:
  find src/app/api -name "*.ts" -type f -exec sed -i '' "s/{ ${snake}:/{ ${camel}:/g" {} +
done

echo "✅ Fixed all snake_case field references"
