#!/usr/bin/env tsx
/**
 * End-to-End PDF Invoice Upload Test
 *
 * MANUAL TEST INSTRUCTIONS:
 * This test requires manual interaction since we need login credentials.
 * 
 * How to use:
 * 1. Update TEST_EMAIL and TEST_PASSWORD below
 * 2. Ensure dev server is running: npm run dev
 * 3. Run: npx tsx scripts/test-dashboard-playwright.ts
 */

import { chromium, Browser, Page } from 'playwright'
import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const APP_URL = 'http://localhost:3000'

// ⚠️ UPDATE THESE WITH YOUR TEST CREDENTIALS
const TEST_EMAIL = 'test@example.com'
const TEST_PASSWORD = 'your-password-here'

async function main() {
  console.log('🧪 PDF Upload E2E Test - Manual Browser Test\n')
  console.log('⚠️  This test requires:')
  console.log('   1. Dev server running (npm run dev)')
  console.log('   2. Valid test account credentials')
  console.log('   3. PDFs in test-pdfs/ directory\n')
  console.log('The browser will open automatically.')
  console.log('You can manually navigate and upload PDFs.')
  console.log('Screenshots will be saved for review.\n')

  const browser = await chromium.launch({ headless: false })
  const page = await browser.newPage()

  // Create screenshots dir
  const screenshotsDir = 'test-screenshots'
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir)

  try {
    // Navigate to upload page
    console.log('📋 Opening upload page...')
    await page.goto(`${APP_URL}/en/dashboard/invoices/upload-pdf`)
    await page.screenshot({ path: `${screenshotsDir}/01-page-loaded.png` })
    
    console.log('✅ Browser opened')
    console.log('📝 Please:')
    console.log('   1. Log in if required')
    console.log('   2. Upload test PDFs manually')
    console.log('   3. Review extraction results')
    console.log('   4. Check dashboard metrics')
    console.log('\n⏳ Press Ctrl+C when done testing\n')

    // Keep browser open
    await page.waitForTimeout(300000) // 5 minutes

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await browser.close()
    await prisma.$disconnect()
  }
}

main().catch(console.error)
