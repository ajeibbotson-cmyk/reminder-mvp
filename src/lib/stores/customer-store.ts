import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Customer } from '@prisma/client'
import { CustomerState, CustomerWithInvoices, ApiResponse } from '../types/store'
import { getLocalizedMessage } from '../uae-error-messages'

export const useCustomerStore = create<CustomerState>()(
  devtools(
    (set, get) => ({
      customers: [],
      loading: false,
      error: null,
      totalCount: 0,
      searchResults: [],
      analytics: null,
      filters: {
        page: 1,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'asc',
        isActive: true
      },

      fetchCustomers: async (companyId: string, filters?: any) => {
        set({ loading: true, error: null })
        
        try {
          const currentFilters = filters || get().filters
          const queryParams = new URLSearchParams({
            companyId,
            ...currentFilters,
            page: currentFilters.page?.toString() || '1',
            limit: currentFilters.limit?.toString() || '20'
          })
          
          const response = await fetch(`/api/customers?${queryParams}`)
          
          if (!response.ok) {
            throw new Error(getLocalizedMessage('SYSTEM_OVERLOAD'))
          }

          const result: ApiResponse<{ 
            customers: CustomerWithInvoices[], 
            totalCount: number,
            currentPage: number,
            totalPages: number,
            responseTime: number
          }> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || getLocalizedMessage('QUERY_TIMEOUT'))
          }

          set({ 
            customers: result.data?.customers || [], 
            totalCount: result.data?.totalCount || 0,
            filters: { ...currentFilters, page: result.data?.currentPage || 1 },
            loading: false 
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : getLocalizedMessage('SYSTEM_OVERLOAD')
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      addCustomer: async (customerData) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/customers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(customerData),
          })

          if (!response.ok) {
            throw new Error(`Failed to create customer: ${response.statusText}`)
          }

          const result: ApiResponse<Customer> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to create customer')
          }

          const newCustomer = result.data!
          
          // Add the new customer to local state
          set(state => ({
            customers: [...state.customers, { ...newCustomer, invoices: [] }],
            totalCount: state.totalCount + 1,
            loading: false
          }))

          return newCustomer
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      updateCustomer: async (id: string, updates) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/customers/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          })

          if (!response.ok) {
            throw new Error(`Failed to update customer: ${response.statusText}`)
          }

          const result: ApiResponse<Customer> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to update customer')
          }

          // Update the customer in local state
          set(state => ({
            customers: state.customers.map(customer =>
              customer.id === id ? { ...customer, ...updates } : customer
            ),
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      deleteCustomer: async (id: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/customers/${id}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            throw new Error(`Failed to delete customer: ${response.statusText}`)
          }

          const result: ApiResponse<void> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to delete customer')
          }

          // Remove the customer from local state
          set(state => ({
            customers: state.customers.filter(customer => customer.id !== id),
            totalCount: state.totalCount - 1,
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      getCustomerById: (id: string) => {
        const { customers } = get()
        return customers.find(customer => customer.id === id) || null
      },

      getCustomerByEmail: (email: string) => {
        const { customers } = get()
        return customers.find(customer => customer.email === email) || null
      },

      // Advanced search functionality
      searchCustomers: async (companyId: string, searchQuery: string, options?: any) => {
        set({ loading: true, error: null })
        
        try {
          const queryParams = new URLSearchParams({
            companyId,
            q: searchQuery,
            searchType: options?.searchType || 'fuzzy',
            fields: options?.fields?.join(',') || 'name,email',
            limit: options?.limit?.toString() || '20'
          })
          
          const response = await fetch(`/api/customers/search?${queryParams}`, {
            method: 'POST'
          })
          
          if (!response.ok) {
            throw new Error(getLocalizedMessage('SEARCH_QUERY_TOO_SHORT'))
          }

          const result: ApiResponse<{ 
            customers: any[], 
            totalResults: number,
            searchTerm: string,
            responseTime: number
          }> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || getLocalizedMessage('QUERY_TIMEOUT'))
          }

          set({ 
            searchResults: result.data?.customers || [],
            loading: false 
          })
          
          return result.data
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : getLocalizedMessage('SYSTEM_OVERLOAD')
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      // Fetch customer analytics
      fetchAnalytics: async (companyId: string, options?: any) => {
        set({ loading: true, error: null })
        
        try {
          const queryParams = new URLSearchParams({
            companyId,
            ...(options || {})
          })
          
          const response = await fetch(`/api/customers/analytics?${queryParams}`)
          
          if (!response.ok) {
            throw new Error(getLocalizedMessage('QUERY_TIMEOUT'))
          }

          const result: ApiResponse<any> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || getLocalizedMessage('QUERY_TIMEOUT'))
          }

          set({ 
            analytics: result.data,
            loading: false 
          })
          
          return result.data
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : getLocalizedMessage('SYSTEM_OVERLOAD')
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      // Bulk operations
      performBulkOperation: async (action: string, customerIds: string[], companyId: string, options?: any) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/customers/bulk', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action,
              customerIds,
              companyId,
              ...options
            }),
          })

          if (!response.ok) {
            throw new Error(getLocalizedMessage('BULK_OPERATION_TOO_LARGE'))
          }

          const result: ApiResponse<any> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || getLocalizedMessage('BULK_OPERATION_TOO_LARGE'))
          }

          // Refresh customers after bulk operation
          await get().fetchCustomers(companyId)
          
          set({ loading: false })
          
          return result.data
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : getLocalizedMessage('SYSTEM_OVERLOAD')
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      // Update filters
      updateFilters: (newFilters: any) => {
        const currentFilters = get().filters
        set({ 
          filters: { ...currentFilters, ...newFilters }
        })
      },

      // Clear search results
      clearSearchResults: () => set({ searchResults: [] }),

      clearError: () => set({ error: null }),
    }),
    {
      name: 'customer-store',
      // Persist filters and analytics to localStorage
      partialize: (state) => ({ 
        filters: state.filters,
        analytics: state.analytics 
      })
    }
  )
)