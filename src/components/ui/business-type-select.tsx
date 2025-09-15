'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { Check, ChevronsUpDown, Building2 } from 'lucide-react'
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
import { UAE_BUSINESS_TYPES, UAEBusinessType } from '@/lib/validations'

interface BusinessTypeSelectProps {
  value?: UAEBusinessType
  onValueChange: (value: UAEBusinessType | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  required?: boolean
}

export function BusinessTypeSelect({
  value,
  onValueChange,
  placeholder,
  disabled = false,
  className,
  required = false
}: BusinessTypeSelectProps) {
  const [open, setOpen] = React.useState(false)
  const locale = useLocale()
  const isRTL = locale === 'ar'

  const businessTypeLabels: Record<UAEBusinessType, { en: string; ar: string }> = {
    LLC: { en: 'Limited Liability Company (LLC)', ar: 'شركة ذات مسؤولية محدودة' },
    FREE_ZONE: { en: 'Free Zone Company', ar: 'شركة منطقة حرة' },
    SOLE_PROPRIETORSHIP: { en: 'Sole Proprietorship', ar: 'مؤسسة فردية' },
    PARTNERSHIP: { en: 'Partnership', ar: 'شراكة' },
    BRANCH: { en: 'Branch Office', ar: 'مكتب فرع' }
  }

  const getLabel = (businessType: UAEBusinessType) => {
    return businessTypeLabels[businessType][locale as 'en' | 'ar'] || businessTypeLabels[businessType].en
  }

  const selectedLabel = value ? getLabel(value) : (
    placeholder || (locale === 'ar' ? 'اختر نوع النشاط' : 'Select business type')
  )

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
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{selectedLabel}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-full p-0", isRTL && "text-right")} align={isRTL ? 'end' : 'start'}>
        <Command>
          <CommandInput 
            placeholder={locale === 'ar' ? 'البحث عن نوع النشاط...' : 'Search business type...'}
            className={isRTL ? 'text-right' : ''}
          />
          <CommandEmpty>
            {locale === 'ar' ? 'لم يتم العثور على نتائج.' : 'No results found.'}
          </CommandEmpty>
          <CommandGroup>
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
                    !value ? "opacity-100" : "opacity-0"
                  )}
                />
                <span className="text-muted-foreground">
                  {locale === 'ar' ? 'بدون تحديد' : 'Not specified'}
                </span>
              </CommandItem>
            )}
            {UAE_BUSINESS_TYPES.map((businessType) => (
              <CommandItem
                key={businessType}
                value={businessType}
                onSelect={(currentValue) => {
                  onValueChange(currentValue === value ? undefined : currentValue as UAEBusinessType)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === businessType ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{getLabel(businessType)}</span>
                  {locale === 'en' && businessTypeLabels[businessType].ar && (
                    <span className="text-xs text-muted-foreground">
                      {businessTypeLabels[businessType].ar}
                    </span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}