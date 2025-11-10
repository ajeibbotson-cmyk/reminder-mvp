import { test, expect } from '@playwright/test';

test.describe('UAEPay User Journey', () => {
  test('Complete user registration and dashboard navigation', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');
    
    // Check homepage loads with UAE branding
    await expect(page).toHaveTitle(/UAEPay/);
    await expect(page.locator('h1')).toContainText(/UAE.*Pay/i);
    
    // Navigate to signup
    await page.click('text=Sign Up');
    await expect(page).toHaveURL(/\/en\/auth\/signup/);
    
    // Fill registration form
    const timestamp = Date.now();
    await page.fill('input[name="companyName"]', `Test Company ${timestamp}`);
    await page.fill('input[name="trn"]', '100123456780003'); // Valid UAE TRN format
    await page.fill('input[name="name"]', 'Test User');
    await page.fill('input[name="email"]', `test${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'SecurePass123!');
    
    // Submit registration
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard after successful signup
    await expect(page).toHaveURL(/\/en\/dashboard/);
    
    // Verify dashboard elements
    await expect(page.locator('text=Enhanced Dashboard')).toBeVisible();
    await expect(page.locator('text=Total Outstanding')).toBeVisible();
    await expect(page.locator('text=AED')).toBeVisible(); // UAE currency
  });

  test('Navigation through all sidebar sections', async ({ page }) => {
    // Login first (assuming we have test user)
    await page.goto('/en/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    
    // Test all sidebar navigation
    const navigationTests = [
      { text: 'Dashboard', url: '/en/dashboard', expectedContent: 'Enhanced Dashboard' },
      { text: 'Invoices', url: '/en/dashboard/invoices', expectedContent: 'Invoice Management' },
      { text: 'Import Invoices', url: '/en/dashboard/import', expectedContent: 'Import' },
      { text: 'Email Templates', url: '/en/dashboard/email-templates', expectedContent: 'Email Templates' },
      { text: 'Customers', url: '/en/dashboard/customers', expectedContent: 'Customer Management' },
      { text: 'Follow-ups', url: '/en/dashboard/follow-ups', expectedContent: 'Follow-up Sequences' },
      { text: 'Reports', url: '/en/dashboard/reports', expectedContent: 'Reports' },
      { text: 'Settings', url: '/en/dashboard/settings', expectedContent: 'Settings' }
    ];

    for (const nav of navigationTests) {
      await page.click(`text=${nav.text}`);
      await expect(page).toHaveURL(new RegExp(nav.url));
      // Allow some time for page to load
      await page.waitForTimeout(1000);
    }
  });

  test('Mobile responsive navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/en/dashboard');
    
    // Mobile menu should be hidden initially
    const sidebar = page.locator('[data-testid="mobile-sidebar"]').first();
    
    // Click hamburger menu
    await page.click('button:has-text("Menu")');
    
    // Sidebar should appear
    await expect(sidebar).toBeVisible();
    
    // Test mobile navigation
    await page.getByTestId('desktop-nav-invoices').click();
    await expect(page).toHaveURL(/\/en\/dashboard\/invoices/);
  });

  test('Language switching functionality', async ({ page }) => {
    await page.goto('/en/dashboard');
    
    // Switch to Arabic
    await page.click('text=English'); // Language toggle button
    await page.click('text=العربية');
    
    // URL should change to Arabic locale
    await expect(page).toHaveURL(/\/ar\/dashboard/);
    
    // Page should have RTL layout
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('Invoice creation flow', async ({ page }) => {
    await page.goto('/en/dashboard/invoices');
    
    // Click create new invoice
    await page.click('text=New Invoice');
    await expect(page).toHaveURL(/\/en\/dashboard\/invoices\/new/);
    
    // Fill invoice form
    await page.fill('input[name="number"]', 'INV-001');
    await page.selectOption('select[name="customerId"]', { label: 'Test Customer' });
    await page.fill('input[name="amount"]', '1000');
    
    // Add invoice item
    await page.click('text=Add Item');
    await page.fill('input[name="items.0.description"]', 'Test Service');
    await page.fill('input[name="items.0.quantity"]', '1');
    await page.fill('input[name="items.0.rate"]', '1000');
    
    // Submit invoice
    await page.click('button[type="submit"]');
    
    // Should redirect back to invoices list
    await expect(page).toHaveURL(/\/en\/dashboard\/invoices/);
    await expect(page.locator('text=INV-001')).toBeVisible();
  });

  test('Email template customization', async ({ page }) => {
    await page.goto('/en/dashboard/email-templates');
    
    // Create new template
    await page.click('text=New Template');
    
    // Fill template form
    await page.fill('input[name="name"]', 'Test Reminder');
    await page.fill('input[name="subject"]', 'Payment Reminder - {{invoiceNumber}}');
    
    // Use template editor
    const editor = page.locator('[data-testid="template-editor"]').first();
    await editor.click();
    await editor.fill('Dear {{customerName}}, Your invoice {{invoiceNumber}} is overdue.');
    
    // Insert variable
    await page.click('text={{totalAmount}}');
    
    // Save template
    await page.click('button:has-text("Save Template")');
    
    // Template should appear in list
    await expect(page.locator('text=Test Reminder')).toBeVisible();
  });

  test('Follow-up sequence configuration', async ({ page }) => {
    await page.goto('/en/dashboard/follow-ups');
    
    // Create new sequence
    await page.click('text=New Sequence');
    
    // Configure sequence
    await page.fill('input[name="name"]', 'Standard Collection');
    
    // Add follow-up steps
    await page.click('text=Add Step');
    await page.selectOption('select[name="steps.0.delay"]', '3'); // 3 days
    await page.selectOption('select[name="steps.0.templateId"]', { index: 0 });
    
    // UAE-specific settings
    await expect(page.locator('text=UAE Business Hours Only')).toBeVisible();
    await page.check('input[name="respectBusinessHours"]');
    await expect(page.locator('text=Respect UAE Holidays')).toBeVisible();
    await page.check('input[name="respectUaeHolidays"]');
    
    // Save sequence
    await page.click('button:has-text("Save Sequence")');
    
    // Sequence should be created
    await expect(page.locator('text=Standard Collection')).toBeVisible();
  });

  test('Performance and accessibility checks', async ({ page }) => {
    await page.goto('/en/dashboard');
    
    // Basic performance check - page should load quickly
    const startTime = Date.now();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load in under 3 seconds
    
    // Accessibility checks
    await expect(page.locator('main')).toHaveAttribute('role', 'main');
    
    // Check for proper heading structure
    await expect(page.locator('h1')).toHaveCount(1);
    
    // Check for proper focus management
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus').first();
    await expect(focusedElement).toBeVisible();
  });

  test('Error handling and validation', async ({ page }) => {
    await page.goto('/en/dashboard/invoices/new');
    
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Should show validation errors
    await expect(page.locator('text=required')).toHaveCount(1); // At least one required field error
    
    // Test network error handling
    await page.route('**/api/**', route => route.abort());
    
    await page.fill('input[name="number"]', 'INV-001');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('text=error')).toBeVisible();
  });
});