import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function calculateDaysOverdue(dueDate: Date): number {
  const today = new Date()
  const timeDiff = today.getTime() - dueDate.getTime()
  return Math.floor(timeDiff / (1000 * 60 * 60 * 24))
}

async function checkNotDueInvoices() {
  try {
    const invoices = await prisma.invoices.findMany({
      where: {
        company_id: '9a1b69f0-89e7-4a02-8065-d7f6bd810ed8',
        status: {
          in: ['SENT', 'OVERDUE']
        },
        is_active: true
      },
      select: {
        id: true,
        number: true,
        customer_name: true,
        total_amount: true,
        due_date: true,
        status: true
      }
    })

    const notDueInvoices = invoices.filter(inv => {
      const daysOverdue = calculateDaysOverdue(new Date(inv.due_date))
      return daysOverdue >= -999 && daysOverdue <= 0
    })

    console.log(`Total invoices: ${invoices.length}`)
    console.log(`Not due invoices: ${notDueInvoices.length}`)
    console.log('\nFirst 5 not due invoices:')
    notDueInvoices.slice(0, 5).forEach(inv => {
      const daysOverdue = calculateDaysOverdue(new Date(inv.due_date))
      console.log({
        number: inv.number,
        customer: inv.customer_name,
        amount: inv.total_amount,
        dueDate: inv.due_date,
        daysOverdue,
        status: inv.status
      })
    })

    const totalAmount = notDueInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
    console.log(`\nTotal amount for not due: AED ${totalAmount}`)
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkNotDueInvoices()
