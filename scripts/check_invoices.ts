import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get users with their companies and invoice counts
  const users = await prisma.user.findMany({
    include: {
      company: {
        include: {
          _count: {
            select: { invoices: true }
          }
        }
      }
    }
  });

  console.log('\n=== ACCOUNTS WITH INVOICE DATA ===\n');
  
  for (const user of users) {
    const invoiceCount = user.company._count.invoices;
    if (invoiceCount > 0) {
      console.log(`📧 Email: ${user.email}`);
      console.log(`👤 Name: ${user.name}`);
      console.log(`🏢 Company: ${user.company.name}`);
      console.log(`📄 Invoices: ${invoiceCount}`);
      console.log(`🔑 Company ID: ${user.company.id}`);
      console.log('---');
    }
  }
  
  // Also show total invoices
  const totalInvoices = await prisma.invoice.count();
  console.log(`\n📊 Total invoices in database: ${totalInvoices}\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
