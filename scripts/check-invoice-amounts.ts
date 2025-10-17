import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkInvoiceAmounts() {
  try {
    const invoices = await prisma.invoices.findMany({
      where: {
        company_id: '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8'
      },
      select: {
        id: true,
        number: true,
        customer_name: true,
        amount: true,
        total_amount: true,
        currency: true,
        status: true
      },
      take: 5
    })

    console.log('Sample invoices:')
    console.log(JSON.stringify(invoices, null, 2))
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkInvoiceAmounts()
