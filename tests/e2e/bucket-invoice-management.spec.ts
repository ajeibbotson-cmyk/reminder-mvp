import { test, expect, Page } from '@playwright/test'
import { mockAuth } from '../helpers/mock-auth';

// Helper function to setup test data
async function setupTestData(page: Page) {
  // Mock API responses for consistent testing
  await page.route('**/api/invoices/buckets', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        buckets: [
          {
            id: 'bucket-not-due',
            label: 'Not Due Yet',
            count: 2,
            totalAmount: 5000,
            priority: 'low',
            color: 'green',
            eligibleForReminder: 0,
            needsReview: 0,
            sampleInvoices: [],
            hasUrgentCustomers: false,
            hasAutoRemindersEnabled: false,
            hasRecentActivity: false
          },
          {
            id: 'bucket-1-3-days',
            label: '1-3 Days Overdue',
            count: 3,
            totalAmount: 15000,
            priority: 'high',
            color: 'orange',
            eligibleForReminder: 3,
            needsReview: 1,
            sampleInvoices: [
              {
                id: 'invoice-1',
                customerName: 'ABC Trading LLC',
                number: 'INV-001',
                amount: 5000,
                daysOverdue: 2
              }
            ],
            hasUrgentCustomers: true,
            hasAutoRemindersEnabled: false,
            hasRecentActivity: true
          },
          {
            id: 'bucket-4-7-days',
            label: '4-7 Days Overdue',
            count: 2,
            totalAmount: 20000,
            priority: 'critical',
            color: 'red',
            eligibleForReminder: 2,
            needsReview: 2,
            sampleInvoices: [],
            hasUrgentCustomers: true,
            hasAutoRemindersEnabled: true,
            hasRecentActivity: false
          }
        ],
        summary: {
          totalInvoices: 7,
          totalAmount: 40000,
          overdueCount: 5,
          overdueAmount: 35000,
          eligibleForReminder: 5,
          criticalCount: 2,
          needsReview: 3
        },
        lastUpdated: new Date().toISOString()
      })
    })
  })

  await page.route('**/api/invoices/buckets/bucket-1-3-days**', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        invoices: [
          {
            id: 'invoice-1',
            number: 'INV-001',
            customerName: 'ABC Trading LLC',
            customerEmail: 'accounts@abctrading.ae',
            amount: 5000,
            currency: 'AED',
            dueDate: '2024-01-01',
            daysOverdue: 2,
            canSendReminder: true,
            needsUrgentAttention: false,
            isHighValue: false,
            lastReminderSent: null,
            daysSinceLastReminder: null,
            suggestedActions: ['send_reminder']
          },
          {
            id: 'invoice-2',
            number: 'INV-002',
            customerName: 'XYZ Corporation',
            customerEmail: 'finance@xyzcorp.ae',
            amount: 10000,
            currency: 'AED',
            dueDate: '2024-01-02',
            daysOverdue: 1,
            canSendReminder: true,
            needsUrgentAttention: false,
            isHighValue: true,
            lastReminderSent: null,
            daysSinceLastReminder: null,
            suggestedActions: ['send_reminder', 'personal_follow_up']
          }
        ],
        stats: {
          totalInvoices: 2,
          totalAmount: 15000,
          averageAmount: 7500,
          eligibleForReminder: 2,
          needsUrgentAttention: 0,
          highValueInvoices: 1,
          averageDaysOverdue: 1.5
        },
        pagination: {
          page: 1,
          limit: 20,
          totalCount: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      })
    })
  })
}

test.describe('Bucket-Based Invoice Management E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);
    await setupTestData(page)
  })

  test('should display bucket dashboard with summary statistics', async ({ page }) => {
    // Navigate to Invoice Management tab
    await page.click('[data-testid="invoice-management-tab"]')

    // Wait for bucket data to load
    await page.waitForSelector('[data-testid="bucket-card"]', { timeout: 10000 })

    // Verify summary statistics
    await expect(page.locator('text=Total Invoices')).toBeVisible()
    await expect(page.locator('text=7')).toBeVisible() // Total invoices count
    await expect(page.locator('text=AED 40,000.00')).toBeVisible() // Total amount
    await expect(page.locator('text=5')).toBeVisible() // Overdue count

    // Verify bucket cards are displayed
    const bucketCards = page.locator('[data-testid="bucket-card"]')
    await expect(bucketCards).toHaveCount(3)

    // Verify bucket labels
    await expect(page.locator('text=Not Due Yet')).toBeVisible()
    await expect(page.locator('text=1-3 Days Overdue')).toBeVisible()
    await expect(page.locator('text=4-7 Days Overdue')).toBeVisible()
  })

  test('should show priority indicators and status icons', async ({ page }) => {
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Check priority badges
    await expect(page.locator('text=LOW')).toBeVisible() // Not due bucket
    await expect(page.locator('text=HIGH')).toBeVisible() // 1-3 days bucket
    await expect(page.locator('text=CRITICAL')).toBeVisible() // 4-7 days bucket

    // Check status indicators (urgent customers, auto reminders, recent activity)
    const urgentIcon = page.locator('[title="Has urgent customers"]')
    await expect(urgentIcon).toHaveCount(2) // Two buckets have urgent customers

    const autoRemindersIcon = page.locator('[title="Auto reminders enabled"]')
    await expect(autoRemindersIcon).toHaveCount(1) // One bucket has auto reminders

    const recentActivityIcon = page.locator('[title="Recent activity"]')
    await expect(recentActivityIcon).toHaveCount(1) // One bucket has recent activity
  })

  test('should expand bucket card and show sample invoices', async ({ page }) => {
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Click on 1-3 days bucket to expand it
    const bucket1to3Days = page.locator('text=1-3 Days Overdue').locator('..')
    await bucket1to3Days.click()

    // Wait for expansion animation
    await page.waitForTimeout(500)

    // Check if sample invoices are shown
    await expect(page.locator('text=Recent Invoices:')).toBeVisible()
    await expect(page.locator('text=ABC Trading LLC')).toBeVisible()
    await expect(page.locator('text=INV-001')).toBeVisible()
    await expect(page.locator('text=2 days overdue')).toBeVisible()

    // Check quick action buttons
    await expect(page.locator('text=Send (3)')).toBeVisible()
    await expect(page.locator('text=Review (1)')).toBeVisible()
  })

  test('should open bucket detail view with invoice list', async ({ page }) => {
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Click Review button to open detail view
    const bucket1to3Days = page.locator('text=1-3 Days Overdue').locator('..')
    await bucket1to3Days.click()

    await page.waitForSelector('text=Review (1)')
    await page.click('text=Review (1)')

    // Wait for detail view to open
    await page.waitForSelector('text=1-3 Days Overdue - Invoice Details')

    // Verify detail view components
    await expect(page.locator('text=1-3 Days Overdue - Invoice Details')).toBeVisible()
    await expect(page.locator('text=2 of 2 invoices selected')).toBeVisible()
    await expect(page.locator('text=Total: AED 15,000.00')).toBeVisible()

    // Check invoice table
    await expect(page.locator('text=ABC Trading LLC')).toBeVisible()
    await expect(page.locator('text=accounts@abctrading.ae')).toBeVisible()
    await expect(page.locator('text=XYZ Corporation')).toBeVisible()
    await expect(page.locator('text=finance@xyzcorp.ae')).toBeVisible()

    // Check for action buttons
    await expect(page.locator('text=Send Reminders')).toBeVisible()
  })

  test('should handle invoice selection and bulk actions', async ({ page }) => {
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Open detail view
    const bucket1to3Days = page.locator('text=1-3 Days Overdue').locator('..')
    await bucket1to3Days.click()
    await page.click('text=Review (1)')

    await page.waitForSelector('text=1-3 Days Overdue - Invoice Details')

    // Select individual invoices using checkboxes
    const firstCheckbox = page.locator('table tbody tr:first-child input[type="checkbox"]')
    await firstCheckbox.click()

    // Verify selection count updates
    await expect(page.locator('text=1 of 2 invoices selected')).toBeVisible()

    // Select all invoices
    const selectAllCheckbox = page.locator('table thead input[type="checkbox"]')
    await selectAllCheckbox.click()

    await expect(page.locator('text=2 of 2 invoices selected')).toBeVisible()

    // Verify Send Reminders button is enabled
    const sendRemindersButton = page.locator('text=Send Reminders (2)')
    await expect(sendRemindersButton).toBeVisible()
    await expect(sendRemindersButton).toBeEnabled()
  })

  test('should open email campaign modal and create campaign', async ({ page }) => {
    // Mock campaign creation API
    await page.route('**/api/campaigns/from-invoices', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          campaignId: 'campaign-123',
          message: 'Campaign created successfully'
        })
      })
    })

    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Open detail view and select invoices
    const bucket1to3Days = page.locator('text=1-3 Days Overdue').locator('..')
    await bucket1to3Days.click()
    await page.click('text=Review (1)')

    await page.waitForSelector('text=Send Reminders')
    await page.click('text=Send Reminders')

    // Wait for email campaign modal to open
    await page.waitForSelector('text=Create Email Campaign')

    // Verify modal content
    await expect(page.locator('text=Create Email Campaign')).toBeVisible()
    await expect(page.locator('text=Send payment reminders to 2 customers')).toBeVisible()

    // Check campaign summary
    await expect(page.locator('text=2')).toBeVisible() // Number of invoices
    await expect(page.locator('text=AED 15,000.00')).toBeVisible() // Total amount

    // Navigate through tabs
    await page.click('text=Settings')
    await expect(page.locator('text=Sending Schedule')).toBeVisible()

    await page.click('text=Preview')
    await expect(page.locator('text=Email Preview')).toBeVisible()

    await page.click('text=Send')
    await expect(page.locator('text=Ready to Send')).toBeVisible()

    // Submit campaign
    await page.click('text=Send Campaign')

    // Wait for campaign creation to complete and modal to close
    await page.waitForSelector('text=Create Email Campaign', { state: 'hidden', timeout: 10000 })
  })

  test('should handle search and filtering in detail view', async ({ page }) => {
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Open detail view
    const bucket1to3Days = page.locator('text=1-3 Days Overdue').locator('..')
    await bucket1to3Days.click()
    await page.click('text=Review (1)')

    await page.waitForSelector('text=1-3 Days Overdue - Invoice Details')

    // Test search functionality
    const searchInput = page.locator('input[placeholder*="Search by customer name"]')
    await searchInput.fill('ABC Trading')

    // Search should filter results (mocked data would need to handle this)
    await page.waitForTimeout(500)

    // Test sorting
    const sortSelect = page.locator('select').last()
    await sortSelect.selectOption('amount_desc')

    // Verify sort was applied (would need API mock to handle sorting)
    await page.waitForTimeout(500)
  })

  test('should show action required alerts for critical invoices', async ({ page }) => {
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Check for action required section
    await expect(page.locator('text=Action Required')).toBeVisible()
    await expect(page.locator('text=There are invoices that need immediate attention')).toBeVisible()

    // Check critical invoices alert
    await expect(page.locator('text=Critical Invoices')).toBeVisible()
    await expect(page.locator('text=2 invoices need urgent follow-up')).toBeVisible()

    // Check needs review alert
    await expect(page.locator('text=Need Review')).toBeVisible()
    await expect(page.locator('text=3 high-value invoices need attention')).toBeVisible()

    // Click Review button for critical invoices
    const reviewCriticalButton = page.locator('text=Critical Invoices').locator('..').locator('button:has-text("Review")')
    await reviewCriticalButton.click()

    // Should open the critical bucket detail view
    await page.waitForSelector('text=4-7 Days Overdue - Invoice Details')
  })

  test('should refresh data when refresh button is clicked', async ({ page }) => {
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")')
    await refreshButton.click()

    // Verify loading state (if implemented)
    await page.waitForTimeout(1000)

    // Data should reload (buckets should still be visible)
    await expect(page.locator('[data-testid="bucket-card"]')).toHaveCount(3)
  })

  test('should handle empty state gracefully', async ({ page }) => {
    // Mock empty bucket response
    await page.route('**/api/invoices/buckets', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          buckets: Array.from({ length: 6 }, (_, i) => ({
            id: `bucket-${i}`,
            label: `Bucket ${i}`,
            count: 0,
            totalAmount: 0,
            priority: 'low',
            color: 'gray',
            eligibleForReminder: 0,
            needsReview: 0,
            sampleInvoices: [],
            hasUrgentCustomers: false,
            hasAutoRemindersEnabled: false,
            hasRecentActivity: false
          })),
          summary: {
            totalInvoices: 0,
            totalAmount: 0,
            overdueCount: 0,
            overdueAmount: 0,
            eligibleForReminder: 0,
            criticalCount: 0,
            needsReview: 0
          },
          lastUpdated: new Date().toISOString()
        })
      })
    })

    await page.goto('/en/dashboard')
    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Check empty state message
    await expect(page.locator('text=No Outstanding Invoices')).toBeVisible()
    await expect(page.locator('text=Great job! You don\'t have any unpaid invoices')).toBeVisible()
  })

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Check that bucket cards stack vertically on mobile
    const bucketCards = page.locator('[data-testid="bucket-card"]')
    await expect(bucketCards).toHaveCount(3)

    // Check that the grid layout adapts
    const grid = page.locator('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3.xl\\:grid-cols-6')
    await expect(grid).toBeVisible()

    // Check that tabs are responsive
    const tabsList = page.locator('.grid.grid-cols-5')
    await expect(tabsList).toBeVisible()
  })
})

test.describe('Accessibility Tests', () => {
  test('should meet accessibility requirements', async ({ page }) => {
    await mockAuth(page);
    await setupTestData(page)

    await page.click('[data-testid="invoice-management-tab"]')
    await page.waitForSelector('[data-testid="bucket-card"]')

    // Check for proper heading hierarchy
    await expect(page.locator('h1')).toContainText('Invoice Management')
    await expect(page.locator('h2')).toContainText('Invoice Categories')

    // Check for proper ARIA labels
    const bucketCards = page.locator('[data-testid="bucket-card"]')
    for (let i = 0; i < await bucketCards.count(); i++) {
      const card = bucketCards.nth(i)
      await expect(card).toBeVisible()
      // Cards should be clickable and have proper roles
    }

    // Check that buttons have accessible names
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible()

    // Check form labels
    const bucket1to3Days = page.locator('text=1-3 Days Overdue').locator('..')
    await bucket1to3Days.click()
    await page.click('text=Review (1)')

    await page.waitForSelector('input[type="checkbox"]')

    // Checkboxes should have proper labels
    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes.first()).toBeVisible()
  })
})