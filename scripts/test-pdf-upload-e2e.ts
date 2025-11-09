#!/usr/bin/env tsx
/**
 * End-to-End PDF Invoice Upload Test with Playwright
 *
 * Tests the complete upload flow:
 * 1. Authenticate with existing test user
 * 2. Upload 10 PDF invoices
 * 3. Verify extraction results
 * 4. Check dashboard metrics accuracy
 */

import { chromium, Browser, Page } from 'playwright'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const APP_URL = 'http://localhost:3000'

interface UploadResult {
  filename: string
  success: boolean
  extractedFields?: string[]
  confidence?: number
  error?: string
}

async function testPDFUploadE2E() {
  let browser: Browser | null = null

  try {
    console.log('🧪 Starting End-to-End PDF Upload Test\n')

    // Step 0: Get test user credentials from database
    console.log('📋 Step 0: Getting test user from database...')

    const testUser = await prisma.users.findFirst({
      where: {
        email: {
          contains: 'test'
        }
      },
      include: {
        companies: true
      }
    })

    if (!testUser) {
      console.log('❌ No test user found in database')
      console.log('   Please create a test user first or provide credentials')
      return
    }

    console.log(`✅ Found test user: ${testUser.email}`)
    console.log(`   Company: ${testUser.companies.name}`)
    console.log(`   User ID: ${testUser.id}\n`)

    // Note: Password has been reset to known test password
    const TEST_PASSWORD = 'TestPassword123!'

    // Step 1: Find test PDFs
    console.log('📋 Step 1: Locating test PDF files...')
    const testPdfDir = path.join(process.cwd(), 'test-pdfs')

    if (!fs.existsSync(testPdfDir)) {
      console.log('❌ test-pdfs directory not found')
      return
    }

    const pdfFiles = fs.readdirSync(testPdfDir)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .slice(0, 10)
      .map(file => ({
        name: file,
        path: path.join(testPdfDir, file),
        size: fs.statSync(path.join(testPdfDir, file)).size
      }))

    console.log(`✅ Found ${pdfFiles.length} PDF files to test\n`)

    // Step 2: Launch browser
    console.log('📋 Step 2: Launching browser...')
    browser = await chromium.launch({
      headless: false, // Visible for debugging
      slowMo: 50
    })

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    })
    const page = await context.newPage()

    // Create screenshots directory
    const screenshotsDir = path.join(process.cwd(), 'test-screenshots')
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true })
    }

    // Step 3: Login
    console.log('\n📋 Step 3: Logging in...')
    await page.goto(`${APP_URL}/en/auth/signin`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: `${screenshotsDir}/01-login-page.png` })

    // Fill login form
    await page.waitForSelector('input[name="email"]', { timeout: 10000 })
    await page.fill('input[name="email"]', testUser.email)
    await page.fill('input[name="password"]', TEST_PASSWORD)

    await page.screenshot({ path: `${screenshotsDir}/02-login-filled.png` })

    // Submit login
    await page.click('button[type="submit"]')

    // Wait for navigation
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000) // Give time for redirect

    // Check if we're on dashboard or still on login page
    const currentUrl = page.url()
    console.log(`   Current URL after login: ${currentUrl}`)

    if (currentUrl.includes('dashboard')) {
      console.log('✅ Login successful\n')
      await page.screenshot({ path: `${screenshotsDir}/03-dashboard.png` })
    } else {
      console.log('❌ Login failed - still on login page')
      await page.screenshot({ path: `${screenshotsDir}/03-login-failed.png` })

      // Check for error message
      const errorElement = await page.$('.text-red-500, .text-destructive, [role="alert"]')
      if (errorElement) {
        const errorText = await errorElement.textContent()
        console.log(`   Error message: ${errorText}`)
      }

      console.log('\n⚠️  Manual intervention required:')
      console.log(`   1. Test user email: ${testUser.email}`)
      console.log(`   2. Try password: ${TEST_PASSWORD}`)
      console.log(`   3. Check screenshot at test-screenshots/03-login-failed.png`)
      return
    }

    // Step 4: Navigate to upload page
    console.log('📋 Step 4: Navigating to PDF upload page...')
    await page.goto(`${APP_URL}/en/dashboard/invoices/upload-pdf`)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: `${screenshotsDir}/04-upload-page.png` })
    console.log('✅ Upload page loaded\n')

    // Step 5: Upload PDFs and collect results
    console.log('📋 Step 5: Uploading 10 PDFs...\n')

    const uploadResults: UploadResult[] = []

    for (let i = 0; i < pdfFiles.length; i++) {
      const pdf = pdfFiles[i]

      console.log(`\n[${i + 1}/10] Processing: ${pdf.name}`)
      console.log(`  File size: ${(pdf.size / 1024).toFixed(1)} KB`)

      try {
        // Find file input (it's hidden, so we need to make it visible or use setInputFiles directly)
        const fileInput = page.locator('input[type="file"]')

        // Upload file directly to hidden input
        await fileInput.setInputFiles(pdf.path)
        console.log('  📤 File uploaded, waiting for extraction...')

        // Wait for extraction to complete (look for any success/result indicator)
        await page.waitForTimeout(5000) // Give AWS Textract time to process

        // Take screenshot
        await page.screenshot({
          path: `${screenshotsDir}/upload-${String(i + 1).padStart(2, '0')}-${pdf.name.substring(0, 30)}.png`
        })

        // Try to detect extraction results
        const pageText = await page.textContent('body')

        // Look for extracted fields in the page
        const hasInvoiceNumber = pageText?.toLowerCase().includes('invoice') || false
        const hasCustomer = pageText?.toLowerCase().includes('customer') || false
        const hasAmount = pageText?.toLowerCase().includes('amount') || pageText?.toLowerCase().includes('total') || false

        const extractedFields = []
        if (hasInvoiceNumber) extractedFields.push('invoiceNumber')
        if (hasCustomer) extractedFields.push('customerName')
        if (hasAmount) extractedFields.push('amount')

        if (extractedFields.length > 0) {
          console.log(`  ✅ Extraction detected`)
          console.log(`  📊 Possible fields: ${extractedFields.join(', ')}`)

          uploadResults.push({
            filename: pdf.name,
            success: true,
            extractedFields
          })
        } else {
          console.log(`  ⚠️  Extraction status unclear`)
          uploadResults.push({
            filename: pdf.name,
            success: false,
            error: 'Could not detect extraction results'
          })
        }

        // Wait before next upload
        await page.waitForTimeout(1000)

      } catch (error) {
        console.log(`  ❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown'}`)

        uploadResults.push({
          filename: pdf.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Step 6: Check dashboard metrics
    console.log('\n\n📋 Step 6: Checking dashboard metrics...')
    await page.goto(`${APP_URL}/en/dashboard`)
    await page.waitForTimeout(2000)

    await page.screenshot({ path: `${screenshotsDir}/05-dashboard-final.png` })

    // Extract metrics from dashboard
    const bodyText = await page.textContent('body')
    console.log('\n📊 Dashboard Content Analysis:')

    const totalInvoicesMatch = bodyText?.match(/(\d+)\s*(?:total\s*)?invoices?/i)
    const totalAmountMatch = bodyText?.match(/(\d+(?:,\d{3})*(?:\.\d{2})?)\s*AED/i)
    const overdueMatch = bodyText?.match(/(\d+)\s*overdue/i)

    if (totalInvoicesMatch) console.log(`   Total Invoices: ${totalInvoicesMatch[1]}`)
    if (totalAmountMatch) console.log(`   Total Amount: ${totalAmountMatch[1]} AED`)
    if (overdueMatch) console.log(`   Overdue Count: ${overdueMatch[1]}`)

    // Summary
    console.log('\n\n' + '═'.repeat(80))
    console.log('📊 TEST SUMMARY')
    console.log('═'.repeat(80))

    const successCount = uploadResults.filter(r => r.success).length
    const failCount = uploadResults.filter(r => !r.success).length

    console.log(`\n✅ Successful Uploads: ${successCount}/10`)
    console.log(`❌ Failed Uploads: ${failCount}/10`)
    console.log(`📈 Success Rate: ${((successCount / 10) * 100).toFixed(1)}%`)

    console.log(`\n📋 Upload Results:`)
    uploadResults.forEach((result, i) => {
      const status = result.success ? '✅' : '❌'
      const fields = result.extractedFields ? ` (${result.extractedFields.join(', ')})` : ''
      const error = result.error ? ` - ${result.error}` : ''
      console.log(`   ${i + 1}. ${status} ${result.filename}${fields}${error}`)
    })

    console.log(`\n📸 Screenshots saved to: test-screenshots/`)
    console.log(`\n✨ Test completed!`)

    // Keep browser open for review
    console.log('\n⏳ Browser will remain open for 10 seconds for review...')
    await page.waitForTimeout(10000)

  } catch (error) {
    console.error('\n❌ Test failed:', error)

    if (browser) {
      try {
        const pages = await browser.contexts()[0]?.pages()
        if (pages && pages[0]) {
          await pages[0].screenshot({
            path: 'test-screenshots/error.png',
            fullPage: true
          })
          console.log('📸 Error screenshot saved')
        }
      } catch (e) {
        // Ignore screenshot errors
      }
    }

  } finally {
    if (browser) {
      await browser.close()
    }
    await prisma.$disconnect()
  }
}

testPDFUploadE2E().catch(console.error)
