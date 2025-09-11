# CLAUDE.md - Internationalization

This file provides guidance for working with UAEPay multilingual content and cultural localization.

## Message Structure

### File Organization
- **`en.json`** - English (primary language)
- **`ar.json`** - Arabic with cultural adaptations

### Hierarchical Organization
```json
{
  "auth": {
    "signIn": "Sign In",
    "signUp": "Sign Up"
  },
  "navigation": {
    "dashboard": "Dashboard",
    "invoices": "Invoices"
  },
  "dashboard": {
    "title": "Dashboard",
    "totalOutstanding": "Total Outstanding"
  },
  "invoices": {
    "title": "Invoices",
    "status": "Status"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel"
  }
}
```

## Translation Guidelines

### English (en.json)
- **Tone**: Professional, friendly, direct
- **Business Focus**: SME-appropriate language
- **Technical Terms**: Clear, non-jargon explanations
- **Currency**: "AED" terminology throughout

### Arabic (ar.json)
- **Tone**: Respectful, professional (formal Arabic)
- **Cultural Sensitivity**: UAE business customs
- **RTL Support**: Text flows right-to-left
- **Numbers**: Use Arabic-Indic numerals where appropriate

## Usage Patterns

### Component Integration
```typescript
import { useTranslations } from 'next-intl'

export default function Component() {
  const t = useTranslations('dashboard')
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('totalOutstanding')}</p>
    </div>
  )
}
```

### Server Components
```typescript
import { getTranslations } from 'next-intl/server'

export default async function ServerComponent() {
  const t = await getTranslations('invoices')
  
  return <h1>{t('title')}</h1>
}
```

### Parameterized Messages
```json
{
  "invoices": {
    "paymentDue": "Payment of {amount} is due on {date}",
    "overdueBy": "This invoice is overdue by {days} days"
  }
}
```

```typescript
t('invoices.paymentDue', {
  amount: formatCurrency(invoice.amount),
  date: formatDate(invoice.dueDate)
})
```

## UAE Cultural Considerations

### Business Communication
- **Respectful Language**: Formal, courteous tone
- **Patience**: Avoid aggressive collection language
- **Relationship Focus**: Emphasize business partnership
- **Islamic Principles**: Honor trust-based commerce

### Arabic Translation Principles

#### Formal vs Informal
```json
// Use formal Arabic (فصحى) for business context
{
  "auth": {
    "signIn": "تسجيل الدخول", // Formal
    "welcome": "مرحباً بكم" // Formal welcome
  }
}
```

#### Currency and Numbers
```json
{
  "dashboard": {
    "totalOutstanding": "إجمالي المبالغ المستحقة",
    "currency": "درهم إماراتي" // UAE Dirham in Arabic
  }
}
```

#### Date and Time
```json
{
  "common": {
    "dueDate": "تاريخ الاستحقاق",
    "businessHours": "ساعات العمل: الأحد - الخميس"
  }
}
```

### Follow-up Email Tone

#### English - Professional but Friendly
```json
{
  "followUp": {
    "subject1": "Friendly Payment Reminder",
    "greeting": "Dear {customerName}",
    "body1": "We hope this message finds you well. This is a gentle reminder that invoice #{invoiceNumber} for {amount} was due on {dueDate}."
  }
}
```

#### Arabic - Respectful and Patient
```json
{
  "followUp": {
    "subject1": "تذكير ودي بالدفع",
    "greeting": "عزيزي {customerName}",
    "body1": "نأمل أن تكونوا في أتم الصحة والعافية. هذا تذكير ودي بأن الفاتورة رقم #{invoiceNumber} بمبلغ {amount} كان موعد استحقاقها في {dueDate}."
  }
}
```

## Message Categories

### Authentication (`auth`)
User registration, login, password management
- Clear instructions for account creation
- Error messages for validation failures
- Success confirmations

### Navigation (`navigation`)
Menu items, breadcrumbs, page titles
- Consistent terminology across pages
- Clear hierarchy indication
- Accessible navigation labels

### Dashboard (`dashboard`)  
KPIs, metrics, quick actions
- Financial terminology (AED, outstanding, overdue)
- Action-oriented button labels
- Status descriptions

### Invoices (`invoices`)
Invoice management, status, actions
- Business document terminology
- Status labels (Draft, Sent, Paid, Overdue)
- Action buttons (Import, Export, Send)

### Common (`common`)
Buttons, notifications, shared elements
- Standard actions (Save, Cancel, Delete)
- Success/error messages
- Loading states

## RTL (Right-to-Left) Support

### Layout Considerations
```css
/* Arabic text direction */
[dir="rtl"] {
  text-align: right;
  direction: rtl;
}

/* Logical properties for RTL */
.element {
  margin-inline-start: 1rem; /* Instead of margin-left */
  padding-inline-end: 2rem;  /* Instead of padding-right */
}
```

### Number Formatting
```typescript
// Arabic number formatting
const formatter = new Intl.NumberFormat('ar-AE', {
  style: 'currency',
  currency: 'AED'
})
```

## Email Template Integration

### Template Structure
```json
{
  "emailTemplates": {
    "paymentReminder1": {
      "subject": "Payment Reminder - Invoice #{invoiceNumber}",
      "greeting": "Dear {customerName},",
      "body": "This is a friendly reminder...",
      "closing": "Best regards,\n{companyName}"
    }
  }
}
```

### Cultural Email Adaptations

#### English Email Template
- Direct but polite approach
- Business-focused language
- Clear call-to-action

#### Arabic Email Template  
- Extended greetings and well-wishes
- More formal language structure
- Emphasis on business relationship

## Adding New Messages

### Process
1. Add to English file first (`en.json`)
2. Create Arabic translation (`ar.json`) 
3. Consider cultural context
4. Test with RTL layout
5. Validate with native speakers

### Key Naming Convention
```json
// Use descriptive, hierarchical keys
{
  "section": {
    "subsection": {
      "specificAction": "Message text"
    }
  }
}

// Examples:
"invoices.actions.markAsPaid"
"dashboard.metrics.totalOutstanding" 
"followUp.templates.gentleReminder"
```

## Validation and Quality

### Translation Checklist
- [ ] Consistent terminology across sections
- [ ] Appropriate formality level
- [ ] Cultural sensitivity maintained
- [ ] Numbers and currency formatted correctly
- [ ] RTL layout compatibility
- [ ] No truncation in UI components

### Testing Approach
- Test with actual Arabic speakers
- Verify layout in both languages
- Check email template rendering
- Validate currency/date formatting
- Review cultural appropriateness

## Future Localization

### Additional Languages (Planned)
- **Hindi** - Large expat community in UAE
- **Urdu** - Common business language
- **French** - International business

### Dynamic Content
```json
{
  "invoices": {
    "statusText": {
      "DRAFT": "Draft",
      "SENT": "Sent", 
      "OVERDUE": "Overdue",
      "PAID": "Paid"
    }
  }
}
```

### Regional Variations
```json
// UAE-specific terms vs general Arabic
{
  "business": {
    "tradeLicense": "رخصة تجارية", // UAE term
    "trn": "رقم الهوية الضريبية"    // UAE TRN
  }
}
```

## Performance Considerations

- Keep message files reasonably sized
- Consider lazy loading for less common sections
- Use namespacing to avoid key conflicts
- Implement fallback to English for missing keys