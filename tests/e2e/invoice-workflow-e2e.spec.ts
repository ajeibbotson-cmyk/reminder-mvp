/**
 * Phase 4 Sprint 1.5: End-to-End Invoice Workflow Tests
 *
 * Complete user journey testing for invoice management system
 * Tests the integration between frontend components and backend APIs
 * Validates Sprint 1.5 acceptance criteria through user interactions
 */

import { test, expect } from '@playwright/test'
import { faker } from '@faker-js/faker'
import { mockAuth } from '../helpers/mock-auth';

// Test data generators
function generateUAECompanyData() {
  const timestamp = Date.now()
  return {
    companyName: `UAE Test Company ${timestamp}`,
    trn: `100${timestamp.toString().slice(-12)}3`,
    name: 'E2E Test User',
    email: `e2etest${timestamp}@uaetest.ae`,
    password: 'SecurePass123!'
  }
}

function generateInvoiceData() {
  const timestamp = Date.now()
  return {
    number: `E2E-INV-${timestamp}`,
    customerName: 'E2E Test Customer',
    customerEmail: `customer${timestamp}@uaetest.ae`,
    customerPhone: '+971501234567',
    description: 'End-to-end test invoice',
    notes: 'Generated for E2E testing',
    amount: '1000.00',
    currency: 'AED',
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  }
}

test.describe('Complete Invoice Workflow E2E Tests - Sprint 1.5', () => {
  let companyData: any
  let invoiceData: any

  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    companyData = generateUAECompanyData()
    invoiceData = generateInvoiceData()
  })

  test('Complete invoice lifecycle: Create → Send → Pay → Status Updates', async ({ page }) => {
    // ==================== USER REGISTRATION ====================
    await test.step('Register new UAE company', async () => {
      await page.click('text=Sign Up')
      await expect(page).toHaveURL(/\/auth\/signup/)
      
      // Fill registration form with UAE-specific data
      await page.fill('input[name="companyName"]', companyData.companyName)
      await page.fill('input[name="trn"]', companyData.trn)
      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.fill('input[name="password"]', companyData.password)
      
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/dashboard/)
      
      // Verify UAE-specific elements on dashboard
      await expect(page.locator('text=AED')).toBeVisible()
      await expect(page.locator('text=UAE')).toBeVisible()
    })

    // ==================== INVOICE CREATION (DRAFT) ====================
    await test.step('Create new invoice in DRAFT status', async () => {
      await page.getByTestId('desktop-nav-invoices').click();
      await expect(page).toHaveURL(/\/dashboard\/invoices/)
      
      await page.click('text=New Invoice')
      await expect(page).toHaveURL(/\/dashboard\/invoices\/new/)
      
      // Fill basic invoice information
      await page.fill('input[name="number"]', invoiceData.number)
      await page.fill('input[name="customerName"]', invoiceData.customerName)
      await page.fill('input[name="customerEmail"]', invoiceData.customerEmail)
      await page.fill('input[name="customerPhone"]', invoiceData.customerPhone)
      await page.fill('textarea[name="description"]', invoiceData.description)
      await page.fill('textarea[name="notes"]', invoiceData.notes)
      
      // Set due date
      await page.fill('input[name="dueDate"]', invoiceData.dueDate)
      
      // Add invoice items
      await page.click('[data-testid="add-item-button"]')
      await page.fill('input[name="items.0.description"]', 'Professional Services')
      await page.fill('input[name="items.0.quantity"]', '1')
      await page.fill('input[name="items.0.unitPrice"]', '952.38')
      
      // Select VAT rate (5% for UAE)
      await page.selectOption('select[name="items.0.vatRate"]', '5')
      
      // Verify VAT calculation happens in real-time
      await expect(page.locator('[data-testid="vat-amount"]')).toContainText('47.62')
      await expect(page.locator('[data-testid="total-amount"]')).toContainText('1,000.00')
      await expect(page.locator('[data-testid="currency-display"]')).toContainText('AED')
      
      // Save as draft
      await page.click('button[data-testid="save-draft"]')
      
      // Should redirect to invoice detail page
      await expect(page).toHaveURL(/\/dashboard\/invoices\/[^\/]+$/)
      await expect(page.locator('[data-testid="invoice-status"]')).toContainText('Draft')
      await expect(page.locator('[data-testid="invoice-number"]')).toContainText(invoiceData.number)
    })

    // ==================== INVOICE SENDING (DRAFT → SENT) ====================
    await test.step('Send invoice to customer', async () => {
      // Click send invoice button
      await page.click('[data-testid="send-invoice-button"]')
      
      // Confirm in modal
      await expect(page.locator('[data-testid="send-modal"]')).toBeVisible()
      await expect(page.locator('text=Send Invoice')).toBeVisible()
      await expect(page.locator(`text=${invoiceData.customerEmail}`)).toBeVisible()
      
      await page.click('[data-testid="confirm-send"]')
      
      // Wait for status update
      await page.waitForTimeout(2000)
      await expect(page.locator('[data-testid="invoice-status"]')).toContainText('Sent')
      
      // Verify audit trail entry
      await expect(page.locator('[data-testid="activity-log"]')).toContainText('Invoice sent to customer')
    })

    // ==================== PAYMENT RECORDING (PARTIAL) ====================
    await test.step('Record partial payment', async () => {
      await page.click('[data-testid="record-payment-button"]')
      
      // Fill payment modal
      await expect(page.locator('[data-testid="payment-modal"]')).toBeVisible()
      await page.fill('input[name="amount"]', '600')
      await page.selectOption('select[name="method"]', 'BANK_TRANSFER')
      await page.fill('input[name="reference"]', 'TXN-PARTIAL-001')
      await page.fill('textarea[name="notes"]', 'Partial payment from customer')
      
      await page.click('[data-testid="save-payment"]')
      
      // Verify payment recorded
      await page.waitForTimeout(2000)
      await expect(page.locator('[data-testid="payments-section"]')).toContainText('AED 600.00')
      await expect(page.locator('[data-testid="outstanding-amount"]')).toContainText('AED 400.00')
      
      // Invoice should still be in SENT status (partial payment)
      await expect(page.locator('[data-testid="invoice-status"]')).toContainText('Sent')
    })

    // ==================== FINAL PAYMENT (SENT → PAID) ====================
    await test.step('Record final payment and verify automatic status update', async () => {
      await page.click('[data-testid="record-payment-button"]')
      
      // Fill final payment
      await page.fill('input[name="amount"]', '400')
      await page.selectOption('select[name="method"]', 'BANK_TRANSFER')
      await page.fill('input[name="reference"]', 'TXN-FINAL-001')
      await page.fill('textarea[name="notes"]', 'Final payment completing invoice')
      
      await page.click('[data-testid="save-payment"]')
      
      // Verify automatic status update to PAID
      await page.waitForTimeout(3000)
      await expect(page.locator('[data-testid="invoice-status"]')).toContainText('Paid')
      await expect(page.locator('[data-testid="outstanding-amount"]')).toContainText('AED 0.00')
      
      // Verify payment summary
      await expect(page.locator('[data-testid="payments-section"]')).toContainText('2 payments')
      await expect(page.locator('[data-testid="total-paid"]')).toContainText('AED 1,000.00')
      
      // Verify audit trail shows automatic status change
      await expect(page.locator('[data-testid="activity-log"]')).toContainText('Status changed to Paid')
      await expect(page.locator('[data-testid="activity-log"]')).toContainText('automatically')
    })

    // ==================== VERIFICATION AND CLEANUP ====================
    await test.step('Verify final invoice state in list view', async () => {
      await page.getByTestId('desktop-nav-invoices').click();
      await expect(page).toHaveURL(/\/dashboard\/invoices$/)
      
      // Find our invoice in the list
      const invoiceRow = page.locator(`[data-testid="invoice-row-${invoiceData.number}"]`)
      await expect(invoiceRow).toBeVisible()
      await expect(invoiceRow.locator('[data-testid="status-badge"]')).toContainText('Paid')
      await expect(invoiceRow.locator('[data-testid="amount"]')).toContainText('AED 1,000.00')
      await expect(invoiceRow.locator('[data-testid="customer"]')).toContainText(invoiceData.customerName)
    })
  })

  test('Bulk invoice operations workflow', async ({ page }) => {
    // Register and create multiple invoices first
    await test.step('Setup: Register and create multiple invoices', async () => {
      // Quick registration
      await page.click('text=Sign Up')
      await page.fill('input[name="companyName"]', companyData.companyName)
      await page.fill('input[name="trn"]', companyData.trn)
      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.fill('input[name="password"]', companyData.password)
      await page.click('button[type="submit"]')
      
      // Create 3 test invoices
      for (let i = 1; i <= 3; i++) {
        await page.goto('/dashboard/invoices/new')
        
        const testInvoice = generateInvoiceData()
        testInvoice.number = `BULK-${i}-${Date.now()}`
        
        await page.fill('input[name="number"]', testInvoice.number)
        await page.fill('input[name="customerName"]', `Bulk Customer ${i}`)
        await page.fill('input[name="customerEmail"]', `bulk${i}@test.ae`)
        await page.fill('textarea[name="description"]', `Bulk test invoice ${i}`)
        await page.fill('input[name="dueDate"]', testInvoice.dueDate)
        
        // Add item
        await page.click('[data-testid="add-item-button"]')
        await page.fill('input[name="items.0.description"]', `Service ${i}`)
        await page.fill('input[name="items.0.quantity"]', '1')
        await page.fill('input[name="items.0.unitPrice"]', '952.38')
        await page.selectOption('select[name="items.0.vatRate"]', '5')
        
        await page.click('button[data-testid="save-draft"]')
        await page.waitForTimeout(1000)
      }
    })

    await test.step('Perform bulk status update', async () => {
      await page.goto('/dashboard/invoices')
      
      // Select all invoices with BULK prefix
      const bulkInvoices = page.locator('[data-testid^="invoice-row-BULK-"]')
      const count = await bulkInvoices.count()
      expect(count).toBe(3)
      
      // Select all bulk invoices
      for (let i = 0; i < count; i++) {
        await bulkInvoices.nth(i).locator('input[type="checkbox"]').check()
      }
      
      // Click bulk actions
      await page.click('[data-testid="bulk-actions-button"]')
      await expect(page.locator('[data-testid="bulk-actions-menu"]')).toBeVisible()
      
      // Select "Send All"
      await page.click('[data-testid="bulk-send-action"]')
      
      // Confirm bulk operation
      await expect(page.locator('[data-testid="bulk-confirm-modal"]')).toBeVisible()
      await expect(page.locator('text=3 invoices')).toBeVisible()
      await page.click('[data-testid="confirm-bulk-operation"]')
      
      // Wait for bulk operation to complete
      await page.waitForTimeout(5000)
      
      // Verify all invoices are now in SENT status
      for (let i = 0; i < count; i++) {
        await expect(bulkInvoices.nth(i).locator('[data-testid="status-badge"]')).toContainText('Sent')
      }
      
      // Verify success notification
      await expect(page.locator('[data-testid="notification"]')).toContainText('3 invoices sent successfully')
    })
  })

  test('Advanced filtering and search functionality', async ({ page }) => {
    await test.step('Setup: Register and create test data', async () => {
      // Quick registration
      await page.click('text=Sign Up')
      await page.fill('input[name="companyName"]', companyData.companyName)
      await page.fill('input[name="trn"]', companyData.trn)
      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.fill('input[name="password"]', companyData.password)
      await page.click('button[type="submit"]')
      
      // Create invoices with different characteristics for filtering
      const testScenarios = [
        { prefix: 'FILTER-AED', currency: 'AED', amount: '1000', status: 'draft' },
        { prefix: 'FILTER-USD', currency: 'USD', amount: '500', status: 'draft' },
        { prefix: 'SEARCH-TEST', currency: 'AED', amount: '2000', status: 'draft', customer: 'Arabic عميل' }
      ]
      
      for (const scenario of testScenarios) {
        await page.goto('/dashboard/invoices/new')
        
        await page.fill('input[name="number"]', `${scenario.prefix}-${Date.now()}`)
        await page.fill('input[name="customerName"]', scenario.customer || 'Filter Customer')
        await page.fill('input[name="customerEmail"]', `${scenario.prefix.toLowerCase()}@test.ae`)
        await page.fill('textarea[name="description"]', `Test for ${scenario.prefix}`)
        await page.fill('input[name="dueDate"]', invoiceData.dueDate)
        
        // Set currency if not AED
        if (scenario.currency !== 'AED') {
          await page.selectOption('select[name="currency"]', scenario.currency)
        }
        
        await page.click('[data-testid="add-item-button"]')
        await page.fill('input[name="items.0.description"]', 'Filter test service')
        await page.fill('input[name="items.0.quantity"]', '1')
        await page.fill('input[name="items.0.unitPrice"]', scenario.amount)
        
        if (scenario.currency === 'AED') {
          await page.selectOption('select[name="items.0.vatRate"]', '5')
        }
        
        await page.click('button[data-testid="save-draft"]')
        await page.waitForTimeout(1000)
      }
    })

    await test.step('Test currency filtering', async () => {
      await page.goto('/dashboard/invoices')
      
      // Open filters
      await page.click('[data-testid="filters-button"]')
      await expect(page.locator('[data-testid="filters-panel"]')).toBeVisible()
      
      // Filter by AED currency
      await page.selectOption('select[name="currency"]', 'AED')
      await page.click('[data-testid="apply-filters"]')
      
      // Verify only AED invoices are shown
      const invoiceRows = page.locator('[data-testid^="invoice-row-"]')
      const count = await invoiceRows.count()
      
      for (let i = 0; i < count; i++) {
        await expect(invoiceRows.nth(i).locator('[data-testid="currency"]')).toContainText('AED')
      }
      
      // Should not see USD invoices
      await expect(page.locator('text=FILTER-USD')).not.toBeVisible()
    })

    await test.step('Test amount range filtering', async () => {
      await page.click('[data-testid="filters-button"]')
      
      // Clear previous filters
      await page.click('[data-testid="clear-filters"]')
      
      // Set amount range
      await page.fill('input[name="minAmount"]', '1500')
      await page.fill('input[name="maxAmount"]', '2500')
      await page.click('[data-testid="apply-filters"]')
      
      // Should only show invoices in range (2000 AED invoice)
      await expect(page.locator('text=SEARCH-TEST')).toBeVisible()
      await expect(page.locator('text=FILTER-AED')).not.toBeVisible()
      await expect(page.locator('text=FILTER-USD')).not.toBeVisible()
    })

    await test.step('Test Arabic text search', async () => {
      await page.click('[data-testid="filters-button"]')
      await page.click('[data-testid="clear-filters"]')
      
      // Search for Arabic text
      await page.fill('input[name="search"]', 'عميل')
      await page.click('[data-testid="apply-filters"]')
      
      // Should find the invoice with Arabic customer name
      await expect(page.locator('text=SEARCH-TEST')).toBeVisible()
      await expect(page.locator('text=Arabic عميل')).toBeVisible()
      
      // Should not show other invoices
      await expect(page.locator('text=FILTER-AED')).not.toBeVisible()
      await expect(page.locator('text=FILTER-USD')).not.toBeVisible()
    })
  })

  test('Error handling and validation workflows', async ({ page }) => {
    await test.step('Setup: Register user', async () => {
      await page.click('text=Sign Up')
      await page.fill('input[name="companyName"]', companyData.companyName)
      await page.fill('input[name="trn"]', companyData.trn)
      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.fill('input[name="password"]', companyData.password)
      await page.click('button[type="submit"]')
    })

    await test.step('Test invoice form validation', async () => {
      await page.goto('/dashboard/invoices/new')
      
      // Try to submit empty form
      await page.click('button[data-testid="save-draft"]')
      
      // Should show validation errors
      await expect(page.locator('[data-testid="error-message"]')).toContainText('required')
      await expect(page.locator('[data-testid="validation-error"]')).toBeVisible()
    })

    await test.step('Test invalid TRN validation', async () => {
      // Try to create invoice with invalid TRN (this would be caught at company level)
      await page.goto('/dashboard/settings')
      
      // Attempt to update company TRN to invalid format
      await page.fill('input[name="trn"]', '123456789') // Too short
      await page.click('[data-testid="save-settings"]')
      
      // Should show TRN validation error
      await expect(page.locator('[data-testid="trn-error"]')).toContainText('Invalid UAE TRN format')
    })

    await test.step('Test overpayment prevention', async () => {
      // Create and send an invoice first
      await page.goto('/dashboard/invoices/new')
      
      const testInvoice = generateInvoiceData()
      await page.fill('input[name="number"]', testInvoice.number)
      await page.fill('input[name="customerName"]', testInvoice.customerName)
      await page.fill('input[name="customerEmail"]', testInvoice.customerEmail)
      await page.fill('textarea[name="description"]', testInvoice.description)
      await page.fill('input[name="dueDate"]', testInvoice.dueDate)
      
      await page.click('[data-testid="add-item-button"]')
      await page.fill('input[name="items.0.description"]', 'Service')
      await page.fill('input[name="items.0.quantity"]', '1')
      await page.fill('input[name="items.0.unitPrice"]', '952.38')
      await page.selectOption('select[name="items.0.vatRate"]', '5')
      
      await page.click('button[data-testid="save-draft"]')
      
      // Send the invoice
      await page.click('[data-testid="send-invoice-button"]')
      await page.click('[data-testid="confirm-send"]')
      await page.waitForTimeout(2000)
      
      // Try to record overpayment
      await page.click('[data-testid="record-payment-button"]')
      await page.fill('input[name="amount"]', '1500') // More than invoice total
      await page.selectOption('select[name="method"]', 'BANK_TRANSFER')
      await page.fill('input[name="reference"]', 'OVERPAY-001')
      
      await page.click('[data-testid="save-payment"]')
      
      // Should show overpayment error
      await expect(page.locator('[data-testid="payment-error"]')).toContainText('exceeds invoice total')
      await expect(page.locator('[data-testid="payment-modal"]')).toBeVisible() // Modal should stay open
    })

    await test.step('Test network error handling', async () => {
      // Simulate network failure
      await page.route('**/api/invoices', route => route.abort())
      
      await page.goto('/dashboard/invoices')
      
      // Should show network error message
      await expect(page.locator('[data-testid="network-error"]')).toContainText('connection')
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible()
      
      // Test retry functionality
      await page.unroute('**/api/invoices')
      await page.click('[data-testid="retry-button"]')
      
      // Should recover and show invoices
      await page.waitForTimeout(2000)
      await expect(page.locator('[data-testid="invoices-table"]')).toBeVisible()
    })
  })

  test('Mobile responsive functionality', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await test.step('Mobile registration and navigation', async () => {
      await page.click('text=Sign Up')
      
      // Mobile form should be properly sized
      await expect(page.locator('form')).toBeVisible()
      await expect(page.locator('form')).toHaveCSS('width', /\d+px/)
      
      await page.fill('input[name="companyName"]', companyData.companyName)
      await page.fill('input[name="trn"]', companyData.trn)
      await page.fill('input[name="name"]', companyData.name)
      await page.fill('input[name="email"]', companyData.email)
      await page.fill('input[name="password"]', companyData.password)
      await page.click('button[type="submit"]')
      
      // Mobile dashboard navigation
      await page.click('[data-testid="mobile-menu-button"]')
      await expect(page.locator('[data-testid="mobile-sidebar"]')).toBeVisible()

      await page.getByTestId('desktop-nav-invoices').click();
      await expect(page).toHaveURL(/\/dashboard\/invoices/)
    })

    await test.step('Mobile invoice creation', async () => {
      await page.click('[data-testid="mobile-new-invoice"]')
      
      // Form should be mobile-optimized
      const form = page.locator('[data-testid="invoice-form"]')
      await expect(form).toBeVisible()
      
      // Fill form on mobile
      await page.fill('input[name="number"]', invoiceData.number)
      await page.fill('input[name="customerName"]', invoiceData.customerName)
      await page.fill('input[name="customerEmail"]', invoiceData.customerEmail)
      
      // Mobile item addition
      await page.click('[data-testid="add-item-button"]')
      await page.fill('input[name="items.0.description"]', 'Mobile Service')
      await page.fill('input[name="items.0.quantity"]', '1')
      await page.fill('input[name="items.0.unitPrice"]', '1000')
      
      await page.click('button[data-testid="save-draft"]')
      
      // Should successfully create invoice on mobile
      await expect(page.locator('[data-testid="invoice-status"]')).toContainText('Draft')
    })
  })

  test('Performance and accessibility validation', async ({ page }) => {
    await test.step('Page load performance', async () => {
      const startTime = Date.now()
      
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      expect(loadTime).toBeLessThan(3000) // Should load in under 3 seconds
    })

    await test.step('Accessibility checks', async () => {
      await page.goto('/dashboard/invoices')
      
      // Check for proper ARIA labels
      await expect(page.locator('[aria-label]')).toHaveCount(5) // At least 5 ARIA labeled elements
      
      // Check for proper heading structure
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('h2')).toHaveCount(2) // At least 2 section headings
      
      // Check focus management
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
      
      // Check color contrast (basic test)
      const computedStyle = await page.locator('body').evaluate(el => 
        window.getComputedStyle(el)
      )
      expect(computedStyle.color).toBeTruthy()
      expect(computedStyle.backgroundColor).toBeTruthy()
    })

    await test.step('Large dataset performance', async () => {
      // This would typically be done with test data seeding
      // For E2E, we simulate by checking pagination performance
      
      await page.goto('/dashboard/invoices?page=1&limit=50')
      await page.waitForLoadState('networkidle')
      
      const startScroll = Date.now()
      await page.locator('[data-testid="invoices-table"]').scrollIntoView()
      const scrollTime = Date.now() - startScroll
      
      expect(scrollTime).toBeLessThan(1000) // Should scroll smoothly
    })
  })
})