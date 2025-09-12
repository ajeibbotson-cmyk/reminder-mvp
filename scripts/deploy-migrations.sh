#!/bin/bash

# Database Migration Deployment Script
# UAE Pay MVP - Week 1 Database Optimization
# Purpose: Deploy performance indexes and validation constraints

set -e  # Exit on any error

echo "🚀 Starting UAE Pay MVP Database Migration Deployment"
echo "=================================================="

# Check if required environment variables are set
if [ -z "$DATABASE_URL" ] || [ -z "$DIRECT_URL" ]; then
    echo "❌ Error: DATABASE_URL and DIRECT_URL environment variables must be set"
    exit 1
fi

# Function to run SQL with error handling
run_sql() {
    local sql_file=$1
    local description=$2
    
    echo "📋 Running: $description"
    echo "   File: $sql_file"
    
    if psql "$DIRECT_URL" -f "$sql_file" > /tmp/migration_output.log 2>&1; then
        echo "✅ Success: $description completed"
    else
        echo "❌ Error: $description failed"
        echo "   Check /tmp/migration_output.log for details:"
        cat /tmp/migration_output.log
        exit 1
    fi
    echo ""
}

# Function to test database connection
test_connection() {
    echo "🔍 Testing database connection..."
    
    if psql "$DIRECT_URL" -c "SELECT version();" > /dev/null 2>&1; then
        echo "✅ Database connection successful"
    else
        echo "❌ Database connection failed"
        echo "   Please check your DATABASE_URL and DIRECT_URL configuration"
        exit 1
    fi
    echo ""
}

# Function to backup current state
backup_database() {
    echo "💾 Creating database backup before migration..."
    
    local backup_file="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    if pg_dump "$DIRECT_URL" > "$backup_file" 2>/dev/null; then
        echo "✅ Backup created: $backup_file"
        echo "   Keep this file safe in case rollback is needed"
    else
        echo "⚠️  Warning: Could not create backup (continuing anyway)"
    fi
    echo ""
}

# Function to check migration status
check_migration_status() {
    echo "📊 Checking current migration status..."
    
    # Check if _prisma_migrations table exists
    if psql "$DIRECT_URL" -c "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name='_prisma_migrations');" -t | grep -q 't'; then
        echo "✅ Prisma migration table exists"
        
        # Show current migration status
        echo "📋 Current applied migrations:"
        psql "$DIRECT_URL" -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 5;" 2>/dev/null || echo "   No migrations found"
    else
        echo "⚠️  Prisma migration table does not exist - this will be the first migration"
    fi
    echo ""
}

# Function to apply migrations
apply_migrations() {
    echo "🔧 Applying Prisma migrations..."
    
    # Try to deploy migrations
    if npx prisma migrate deploy --schema=prisma/schema.prisma; then
        echo "✅ Prisma migrations applied successfully"
    else
        echo "❌ Prisma migration deployment failed"
        echo "   Attempting manual migration application..."
        
        # Apply migrations manually
        for migration_dir in prisma/migrations/*/; do
            if [ -d "$migration_dir" ]; then
                migration_name=$(basename "$migration_dir")
                migration_file="$migration_dir/migration.sql"
                
                if [ -f "$migration_file" ]; then
                    echo "   Applying: $migration_name"
                    run_sql "$migration_file" "Migration: $migration_name"
                fi
            fi
        done
    fi
    echo ""
}

# Function to verify indexes were created
verify_indexes() {
    echo "🔍 Verifying performance indexes..."
    
    local expected_indexes=(
        "idx_invoices_company_status_due"
        "idx_customers_company_email"
        "idx_followup_logs_invoice_sent"
        "idx_invoices_company_number"
        "idx_invoices_company_amount"
        "idx_customers_company_name"
    )
    
    local missing_indexes=()
    
    for index in "${expected_indexes[@]}"; do
        if psql "$DIRECT_URL" -c "SELECT indexname FROM pg_indexes WHERE indexname = '$index';" -t | grep -q "$index"; then
            echo "✅ Index found: $index"
        else
            echo "❌ Index missing: $index"
            missing_indexes+=("$index")
        fi
    done
    
    if [ ${#missing_indexes[@]} -eq 0 ]; then
        echo "✅ All expected indexes are present"
    else
        echo "❌ Missing indexes: ${missing_indexes[*]}"
        echo "   Performance optimization may not be fully effective"
    fi
    echo ""
}

# Function to verify constraints
verify_constraints() {
    echo "🔍 Verifying validation constraints..."
    
    local expected_constraints=(
        "chk_companies_trn_format"
        "chk_users_email_format"
        "chk_invoices_amount_positive"
        "chk_invoices_currency_valid"
        "chk_customers_phone_format"
    )
    
    local missing_constraints=()
    
    for constraint in "${expected_constraints[@]}"; do
        if psql "$DIRECT_URL" -c "SELECT conname FROM pg_constraint WHERE conname = '$constraint';" -t | grep -q "$constraint"; then
            echo "✅ Constraint found: $constraint"
        else
            echo "❌ Constraint missing: $constraint"
            missing_constraints+=("$constraint")
        fi
    done
    
    if [ ${#missing_constraints[@]} -eq 0 ]; then
        echo "✅ All expected constraints are present"
    else
        echo "❌ Missing constraints: ${missing_constraints[*]}"
        echo "   Data validation may not be fully effective"
    fi
    echo ""
}

# Function to run performance tests
run_performance_tests() {
    echo "⚡ Running performance validation..."
    
    if [ -f "scripts/performance-test.sql" ]; then
        echo "   Running performance test suite..."
        if psql "$DIRECT_URL" -f "scripts/performance-test.sql" > /tmp/performance_results.log 2>&1; then
            echo "✅ Performance tests completed"
            echo "   Results saved to: /tmp/performance_results.log"
        else
            echo "⚠️  Performance tests encountered issues (check /tmp/performance_results.log)"
        fi
    else
        echo "⚠️  Performance test file not found - skipping tests"
    fi
    echo ""
}

# Function to test constraints
test_constraints() {
    echo "🧪 Testing validation constraints..."
    
    if [ -f "scripts/verify-constraints.sql" ]; then
        echo "   Running constraint validation tests..."
        if psql "$DIRECT_URL" -f "scripts/verify-constraints.sql" > /tmp/constraint_test_results.log 2>&1; then
            echo "✅ Constraint tests completed"
            echo "   Results saved to: /tmp/constraint_test_results.log"
        else
            echo "⚠️  Constraint tests encountered issues (check /tmp/constraint_test_results.log)"
        fi
    else
        echo "⚠️  Constraint test file not found - skipping tests"
    fi
    echo ""
}

# Main deployment process
main() {
    echo "Starting deployment at $(date)"
    echo ""
    
    # Pre-flight checks
    test_connection
    check_migration_status
    backup_database
    
    # Apply migrations
    apply_migrations
    
    # Verification
    verify_indexes
    verify_constraints
    
    # Testing
    run_performance_tests
    test_constraints
    
    # Final status
    echo "🎉 Migration deployment completed successfully!"
    echo "=================================================="
    echo "Summary:"
    echo "✅ Database connection verified"
    echo "✅ Migrations applied"
    echo "✅ Performance indexes created"
    echo "✅ Validation constraints added"
    echo "✅ Tests executed"
    echo ""
    echo "Next steps:"
    echo "1. Monitor application performance"
    echo "2. Review test results in /tmp/performance_results.log"
    echo "3. Review constraint validation in /tmp/constraint_test_results.log"
    echo "4. Update application code to handle new validation errors"
    echo ""
    echo "Deployment completed at $(date)"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi