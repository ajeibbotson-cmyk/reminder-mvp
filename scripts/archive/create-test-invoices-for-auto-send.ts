#!/usr/bin/env tsx
/**
 * Create Test Invoices for Auto-Send Testing
 * Creates invoices with specific due dates to test each bucket
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestInvoices() {
  try {
    console.log('\n🌱 Creating test invoices for auto-send testing...\n')

    // Get first active company
    const company = await prisma.companies.findFirst({
      where: { is_active: true }
    })

    if (!company) {
      console.error('❌ No active company found')
      return
    }

    console.log(`✅ Using company: ${company.name} (${company.id})\n`)

    // Get or create a test customer
    let customer = await prisma.customers.findFirst({
      where: { company_id: company.id }
    })

    if (!customer) {
      customer = await prisma.customers.create({
        data: {
          company_id: company.id,
          name: 'Test Customer for Auto-Send',
          email: 'test-autosend@example.com',
          payment_terms: 30,
          is_active: true
        }
      })
      console.log(`✅ Created test customer: ${customer.name}`)
    } else {
      console.log(`✅ Using existing customer: ${customer.name}`)
    }

    const now = new Date()

    // Create invoices for different buckets
    const testInvoices = [
      {
        bucket: 'overdue_1_3',
        daysOverdue: 2,
        amount: 1000
      },
      {
        bucket: 'overdue_4_7',
        daysOverdue: 5,
        amount: 2000
      },
      {
        bucket: 'overdue_8_14',
        daysOverdue: 10,
        amount: 3000
      }
    ]

    console.log('\n📝 Creating invoices:\n')

    for (const spec of testInvoices) {
      const dueDate = new Date(now.getTime() - spec.daysOverdue * 24 * 60 * 60 * 1000)

      const invoice = await prisma.invoices.create({
        data: {
          company_id: company.id,
          customer_id: customer.id,
          invoice_number: `TEST-AUTO-${Date.now()}-${spec.daysOverdue}`,
          invoice_date: new Date(dueDate.getTime() - 30 * 24 * 60 * 60 * 1000),
          due_date: dueDate,
          total_amount: spec.amount,
          amount_paid: 0,
          balance_due: spec.amount,
          status: 'SENT',
          currency: 'AED'
        }
      })

      console.log(`✅ ${spec.bucket}: Invoice ${invoice.invoice_number}`)
      console.log(`   Due: ${dueDate.toISOString().split('T')[0]} (${spec.daysOverdue} days ago)`)
      console.log(`   Amount: AED ${spec.amount}\n`)
    }

    console.log('✅ Test invoices created successfully!\n')

  } catch (error) {
    console.error('❌ Error creating test invoices:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestInvoices()
