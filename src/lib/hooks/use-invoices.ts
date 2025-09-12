'use client'

import { useCallback, useEffect } from 'react'
import { useInvoiceStore } from '@/lib/stores'
import { InvoiceFilters } from '@/lib/types/store'

export function useInvoices(companyId: string, filters?: InvoiceFilters) {
  const {
    invoices,
    loading,
    error,
    totalCount,
    fetchInvoices,
    clearError
  } = useInvoiceStore()

  const loadInvoices = useCallback(async () => {
    if (!companyId) return
    
    try {
      await fetchInvoices(companyId, filters)
    } catch (error) {
      console.error('Failed to load invoices:', error)
    }
  }, [companyId, filters, fetchInvoices])

  useEffect(() => {
    loadInvoices()
  }, [loadInvoices])

  return {
    invoices,
    loading,
    error,
    totalCount,
    refetch: loadInvoices,
    clearError
  }
}

export function useInvoiceActions() {
  const {
    addInvoice,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
    getInvoiceById
  } = useInvoiceStore()

  return {
    addInvoice,
    updateInvoice,
    updateInvoiceStatus,
    deleteInvoice,
    getInvoiceById
  }
}