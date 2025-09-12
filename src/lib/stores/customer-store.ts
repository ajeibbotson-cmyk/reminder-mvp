import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Customer } from '@prisma/client'
import { CustomerState, CustomerWithInvoices, ApiResponse } from '../types/store'

export const useCustomerStore = create<CustomerState>()(
  devtools(
    (set, get) => ({
      customers: [],
      loading: false,
      error: null,
      totalCount: 0,

      fetchCustomers: async (companyId: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/customers?companyId=${companyId}`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch customers: ${response.statusText}`)
          }

          const result: ApiResponse<{ customers: CustomerWithInvoices[], totalCount: number }> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch customers')
          }

          set({ 
            customers: result.data?.customers || [], 
            totalCount: result.data?.totalCount || 0,
            loading: false 
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
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

      clearError: () => set({ error: null }),
    }),
    {
      name: 'customer-store',
    }
  )
)