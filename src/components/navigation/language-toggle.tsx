'use client'

import { useState, useTransition } from 'react'
import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Languages, Globe } from 'lucide-react'

const languages = {
  en: {
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸'
  },
  ar: {
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇦🇪'
  }
}

export function LanguageToggle() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  
  const currentLanguage = languages[locale as keyof typeof languages]
  
  const switchLanguage = (newLocale: string) => {
    startTransition(() => {
      // Replace the locale in the current path
      const segments = pathname.split('/')
      segments[1] = newLocale // Replace locale segment
      const newPath = segments.join('/')
      
      router.replace(newPath)
      
      // Update document direction
      if (typeof document !== 'undefined') {
        document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = newLocale
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center gap-2"
          disabled={isPending}
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {currentLanguage?.flag} {currentLanguage?.nativeName}
          </span>
          <span className="sm:hidden">
            {currentLanguage?.flag}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={locale === 'ar' ? 'start' : 'end'}>
        {Object.entries(languages).map(([code, lang]) => (
          <DropdownMenuItem
            key={code}
            onClick={() => switchLanguage(code)}
            className={`flex items-center gap-2 ${
              locale === code ? 'bg-accent' : ''
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.nativeName}</span>
            {locale === code && (
              <span className="ml-auto text-xs text-muted-foreground">
                ✓
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Simple toggle button for quick switching
export function LanguageToggleButton() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  
  const toggleLanguage = () => {
    const newLocale = locale === 'en' ? 'ar' : 'en'
    
    startTransition(() => {
      const segments = pathname.split('/')
      segments[1] = newLocale
      const newPath = segments.join('/')
      
      router.replace(newPath)
      
      if (typeof document !== 'undefined') {
        document.documentElement.dir = newLocale === 'ar' ? 'rtl' : 'ltr'
        document.documentElement.lang = newLocale
      }
    })
  }
  
  const currentLang = languages[locale as keyof typeof languages]
  const nextLang = languages[locale === 'en' ? 'ar' : 'en']
  
  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={toggleLanguage}
      disabled={isPending}
      className="flex items-center gap-2"
    >
      {isPending ? (
        <>
          <Languages className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">
            {locale === 'ar' ? 'جاري التبديل...' : 'Switching...'}
          </span>
        </>
      ) : (
        <>
          <span>{nextLang.flag}</span>
          <span className="hidden sm:inline">
            {nextLang.nativeName}
          </span>
        </>
      )}
    </Button>
  )
}