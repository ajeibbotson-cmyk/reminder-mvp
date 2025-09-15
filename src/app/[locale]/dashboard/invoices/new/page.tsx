'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from '@/components/ui/loading-spinner'

export default function NewInvoicePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to the new create page
    router.replace('/dashboard/invoices/create')
  }, [router])

  return (
    <div className="flex items-center justify-center h-96">
      <LoadingSpinner size="lg" />
      <span className="ml-3">Redirecting to invoice creation...</span>
    </div>
  )
}