'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { InvoiceFilters as FilterType } from '@/types/invoice'
import { InvoiceStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { 
  Filter, 
  X, 
  Calendar as CalendarIcon, 
  ChevronDown,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface InvoiceFiltersProps {
  onFiltersChange: (filters: FilterType) => void
  className?: string
  defaultFilters?: FilterType
}

const STATUS_OPTIONS: { value: InvoiceStatus; labelEn: string; labelAr: string; color: string }[] = [
  { value: 'DRAFT', labelEn: 'Draft', labelAr: 'مسودة', color: 'bg-gray-100 text-gray-800' },
  { value: 'SENT', labelEn: 'Sent', labelAr: 'مرسلة', color: 'bg-blue-100 text-blue-800' },
  { value: 'OVERDUE', labelEn: 'Overdue', labelAr: 'متأخرة', color: 'bg-red-100 text-red-800' },
  { value: 'PAID', labelEn: 'Paid', labelAr: 'مدفوعة', color: 'bg-green-100 text-green-800' },
  { value: 'DISPUTED', labelEn: 'Disputed', labelAr: 'متنازع عليها', color: 'bg-orange-100 text-orange-800' },
  { value: 'WRITTEN_OFF', labelEn: 'Written Off', labelAr: 'شطب', color: 'bg-gray-100 text-gray-800' }
]

const CURRENCY_OPTIONS = [
  { value: 'AED', label: 'AED (UAE Dirham)' },
  { value: 'USD', label: 'USD (US Dollar)' },
  { value: 'EUR', label: 'EUR (Euro)' },
  { value: 'GBP', label: 'GBP (British Pound)' },
  { value: 'SAR', label: 'SAR (Saudi Riyal)' }
]

export function InvoiceFilters({ onFiltersChange, className, defaultFilters }: InvoiceFiltersProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [filters, setFilters] = useState<FilterType>({
    status: [],
    due_date_from: undefined,
    due_date_to: undefined,
    amount_from: undefined,
    amount_to: undefined,
    currency: undefined,
    search: '',
    page: 1,
    limit: 10,
    sort_by: 'created_at',
    sort_order: 'desc',
    ...defaultFilters
  })

  const [isOpen, setIsOpen] = useState(false)
  const [dueDateFromOpen, setDueDateFromOpen] = useState(false)
  const [dueDateToOpen, setDueDateToOpen] = useState(false)

  // Load filters from URL params on mount
  useEffect(() => {
    const urlFilters: FilterType = {
      status: searchParams.get('status')?.split(',') as InvoiceStatus[] || [],
      due_date_from: searchParams.get('due_date_from') ? new Date(searchParams.get('due_date_from')!) : undefined,
      due_date_to: searchParams.get('due_date_to') ? new Date(searchParams.get('due_date_to')!) : undefined,
      amount_from: searchParams.get('amount_from') ? parseFloat(searchParams.get('amount_from')!) : undefined,
      amount_to: searchParams.get('amount_to') ? parseFloat(searchParams.get('amount_to')!) : undefined,
      currency: searchParams.get('currency') || undefined,
      search: searchParams.get('search') || '',
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      sort_by: (searchParams.get('sort_by') as any) || 'created_at',
      sort_order: (searchParams.get('sort_order') as any) || 'desc'
    }
    
    setFilters(urlFilters)
    onFiltersChange(urlFilters)
  }, [searchParams, onFiltersChange])

  // Update URL when filters change
  const updateURL = useCallback((newFilters: FilterType) => {
    const params = new URLSearchParams()
    
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && 
          !(Array.isArray(value) && value.length === 0)) {
        if (Array.isArray(value)) {
          params.set(key, value.join(','))
        } else if (value instanceof Date) {
          params.set(key, value.toISOString().split('T')[0])
        } else {
          params.set(key, value.toString())
        }
      }
    })

    const newURL = `${pathname}?${params.toString()}`
    router.replace(newURL, { scroll: false })
  }, [pathname, router])

  const handleFilterChange = (key: keyof FilterType, value: any) => {
    const newFilters = { ...filters, [key]: value, page: 1 } // Reset page when filters change
    setFilters(newFilters)
    updateURL(newFilters)
    onFiltersChange(newFilters)
  }

  const handleStatusToggle = (status: InvoiceStatus) => {
    const currentStatuses = filters.status || []
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status]
    
    handleFilterChange('status', newStatuses)
  }

  const clearAllFilters = () => {
    const clearedFilters: FilterType = {
      status: [],
      due_date_from: undefined,
      due_date_to: undefined,
      amount_from: undefined,
      amount_to: undefined,
      currency: undefined,
      search: '',
      page: 1,
      limit: filters.limit || 10,
      sort_by: 'created_at',
      sort_order: 'desc'
    }
    
    setFilters(clearedFilters)
    updateURL(clearedFilters)
    onFiltersChange(clearedFilters)
  }

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.status && filters.status.length > 0) count++
    if (filters.due_date_from || filters.due_date_to) count++
    if (filters.amount_from || filters.amount_to) count++
    if (filters.currency) count++
    if (filters.search && filters.search.trim()) count++
    return count
  }

  const activeFiltersCount = getActiveFiltersCount()

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter Summary Bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative">
                <Filter className="h-4 w-4 mr-2" />
                {locale === 'ar' ? 'الفلاتر' : 'Filters'}
                {activeFiltersCount > 0 && (
                  <Badge className="ml-2 bg-blue-600 text-white text-xs px-1.5 py-0.5">
                    {activeFiltersCount}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align={isRTL ? 'end' : 'start'}>
              <Card className="border-0 shadow-none">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {locale === 'ar' ? 'تصفية الفواتير' : 'Filter Invoices'}
                    </CardTitle>
                    {activeFiltersCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFilters}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        {locale === 'ar' ? 'مسح الكل' : 'Clear All'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Filter */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {locale === 'ar' ? 'الحالة' : 'Status'}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((option) => (
                        <div key={option.value} className="flex items-center space-x-2 rtl:space-x-reverse">
                          <Checkbox
                            id={`status-${option.value}`}
                            checked={(filters.status || []).includes(option.value)}
                            onCheckedChange={() => handleStatusToggle(option.value)}
                          />
                          <Label
                            htmlFor={`status-${option.value}`}
                            className="text-sm cursor-pointer"
                          >
                            <Badge className={option.color} variant="outline">
                              {locale === 'ar' ? option.labelAr : option.labelEn}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {locale === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date Range'}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {locale === 'ar' ? 'من' : 'From'}
                        </Label>
                        <Popover open={dueDateFromOpen} onOpenChange={setDueDateFromOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !filters.due_date_from && "text-muted-foreground",
                                isRTL && "text-right"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {filters.due_date_from ? (
                                format(filters.due_date_from, "dd/MM/yyyy")
                              ) : (
                                <span>{locale === 'ar' ? 'اختر التاريخ' : 'Pick date'}</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={filters.due_date_from}
                              onSelect={(date) => handleFilterChange('due_date_from', date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {locale === 'ar' ? 'إلى' : 'To'}
                        </Label>
                        <Popover open={dueDateToOpen} onOpenChange={setDueDateToOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !filters.due_date_to && "text-muted-foreground",
                                isRTL && "text-right"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {filters.due_date_to ? (
                                format(filters.due_date_to, "dd/MM/yyyy")
                              ) : (
                                <span>{locale === 'ar' ? 'اختر التاريخ' : 'Pick date'}</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={filters.due_date_to}
                              onSelect={(date) => handleFilterChange('due_date_to', date)}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>

                  {/* Amount Range Filter */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {locale === 'ar' ? 'نطاق المبلغ (درهم)' : 'Amount Range (AED)'}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {locale === 'ar' ? 'الحد الأدنى' : 'Min'}
                        </Label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={filters.amount_from || ''}
                          onChange={(e) => 
                            handleFilterChange('amount_from', e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          {locale === 'ar' ? 'الحد الأقصى' : 'Max'}
                        </Label>
                        <Input
                          type="number"
                          placeholder="∞"
                          value={filters.amount_to || ''}
                          onChange={(e) => 
                            handleFilterChange('amount_to', e.target.value ? parseFloat(e.target.value) : undefined)
                          }
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Currency Filter */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">
                      {locale === 'ar' ? 'العملة' : 'Currency'}
                    </Label>
                    <Select
                      value={filters.currency || ''}
                      onValueChange={(value) => 
                        handleFilterChange('currency', value === 'all' ? undefined : value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={locale === 'ar' ? 'كل العملات' : 'All currencies'} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {locale === 'ar' ? 'كل العملات' : 'All currencies'}
                        </SelectItem>
                        {CURRENCY_OPTIONS.map((currency) => (
                          <SelectItem key={currency.value} value={currency.value}>
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">
              {locale === 'ar' ? 'الفلاتر النشطة:' : 'Active filters:'}
            </span>
            
            {(filters.status || []).map((status) => {
              const statusOption = STATUS_OPTIONS.find(opt => opt.value === status)
              return statusOption ? (
                <Badge 
                  key={status} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-red-50"
                  onClick={() => handleStatusToggle(status)}
                >
                  {locale === 'ar' ? statusOption.labelAr : statusOption.labelEn}
                  <X className="h-3 w-3 ml-1" />
                </Badge>
              ) : null
            })}
            
            {(filters.due_date_from || filters.due_date_to) && (
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-red-50"
                onClick={() => {
                  handleFilterChange('due_date_from', undefined)
                  handleFilterChange('due_date_to', undefined)
                }}
              >
                {locale === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date'}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            
            {(filters.amount_from || filters.amount_to) && (
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-red-50"
                onClick={() => {
                  handleFilterChange('amount_from', undefined)
                  handleFilterChange('amount_to', undefined)
                }}
              >
                {locale === 'ar' ? 'المبلغ' : 'Amount'}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
            
            {filters.currency && (
              <Badge 
                variant="outline" 
                className="cursor-pointer hover:bg-red-50"
                onClick={() => handleFilterChange('currency', undefined)}
              >
                {filters.currency}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  )
}