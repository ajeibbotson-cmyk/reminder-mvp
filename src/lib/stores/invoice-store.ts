import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Invoice, InvoiceStatus } from '@prisma/client'
import { InvoiceState, InvoiceFilters, InvoiceWithDetails, ApiResponse, BulkActionResult } from '../types/store'

export const useInvoiceStore = create<InvoiceState>()(
  devtools(
    (set, get) => ({
      invoices: [],
      loading: false,
      error: null,
      totalCount: 0,

      fetchInvoices: async (filters?: InvoiceFilters) => {
        set({ loading: true, error: null })

        try {
          const searchParams = new URLSearchParams()

          if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
              if (value !== undefined && value !== null) {
                if (value instanceof Date) {
                  searchParams.append(key, value.toISOString())
                } else {
                  searchParams.append(key, value.toString())
                }
              }
            })
          }

          const response = await fetch(`/api/invoices?${searchParams}`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch invoices: ${response.statusText}`)
          }

          const result: ApiResponse<{ invoices: InvoiceWithDetails[], totalCount: number }> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch invoices')
          }

          set({ 
            invoices: result.data?.invoices || [], 
            totalCount: result.data?.totalCount || 0,
            loading: false 
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      addInvoice: async (invoiceData) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoiceData),
          })

          if (!response.ok) {
            throw new Error(`Failed to create invoice: ${response.statusText}`)
          }

          const result: ApiResponse<Invoice> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to create invoice')
          }

          const newInvoice = result.data!
          
          // Re-fetch invoices to get complete data with relations
          await get().fetchInvoices()
          
          set({ loading: false })
          return newInvoice
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      updateInvoice: async (id: string, updates) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/invoices/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          })

          if (!response.ok) {
            throw new Error(`Failed to update invoice: ${response.statusText}`)
          }

          const result: ApiResponse<Invoice> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to update invoice')
          }

          // Update the invoice in local state
          set(state => ({
            invoices: state.invoices.map(invoice =>
              invoice.id === id ? { ...invoice, ...updates } : invoice
            ),
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      updateInvoiceStatus: async (id: string, status: InvoiceStatus) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/invoices/${id}/status`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status }),
          })

          if (!response.ok) {
            throw new Error(`Failed to update invoice status: ${response.statusText}`)
          }

          const result: ApiResponse<Invoice> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to update invoice status')
          }

          // Update the invoice status in local state
          set(state => ({
            invoices: state.invoices.map(invoice =>
              invoice.id === id ? { ...invoice, status } : invoice
            ),
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      deleteInvoice: async (id: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/invoices/${id}`, {
            method: 'DELETE',
          })

          if (!response.ok) {
            throw new Error(`Failed to delete invoice: ${response.statusText}`)
          }

          const result: ApiResponse<void> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to delete invoice')
          }

          // Remove the invoice from local state
          set(state => ({
            invoices: state.invoices.filter(invoice => invoice.id !== id),
            totalCount: state.totalCount - 1,
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      getInvoiceById: (id: string) => {
        const { invoices } = get()
        return invoices.find(invoice => invoice.id === id) || null
      },

      bulkUpdateStatus: async (invoiceIds: string[], status: InvoiceStatus) => {
        set({ loading: true, error: null })

        try {
          const response = await fetch('/api/invoices/bulk-update-status', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              invoiceIds,
              status
            }),
          })

          if (!response.ok) {
            throw new Error(`Failed to bulk update invoice status: ${response.statusText}`)
          }

          const result = await response.json()

          if (!result.success) {
            throw new Error(result.error || 'Failed to bulk update invoice status')
          }

          // Update the invoice statuses in local state
          set(state => ({
            invoices: state.invoices.map(invoice =>
              invoiceIds.includes(invoice.id) ? { ...invoice, status } : invoice
            ),
            loading: false
          }))

          return {
            action: 'bulk-update-status',
            requestedCount: invoiceIds.length,
            processedCount: result.data?.processedCount || invoiceIds.length,
            successCount: result.data?.successCount || invoiceIds.length,
            failureCount: result.data?.failureCount || 0,
            results: result.data?.results || [],
            errors: result.data?.errors || []
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'invoice-store',
    }
  )
)