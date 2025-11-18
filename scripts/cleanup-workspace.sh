#!/bin/bash

# Workspace Cleanup Script
# Archives temporary test scripts and keeps production-ready utilities

echo "🧹 Cleaning up workspace..."
echo ""

# Create archive directory if it doesn't exist
mkdir -p scripts/archive

# Keep these production-ready scripts
KEEP_SCRIPTS=(
  "test-invoice-reminder-flow.ts"
  "verify-invoice-customers.ts"
  "postmark-direct-test.ts"
  "list-users.ts"
  "reset-test-password.ts"
  "fix-customer-relationships.ts"
)

# Move all test/temp scripts to archive except the ones we want to keep
ARCHIVED=0
for file in scripts/test-*.ts scripts/fix-*.ts scripts/verify-*.ts scripts/*-test*.ts; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")

    # Check if this file should be kept
    SHOULD_KEEP=false
    for keep in "${KEEP_SCRIPTS[@]}"; do
      if [ "$filename" == "$keep" ]; then
        SHOULD_KEEP=true
        break
      fi
    done

    if [ "$SHOULD_KEEP" == false ]; then
      mv "$file" scripts/archive/
      echo "  📦 Archived: $filename"
      ((ARCHIVED++))
    else
      echo "  ✅ Keeping: $filename"
    fi
  fi
done

# Archive old shell scripts
for file in scripts/fix-*.sh scripts/test-*.sh; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    mv "$file" scripts/archive/
    echo "  📦 Archived: $filename"
    ((ARCHIVED++))
  fi
done

# Archive old JavaScript files
for file in scripts/test-*.js scripts/fix-*.js scripts/*-test*.js; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    mv "$file" scripts/archive/
    echo "  📦 Archived: $filename"
    ((ARCHIVED++))
  fi
done

# Archive old MJS files
for file in scripts/*.mjs; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    mv "$file" scripts/archive/
    echo "  📦 Archived: $filename"
    ((ARCHIVED++))
  fi
done

# Archive SQL test files
for file in scripts/test-*.sql scripts/verify-*.sql; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    mv "$file" scripts/archive/
    echo "  📦 Archived: $filename"
    ((ARCHIVED++))
  fi
done

echo ""
echo "✅ Cleanup complete!"
echo "   📦 Archived: $ARCHIVED files"
echo "   ✅ Kept: ${#KEEP_SCRIPTS[@]} production scripts"
echo ""
echo "Production scripts in scripts/:"
ls -1 scripts/*.ts 2>/dev/null | grep -v archive | head -10
echo ""
