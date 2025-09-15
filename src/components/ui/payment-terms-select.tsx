'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { Check, ChevronsUpDown, Calendar, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface PaymentTermsSelectProps {
  value?: number
  onValueChange: (value: number | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
  allowCustom?: boolean
}

// Common UAE business payment terms
const COMMON_PAYMENT_TERMS = [
  { value: 0, labelKey: 'immediate' },
  { value: 7, labelKey: '7days' },
  { value: 15, labelKey: '15days' },
  { value: 30, labelKey: '30days' },
  { value: 45, labelKey: '45days' },
  { value: 60, labelKey: '60days' },
  { value: 90, labelKey: '90days' },
] as const

export function PaymentTermsSelect({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
  required = false,
  allowCustom = true
}: PaymentTermsSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [showCustomInput, setShowCustomInput] = React.useState(false)
  const [customValue, setCustomValue] = React.useState('')
  const locale = useLocale()
  const isRTL = locale === 'ar'

  const getTermLabel = (days: number) => {
    const labels = {
      immediate: { en: 'Immediate (Cash)', ar: 'فوري (نقداً)' },
      '7days': { en: '7 Days', ar: '7 أيام' },
      '15days': { en: '15 Days', ar: '15 يوم' },
      '30days': { en: '30 Days (Standard)', ar: '30 يوم (عادي)' },
      '45days': { en: '45 Days', ar: '45 يوم' },
      '60days': { en: '60 Days', ar: '60 يوم' },
      '90days': { en: '90 Days', ar: '90 يوم' },
    }

    const term = COMMON_PAYMENT_TERMS.find(t => t.value === days)
    if (term) {
      return labels[term.labelKey][locale as 'en' | 'ar'] || labels[term.labelKey].en
    }

    // Custom value
    if (days === 1) {
      return locale === 'ar' ? 'يوم واحد' : '1 Day'
    } else {
      return locale === 'ar' ? `${days} يوم` : `${days} Days`
    }
  }

  const handleCustomSubmit = () => {
    const numValue = parseInt(customValue)
    if (!isNaN(numValue) && numValue > 0 && numValue <= 365) {
      onValueChange(numValue)
      setShowCustomInput(false)
      setCustomValue('')
      setOpen(false)
    }
  }

  const selectedLabel = value !== undefined ? getTermLabel(value) : (
    placeholder || (locale === 'ar' ? 'اختر شروط الدفع' : 'Select payment terms')
  )

  const isCustomValue = value !== undefined && !COMMON_PAYMENT_TERMS.find(t => t.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "justify-between text-left font-normal",
            !value && "text-muted-foreground",
            isRTL && "text-right",
            className
          )}
          disabled={disabled}
        >
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{selectedLabel}</span>
            {isCustomValue && (
              <span className="text-xs bg-blue-100 text-blue-800 px-1 rounded">
                {locale === 'ar' ? 'مخصص' : 'Custom'}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-full p-0", isRTL && "text-right")} align={isRTL ? 'end' : 'start'}>
        <Command>
          <CommandInput 
            placeholder={locale === 'ar' ? 'البحث عن شروط الدفع...' : 'Search payment terms...'}
            className={isRTL ? 'text-right' : ''}
          />
          <CommandEmpty>
            {locale === 'ar' ? 'لم يتم العثور على نتائج.' : 'No results found.'}
          </CommandEmpty>
          
          {!showCustomInput ? (
            <>
              <CommandGroup heading={locale === 'ar' ? 'الشروط الشائعة' : 'Common Terms'}>
                {!required && (
                  <CommandItem
                    value=""
                    onSelect={() => {
                      onValueChange(undefined)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === undefined ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="text-muted-foreground">
                      {locale === 'ar' ? 'بدون تحديد' : 'Not specified'}
                    </span>
                  </CommandItem>
                )}
                {COMMON_PAYMENT_TERMS.map((term) => (
                  <CommandItem
                    key={term.value}
                    value={term.value.toString()}
                    onSelect={(currentValue) => {
                      const numValue = parseInt(currentValue)
                      onValueChange(numValue === value ? undefined : numValue)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === term.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-2">
                      {term.value === 0 ? (
                        <Clock className="h-3 w-3 text-green-500" />
                      ) : term.value === 30 ? (
                        <Calendar className="h-3 w-3 text-blue-500" />
                      ) : (
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                      )}
                      <span>{getTermLabel(term.value)}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              
              {allowCustom && (
                <CommandGroup>
                  <CommandItem onSelect={() => setShowCustomInput(true)}>
                    <div className="flex items-center gap-2 text-blue-600">
                      <Clock className="h-3 w-3" />
                      <span>
                        {locale === 'ar' ? 'إدخال قيمة مخصصة' : 'Enter custom value'}
                      </span>
                    </div>
                  </CommandItem>
                </CommandGroup>
              )}
            </>
          ) : (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="custom-payment-terms">
                  {locale === 'ar' ? 'أدخل عدد الأيام (1-365)' : 'Enter days (1-365)'}
                </Label>
                <Input
                  id="custom-payment-terms"
                  type="number"
                  min="1"
                  max="365"
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder={locale === 'ar' ? 'عدد الأيام' : 'Number of days'}
                  className={isRTL ? 'text-right' : ''}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomSubmit()
                    } else if (e.key === 'Escape') {
                      setShowCustomInput(false)
                      setCustomValue('')
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleCustomSubmit}
                  disabled={!customValue || parseInt(customValue) < 1 || parseInt(customValue) > 365}
                  className="flex-1"
                >
                  {locale === 'ar' ? 'تطبيق' : 'Apply'}
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setShowCustomInput(false)
                    setCustomValue('')
                  }}
                  className="flex-1"
                >
                  {locale === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {locale === 'ar' 
                  ? 'أدخل قيمة بين 1 و 365 يوم'
                  : 'Enter a value between 1 and 365 days'
                }
              </p>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}