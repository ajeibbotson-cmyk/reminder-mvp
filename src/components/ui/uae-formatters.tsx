import { cn } from "@/lib/utils"

interface AEDAmountProps {
  amount: number
  className?: string
  showCurrency?: boolean
  precision?: number
  locale?: string
}

export function AEDAmount({ 
  amount, 
  className, 
  showCurrency = true, 
  precision = 2,
  locale = 'en-AE'
}: AEDAmountProps) {
  const formatted = new Intl.NumberFormat(locale, {
    style: showCurrency ? 'currency' : 'decimal',
    currency: 'AED',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(amount)

  return (
    <span className={cn("font-medium", className)}>
      {formatted}
    </span>
  )
}

interface TRNProps {
  trn: string
  className?: string
  showLabel?: boolean
  locale?: string
}

export function TRNDisplay({ 
  trn, 
  className, 
  showLabel = false,
  locale = 'en'
}: TRNProps) {
  const label = locale === 'ar' ? 'الرقم الضريبي:' : 'TRN:'
  
  return (
    <span className={cn("font-mono text-sm", className)}>
      {showLabel && <span className="text-muted-foreground mr-1">{label}</span>}
      {trn}
    </span>
  )
}

interface UAEPhoneProps {
  phone: string
  className?: string
  showCountryCode?: boolean
}

export function UAEPhoneDisplay({ 
  phone, 
  className, 
  showCountryCode = true 
}: UAEPhoneProps) {
  // Format UAE phone number
  let formattedPhone = phone.replace(/\D/g, '') // Remove non-digits
  
  if (formattedPhone.startsWith('971')) {
    // International format
    formattedPhone = formattedPhone.substring(3)
  }
  
  // Format as XX XXX XXXX
  if (formattedPhone.length === 9) {
    formattedPhone = `${formattedPhone.substring(0, 2)} ${formattedPhone.substring(2, 5)} ${formattedPhone.substring(5)}`
  }
  
  const displayPhone = showCountryCode ? `+971 ${formattedPhone}` : formattedPhone
  
  return (
    <span className={cn("", className)}>
      {displayPhone}
    </span>
  )
}

interface UAEDateProps {
  date: Date | string
  className?: string
  format?: 'short' | 'medium' | 'long'
  locale?: string
}

export function UAEDateDisplay({ 
  date, 
  className, 
  format = 'medium',
  locale = 'en-AE'
}: UAEDateProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  const options: Intl.DateTimeFormatOptions = {
    short: { day: 'numeric', month: 'short', year: 'numeric' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  }[format]
  
  const formatted = new Intl.DateTimeFormat(locale, options).format(dateObj)
  
  return (
    <span className={cn("", className)}>
      {formatted}
    </span>
  )
}

interface StatusBadgeProps {
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'DRAFT'
  className?: string
  locale?: string
}

export function InvoiceStatusBadge({ 
  status, 
  className,
  locale = 'en'
}: StatusBadgeProps) {
  const statusConfig = {
    PENDING: {
      en: 'Pending',
      ar: 'معلقة',
      className: 'bg-accent/10 text-accent-foreground border-accent/20 dark:bg-accent/20'
    },
    PAID: {
      en: 'Paid',
      ar: 'مدفوعة',
      className: 'bg-[oklch(0.55_0.15_155)]/10 text-[oklch(0.40_0.15_155)] border-[oklch(0.55_0.15_155)]/20 dark:bg-[oklch(0.55_0.15_155)]/20 dark:text-[oklch(0.65_0.15_155)]'
    },
    OVERDUE: {
      en: 'Overdue',
      ar: 'متأخرة',
      className: 'bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/20'
    },
    CANCELLED: {
      en: 'Cancelled',
      ar: 'ملغية',
      className: 'bg-muted text-muted-foreground border-border'
    },
    DRAFT: {
      en: 'Draft',
      ar: 'مسودة',
      className: 'bg-primary/10 text-primary border-primary/20 dark:bg-primary/20'
    }
  }
  
  const config = statusConfig[status]
  const text = config[locale as keyof typeof config] || config.en
  
  return (
    <span className={cn(
      "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border shadow-sm transition-all duration-200",
      config.className,
      className
    )}>
      {text}
    </span>
  )
}

interface BusinessTypeProps {
  type: string
  className?: string
  locale?: string
}

export function BusinessTypeDisplay({
  type,
  className,
  locale = 'en'
}: BusinessTypeProps) {
  const businessTypes = {
    'LLC': { en: 'LLC', ar: 'ش.ذ.م.م' },
    'FREE_ZONE': { en: 'Free Zone', ar: 'منطقة حرة' },
    'SOLE_PROPRIETORSHIP': { en: 'Sole Proprietorship', ar: 'مؤسسة فردية' },
    'PARTNERSHIP': { en: 'Partnership', ar: 'شراكة' },
    'BRANCH': { en: 'Branch', ar: 'فرع' }
  }

  const config = businessTypes[type as keyof typeof businessTypes]
  const text = config ? (config[locale as keyof typeof config] || config.en) : type

  return (
    <span className={cn("text-sm", className)}>
      {text}
    </span>
  )
}

// Export utility functions that are expected by analytics components
export function formatAEDCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

export function formatPercentage(value: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100)
}