'use client'

import { useCallback, useEffect } from 'react'
import { useCustomerStore } from '@/lib/stores'

export function useCustomers(companyId: string) {
  const {
    customers,
    loading,
    error,
    totalCount,
    fetchCustomers,
    clearError
  } = useCustomerStore()

  const loadCustomers = useCallback(async () => {
    if (!companyId) return
    
    try {
      await fetchCustomers(companyId)
    } catch (error) {
      console.error('Failed to load customers:', error)
    }
  }, [companyId, fetchCustomers])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  return {
    customers,
    loading,
    error,
    totalCount,
    refetch: loadCustomers,
    clearError
  }
}

export function useCustomerActions() {
  const {
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerById,
    getCustomerByEmail
  } = useCustomerStore()

  return {
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerById,
    getCustomerByEmail
  }
}