#!/usr/bin/env tsx
/**
 * Update customer email to verified SES address for testing
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function updateCustomerEmail() {
  try {
    console.log('\n📧 Updating customer email to verified SES address...\n')

    // Find the invoice we updated for testing
    const invoice = await prisma.invoices.findFirst({
      where: {
        number: 'V01250732',
        company_id: '0b5f0d5b-b46e-48c2-9d86-3170ef53c307'
      },
      include: { customers: true }
    })

    if (!invoice || !invoice.customers) {
      console.log('❌ Invoice or customer not found')
      return
    }

    console.log('Current customer email:', invoice.customers.email)

    // Update customer email to verified address
    const updated = await prisma.customers.update({
      where: { id: invoice.customers.id },
      data: { email: 'ajeibbotson@gmail.com' }
    })

    console.log('✅ Updated customer email to:', updated.email)
    console.log('✅ This email is verified in AWS SES us-east-1\n')

  } catch (error) {
    console.error('❌ Error updating customer email:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateCustomerEmail()
