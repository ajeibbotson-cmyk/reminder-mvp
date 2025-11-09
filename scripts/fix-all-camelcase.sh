#!/bin/bash

# Comprehensive camelCase fix script for all Prisma model references
# This fixes snake_case to camelCase across the entire codebase

echo "🔧 Starting comprehensive camelCase fixes..."

# Define the corrections
declare -A replacements=(
    ["prisma.invoices"]="prisma.invoice"
    ["prisma.customers"]="prisma.customer"
    ["prisma.payments"]="prisma.payment"
    ["prisma.users"]="prisma.user"
    ["prisma.companies"]="prisma.company"
    ["prisma.follow_up_logs"]="prisma.followUpLog"
    ["prisma.follow_up_sequences"]="prisma.followUpSequence"
    ["prisma.email_logs"]="prisma.emailLog"
    ["prisma.follow_up_logss"]="prisma.followUpLog"
    ["prisma.follow_up_sequencess"]="prisma.followUpSequence"
)

# Files to fix
files=(
    "src/lib/services/consolidated-email-service.ts"
    "src/lib/services/follow-up-detection-service.ts"
    "src/lib/services/sequence-triggers-service.ts"
    "src/lib/services/sequence-execution-service.ts"
    "src/lib/services/payment-reconciliation-service.ts"
    "src/lib/services/user-service.ts"
    "src/lib/services/payment-analytics-service.ts"
    "src/lib/services/invoice-analytics-service.ts"
    "src/lib/services/customer-analytics-service.ts"
    "src/lib/services/email-analytics-service.ts"
)

# Apply fixes
for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "📝 Fixing $file..."
        for old in "${!replacements[@]}"; do
            new="${replacements[$old]}"
            # Use perl for more reliable replacement
            perl -i -pe "s/\Q$old\E/$new/g" "$file"
        done
        echo "✅ Fixed $file"
    else
        echo "⚠️  File not found: $file"
    fi
done

echo "🎉 All camelCase fixes complete!"
echo "📋 Next steps:"
echo "   1. Regenerate Prisma client: npx prisma generate"
echo "   2. Restart dev server"
echo "   3. Test analytics dashboard"
