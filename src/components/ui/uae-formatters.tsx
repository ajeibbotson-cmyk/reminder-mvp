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
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    },
    PAID: {
      en: 'Paid',
      ar: 'مدفوعة',
      className: 'bg-green-100 text-green-800 border-green-200'
    },
    OVERDUE: {
      en: 'Overdue',
      ar: 'متأخرة',
      className: 'bg-red-100 text-red-800 border-red-200'
    },
    CANCELLED: {
      en: 'Cancelled',
      ar: 'ملغية',
      className: 'bg-gray-100 text-gray-800 border-gray-200'
    },
    DRAFT: {
      en: 'Draft',
      ar: 'مسودة',
      className: 'bg-blue-100 text-blue-800 border-blue-200'
    }
  }
  
  const config = statusConfig[status]
  const text = config[locale as keyof typeof config] || config.en
  
  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
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