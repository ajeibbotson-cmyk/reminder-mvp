import { SESClient, SendEmailCommand, SendTemplatedEmailCommand } from "@aws-sdk/client-ses";

const sesClient = new SESClient({
  region: process.env.AWS_REGION || "me-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export interface EmailOptions {
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

export interface TemplatedEmailOptions {
  to: string;
  templateName: string;
  templateData: Record<string, any>;
}

export async function sendEmail({ to, subject, htmlBody, textBody }: EmailOptions) {
  const fromEmail = process.env.AWS_SES_FROM_EMAIL;
  
  if (!fromEmail) {
    throw new Error("AWS_SES_FROM_EMAIL environment variable is not set");
  }

  const params = {
    Source: fromEmail,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: "UTF-8",
      },
      Body: {
        ...(htmlBody && {
          Html: {
            Data: htmlBody,
            Charset: "UTF-8",
          },
        }),
        ...(textBody && {
          Text: {
            Data: textBody,
            Charset: "UTF-8",
          },
        }),
      },
    },
  };

  try {
    const result = await sesClient.send(new SendEmailCommand(params));
    return {
      success: true,
      messageId: result.MessageId,
    };
  } catch (error) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function sendTemplatedEmail({ to, templateName, templateData }: TemplatedEmailOptions) {
  const fromEmail = process.env.AWS_SES_FROM_EMAIL;
  
  if (!fromEmail) {
    throw new Error("AWS_SES_FROM_EMAIL environment variable is not set");
  }

  const params = {
    Source: fromEmail,
    Destination: {
      ToAddresses: [to],
    },
    Template: templateName,
    TemplateData: JSON.stringify(templateData),
  };

  try {
    const result = await sesClient.send(new SendTemplatedEmailCommand(params));
    return {
      success: true,
      messageId: result.MessageId,
    };
  } catch (error) {
    console.error("Failed to send templated email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Helper function to format currency in AED
export function formatCurrency(amount: number, currency = "AED"): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

// Helper function to format dates for UAE locale
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-AE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(dateObj);
}

// Default email templates for follow-ups
export const DEFAULT_FOLLOW_UP_TEMPLATES = {
  polite_reminder: {
    subject: "Payment Reminder - Invoice {{invoice_number}}",
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Payment Reminder</h2>
        <p>Dear {{customer_name}},</p>
        <p>We hope this message finds you well. This is a friendly reminder that payment for Invoice #{{invoice_number}} is now due.</p>
        <div style="background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>Invoice Number:</strong> {{invoice_number}}</p>
          <p><strong>Amount Due:</strong> {{amount}}</p>
          <p><strong>Due Date:</strong> {{due_date}}</p>
        </div>
        <p>We would appreciate your prompt attention to this matter. If you have any questions or concerns, please don't hesitate to contact us.</p>
        <p>Thank you for your business.</p>
        <p>Best regards,<br>{{company_name}}</p>
      </div>
    `,
    textBody: `
Payment Reminder - Invoice {{invoice_number}}

Dear {{customer_name}},

We hope this message finds you well. This is a friendly reminder that payment for Invoice #{{invoice_number}} is now due.

Invoice Details:
- Invoice Number: {{invoice_number}}
- Amount Due: {{amount}}
- Due Date: {{due_date}}

We would appreciate your prompt attention to this matter. If you have any questions or concerns, please don't hesitate to contact us.

Thank you for your business.

Best regards,
{{company_name}}
    `,
  },
  firm_reminder: {
    subject: "Overdue Payment Notice - Invoice {{invoice_number}}",
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Overdue Payment Notice</h2>
        <p>Dear {{customer_name}},</p>
        <p>We notice that payment for Invoice #{{invoice_number}} is now overdue. We kindly request your immediate attention to settle this outstanding amount.</p>
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>Invoice Number:</strong> {{invoice_number}}</p>
          <p><strong>Amount Due:</strong> {{amount}}</p>
          <p><strong>Original Due Date:</strong> {{due_date}}</p>
          <p><strong>Status:</strong> OVERDUE</p>
        </div>
        <p>To avoid any service interruption or additional charges, please process this payment at your earliest convenience.</p>
        <p>If payment has already been made, please disregard this notice. Otherwise, we appreciate your immediate attention to this matter.</p>
        <p>Best regards,<br>{{company_name}}</p>
      </div>
    `,
    textBody: `
Overdue Payment Notice - Invoice {{invoice_number}}

Dear {{customer_name}},

We notice that payment for Invoice #{{invoice_number}} is now overdue. We kindly request your immediate attention to settle this outstanding amount.

Invoice Details:
- Invoice Number: {{invoice_number}}
- Amount Due: {{amount}}
- Original Due Date: {{due_date}}
- Status: OVERDUE

To avoid any service interruption or additional charges, please process this payment at your earliest convenience.

If payment has already been made, please disregard this notice. Otherwise, we appreciate your immediate attention to this matter.

Best regards,
{{company_name}}
    `,
  },
  final_notice: {
    subject: "Final Notice - Invoice {{invoice_number}}",
    htmlBody: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Final Payment Notice</h2>
        <p>Dear {{customer_name}},</p>
        <p>This is our final notice regarding the overdue payment for Invoice #{{invoice_number}}. Despite previous reminders, this amount remains unpaid.</p>
        <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <p><strong>Invoice Number:</strong> {{invoice_number}}</p>
          <p><strong>Amount Due:</strong> {{amount}}</p>
          <p><strong>Original Due Date:</strong> {{due_date}}</p>
          <p><strong>Status:</strong> FINAL NOTICE</p>
        </div>
        <p>We require immediate payment to avoid further action. If payment is not received within 7 days, we may need to pursue alternative collection methods.</p>
        <p>If there are any circumstances preventing payment, please contact us immediately to discuss payment arrangements.</p>
        <p>We value our business relationship and hope to resolve this matter promptly.</p>
        <p>Regards,<br>{{company_name}}</p>
      </div>
    `,
    textBody: `
Final Payment Notice - Invoice {{invoice_number}}

Dear {{customer_name}},

This is our final notice regarding the overdue payment for Invoice #{{invoice_number}}. Despite previous reminders, this amount remains unpaid.

Invoice Details:
- Invoice Number: {{invoice_number}}
- Amount Due: {{amount}}
- Original Due Date: {{due_date}}
- Status: FINAL NOTICE

We require immediate payment to avoid further action. If payment is not received within 7 days, we may need to pursue alternative collection methods.

If there are any circumstances preventing payment, please contact us immediately to discuss payment arrangements.

We value our business relationship and hope to resolve this matter promptly.

Regards,
{{company_name}}
    `,
  },
};

// Function to render email template with data
export function renderEmailTemplate(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match;
  });
}