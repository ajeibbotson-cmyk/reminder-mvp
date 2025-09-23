/**
 * Zustand state management store for customer consolidation functionality
 * Integrates with existing store patterns and provides comprehensive state management
 * for consolidation queue, analytics, and email operations
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import {
  ConsolidationCandidate,
  ConsolidatedReminder,
  ConsolidationMetrics,
  ConsolidationQueueFilters,
  BulkOperationResult,
  ConsolidationApiResponse,
  ConsolidationDashboardData,
  CustomerConsolidationHistory,
  ConsolidatedEmailOptions
} from '../types/consolidation'
import {
  ConsolidationQueueUIState,
  ConsolidationAnalyticsUIState,
  ConsolidationEmailUIState,
  BulkActionType,
  MetricsTimeframe,
  ConsolidationCandidateStats,
  ConsolidationFilterPreset
} from '../types/consolidation-ui'

// =============================================================================
// STORE STATE INTERFACES
// =============================================================================

/**
 * Main consolidation store state combining all sub-states
 */
export interface ConsolidationStoreState {
  // Core data
  candidates: ConsolidationCandidate[]
  reminders: ConsolidatedReminder[]
  metrics: ConsolidationMetrics | null
  dashboardData: ConsolidationDashboardData | null

  // UI state
  queue: ConsolidationQueueUIState
  analytics: ConsolidationAnalyticsUIState
  email: ConsolidationEmailUIState

  // Global states
  initialized: boolean
  lastUpdated: Date | null
  companyId: string | null

  // Actions
  initializeStore: (companyId: string) => Promise<void>
  refreshAllData: () => Promise<void>
  cleanup: () => void

  // Queue actions
  loadCandidates: (filters?: ConsolidationQueueFilters) => Promise<void>
  selectCustomers: (customerIds: string[], selected?: boolean) => void
  selectAllCustomers: (selected?: boolean) => void
  clearSelection: () => void
  updateFilters: (filters: Partial<ConsolidationQueueFilters>) => void
  resetFilters: () => void
  sortCandidates: (field: string, order?: 'asc' | 'desc') => void

  // Bulk actions
  executeBulkAction: (action: BulkActionType, customerIds: string[], options?: any) => Promise<BulkOperationResult>
  sendConsolidatedReminders: (customerIds: string[], options?: Partial<ConsolidatedEmailOptions>) => Promise<BulkOperationResult>
  scheduleConsolidatedReminders: (customerIds: string[], scheduledFor: Date, options?: any) => Promise<BulkOperationResult>

  // Individual actions
  sendIndividualReminder: (customerId: string, options?: any) => Promise<void>
  previewConsolidation: (customerId: string, templateId?: string) => Promise<void>
  updateCustomerPriority: (customerId: string, priority: number) => Promise<void>

  // Analytics actions
  loadMetrics: (timeframe: MetricsTimeframe) => Promise<void>
  loadDashboardData: () => Promise<void>
  exportMetrics: (format: 'csv' | 'xlsx' | 'pdf') => Promise<string>

  // Email actions
  loadEmailTemplates: () => Promise<void>
  generateEmailPreview: (customerId: string, templateId: string, language: 'en' | 'ar') => Promise<void>
  sendPreviewEmail: (customerId: string) => Promise<void>

  // Filter presets
  saveFilterPreset: (name: string, filters: ConsolidationQueueFilters) => Promise<void>
  loadFilterPresets: () => Promise<void>
  applyFilterPreset: (presetId: string) => void
  deleteFilterPreset: (presetId: string) => Promise<void>

  // Customer history
  loadCustomerHistory: (customerId: string) => Promise<CustomerConsolidationHistory>
  updateContactStatus: (customerId: string, contacted: boolean) => Promise<void>

  // Error handling
  clearErrors: () => void
  setError: (section: string, error: string) => void
}

// =============================================================================
// DEFAULT STATES
// =============================================================================

const defaultQueueState: ConsolidationQueueUIState = {
  candidates: [],
  selectedCustomers: [],
  expandedCustomers: [],
  view: 'table',
  sortBy: 'priority',
  sortOrder: 'desc',
  filters: {
    priority: 'all',
    escalationLevel: 'all',
    contactEligibility: 'all',
    searchQuery: ''
  },
  searchQuery: '',
  currentPage: 1,
  itemsPerPage: 50,
  totalItems: 0,
  loading: false,
  refreshing: false,
  loadingActions: new Set(),
  error: null,
  actionErrors: {},
  previewCustomerId: null,
  previewLoading: false,
  previewError: null
}

const defaultAnalyticsState: ConsolidationAnalyticsUIState = {
  metrics: null,
  historicalData: [],
  chartData: {},
  timeframe: '30d',
  selectedCharts: ['effectiveness', 'volume-reduction'],
  comparisonMode: false,
  loading: false,
  refreshing: false,
  error: null,
  exportInProgress: false
}

const defaultEmailState: ConsolidationEmailUIState = {
  previewData: null,
  availableTemplates: [],
  selectedTemplateId: null,
  selectedLanguage: 'en',
  schedulingMode: false,
  scheduledFor: null,
  scheduleOptions: {
    respectBusinessHours: true,
    avoidHolidays: true,
    avoidPrayerTimes: true,
    timezone: 'Asia/Dubai',
    maxDelay: 24
  },
  includeAttachments: true,
  attachmentSettings: {
    includeIndividualInvoices: true,
    includeConsolidatedStatement: false,
    maxTotalSize: 25,
    compressionLevel: 'medium',
    format: 'pdf'
  },
  loading: false,
  sending: false,
  error: null,
  validationErrors: {}
}

// =============================================================================
// MAIN STORE IMPLEMENTATION
// =============================================================================

export const useConsolidationStore = create<ConsolidationStoreState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      candidates: [],
      reminders: [],
      metrics: null,
      dashboardData: null,
      queue: defaultQueueState,
      analytics: defaultAnalyticsState,
      email: defaultEmailState,
      initialized: false,
      lastUpdated: null,
      companyId: null,

      // =======================================================================
      // INITIALIZATION AND CLEANUP
      // =======================================================================

      initializeStore: async (companyId: string) => {
        set((state) => {
          state.companyId = companyId
          state.initialized = false
        })

        try {
          await Promise.all([
            get().loadCandidates(),
            get().loadMetrics('30d'),
            get().loadDashboardData(),
            get().loadEmailTemplates(),
            get().loadFilterPresets()
          ])

          set((state) => {
            state.initialized = true
            state.lastUpdated = new Date()
          })
        } catch (error) {
          console.error('Failed to initialize consolidation store:', error)
          get().setError('initialization', 'Failed to initialize consolidation data')
        }
      },

      refreshAllData: async () => {
        set((state) => {
          state.queue.refreshing = true
          state.analytics.refreshing = true
        })

        try {
          await Promise.all([
            get().loadCandidates(get().queue.filters),
            get().loadMetrics(get().analytics.timeframe),
            get().loadDashboardData()
          ])

          set((state) => {
            state.lastUpdated = new Date()
          })
        } catch (error) {
          console.error('Failed to refresh consolidation data:', error)
          get().setError('refresh', 'Failed to refresh data')
        } finally {
          set((state) => {
            state.queue.refreshing = false
            state.analytics.refreshing = false
          })
        }
      },

      cleanup: () => {
        set((state) => {
          state.candidates = []
          state.reminders = []
          state.metrics = null
          state.dashboardData = null
          state.queue = { ...defaultQueueState }
          state.analytics = { ...defaultAnalyticsState }
          state.email = { ...defaultEmailState }
          state.initialized = false
          state.lastUpdated = null
          state.companyId = null
        })
      },

      // =======================================================================
      // QUEUE MANAGEMENT
      // =======================================================================

      loadCandidates: async (filters?: ConsolidationQueueFilters) => {
        const { companyId } = get()
        if (!companyId) return

        set((state) => {
          state.queue.loading = true
          state.queue.error = null
          if (filters) {
            state.queue.filters = { ...state.queue.filters, ...filters }
          }
        })

        try {
          const queryParams = new URLSearchParams()
          const currentFilters = get().queue.filters

          Object.entries(currentFilters).forEach(([key, value]) => {
            if (value && value !== 'all' && value !== '') {
              queryParams.append(key, String(value))
            }
          })

          const response = await fetch(`/api/consolidation/candidates?${queryParams}`)
          const data: ConsolidationApiResponse<{
            candidates: ConsolidationCandidate[]
            summary: ConsolidationCandidateStats
          }> = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Failed to load candidates')
          }

          set((state) => {
            state.candidates = data.data!.candidates
            state.queue.candidates = data.data!.candidates
            state.queue.totalItems = data.data!.candidates.length
            state.queue.loading = false
          })
        } catch (error) {
          console.error('Failed to load consolidation candidates:', error)
          set((state) => {
            state.queue.loading = false
            state.queue.error = error instanceof Error ? error.message : 'Failed to load candidates'
          })
        }
      },

      selectCustomers: (customerIds: string[], selected = true) => {
        set((state) => {
          if (selected) {
            customerIds.forEach(id => {
              if (!state.queue.selectedCustomers.includes(id)) {
                state.queue.selectedCustomers.push(id)
              }
            })
          } else {
            state.queue.selectedCustomers = state.queue.selectedCustomers.filter(
              id => !customerIds.includes(id)
            )
          }
        })
      },

      selectAllCustomers: (selected = true) => {
        set((state) => {
          if (selected) {
            state.queue.selectedCustomers = state.queue.candidates.map(c => c.customerId)
          } else {
            state.queue.selectedCustomers = []
          }
        })
      },

      clearSelection: () => {
        set((state) => {
          state.queue.selectedCustomers = []
          state.queue.expandedCustomers = []
        })
      },

      updateFilters: (filters: Partial<ConsolidationQueueFilters>) => {
        set((state) => {
          state.queue.filters = { ...state.queue.filters, ...filters }
          state.queue.currentPage = 1
        })

        // Reload data with new filters
        get().loadCandidates()
      },

      resetFilters: () => {
        const defaultFilters: ConsolidationQueueFilters = {
          priority: 'all',
          escalationLevel: 'all',
          contactEligibility: 'all',
          searchQuery: ''
        }

        set((state) => {
          state.queue.filters = defaultFilters
          state.queue.searchQuery = ''
          state.queue.currentPage = 1
        })

        get().loadCandidates()
      },

      sortCandidates: (field: string, order = 'desc') => {
        set((state) => {
          state.queue.sortBy = field as any
          state.queue.sortOrder = order

          // Sort candidates in memory
          state.queue.candidates.sort((a, b) => {
            let aValue: any
            let bValue: any

            switch (field) {
              case 'priority':
                aValue = a.priorityScore
                bValue = b.priorityScore
                break
              case 'total-amount':
                aValue = a.totalAmount
                bValue = b.totalAmount
                break
              case 'invoice-count':
                aValue = a.overdueInvoices.length
                bValue = b.overdueInvoices.length
                break
              case 'oldest-invoice':
                aValue = a.oldestInvoiceDays
                bValue = b.oldestInvoiceDays
                break
              case 'customer-name':
                aValue = a.customerName.toLowerCase()
                bValue = b.customerName.toLowerCase()
                break
              case 'last-contact':
                aValue = a.lastContactDate?.getTime() || 0
                bValue = b.lastContactDate?.getTime() || 0
                break
              default:
                return 0
            }

            if (order === 'asc') {
              return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
            } else {
              return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
            }
          })
        })
      },

      // =======================================================================
      // BULK ACTIONS
      // =======================================================================

      executeBulkAction: async (action: BulkActionType, customerIds: string[], options?: any) => {
        switch (action) {
          case 'send-now':
            return get().sendConsolidatedReminders(customerIds, options)
          case 'schedule':
            return get().scheduleConsolidatedReminders(customerIds, options?.scheduledFor, options)
          case 'pause':
            return get().pauseCustomerConsolidations(customerIds, options?.reason)
          case 'export':
            return get().exportCustomerData(customerIds, options?.format)
          default:
            throw new Error(`Unsupported bulk action: ${action}`)
        }
      },

      sendConsolidatedReminders: async (customerIds: string[], options?: Partial<ConsolidatedEmailOptions>) => {
        const { companyId } = get()
        if (!companyId) throw new Error('Company ID not set')

        // Mark customers as loading
        set((state) => {
          customerIds.forEach(id => state.queue.loadingActions.add(id))
        })

        try {
          const response = await fetch('/api/consolidation/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerIds,
              templateOverride: options?.templateId,
              ...options
            })
          })

          const result: ConsolidationApiResponse<BulkOperationResult> = await response.json()

          if (!result.success) {
            throw new Error(result.error || 'Failed to send reminders')
          }

          // Update local state to reflect sent reminders
          set((state) => {
            result.data!.results.forEach(({ customerId, success, error }) => {
              if (success) {
                // Remove from candidates or update status
                const candidateIndex = state.queue.candidates.findIndex(c => c.customerId === customerId)
                if (candidateIndex >= 0) {
                  state.queue.candidates[candidateIndex].lastContactDate = new Date()
                  state.queue.candidates[candidateIndex].canContact = false
                }
              } else if (error) {
                state.queue.actionErrors[customerId] = error
              }
            })
          })

          return result.data!
        } catch (error) {
          console.error('Failed to send consolidated reminders:', error)
          throw error
        } finally {
          // Remove loading state
          set((state) => {
            customerIds.forEach(id => state.queue.loadingActions.delete(id))
          })
        }
      },

      scheduleConsolidatedReminders: async (customerIds: string[], scheduledFor: Date, options?: any) => {
        const { companyId } = get()
        if (!companyId) throw new Error('Company ID not set')

        try {
          const response = await fetch('/api/consolidation/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customerIds,
              scheduledFor: scheduledFor.toISOString(),
              ...options
            })
          })

          const result: ConsolidationApiResponse<BulkOperationResult> = await response.json()

          if (!result.success) {
            throw new Error(result.error || 'Failed to schedule reminders')
          }

          return result.data!
        } catch (error) {
          console.error('Failed to schedule consolidated reminders:', error)
          throw error
        }
      },

      // Helper methods for bulk actions
      pauseCustomerConsolidations: async (customerIds: string[], reason?: string): Promise<BulkOperationResult> => {
        // Implementation would call API to pause consolidations
        throw new Error('Not implemented')
      },

      exportCustomerData: async (customerIds: string[], format = 'csv'): Promise<BulkOperationResult> => {
        // Implementation would call API to export data
        throw new Error('Not implemented')
      },

      // =======================================================================
      // INDIVIDUAL ACTIONS
      // =======================================================================

      sendIndividualReminder: async (customerId: string, options?: any) => {
        await get().sendConsolidatedReminders([customerId], options)
      },

      previewConsolidation: async (customerId: string, templateId?: string) => {
        set((state) => {
          state.queue.previewCustomerId = customerId
          state.queue.previewLoading = true
          state.queue.previewError = null
        })

        try {
          const queryParams = new URLSearchParams()
          if (templateId) queryParams.append('templateId', templateId)

          const response = await fetch(`/api/consolidation/preview/${customerId}?${queryParams}`)
          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Failed to generate preview')
          }

          set((state) => {
            state.email.previewData = data.data.emailPreview
            state.queue.previewLoading = false
          })
        } catch (error) {
          console.error('Failed to preview consolidation:', error)
          set((state) => {
            state.queue.previewLoading = false
            state.queue.previewError = error instanceof Error ? error.message : 'Failed to generate preview'
          })
        }
      },

      updateCustomerPriority: async (customerId: string, priority: number) => {
        try {
          const response = await fetch(`/api/consolidation/customers/${customerId}/priority`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ priority })
          })

          if (!response.ok) {
            throw new Error('Failed to update priority')
          }

          // Update local state
          set((state) => {
            const candidate = state.queue.candidates.find(c => c.customerId === customerId)
            if (candidate) {
              candidate.priorityScore = priority
            }
          })
        } catch (error) {
          console.error('Failed to update customer priority:', error)
          throw error
        }
      },

      // =======================================================================
      // ANALYTICS
      // =======================================================================

      loadMetrics: async (timeframe: MetricsTimeframe) => {
        const { companyId } = get()
        if (!companyId) return

        set((state) => {
          state.analytics.loading = true
          state.analytics.timeframe = timeframe
          state.analytics.error = null
        })

        try {
          const response = await fetch(`/api/analytics/consolidation/effectiveness?timeframe=${timeframe}`)
          const data: ConsolidationApiResponse<ConsolidationMetrics> = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Failed to load metrics')
          }

          set((state) => {
            state.metrics = data.data!
            state.analytics.metrics = data.data!
            state.analytics.loading = false
          })
        } catch (error) {
          console.error('Failed to load consolidation metrics:', error)
          set((state) => {
            state.analytics.loading = false
            state.analytics.error = error instanceof Error ? error.message : 'Failed to load metrics'
          })
        }
      },

      loadDashboardData: async () => {
        const { companyId } = get()
        if (!companyId) return

        try {
          const response = await fetch('/api/dashboard/consolidation')
          const data: ConsolidationApiResponse<ConsolidationDashboardData> = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Failed to load dashboard data')
          }

          set((state) => {
            state.dashboardData = data.data!
          })
        } catch (error) {
          console.error('Failed to load dashboard data:', error)
        }
      },

      exportMetrics: async (format: 'csv' | 'xlsx' | 'pdf') => {
        const { companyId } = get()
        if (!companyId) throw new Error('Company ID not set')

        set((state) => {
          state.analytics.exportInProgress = true
        })

        try {
          const response = await fetch(`/api/analytics/consolidation/export?format=${format}`)

          if (!response.ok) {
            throw new Error('Failed to export metrics')
          }

          const blob = await response.blob()
          const url = URL.createObjectURL(blob)

          set((state) => {
            state.analytics.lastExportedAt = new Date()
          })

          return url
        } catch (error) {
          console.error('Failed to export metrics:', error)
          throw error
        } finally {
          set((state) => {
            state.analytics.exportInProgress = false
          })
        }
      },

      // =======================================================================
      // EMAIL FUNCTIONALITY
      // =======================================================================

      loadEmailTemplates: async () => {
        try {
          const response = await fetch('/api/email-templates/consolidation')
          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Failed to load templates')
          }

          set((state) => {
            state.email.availableTemplates = data.data
          })
        } catch (error) {
          console.error('Failed to load email templates:', error)
        }
      },

      generateEmailPreview: async (customerId: string, templateId: string, language: 'en' | 'ar') => {
        set((state) => {
          state.email.loading = true
          state.email.error = null
          state.email.selectedTemplateId = templateId
          state.email.selectedLanguage = language
        })

        try {
          const response = await fetch(`/api/consolidation/preview/${customerId}?templateId=${templateId}&language=${language}`)
          const data = await response.json()

          if (!data.success) {
            throw new Error(data.error || 'Failed to generate preview')
          }

          set((state) => {
            state.email.previewData = data.data.emailPreview
            state.email.loading = false
          })
        } catch (error) {
          console.error('Failed to generate email preview:', error)
          set((state) => {
            state.email.loading = false
            state.email.error = error instanceof Error ? error.message : 'Failed to generate preview'
          })
        }
      },

      sendPreviewEmail: async (customerId: string) => {
        const { email: emailState } = get()
        if (!emailState.selectedTemplateId) {
          throw new Error('No template selected')
        }

        set((state) => {
          state.email.sending = true
          state.email.error = null
        })

        try {
          await get().sendIndividualReminder(customerId, {
            templateId: emailState.selectedTemplateId,
            language: emailState.selectedLanguage,
            attachmentSettings: emailState.attachmentSettings,
            schedulingOptions: emailState.scheduleOptions
          })

          set((state) => {
            state.email.sending = false
            state.queue.previewCustomerId = null
            state.email.previewData = null
          })
        } catch (error) {
          console.error('Failed to send preview email:', error)
          set((state) => {
            state.email.sending = false
            state.email.error = error instanceof Error ? error.message : 'Failed to send email'
          })
        }
      },

      // =======================================================================
      // FILTER PRESETS
      // =======================================================================

      saveFilterPreset: async (name: string, filters: ConsolidationQueueFilters) => {
        // Implementation would save to API/localStorage
        console.log('Saving filter preset:', name, filters)
      },

      loadFilterPresets: async () => {
        // Implementation would load from API/localStorage
        console.log('Loading filter presets')
      },

      applyFilterPreset: (presetId: string) => {
        // Implementation would apply saved preset
        console.log('Applying filter preset:', presetId)
      },

      deleteFilterPreset: async (presetId: string) => {
        // Implementation would delete from API/localStorage
        console.log('Deleting filter preset:', presetId)
      },

      // =======================================================================
      // CUSTOMER HISTORY
      // =======================================================================

      loadCustomerHistory: async (customerId: string): Promise<CustomerConsolidationHistory> => {
        const response = await fetch(`/api/consolidation/customers/${customerId}/history`)
        const data = await response.json()

        if (!data.success) {
          throw new Error(data.error || 'Failed to load customer history')
        }

        return data.data
      },

      updateContactStatus: async (customerId: string, contacted: boolean) => {
        try {
          const response = await fetch(`/api/consolidation/customers/${customerId}/contact`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contacted, contactedAt: new Date().toISOString() })
          })

          if (!response.ok) {
            throw new Error('Failed to update contact status')
          }

          // Update local state
          set((state) => {
            const candidate = state.queue.candidates.find(c => c.customerId === customerId)
            if (candidate) {
              candidate.lastContactDate = contacted ? new Date() : undefined
              candidate.canContact = !contacted
            }
          })
        } catch (error) {
          console.error('Failed to update contact status:', error)
          throw error
        }
      },

      // =======================================================================
      // ERROR HANDLING
      // =======================================================================

      clearErrors: () => {
        set((state) => {
          state.queue.error = null
          state.analytics.error = null
          state.email.error = null
          state.queue.actionErrors = {}
          state.email.validationErrors = {}
        })
      },

      setError: (section: string, error: string) => {
        set((state) => {
          switch (section) {
            case 'queue':
              state.queue.error = error
              break
            case 'analytics':
              state.analytics.error = error
              break
            case 'email':
              state.email.error = error
              break
            default:
              console.error(`Unknown error section: ${section}`)
          }
        })
      }
    }))
  )
)

// =============================================================================
// UTILITY FUNCTIONS AND SELECTORS
// =============================================================================

/**
 * Utility functions for working with consolidation store
 */
export const consolidationStoreUtils = {
  /**
   * Get filtered and sorted candidates
   */
  getFilteredCandidates: (store: ConsolidationStoreState) => {
    const { candidates, filters, sortBy, sortOrder } = store.queue

    let filtered = candidates.filter(candidate => {
      // Apply filters
      if (filters.priority !== 'all') {
        const priority = getPriorityLevel(candidate.priorityScore)
        if (priority !== filters.priority) return false
      }

      if (filters.escalationLevel !== 'all') {
        if (candidate.escalationLevel.toLowerCase() !== filters.escalationLevel) return false
      }

      if (filters.contactEligibility !== 'all') {
        if (filters.contactEligibility === 'eligible' && !candidate.canContact) return false
        if (filters.contactEligibility === 'waiting' && candidate.canContact) return false
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        return (
          candidate.customerName.toLowerCase().includes(query) ||
          candidate.customerEmail.toLowerCase().includes(query) ||
          (candidate.companyName && candidate.companyName.toLowerCase().includes(query))
        )
      }

      return true
    })

    // Apply sorting (already done in store, but can be used independently)
    return filtered
  },

  /**
   * Get summary statistics for current view
   */
  getSummaryStats: (candidates: ConsolidationCandidate[]) => {
    return {
      total: candidates.length,
      eligible: candidates.filter(c => c.canContact).length,
      totalOutstanding: candidates.reduce((sum, c) => sum + c.totalAmount, 0),
      emailsSaved: candidates.reduce((sum, c) => sum + c.overdueInvoices.length - 1, 0),
      highPriority: candidates.filter(c => getPriorityLevel(c.priorityScore) === 'high').length,
      averagePriority: candidates.length > 0
        ? candidates.reduce((sum, c) => sum + c.priorityScore, 0) / candidates.length
        : 0
    }
  },

  /**
   * Check if bulk actions are available
   */
  canPerformBulkActions: (selectedCustomers: string[], candidates: ConsolidationCandidate[]) => {
    if (selectedCustomers.length === 0) return false

    const selectedCandidates = candidates.filter(c => selectedCustomers.includes(c.customerId))
    return {
      send: selectedCandidates.some(c => c.canContact),
      schedule: selectedCandidates.length > 0,
      export: selectedCandidates.length > 0,
      pause: selectedCandidates.length > 0
    }
  }
}

/**
 * Helper function to determine priority level from score
 */
function getPriorityLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

/**
 * Selector hooks for specific store slices
 */
export const useConsolidationQueue = () => useConsolidationStore(state => state.queue)
export const useConsolidationAnalytics = () => useConsolidationStore(state => state.analytics)
export const useConsolidationEmail = () => useConsolidationStore(state => state.email)
export const useConsolidationCandidates = () => useConsolidationStore(state => state.candidates)
export const useConsolidationMetrics = () => useConsolidationStore(state => state.metrics)

/**
 * Action hooks for common operations
 */
export const useConsolidationActions = () => {
  return useConsolidationStore(state => ({
    initializeStore: state.initializeStore,
    refreshAllData: state.refreshAllData,
    loadCandidates: state.loadCandidates,
    selectCustomers: state.selectCustomers,
    executeBulkAction: state.executeBulkAction,
    sendConsolidatedReminders: state.sendConsolidatedReminders,
    previewConsolidation: state.previewConsolidation,
    clearErrors: state.clearErrors
  }))
}