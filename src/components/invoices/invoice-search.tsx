'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocale } from 'next-intl'
import { InvoiceWithDetails } from '@/types/invoice'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AEDAmount, UAEDateDisplay, InvoiceStatusBadge } from '@/components/ui/uae-formatters'
import { 
  Search, 
  X, 
  Clock, 
  Building2, 
  Hash,
  Mail,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

interface InvoiceSearchProps {
  invoices: InvoiceWithDetails[]
  onSearch: (query: string) => void
  onInvoiceSelect?: (invoice: InvoiceWithDetails) => void
  placeholder?: string
  className?: string
}

interface SearchSuggestion {
  type: 'invoice' | 'customer' | 'recent'
  label: string
  sublabel?: string
  value: string
  invoice?: InvoiceWithDetails
  icon: React.ReactNode
}

const RECENT_SEARCHES_KEY = 'invoice-recent-searches'
const MAX_RECENT_SEARCHES = 5
const MAX_SUGGESTIONS = 8

export function InvoiceSearch({ 
  invoices, 
  onSearch, 
  onInvoiceSelect, 
  placeholder,
  className 
}: InvoiceSearchProps) {
  const locale = useLocale()
  const isRTL = locale === 'ar'
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Debounce search query
  const debouncedQuery = useDebounce(query, 300)
  
  useEffect(() => {
    onSearch(debouncedQuery)
  }, [debouncedQuery, onSearch])

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved))
      } catch (e) {
        console.warn('Failed to load recent searches')
      }
    }
  }, [])

  // Save recent searches to localStorage
  const saveRecentSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return
    
    const updated = [
      searchQuery.trim(),
      ...recentSearches.filter(s => s !== searchQuery.trim())
    ].slice(0, MAX_RECENT_SEARCHES)
    
    setRecentSearches(updated)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  }

  // Generate search suggestions
  const suggestions = useMemo((): SearchSuggestion[] => {
    if (!query.trim()) {
      // Show recent searches when no query
      return recentSearches.map(search => ({
        type: 'recent' as const,
        label: search,
        value: search,
        icon: <Clock className="h-4 w-4" />
      }))
    }

    const searchQuery = query.toLowerCase().trim()
    const results: SearchSuggestion[] = []
    
    // Search in invoices
    invoices.forEach(invoice => {
      const matches = []
      
      // Match invoice number
      if (invoice.number.toLowerCase().includes(searchQuery)) {
        matches.push('invoice')
      }
      
      // Match customer name
      if (invoice.customerName?.toLowerCase().includes(searchQuery)) {
        matches.push('customer')
      }
      
      // Match customer email
      if (invoice.customerEmail?.toLowerCase().includes(searchQuery)) {
        matches.push('email')
      }
      
      // Match description
      if (invoice.description?.toLowerCase().includes(searchQuery)) {
        matches.push('description')
      }

      // Match TRN
      if (invoice.trnNumber?.toLowerCase().includes(searchQuery)) {
        matches.push('trn')
      }
      
      if (matches.length > 0) {
        const primaryMatch = matches[0]
        let icon: React.ReactNode
        let sublabel: string
        
        switch (primaryMatch) {
          case 'invoice':
            icon = <Hash className="h-4 w-4" />
            sublabel = invoice.customer?.name || invoice.customerName || 'Unknown Customer'
            break
          case 'customer':
            icon = <Building2 className="h-4 w-4" />
            sublabel = invoice.number
            break
          case 'email':
            icon = <Mail className="h-4 w-4" />
            sublabel = invoice.number
            break
          case 'description':
            icon = <FileText className="h-4 w-4" />
            sublabel = invoice.number
            break
          default:
            icon = <Hash className="h-4 w-4" />
            sublabel = invoice.customer?.name || invoice.customerName || 'Unknown Customer'
        }
        
        results.push({
          type: 'invoice',
          label: primaryMatch === 'customer' ? invoice.customerName! : invoice.number,
          sublabel,
          value: invoice.number,
          invoice,
          icon
        })
      }
    })
    
    // Remove duplicates and limit results
    const uniqueResults = results.reduce((acc, current) => {
      const exists = acc.find(item => item.value === current.value)
      return exists ? acc : [...acc, current]
    }, [] as SearchSuggestion[])
    
    return uniqueResults.slice(0, MAX_SUGGESTIONS)
  }, [query, invoices, recentSearches])

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'invoice' && suggestion.invoice) {
      onInvoiceSelect?.(suggestion.invoice)
      saveRecentSearch(suggestion.label)
    } else {
      setQuery(suggestion.value)
      saveRecentSearch(suggestion.value)
    }
    setIsOpen(false)
  }

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setIsOpen(true)
  }

  // Handle input focus
  const handleInputFocus = () => {
    setIsOpen(true)
  }

  // Handle clear search
  const handleClearSearch = () => {
    setQuery('')
    setIsOpen(false)
    inputRef.current?.focus()
  }

  // Handle search submission
  const handleSearchSubmit = () => {
    if (query.trim()) {
      saveRecentSearch(query.trim())
      setIsOpen(false)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearchSubmit()
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className={cn(
          'h-4 w-4 absolute top-3 text-muted-foreground pointer-events-none',
          isRTL ? 'right-3' : 'left-3'
        )} />
        
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder || (locale === 'ar' 
            ? 'البحث في الفواتير، العملاء، المبالغ...' 
            : 'Search invoices, customers, amounts...'
          )}
          value={query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full transition-all duration-200',
            isRTL ? 'pr-10 pl-10' : 'pl-10 pr-10',
            isOpen && suggestions.length > 0 && 'rounded-b-none border-b-transparent'
          )}
          dir={isRTL ? 'rtl' : 'ltr'}
        />
        
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSearch}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100',
              isRTL ? 'left-2' : 'right-2'
            )}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Search Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <Card className={cn(
          'absolute top-full left-0 right-0 z-50 max-h-96 overflow-y-auto border-t-0 rounded-t-none shadow-lg',
          'bg-background border'
        )}>
          <div className="p-2">
            {/* Recent searches header */}
            {!query.trim() && recentSearches.length > 0 && (
              <div className={cn(
                'text-xs text-muted-foreground mb-2 px-2',
                isRTL ? 'text-right' : 'text-left'
              )}>
                {locale === 'ar' ? 'البحثات الأخيرة' : 'Recent searches'}
              </div>
            )}

            {/* Suggestions list */}
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.type}-${suggestion.value}-${index}`}
                onClick={() => handleSuggestionSelect(suggestion)}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-md hover:bg-accent cursor-pointer transition-colors',
                  isRTL ? 'text-right' : 'text-left'
                )}
              >
                <div className="text-muted-foreground flex-shrink-0">
                  {suggestion.icon}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {suggestion.label}
                  </div>
                  {suggestion.sublabel && (
                    <div className="text-xs text-muted-foreground truncate">
                      {suggestion.sublabel}
                    </div>
                  )}
                </div>
                
                {suggestion.invoice && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <InvoiceStatusBadge 
                      status={suggestion.invoice.status} 
                      locale={locale}
                    />
                    <AEDAmount 
                      amount={suggestion.invoice.amount}
                      locale={locale === 'ar' ? 'ar-AE' : 'en-AE'}
                      className="text-xs"
                    />
                  </div>
                )}
                
                {suggestion.type === 'recent' && (
                  <Badge variant="outline" className="text-xs">
                    {locale === 'ar' ? 'حديث' : 'Recent'}
                  </Badge>
                )}
              </div>
            ))}
            
            {/* No results message */}
            {query.trim() && suggestions.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {locale === 'ar' 
                    ? 'لا توجد نتائج للبحث عن "' + query + '"'
                    : 'No results found for "' + query + '"'
                  }
                </p>
                <p className="text-xs mt-1">
                  {locale === 'ar' 
                    ? 'جرب البحث برقم الفاتورة أو اسم العميل أو البريد الإلكتروني'
                    : 'Try searching by invoice number, customer name, or email'
                  }
                </p>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}