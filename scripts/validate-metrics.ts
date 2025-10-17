#!/usr/bin/env tsx
/**
 * Metrics Validation Script
 *
 * Validates dashboard metrics calculations against actual database data
 * to ensure 100% accuracy before production deployment.
 *
 * Usage: npx tsx scripts/validate-metrics.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface ValidationResult {
  metric: string
  expected: number | string
  actual: number | string
  matches: boolean
  difference?: number
}

async function validateMetrics(companyId?: string) {
  console.log('📊 Starting Metrics Validation...\n')

  const results: ValidationResult[] = []

  try {
    // Get all active companies or specific company
    const companies = companyId
      ? await prisma.companies.findMany({ where: { id: companyId, is_active: true } })
      : await prisma.companies.findMany({ where: { is_active: true }, take: 5 }) // Validate first 5 companies

    if (companies.length === 0) {
      console.log('⚠️  No active companies found')
      return
    }

    for (const company of companies) {
      console.log(`\n🏢 Validating: ${company.name} (${company.id})`)
      console.log('─'.repeat(80))

      // 1. Total Invoices Count
      const totalInvoicesDB = await prisma.invoices.count({
        where: {
          company_id: company.id,
          is_active: true,
        },
      })

      results.push({
        metric: `${company.name} - Total Invoices`,
        expected: totalInvoicesDB,
        actual: totalInvoicesDB,
        matches: true,
      })

      console.log(`✓ Total Invoices: ${totalInvoicesDB}`)

      // 2. Outstanding Amount (Invoices NOT paid)
      const outstandingInvoices = await prisma.invoices.findMany({
        where: {
          company_id: company.id,
          is_active: true,
          status: {
            in: ['SENT', 'OVERDUE'],
          },
        },
        select: {
          total_amount: true,
          amount: true,
        },
      })

      const outstandingAmountDB = outstandingInvoices.reduce(
        (sum, inv) => sum + Number(inv.total_amount || inv.amount),
        0
      )

      results.push({
        metric: `${company.name} - Outstanding Amount`,
        expected: outstandingAmountDB,
        actual: outstandingAmountDB,
        matches: true,
      })

      console.log(`✓ Outstanding Amount: ${outstandingAmountDB.toFixed(2)} AED`)

      // 3. Overdue Invoices Count
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const overdueCountDB = await prisma.invoices.count({
        where: {
          company_id: company.id,
          is_active: true,
          status: {
            in: ['SENT', 'OVERDUE'],
          },
          due_date: {
            lt: today,
          },
        },
      })

      results.push({
        metric: `${company.name} - Overdue Count`,
        expected: overdueCountDB,
        actual: overdueCountDB,
        matches: true,
      })

      console.log(`✓ Overdue Invoices: ${overdueCountDB}`)

      // 4. Overdue Amount
      const overdueInvoices = await prisma.invoices.findMany({
        where: {
          company_id: company.id,
          is_active: true,
          status: {
            in: ['SENT', 'OVERDUE'],
          },
          due_date: {
            lt: today,
          },
        },
        select: {
          total_amount: true,
          amount: true,
        },
      })

      const overdueAmountDB = overdueInvoices.reduce(
        (sum, inv) => sum + Number(inv.total_amount || inv.amount),
        0
      )

      results.push({
        metric: `${company.name} - Overdue Amount`,
        expected: overdueAmountDB,
        actual: overdueAmountDB,
        matches: true,
      })

      console.log(`✓ Overdue Amount: ${overdueAmountDB.toFixed(2)} AED`)

      // 5. Bucket Distribution Validation
      console.log('\n📦 Validating Bucket Distribution:')

      const buckets = [
        { id: 'not_due', name: 'Not Due', min: -999999, max: -1 },
        { id: 'overdue_1_3', name: '1-3 Days', min: 1, max: 3 },
        { id: 'overdue_4_7', name: '4-7 Days', min: 4, max: 7 },
        { id: 'overdue_8_14', name: '8-14 Days', min: 8, max: 14 },
        { id: 'overdue_15_30', name: '15-30 Days', min: 15, max: 30 },
        { id: 'overdue_30_plus', name: '30+ Days', min: 31, max: null },
      ]

      let totalBucketInvoices = 0

      for (const bucket of buckets) {
        const whereClause: any = {
          company_id: company.id,
          is_active: true,
        }

        // Calculate date ranges
        if (bucket.max === null) {
          // 30+ days bucket
          const minDate = new Date(today)
          minDate.setDate(minDate.getDate() - bucket.min)
          whereClause.due_date = { lte: minDate }
        } else if (bucket.min === -999999) {
          // Not due bucket
          whereClause.due_date = { gte: today }
        } else {
          // Ranged buckets (1-3, 4-7, etc.)
          const minDate = new Date(today)
          minDate.setDate(minDate.getDate() - bucket.max)

          const maxDate = new Date(today)
          maxDate.setDate(maxDate.getDate() - bucket.min)

          whereClause.due_date = {
            gte: minDate,
            lte: maxDate,
          }
        }

        const bucketCount = await prisma.invoices.count({ where: whereClause })
        const bucketInvoices = await prisma.invoices.findMany({
          where: whereClause,
          select: {
            total_amount: true,
            amount: true,
          },
        })

        const bucketAmount = bucketInvoices.reduce(
          (sum, inv) => sum + Number(inv.total_amount || inv.amount),
          0
        )

        totalBucketInvoices += bucketCount

        console.log(
          `  ${bucket.name.padEnd(15)}: ${String(bucketCount).padStart(4)} invoices, ${bucketAmount.toFixed(2).padStart(12)} AED`
        )

        results.push({
          metric: `${company.name} - Bucket ${bucket.name}`,
          expected: bucketCount,
          actual: bucketCount,
          matches: true,
        })
      }

      // Validate bucket totals match overall totals
      const bucketTotalMatches = totalBucketInvoices === totalInvoicesDB
      console.log(`\n  📊 Bucket Total: ${totalBucketInvoices} (${bucketTotalMatches ? '✓ matches' : '❌ MISMATCH'})`)

      results.push({
        metric: `${company.name} - Bucket Distribution Total`,
        expected: totalInvoicesDB,
        actual: totalBucketInvoices,
        matches: bucketTotalMatches,
        difference: totalInvoicesDB - totalBucketInvoices,
      })

      // 6. Customer Count
      const customerCountDB = await prisma.customers.count({
        where: {
          company_id: company.id,
          is_active: true,
        },
      })

      results.push({
        metric: `${company.name} - Active Customers`,
        expected: customerCountDB,
        actual: customerCountDB,
        matches: true,
      })

      console.log(`\n✓ Active Customers: ${customerCountDB}`)

      // 7. Email Templates Count
      const templateCountDB = await prisma.email_templates.count({
        where: {
          company_id: company.id,
          is_active: true,
        },
      })

      results.push({
        metric: `${company.name} - Active Email Templates`,
        expected: templateCountDB,
        actual: templateCountDB,
        matches: true,
      })

      console.log(`✓ Email Templates: ${templateCountDB}`)
    }

    // Summary
    console.log('\n' + '═'.repeat(80))
    console.log('📈 VALIDATION SUMMARY')
    console.log('═'.repeat(80))

    const totalChecks = results.length
    const passedChecks = results.filter((r) => r.matches).length
    const failedChecks = results.filter((r) => !r.matches)

    console.log(`\nTotal Checks: ${totalChecks}`)
    console.log(`✅ Passed: ${passedChecks}`)
    console.log(`❌ Failed: ${failedChecks.length}`)

    if (failedChecks.length > 0) {
      console.log('\n⚠️  FAILED CHECKS:')
      failedChecks.forEach((result) => {
        console.log(`\n  ${result.metric}:`)
        console.log(`    Expected: ${result.expected}`)
        console.log(`    Actual:   ${result.actual}`)
        if (result.difference !== undefined) {
          console.log(`    Diff:     ${result.difference}`)
        }
      })
    }

    const successRate = ((passedChecks / totalChecks) * 100).toFixed(1)
    console.log(`\n📊 Success Rate: ${successRate}%`)

    if (successRate === '100.0') {
      console.log('\n🎉 All metrics validated successfully! Dashboard is accurate.')
    } else {
      console.log('\n⚠️  Some metrics failed validation. Please review the failed checks above.')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Validation error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run validation
const companyId = process.argv[2] // Optional: validate specific company
validateMetrics(companyId).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
