-- UAE-Specific Validation Constraints Migration
-- Created: 2024-12-09 09:10:56
-- Purpose: Add data validation constraints for UAE business requirements

-- 1. UAE Trade Registration Number (TRN) Format Validation
-- TRN format: 15 digits (e.g., 100123456700003)
ALTER TABLE companies 
ADD CONSTRAINT chk_companies_trn_format 
CHECK (trn IS NULL OR (trn ~ '^[0-9]{15}$'));

-- 2. Email Format Validation
-- Comprehensive email validation for users
ALTER TABLE users 
ADD CONSTRAINT chk_users_email_format 
CHECK (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- Email validation for customers
ALTER TABLE customers 
ADD CONSTRAINT chk_customers_email_format 
CHECK (email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- Email validation for invoices
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoices_customer_email_format 
CHECK (customer_email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- Email validation for follow-up logs
ALTER TABLE follow_up_logs 
ADD CONSTRAINT chk_followup_logs_email_format 
CHECK (email_address ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$');

-- 3. AED Currency and Amount Validation
-- Ensure amounts are positive and reasonable for UAE business
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoices_amount_positive 
CHECK (amount > 0 AND amount <= 99999999.99);

-- Ensure currency is AED for UAE operations (can be extended later)
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoices_currency_valid 
CHECK (currency IN ('AED', 'USD', 'EUR'));

-- Payment amount validation
ALTER TABLE payments 
ADD CONSTRAINT chk_payments_amount_positive 
CHECK (amount > 0 AND amount <= 99999999.99);

-- Invoice item validations
ALTER TABLE invoice_items 
ADD CONSTRAINT chk_invoice_items_quantity_positive 
CHECK (quantity > 0);

ALTER TABLE invoice_items 
ADD CONSTRAINT chk_invoice_items_unit_price_positive 
CHECK (unit_price >= 0);

ALTER TABLE invoice_items 
ADD CONSTRAINT chk_invoice_items_total_positive 
CHECK (total >= 0);

-- 4. Date Validation Constraints
-- Due date should be in the future or today when creating invoices
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoices_due_date_reasonable 
CHECK (due_date >= created_at::date);

-- Payment date should not be in the future
ALTER TABLE payments 
ADD CONSTRAINT chk_payments_date_not_future 
CHECK (payment_date <= CURRENT_DATE);

-- Follow-up logs sent date validation
ALTER TABLE follow_up_logs 
ADD CONSTRAINT chk_followup_logs_sent_date_not_future 
CHECK (sent_at <= CURRENT_TIMESTAMP);

-- Email interaction timestamps should be logical
ALTER TABLE follow_up_logs 
ADD CONSTRAINT chk_followup_logs_email_opened_after_sent 
CHECK (email_opened IS NULL OR email_opened >= sent_at);

ALTER TABLE follow_up_logs 
ADD CONSTRAINT chk_followup_logs_email_clicked_after_opened 
CHECK (email_clicked IS NULL OR (email_opened IS NOT NULL AND email_clicked >= email_opened));

-- 5. Business Logic Constraints
-- Company name should not be empty
ALTER TABLE companies 
ADD CONSTRAINT chk_companies_name_not_empty 
CHECK (trim(name) != '');

-- User name should not be empty
ALTER TABLE users 
ADD CONSTRAINT chk_users_name_not_empty 
CHECK (trim(name) != '');

-- Customer name should not be empty
ALTER TABLE customers 
ADD CONSTRAINT chk_customers_name_not_empty 
CHECK (trim(name) != '');

-- Invoice number should not be empty
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoices_number_not_empty 
CHECK (trim(number) != '');

-- Customer name and email on invoices should not be empty
ALTER TABLE invoices 
ADD CONSTRAINT chk_invoices_customer_name_not_empty 
CHECK (trim(customer_name) != '');

-- 6. UAE-Specific Phone Number Validation (optional format)
-- UAE phone format: +971XXXXXXXXX or 971XXXXXXXXX or 0XXXXXXXXX
ALTER TABLE customers 
ADD CONSTRAINT chk_customers_phone_format 
CHECK (phone IS NULL OR 
       phone ~ '^(\+971|971|0)[1-9][0-9]{8}$');

-- 7. Payment Terms Validation
-- Payment terms should be reasonable (0-365 days)
ALTER TABLE customers 
ADD CONSTRAINT chk_customers_payment_terms_reasonable 
CHECK (payment_terms IS NULL OR (payment_terms >= 0 AND payment_terms <= 365));

-- 8. Follow-up Step Number Validation
-- Step numbers should be positive
ALTER TABLE follow_up_logs 
ADD CONSTRAINT chk_followup_logs_step_number_positive 
CHECK (step_number > 0 AND step_number <= 100);

-- 9. Invoice Status Transition Logic (basic)
-- Ensure status values are from the enum
-- Note: Enum constraint is already handled by PostgreSQL enum type

-- 10. Activity Type Validation
-- Activity type should not be empty
ALTER TABLE activities 
ADD CONSTRAINT chk_activities_type_not_empty 
CHECK (trim(type) != '');

-- Activity description should not be empty
ALTER TABLE activities 
ADD CONSTRAINT chk_activities_description_not_empty 
CHECK (trim(description) != '');

-- Business Rationale Comments:
-- These constraints ensure data integrity for UAE-specific business requirements:
-- 1. TRN format validation ensures compliance with UAE business registration
-- 2. Email validation prevents invalid email addresses in the system
-- 3. Amount constraints prevent negative or unreasonable amounts
-- 4. Date constraints ensure logical temporal relationships
-- 5. Non-empty string constraints prevent data quality issues
-- 6. Phone format validation supports UAE numbering formats
-- 7. Business logic constraints maintain operational integrity
--
-- All constraints are designed to:
-- - Prevent invalid data entry at the database level
-- - Support UAE business compliance requirements
-- - Maintain data quality for reporting and analytics
-- - Provide clear error messages for application debugging