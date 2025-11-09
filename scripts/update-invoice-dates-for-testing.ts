#!/usr/bin/env tsx
/**
 * Update Existing Invoices for Auto-Send Testing
 * Modifies existing unpaid invoices to have due dates in different buckets
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateInvoiceDates() {
  try {
    console.log('\n🔄 Updating invoice dates for auto-send testing...\n')

    // Get first active company with unpaid invoices
    const company = await prisma.companies.findFirst({
      where: { is_active: true },
      include: {
        invoices: {
          where: { status: { not: 'PAID' } },
          take: 5,
          orderBy: { created_at: 'desc' }
        }
      }
    })

    if (!company) {
      console.error('❌ No active company found')
      return
    }

    if (company.invoices.length === 0) {
      console.error('❌ No unpaid invoices found')
      return
    }

    console.log(`✅ Using company: ${company.name} (${company.id})`)
    console.log(`✅ Found ${company.invoices.length} unpaid invoices\n`)

    const now = new Date()

    // Update invoices to have different due dates
    const updates = [
      { daysOverdue: 2, bucket: 'overdue_1_3' },
      { daysOverdue: 5, bucket: 'overdue_4_7' },
      { daysOverdue: 10, bucket: 'overdue_8_14' },
      { daysOverdue: 20, bucket: 'overdue_15_30' },
      { daysOverdue: 35, bucket: 'overdue_30_plus' }
    ]

    for (let i = 0; i < Math.min(company.invoices.length, updates.length); i++) {
      const invoice = company.invoices[i]
      const spec = updates[i]
      const newDueDate = new Date(now.getTime() - spec.daysOverdue * 24 * 60 * 60 * 1000)

      await prisma.invoices.update({
        where: { id: invoice.id },
        data: {
          due_date: newDueDate,
          status: 'SENT' // Ensure status is SENT not PAID
        }
      })

      console.log(`✅ ${spec.bucket}: ${invoice.number}`)
      console.log(`   Old due date: ${invoice.due_date.toISOString().split('T')[0]}`)
      console.log(`   New due date: ${newDueDate.toISOString().split('T')[0]} (${spec.daysOverdue} days ago)\n`)
    }

    console.log('✅ Invoice dates updated successfully!\n')

    // Show final bucket distribution
    console.log('📊 Final bucket distribution:')
    for (const spec of updates) {
      const count = await prisma.invoices.count({
        where: {
          company_id: company.id,
          status: { not: 'PAID' },
          due_date: {
            lte: new Date(now.getTime() - (spec.daysOverdue - 1) * 24 * 60 * 60 * 1000),
            gte: spec.bucket === 'overdue_30_plus' 
              ? undefined 
              : new Date(now.getTime() - (spec.daysOverdue + 2) * 24 * 60 * 60 * 1000)
          }
        }
      })
      console.log(`   ${spec.bucket}: ${count} invoices`)
    }

  } catch (error) {
    console.error('❌ Error updating invoices:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateInvoiceDates()
