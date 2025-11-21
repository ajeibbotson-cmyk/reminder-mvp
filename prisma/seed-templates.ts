import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

const templates = [
  {
    name: 'Gentle Reminder (English)',
    description: 'Polite first reminder for invoices 1-3 days overdue',
    template_type: 'INVOICE_REMINDER' as const,
    subject_en: 'Friendly Payment Reminder - Invoice {invoice_number}',
    subject_ar: null,
    content_en: `Dear {customer_name},

We hope this message finds you well.

This is a friendly reminder that Invoice {invoice_number} for {invoice_amount} AED was due on {due_date}. We understand that oversights happen, and we wanted to bring this to your attention.

Invoice Details:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_amount} AED
- Original Due Date: {due_date}
- Days Overdue: {days_overdue}

If you have already processed this payment, please disregard this message. Otherwise, we would greatly appreciate your prompt attention to this matter.

Should you have any questions or require clarification regarding this invoice, please don't hesitate to reach out to us.

Thank you for your continued business partnership.

Best regards,
{company_name}

---
This is an automated reminder. Please do not reply to this email.`,
    content_ar: null,
    variables: {
      customer_name: 'Customer name',
      invoice_number: 'Invoice number',
      invoice_amount: 'Invoice total amount',
      due_date: 'Original due date',
      days_overdue: 'Number of days overdue',
      company_name: 'Your company name',
    },
    supports_consolidation: false,
    max_invoice_count: 1,
    is_default: true,
  },
  {
    name: 'Firm Reminder (English)',
    description: 'More assertive reminder for invoices 4-7 days overdue',
    template_type: 'INVOICE_REMINDER' as const,
    subject_en: 'Payment Required - Invoice {invoice_number} Now {days_overdue} Days Overdue',
    subject_ar: null,
    content_en: `Dear {customer_name},

We are writing regarding Invoice {invoice_number} for {invoice_amount} AED, which is now {days_overdue} days overdue.

Invoice Summary:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_amount} AED
- Original Due Date: {due_date}
- Days Overdue: {days_overdue}

We understand that payment delays can occur for various reasons. However, we kindly request your immediate attention to settle this outstanding amount.

If payment has been sent, please provide us with the transaction details for our records. If there are any issues or concerns preventing payment, we encourage you to contact us immediately so we can work together to resolve them.

Prompt payment helps us maintain the quality service you've come to expect from {company_name}.

We appreciate your cooperation and look forward to your response.

Best regards,
{company_name}

---
This is an automated reminder. Please do not reply to this email.`,
    content_ar: null,
    variables: {
      customer_name: 'Customer name',
      invoice_number: 'Invoice number',
      invoice_amount: 'Invoice total amount',
      due_date: 'Original due date',
      days_overdue: 'Number of days overdue',
      company_name: 'Your company name',
    },
    supports_consolidation: false,
    max_invoice_count: 1,
    is_default: false,
  },
  {
    name: 'Final Notice (English)',
    description: 'Urgent final notice for invoices 15+ days overdue',
    template_type: 'OVERDUE_NOTICE' as const,
    subject_en: 'FINAL NOTICE - Invoice {invoice_number} Seriously Overdue',
    subject_ar: null,
    content_en: `Dear {customer_name},

This is a FINAL NOTICE regarding Invoice {invoice_number}.

URGENT PAYMENT REQUIRED:
- Invoice Number: {invoice_number}
- Amount Due: {invoice_amount} AED
- Original Due Date: {due_date}
- Days Overdue: {days_overdue}

Despite our previous reminders, this invoice remains unpaid. We must receive payment within the next 7 business days to avoid further action.

If payment is not received, we will be forced to:
1. Suspend services until account is settled
2. Apply late payment charges as per our terms
3. Escalate this matter to our collections department
4. Report the outstanding debt to credit agencies

If you have already made this payment, please send us the payment confirmation immediately.

If you are experiencing financial difficulties, please contact us urgently to discuss payment arrangements. We are willing to work with you to find a solution.

This matter requires your immediate attention.

{company_name}
Finance Department

---
This is an automated final notice. Immediate action required.`,
    content_ar: null,
    variables: {
      customer_name: 'Customer name',
      invoice_number: 'Invoice number',
      invoice_amount: 'Invoice total amount',
      due_date: 'Original due date',
      days_overdue: 'Number of days overdue',
      company_name: 'Your company name',
    },
    supports_consolidation: false,
    max_invoice_count: 1,
    is_default: false,
  },
  {
    name: 'UAE Respectful Reminder (English)',
    description: 'Culturally appropriate reminder for UAE business context',
    template_type: 'INVOICE_REMINDER' as const,
    subject_en: 'Payment Reminder - Invoice {invoice_number}',
    subject_ar: null,
    content_en: `Dear Valued Partner {customer_name},

السلام عليكم ورحمة الله وبركاته (Peace be upon you)

We hope this message finds you in good health and prosperity.

We are reaching out regarding Invoice {invoice_number} for {invoice_amount} AED, which was due on {due_date}.

Invoice Details:
- Invoice Number: {invoice_number}
- Amount: {invoice_amount} AED
- Due Date: {due_date}
- Days Outstanding: {days_overdue}

We greatly value our business relationship and understand that timing differences can occur in the natural course of business. We would be grateful if you could kindly arrange for payment at your earliest convenience.

If payment has already been processed, we apologize for this reminder and thank you for your promptness. Should you require any clarification or have any concerns, please feel free to contact us. We are here to assist you.

Thank you for your continued trust in {company_name}. We look forward to serving you for many years to come, إن شاء الله (God willing).

With warm regards and best wishes,
{company_name}

---
This reminder respects UAE business hours (Sunday-Thursday, 9 AM - 6 PM GST)`,
    content_ar: null,
    variables: {
      customer_name: 'Customer name',
      invoice_number: 'Invoice number',
      invoice_amount: 'Invoice total amount',
      due_date: 'Original due date',
      days_overdue: 'Number of days overdue',
      company_name: 'Your company name',
    },
    supports_consolidation: false,
    max_invoice_count: 1,
    is_default: false,
  },
  {
    name: 'Gentle Reminder (Arabic)',
    description: 'تذكير لطيف للفواتير المتأخرة من يوم إلى ثلاثة أيام',
    template_type: 'INVOICE_REMINDER' as const,
    subject_en: 'Payment Reminder - Invoice {invoice_number}',
    subject_ar: 'تذكير بالدفع - فاتورة {invoice_number}',
    content_en: `Dear {customer_name},

This is a friendly payment reminder for Invoice {invoice_number} amounting to {invoice_amount} AED, which was due on {due_date}.

If you have any questions, please contact us.

Best regards,
{company_name}`,
    content_ar: `عزيزي {customer_name}،

نأمل أن تكون بخير.

هذا تذكير ودي بأن الفاتورة {invoice_number} بمبلغ {invoice_amount} درهم إماراتي كان موعد استحقاقها في {due_date}. نتفهم أن الأخطاء تحدث، وأردنا لفت انتباهكم إلى هذا الأمر.

تفاصيل الفاتورة:
- رقم الفاتورة: {invoice_number}
- المبلغ المستحق: {invoice_amount} درهم
- تاريخ الاستحقاق الأصلي: {due_date}
- عدد الأيام المتأخرة: {days_overdue}

إذا كنت قد عالجت هذا الدفع بالفعل، يرجى تجاهل هذه الرسالة. وإلا، سنكون ممتنين جداً لاهتمامك السريع بهذا الأمر.

في حال وجود أي استفسارات أو الحاجة إلى توضيح بشأن هذه الفاتورة، يرجى عدم التردد في التواصل معنا.

نشكركم على شراكتكم التجارية المستمرة.

مع أطيب التحيات،
{company_name}

---
هذا تذكير تلقائي. يرجى عدم الرد على هذا البريد الإلكتروني.`,
    variables: {
      customer_name: 'اسم العميل / Customer name',
      invoice_number: 'رقم الفاتورة / Invoice number',
      invoice_amount: 'مبلغ الفاتورة / Invoice amount',
      due_date: 'تاريخ الاستحقاق / Due date',
      days_overdue: 'عدد الأيام المتأخرة / Days overdue',
      company_name: 'اسم شركتك / Your company name',
    },
    supports_consolidation: false,
    max_invoice_count: 1,
    is_default: false,
  },
]

async function seedTemplates() {
  console.log('🌱 Starting template seeding...')

  try {
    // Get all companies
    const companies = await prisma.company.findMany({
      where: {
        is_active: true,
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (companies.length === 0) {
      console.log('⚠️  No active companies found. Please create a company first.')
      return
    }

    console.log(`📊 Found ${companies.length} active companies`)

    let totalCreated = 0
    let totalSkipped = 0

    for (const company of companies) {
      console.log(`\n🏢 Processing company: ${company.name} (${company.id})`)

      // Get any user from this company to use as created_by
      const companyUser = await prisma.user.findFirst({
        where: {
          company_id: company.id,
        },
        select: {
          id: true,
        },
      })

      if (!companyUser) {
        console.log(`  ⚠️  No users found for company ${company.name}, skipping...`)
        continue
      }

      for (const template of templates) {
        // Check if template already exists
        const existing = await prisma.emailTemplate.findFirst({
          where: {
            company_id: company.id,
            name: template.name,
          },
        })

        if (existing) {
          console.log(`  ⏭️  Template "${template.name}" already exists, skipping...`)
          totalSkipped++
          continue
        }

        // Create template
        await prisma.emailTemplate.create({
          data: {
            id: randomUUID(),
            company_id: company.id,
            created_by: companyUser.id,
            name: template.name,
            description: template.description,
            template_type: template.template_type,
            subject_en: template.subject_en,
            subject_ar: template.subject_ar,
            content_en: template.content_en,
            content_ar: template.content_ar,
            variables: template.variables,
            is_active: true,
            is_default: template.is_default,
            supports_consolidation: template.supports_consolidation,
            max_invoice_count: template.max_invoice_count,
            uae_business_hours_only: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        })

        console.log(`  ✅ Created template: "${template.name}"`)
        totalCreated++
      }
    }

    console.log(`\n✨ Seeding complete!`)
    console.log(`📈 Summary:`)
    console.log(`   - Templates created: ${totalCreated}`)
    console.log(`   - Templates skipped: ${totalSkipped}`)
    console.log(`   - Companies processed: ${companies.length}`)
  } catch (error) {
    console.error('❌ Error seeding templates:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedTemplates()
  .then(() => {
    console.log('\n🎉 Template seeding finished successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Template seeding failed:', error)
    process.exit(1)
  })
