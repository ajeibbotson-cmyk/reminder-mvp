'use client'

import * as React from 'react'
import { useLocale } from 'next-intl'
import { Badge, CheckCircle2, AlertCircle, Hash } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { validateUAETRN } from '@/lib/validations'

interface TRNInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string
  onChange: (value: string) => void
  showValidation?: boolean
  required?: boolean
  className?: string
}

export function TRNInput({
  value = '',
  onChange,
  showValidation = true,
  required = false,
  className,
  placeholder,
  disabled = false,
  ...props
}: TRNInputProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  
  const [isFocused, setIsFocused] = React.useState(false)
  const [hasBeenBlurred, setHasBeenBlurred] = React.useState(false)

  // Format TRN input - only allow digits and limit to 15 characters
  const formatTRN = (input: string) => {
    // Remove all non-digit characters
    const digitsOnly = input.replace(/\D/g, '')
    // Limit to 15 digits
    return digitsOnly.slice(0, 15)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatTRN(e.target.value)
    onChange(formatted)
  }

  const handleFocus = () => {
    setIsFocused(true)
  }

  const handleBlur = () => {
    setIsFocused(false)
    setHasBeenBlurred(true)
  }

  // Validation state
  const isValid = value.length === 0 || validateUAETRN(value)
  const showError = hasBeenBlurred && !isFocused && value.length > 0 && !isValid
  const showSuccess = hasBeenBlurred && !isFocused && value.length > 0 && isValid
  const isIncomplete = hasBeenBlurred && !isFocused && value.length > 0 && value.length < 15

  const getPlaceholder = () => {
    if (placeholder) return placeholder
    return locale === 'ar' ? 'أدخل الرقم الضريبي (15 رقم)' : 'Enter TRN (15 digits)'
  }

  const getValidationMessage = () => {
    if (!showValidation || (!hasBeenBlurred && !showError)) return null
    
    if (value.length === 0 && required) {
      return locale === 'ar' ? 'الرقم الضريبي مطلوب' : 'TRN is required'
    }
    
    if (isIncomplete) {
      return locale === 'ar' 
        ? `الرقم الضريبي يجب أن يكون 15 رقم (${value.length}/15)`
        : `TRN must be 15 digits (${value.length}/15)`
    }
    
    if (showError) {
      return locale === 'ar' ? 'تنسيق الرقم الضريبي غير صحيح' : 'Invalid TRN format'
    }
    
    return null
  }

  const validationMessage = getValidationMessage()

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="absolute left-3 top-3 h-4 w-4 text-muted-foreground">
          <Hash className="h-4 w-4" />
        </div>
        <Input
          {...props}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={getPlaceholder()}
          disabled={disabled}
          className={cn(
            'pl-10 pr-10 font-mono tracking-wider',
            showError && 'border-red-500 focus-visible:ring-red-500',
            showSuccess && 'border-green-500 focus-visible:ring-green-500',
            isRTL && 'text-right',
            className
          )}
          maxLength={15}
        />
        {showValidation && value.length > 0 && (
          <div className="absolute right-3 top-3 h-4 w-4">
            {showSuccess && <CheckCircle2 className="h-4 w-4 text-green-500" />}
            {showError && <AlertCircle className="h-4 w-4 text-red-500" />}
            {isIncomplete && !showError && (
              <div className="h-4 w-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-yellow-500" />
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Character counter and validation message */}
      <div className="flex justify-between items-center text-xs">
        <div>
          {validationMessage && (
            <span className={cn(
              'flex items-center gap-1',
              showError ? 'text-red-600' : 'text-yellow-600'
            )}>
              {showError ? (
                <AlertCircle className="h-3 w-3" />
              ) : (
                <div className="h-3 w-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                </div>
              )}
              {validationMessage}
            </span>
          )}
        </div>
        
        {value.length > 0 && (
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-muted-foreground',
              value.length === 15 ? 'text-green-600' : 'text-yellow-600'
            )}>
              {value.length}/15
            </span>
            {value.length === 15 && (
              <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                {locale === 'ar' ? 'صالح' : 'Valid'}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {/* Helper text */}
      {!hasBeenBlurred && !value && (
        <p className="text-xs text-muted-foreground">
          {locale === 'ar' 
            ? 'الرقم الضريبي يجب أن يكون مكون من 15 رقم بالضبط'
            : 'Tax Registration Number must be exactly 15 digits'
          }
        </p>
      )}
    </div>
  )
}