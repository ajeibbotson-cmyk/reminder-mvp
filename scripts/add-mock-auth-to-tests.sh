#!/bin/bash

# Script to add mock auth import and setup to all E2E test files

echo "🔧 Adding mock auth to E2E test files..."

# List of test files that need auth (excluding auth-flow.spec.ts which tests login)
TEST_FILES=(
  "tests/e2e/payment-recording-flow.spec.ts"
  "tests/e2e/smoke-tests.spec.ts"
  "tests/e2e/bucket-invoice-management.spec.ts"
  "tests/e2e/user-journey.spec.ts"
  "tests/e2e/invoice-workflow-e2e.spec.ts"
  "tests/e2e/dashboard-hybrid.spec.ts"
  "tests/e2e/bucket-auto-send-flow.spec.ts"
  "tests/e2e/pdf-upload-chase-flow.spec.ts"
  "tests/e2e/csv-import-flow.spec.ts"
)

for file in "${TEST_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "  Processing: $file"

    # Check if mock auth is already imported
    if grep -q "import.*mockAuth" "$file"; then
      echo "    ✓ Mock auth already present"
    else
      echo "    + Adding mock auth import"

      # Add import after the first import line
      sed -i '' "1a\\
import { mockAuth } from '../helpers/mock-auth';\\
" "$file"

      # Check if test.beforeEach exists
      if grep -q "test.beforeEach" "$file"; then
        echo "    ⚠ beforeEach already exists - manual review needed"
      else
        # Find first test.describe and add beforeEach after it
        sed -i '' "/test.describe/a\\
\\
  test.beforeEach(async ({ page }) => {\\
    await mockAuth(page);\\
  });\\
" "$file"
        echo "    + Added beforeEach with mock auth"
      fi
    fi
  else
    echo "  ⚠ File not found: $file"
  fi
done

echo ""
echo "✅ Mock auth setup complete!"
echo ""
echo "Next steps:"
echo "1. Review the changes: git diff tests/e2e/"
echo "2. Run tests: npx playwright test --project=chromium"
echo "3. For production: TEST_ENV=production npx playwright test --project=chromium"
