import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { ImportBatch, ImportBatchStatus } from '@prisma/client'
import { 
  ImportBatchState, 
  ImportBatchWithDetails, 
  ImportProgress,
  ImportBatchFilters,
  ProcessingOptions,
  ApiResponse 
} from '../types/store'

export const useImportBatchStore = create<ImportBatchState>()(
  devtools(
    (set, get) => ({
      batches: [],
      currentBatch: null,
      progress: null,
      loading: false,
      error: null,
      totalCount: 0,

      fetchBatches: async (companyId: string, filters?: ImportBatchFilters) => {
        set({ loading: true, error: null })
        
        try {
          const searchParams = new URLSearchParams()
          searchParams.append('companyId', companyId)
          
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

          const response = await fetch(`/api/import-batches?${searchParams}`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch import batches: ${response.statusText}`)
          }

          const result: ApiResponse<{ batches: ImportBatchWithDetails[], totalCount: number }> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch import batches')
          }

          set({ 
            batches: result.data?.batches || [], 
            totalCount: result.data?.totalCount || 0,
            loading: false 
          })
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      createBatch: async (batchData) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch('/api/import-batches', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(batchData),
          })

          if (!response.ok) {
            throw new Error(`Failed to create import batch: ${response.statusText}`)
          }

          const result: ApiResponse<ImportBatch> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to create import batch')
          }

          const newBatch = result.data!
          
          // Update local state
          set(state => ({
            batches: [newBatch as ImportBatchWithDetails, ...state.batches],
            currentBatch: newBatch as ImportBatchWithDetails,
            totalCount: state.totalCount + 1,
            loading: false
          }))
          
          return newBatch
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      getBatchById: async (id: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/import-batches/${id}`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch import batch: ${response.statusText}`)
          }

          const result: ApiResponse<ImportBatchWithDetails> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch import batch')
          }

          const batch = result.data!
          
          set({ 
            currentBatch: batch,
            loading: false 
          })
          
          return batch
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      getBatchProgress: async (batchId: string) => {
        try {
          const response = await fetch(`/api/import-batches/${batchId}/progress`)
          
          if (!response.ok) {
            throw new Error(`Failed to fetch batch progress: ${response.statusText}`)
          }

          const result: ApiResponse<ImportProgress> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to fetch batch progress')
          }

          const progress = result.data!
          
          set({ progress })
          
          return progress
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage })
          return null
        }
      },

      startProcessing: async (batchId: string, options?: ProcessingOptions) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/import-batches/${batchId}/process`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options || {}),
          })

          if (!response.ok) {
            throw new Error(`Failed to start processing: ${response.statusText}`)
          }

          const result: ApiResponse<ImportProgress> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to start processing')
          }

          const progress = result.data!
          
          set({ 
            progress,
            loading: false 
          })
          
          // Update batch status in local state
          set(state => ({
            batches: state.batches.map(batch =>
              batch.id === batchId 
                ? { ...batch, status: ImportBatchStatus.PROCESSING }
                : batch
            ),
            currentBatch: state.currentBatch?.id === batchId
              ? { ...state.currentBatch, status: ImportBatchStatus.PROCESSING }
              : state.currentBatch
          }))
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      cancelBatch: async (batchId: string) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/import-batches/${batchId}/cancel`, {
            method: 'POST',
          })

          if (!response.ok) {
            throw new Error(`Failed to cancel batch: ${response.statusText}`)
          }

          const result: ApiResponse<void> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to cancel batch')
          }

          // Update batch status in local state
          set(state => ({
            batches: state.batches.map(batch =>
              batch.id === batchId 
                ? { ...batch, status: ImportBatchStatus.CANCELLED }
                : batch
            ),
            currentBatch: state.currentBatch?.id === batchId
              ? { ...state.currentBatch, status: ImportBatchStatus.CANCELLED }
              : state.currentBatch,
            loading: false
          }))
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      clearError: () => set({ error: null }),
      
      clearProgress: () => set({ progress: null }),

      // Additional helper methods for file upload and processing
      uploadFile: async (file: File, companyId: string) => {
        set({ loading: true, error: null })
        
        try {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('companyId', companyId)

          const response = await fetch('/api/import-batches/upload', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error(`Failed to upload file: ${response.statusText}`)
          }

          const result: ApiResponse<{ batchId: string, headers: string[], sampleData: Record<string, any>[] }> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to upload file')
          }

          set({ loading: false })
          
          return result.data!
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      processImport: async (batchId: string, options: { fieldMappings?: Record<string, string>, hasHeaders?: boolean, skipEmptyRows?: boolean }) => {
        set({ loading: true, error: null })
        
        try {
          const response = await fetch(`/api/import-batches/${batchId}/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
          })

          if (!response.ok) {
            throw new Error(`Failed to process import: ${response.statusText}`)
          }

          const result: ApiResponse<ImportProgress> = await response.json()
          
          if (!result.success) {
            throw new Error(result.error || 'Failed to process import')
          }

          const progress = result.data!
          
          set({ 
            progress,
            loading: false 
          })
          
          return progress
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
          set({ error: errorMessage, loading: false })
          throw error
        }
      },

      // Helper method for getting progress percentage
      getProgress: async (batchId: string) => {
        try {
          const response = await fetch(`/api/import-batches/${batchId}/status`)
          
          if (!response.ok) {
            return null
          }

          const result: ApiResponse<{ progress: number, status: ImportBatchStatus, processedCount: number, totalRecords: number }> = await response.json()
          
          if (!result.success || !result.data) {
            return null
          }

          return {
            progress: result.data.progress,
            status: result.data.status,
            processedCount: result.data.processedCount,
            totalRecords: result.data.totalRecords
          }
        } catch (error) {
          return null
        }
      },

      // Method to check if current user can perform import operations
      canImport: (userRole?: string) => {
        // Add role-based access control if needed
        return true
      }
    }),
    {
      name: 'import-batch-store',
    }
  )
)